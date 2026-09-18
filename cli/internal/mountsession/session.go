package mountsession

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/heypoom/patchies/cli/internal/client"
	"github.com/heypoom/patchies/cli/internal/mount"
	"github.com/heypoom/patchies/cli/internal/protocol"
)

const reconnectDelay = 500 * time.Millisecond

type remoteClient interface {
	Attach(context.Context) (client.SessionSnapshot, error)
	SubmitOperation(context.Context, string, client.OperationRequest) error
	StreamEvents(context.Context, string, int64, func(client.Event) error) error
}

type Session struct {
	path   string
	remote remoteClient
}

type pendingOperation struct {
	content     string
	operationID string
	path        string
}

type submitResult struct {
	err         error
	operationID string
}

type sessionRunState struct {
	cursor   int64
	inFlight *pendingOperation
	pending  map[string]string
	unsynced map[string]string
}

func New(connection protocol.Connection, path string) *Session {
	return &Session{path: path, remote: client.New(connection)}
}

func (s *Session) Run(ctx context.Context) error {
	absolute, err := filepath.Abs(s.path)
	if err != nil {
		return err
	}
	s.path = absolute
	if info, err := os.Lstat(s.path); err == nil {
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return errors.New("mount path must be a real directory")
		}
		entries, err := os.ReadDir(s.path)
		if err != nil {
			return err
		}
		if len(entries) != 0 {
			return errors.New("mount directory must be empty")
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	if err := os.MkdirAll(s.path, 0o755); err != nil {
		return fmt.Errorf("create mount directory: %w", err)
	}

	watcher, err := mount.NewWatcher(s.path)
	if err != nil {
		return err
	}
	defer func() {
		if err := watcher.Close(); err != nil {
			fmt.Fprintln(os.Stderr, "patchies: close filesystem watcher:", err)
		}
	}()

	fmt.Fprintf(os.Stderr, "patchies: mounted %s; waiting for browser snapshot\n", s.path)

	state := &sessionRunState{pending: make(map[string]string), unsynced: make(map[string]string)}

	for ctx.Err() == nil {
		snapshot, err := s.attach(ctx)
		if err != nil {
			return err
		}

		reconnect, err := s.runAttached(ctx, watcher, snapshot, state)
		if err != nil {
			return err
		}
		if !reconnect {
			return nil
		}
		if err := wait(ctx, reconnectDelay); err != nil {
			return nil
		}
		fmt.Fprintln(os.Stderr, "patchies: remote control stream reconnected")
	}

	return nil
}

func (s *Session) runAttached(ctx context.Context, watcher *mount.Watcher, snapshot client.SessionSnapshot, state *sessionRunState) (bool, error) {
	generation := snapshot.BrowserGeneration
	revision := snapshot.PatchRevision
	active := false
	events := make(chan client.Event, 32)
	streamErrors := make(chan error, 1)
	submitResults := make(chan submitResult, 1)
	streamContext, cancelStream := context.WithCancel(ctx)
	defer cancelStream()

	go func() {
		streamErrors <- s.remote.StreamEvents(streamContext, snapshot.ClientID, state.cursor, func(event client.Event) error {
			select {
			case events <- event:
				return nil
			case <-streamContext.Done():
				return streamContext.Err()
			}
		})
	}()

	submitNext := func() {
		if !active || state.inFlight != nil || len(state.pending) == 0 {
			return
		}

		paths := make([]string, 0, len(state.pending))
		for path := range state.pending {
			paths = append(paths, path)
		}
		sort.Strings(paths)

		operationID, err := randomID()
		if err != nil {
			select {
			case submitResults <- submitResult{err: fmt.Errorf("generate operation ID: %w", err)}:
			default:
			}
			return
		}

		path := paths[0]
		operation := &pendingOperation{content: state.pending[path], operationID: operationID, path: path}
		delete(state.pending, path)
		state.inFlight = operation

		request := client.OperationRequest{
			OperationID:       operationID,
			BrowserGeneration: generation,
			BaseRevision:      revision,
			Path:              operation.path,
			Content:           operation.content,
		}
		go func() {
			err := s.remote.SubmitOperation(streamContext, snapshot.ClientID, request)
			select {
			case submitResults <- submitResult{operationID: operationID, err: err}:
			case <-streamContext.Done():
			}
		}()
	}

	for {
		select {
		case <-ctx.Done():
			return false, nil
		case change := <-watcher.Changes():
			state.pending[change.Path] = change.Content
			delete(state.unsynced, change.Path)
			submitNext()
		case watcherError := <-watcher.Errors():
			fmt.Fprintln(os.Stderr, "patchies: filesystem watcher:", watcherError)
		case result := <-submitResults:
			if state.inFlight == nil || state.inFlight.operationID != result.operationID {
				continue
			}
			if result.err == nil {
				continue
			}

			state.collectLocal(watcher)
			state.requeue()
			fmt.Fprintln(os.Stderr, "patchies: submit local change:", result.err)

			return true, nil
		case event := <-events:
			state.collectLocal(watcher)
			if event.ID > state.cursor {
				state.cursor = event.ID
			}

			if event.Type == "session.reclaimed" {
				state.requeue()

				return true, nil
			}

			if representation, ok, err := representationFromEvent(event); err != nil {
				return false, err
			} else if ok {
				if representation.PatchID != snapshot.PatchID {
					return false, errors.New("snapshot belongs to a different patch")
				}
				discardDeletedPendingWrites(state.pending, representation)
				discardDeletedPendingWrites(state.unsynced, representation)
				if err := watcher.ApplySnapshot(representation); err != nil {
					return false, err
				}
				generation, revision = eventState(event, generation, revision)
				if err := state.preserveLocal(watcher); err != nil {
					return false, err
				}
				active = true
				submitNext()
				fmt.Fprintf(os.Stderr, "patchies: synchronized patch revision from %s\n", event.Type)

				continue
			}

			commit, ok, err := commitFromEvent(event)
			if err != nil {
				return false, err
			}
			if !ok || commit.BrowserGeneration != generation {
				continue
			}
			if err := applyCommit(watcher, commit); err != nil {
				return false, err
			}
			for _, change := range commit.Changes {
				if !bytes.Equal(bytes.TrimSpace(change.Entry), []byte("null")) {
					continue
				}
				for path := range state.pending {
					if path == change.Path || strings.HasPrefix(path, change.Path+"/") {
						delete(state.pending, path)
					}
				}
				for path := range state.unsynced {
					if path == change.Path || strings.HasPrefix(path, change.Path+"/") {
						delete(state.unsynced, path)
					}
				}
				if state.inFlight != nil && (state.inFlight.path == change.Path || strings.HasPrefix(state.inFlight.path, change.Path+"/")) {
					state.inFlight = nil
				}
			}
			revision = commit.PatchRevision
			if state.inFlight != nil && commit.OperationID == state.inFlight.operationID {
				if commit.Error != "" {
					state.unsynced[state.inFlight.path] = state.inFlight.content
					fmt.Fprintf(os.Stderr, "patchies: unsynced %s: %s; edit and save to retry\n", state.inFlight.path, commit.Error)
				} else {
					delete(state.unsynced, state.inFlight.path)
				}
				state.inFlight = nil
			}
			if err := state.preserveLocal(watcher); err != nil {
				return false, err
			}
			submitNext()
		case streamError := <-streamErrors:
			if ctx.Err() != nil {
				return false, nil
			}

			var httpError *client.HTTPError
			if errors.As(streamError, &httpError) && httpError.Code == "session_not_found" {
				return false, streamError
			}
			if errors.As(streamError, &httpError) && httpError.Code == "replay_unavailable" {
				state.cursor = 0
			}
			state.collectLocal(watcher)
			state.requeue()

			return true, nil
		}
	}
}

func (state *sessionRunState) collectLocal(watcher *mount.Watcher) {
	for _, change := range watcher.PendingChanges() {
		state.pending[change.Path] = change.Content
		delete(state.unsynced, change.Path)
	}
}

func (state *sessionRunState) requeue() {
	if state.inFlight == nil {
		return
	}
	if _, newer := state.pending[state.inFlight.path]; !newer {
		state.pending[state.inFlight.path] = state.inFlight.content
	}
	state.inFlight = nil
}

func (state *sessionRunState) preserveLocal(watcher *mount.Watcher) error {
	for path, content := range state.unsynced {
		if err := watcher.PreserveLocal(path, content); err != nil {
			return err
		}
	}
	if state.inFlight != nil {
		if err := watcher.PreserveLocal(state.inFlight.path, state.inFlight.content); err != nil {
			return err
		}
	}
	for path, content := range state.pending {
		if err := watcher.PreserveLocal(path, content); err != nil {
			return err
		}
	}
	return nil
}

func (s *Session) attach(ctx context.Context) (client.SessionSnapshot, error) {
	for {
		snapshot, err := s.remote.Attach(ctx)
		if err == nil {
			return snapshot, nil
		}
		if ctx.Err() != nil {
			return client.SessionSnapshot{}, ctx.Err()
		}

		var httpError *client.HTTPError
		if errors.As(err, &httpError) && httpError.Code != "client_attached" {
			return client.SessionSnapshot{}, err
		}
		if err := wait(ctx, reconnectDelay); err != nil {
			return client.SessionSnapshot{}, err
		}
	}
}

func applyCommit(watcher *mount.Watcher, commit client.CanonicalCommit) error {
	changes := append([]client.EntryChange(nil), commit.Changes...)
	sort.SliceStable(changes, func(i, j int) bool {
		iDeleted := bytes.Equal(bytes.TrimSpace(changes[i].Entry), []byte("null"))
		jDeleted := bytes.Equal(bytes.TrimSpace(changes[j].Entry), []byte("null"))
		if iDeleted != jDeleted {
			return iDeleted
		}
		if iDeleted {
			return len(changes[i].Path) > len(changes[j].Path)
		}
		return len(changes[i].Path) < len(changes[j].Path)
	})
	for _, change := range changes {
		if bytes.Equal(bytes.TrimSpace(change.Entry), []byte("null")) {
			if err := watcher.RemoveEntry(change.Path); err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "patchies: removed entry %s\n", change.Path)
			continue
		}

		var entry mount.Entry
		if err := json.Unmarshal(change.Entry, &entry); err != nil {
			return fmt.Errorf("decode committed entry %s: %w", change.Path, err)
		}
		if entry.Path != change.Path {
			return errors.New("committed entry path does not match its change")
		}
		if err := watcher.ApplyEntry(entry); err != nil {
			return err
		}
		fmt.Fprintf(os.Stderr, "patchies: synchronized entry %s\n", change.Path)
	}

	return nil
}

func commitFromEvent(event client.Event) (client.CanonicalCommit, bool, error) {
	if event.Type != "commit.published" {
		return client.CanonicalCommit{}, false, nil
	}

	var commit client.CanonicalCommit
	if err := json.Unmarshal(event.Data, &commit); err != nil {
		return client.CanonicalCommit{}, false, fmt.Errorf("decode canonical commit: %w", err)
	}

	return commit, true, nil
}

func representationFromEvent(event client.Event) (mount.Representation, bool, error) {
	if event.Type != "snapshot.published" {
		return mount.Representation{}, false, nil
	}

	var body struct {
		Representation json.RawMessage `json:"representation"`
	}
	if err := json.Unmarshal(event.Data, &body); err != nil {
		return mount.Representation{}, false, fmt.Errorf("decode %s: %w", event.Type, err)
	}
	if len(body.Representation) == 0 || bytes.Equal(bytes.TrimSpace(body.Representation), []byte("null")) {
		return mount.Representation{}, false, nil
	}

	var representation mount.Representation
	if err := json.Unmarshal(body.Representation, &representation); err != nil {
		return mount.Representation{}, false, fmt.Errorf("decode patch representation: %w", err)
	}

	return representation, true, nil
}

func eventState(event client.Event, generation string, revision int64) (string, int64) {
	var body struct {
		BrowserGeneration string `json:"browserGeneration"`
		PatchRevision     int64  `json:"patchRevision"`
	}
	if err := json.Unmarshal(event.Data, &body); err != nil {
		return generation, revision
	}
	if body.BrowserGeneration != "" {
		generation = body.BrowserGeneration
	}

	return generation, body.PatchRevision
}

func discardDeletedPendingWrites(pending map[string]string, representation mount.Representation) {
	files := make(map[string]struct{}, len(representation.Entries))
	for _, entry := range representation.Entries {
		if entry.Kind == "file" {
			files[entry.Path] = struct{}{}
		}
	}
	for path := range pending {
		if _, ok := files[path]; !ok {
			delete(pending, path)
		}
	}
}

func randomID() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func wait(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

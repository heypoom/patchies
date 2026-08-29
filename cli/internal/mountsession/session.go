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

func New(connection protocol.Connection, path string) *Session {
	return &Session{path: path, remote: client.New(connection)}
}

func (s *Session) Run(ctx context.Context) error {
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

	pending := make(map[string]string)
	var cursor int64
	var inFlight *pendingOperation

	for ctx.Err() == nil {
		snapshot, err := s.attach(ctx)
		if err != nil {
			return err
		}

		generation := snapshot.BrowserGeneration
		revision := snapshot.PatchRevision
		active := false
		events := make(chan client.Event, 32)
		streamErrors := make(chan error, 1)
		submitResults := make(chan submitResult, 1)
		streamContext, cancelStream := context.WithCancel(ctx)

		go func() {
			streamErrors <- s.remote.StreamEvents(streamContext, snapshot.ClientID, cursor, func(event client.Event) error {
				select {
				case events <- event:
					return nil
				case <-streamContext.Done():
					return streamContext.Err()
				}
			})
		}()

		submitNext := func() {
			if !active || inFlight != nil || len(pending) == 0 {
				return
			}

			paths := make([]string, 0, len(pending))
			for path := range pending {
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
			operation := &pendingOperation{content: pending[path], operationID: operationID, path: path}
			delete(pending, path)
			inFlight = operation

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

		reconnect := false
		for !reconnect {
			select {
			case <-ctx.Done():
				cancelStream()
				return nil
			case change := <-watcher.Changes():
				pending[change.Path] = change.Content
				submitNext()
			case watcherError := <-watcher.Errors():
				fmt.Fprintln(os.Stderr, "patchies: filesystem watcher:", watcherError)
			case result := <-submitResults:
				if inFlight == nil || inFlight.operationID != result.operationID {
					continue
				}
				if result.err == nil {
					continue
				}

				pending[inFlight.path] = inFlight.content
				inFlight = nil
				fmt.Fprintln(os.Stderr, "patchies: submit local change:", result.err)
				reconnect = true
			case event := <-events:
				if event.ID > cursor {
					cursor = event.ID
				}

				if event.Type == "session.reclaimed" {
					active = false
					if inFlight != nil {
						pending[inFlight.path] = inFlight.content
						inFlight = nil
					}
					reconnect = true
					continue
				}

				if representation, ok, err := representationFromEvent(event); err != nil {
					cancelStream()
					return err
				} else if ok {
					discardDeletedPendingWrites(pending, representation)
					if err := watcher.ApplySnapshot(representation); err != nil {
						cancelStream()
						return err
					}
					generation, revision = eventState(event, generation, revision)
					active = true
					submitNext()
					fmt.Fprintf(os.Stderr, "patchies: synchronized patch revision from %s\n", event.Type)
					continue
				}

				commit, ok, err := commitFromEvent(event)
				if err != nil {
					cancelStream()
					return err
				}
				if !ok || commit.BrowserGeneration != generation {
					continue
				}
				if err := applyCommit(watcher, commit); err != nil {
					cancelStream()
					return err
				}
				revision = commit.PatchRevision
				if inFlight != nil && commit.OperationID == inFlight.operationID {
					inFlight = nil
				}
				submitNext()
			case streamError := <-streamErrors:
				if ctx.Err() != nil {
					cancelStream()
					return nil
				}
				var httpError *client.HTTPError
				if errors.As(streamError, &httpError) && httpError.Code == "session_not_found" {
					cancelStream()
					return streamError
				}
				if errors.As(streamError, &httpError) && httpError.Code == "replay_unavailable" {
					cursor = 0
				}
				if inFlight != nil {
					pending[inFlight.path] = inFlight.content
					inFlight = nil
				}
				reconnect = true
			}
		}

		cancelStream()
		if err := wait(ctx, reconnectDelay); err != nil {
			return nil
		}
		fmt.Fprintln(os.Stderr, "patchies: remote control stream reconnected")
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
	for _, change := range commit.Changes {
		if bytes.Equal(bytes.TrimSpace(change.Object), []byte("null")) {
			if err := watcher.RemoveObject(change.ObjectID); err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "patchies: removed object %s\n", change.ObjectID)
			continue
		}

		var object mount.RepresentationObject
		if err := json.Unmarshal(change.Object, &object); err != nil {
			return fmt.Errorf("decode committed object %s: %w", change.ObjectID, err)
		}
		if object.ID != change.ObjectID {
			return errors.New("committed object ID does not match its change")
		}
		if err := watcher.ApplyObject(object); err != nil {
			return err
		}
		fmt.Fprintf(os.Stderr, "patchies: synchronized object %s\n", change.ObjectID)
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
	objects := make(map[string]struct{}, len(representation.Objects))
	for _, object := range representation.Objects {
		objects[object.ID] = struct{}{}
	}
	for path := range pending {
		objectID, _, ok := strings.Cut(path, "/")
		if !ok {
			delete(pending, path)
			continue
		}
		if _, ok := objects[objectID]; !ok {
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

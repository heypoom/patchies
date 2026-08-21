package mountsession

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/heypoom/patchies/cli/internal/client"
	"github.com/heypoom/patchies/cli/internal/mount"
	"github.com/heypoom/patchies/cli/internal/protocol"
)

func TestSessionRemainsBidirectionalAcrossAlternatingEdits(t *testing.T) {
	for _, path := range []string{"objects/glsl-24/shader.glsl", "patch/lib/nested/a.js"} {
		t.Run(path, func(t *testing.T) { testAlternatingEdits(t, path) })
	}
}

func TestMountRejectsNonemptyDirectoryBeforeAttaching(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "keep.txt")
	if err := os.WriteFile(path, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	session := &Session{path: root}
	if err := session.Run(t.Context()); err == nil {
		t.Fatal("nonempty mount accepted")
	}
	content, err := os.ReadFile(path)
	if err != nil || string(content) != "keep" {
		t.Fatalf("existing file changed: %q %v", content, err)
	}
}

func TestReconnectKeepsLatestSaveAndRejectedContent(t *testing.T) {
	remote := &controlledClient{
		events: make(chan client.Event, 8), operations: make(chan client.OperationRequest, 8),
		results: make(chan error, 8),
		streams: make(chan struct{}, 8),
	}
	root := t.TempDir()
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- (&Session{path: root, remote: remote}).Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-done:
			if err != nil {
				t.Error(err)
			}
		case <-time.After(3 * time.Second):
			t.Error("session did not stop")
		}
	})
	path := "patch/a.js"
	codePath := filepath.Join(root, path)
	snapshot := func(id int64) {
		data, _ := json.Marshal(map[string]any{"representation": testRepresentation(path, "browser"), "browserGeneration": "browser-1", "patchRevision": 0})
		remote.events <- client.Event{ID: id, Type: "snapshot.published", Data: data}
	}
	<-remote.streams
	snapshot(1)
	waitForFile(t, codePath, "browser")
	if err := os.WriteFile(codePath, []byte("older"), 0o644); err != nil {
		t.Fatal(err)
	}
	_ = receiveOperation(t, remote.operations)
	if err := os.WriteFile(codePath, []byte("newest"), 0o644); err != nil {
		t.Fatal(err)
	}
	remote.results <- errors.New("connection lost")
	select {
	case <-remote.streams:
	case <-time.After(3 * time.Second):
		t.Fatal("stream did not reconnect")
	}
	snapshot(2)
	newest := receiveOperation(t, remote.operations)
	if newest.Content != "newest" {
		t.Fatalf("retried stale content: %q", newest.Content)
	}
	remote.results <- nil

	data, _ := json.Marshal(client.CanonicalCommit{OperationID: newest.OperationID, BrowserGeneration: "browser-1", Error: "write rejected"})
	remote.events <- client.Event{ID: 3, Type: "commit.published", Data: data}
	data, _ = json.Marshal(testCommit(path, "", 0, 1, "browser update"))
	remote.events <- client.Event{ID: 4, Type: "commit.published", Data: data}
	// A later unrelated snapshot provides a synchronization barrier as well as
	// checking that the rejected local content survives reconciliation.
	representation := testRepresentation(path, "browser")
	representation["entries"] = append(representation["entries"].([]any), testEntry("patch/barrier.js", "ready"))
	data, _ = json.Marshal(map[string]any{"representation": representation, "browserGeneration": "browser-1", "patchRevision": 1})
	remote.events <- client.Event{ID: 5, Type: "snapshot.published", Data: data}
	waitForFile(t, filepath.Join(root, "patch/barrier.js"), "ready")
	waitForFile(t, codePath, "newest")
	if err := os.WriteFile(codePath, []byte("fixed"), 0o644); err != nil {
		t.Fatal(err)
	}
	fixed := receiveOperation(t, remote.operations)
	if fixed.Content != "fixed" {
		t.Fatalf("retry = %q", fixed.Content)
	}
	remote.results <- nil
}

type controlledClient struct {
	streams    chan struct{}
	events     chan client.Event
	operations chan client.OperationRequest
	results    chan error
}

func (*controlledClient) Attach(context.Context) (client.SessionSnapshot, error) {
	return client.SessionSnapshot{SessionID: "session-1", PatchID: "patch-1", BrowserGeneration: "browser-1", ClientID: "client-1"}, nil
}

func (remote *controlledClient) SubmitOperation(ctx context.Context, _ string, request client.OperationRequest) error {
	select {
	case remote.operations <- request:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case err := <-remote.results:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (remote *controlledClient) StreamEvents(ctx context.Context, _ string, _ int64, handle func(client.Event) error) error {
	remote.streams <- struct{}{}
	for {
		select {
		case event := <-remote.events:
			if err := handle(event); err != nil {
				return err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func testAlternatingEdits(t *testing.T, path string) {
	events := make(chan testEvent, 8)
	operations := make(chan client.OperationRequest, 4)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/remote-control/sessions/session-1/client":
			writeTestJSON(response, client.SessionSnapshot{
				SessionID:         "session-1",
				PatchID:           "patch-1",
				BrowserGeneration: "browser-1",
				PatchRevision:     0,
				ClientID:          "client-1",
			})
		case request.Method == http.MethodPost && request.URL.Path == "/api/remote-control/sessions/session-1/operations":
			var body struct {
				ClientID string `json:"clientId"`
				client.OperationRequest
			}
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				http.Error(response, err.Error(), http.StatusBadRequest)
				return
			}
			operations <- body.OperationRequest
			response.WriteHeader(http.StatusAccepted)
		case request.Method == http.MethodGet && request.URL.Path == "/api/remote-control/sessions/session-1/client/events":
			response.Header().Set("Content-Type", "text/event-stream")
			response.WriteHeader(http.StatusOK)
			flusher := response.(http.Flusher)
			flusher.Flush()
			for {
				select {
				case event := <-events:
					payload, _ := json.Marshal(event.data)
					_, _ = fmt.Fprintf(response, "id: %d\nevent: %s\ndata: %s\n\n", event.id, event.eventType, payload)
					flusher.Flush()
				case <-request.Context().Done():
					return
				}
			}
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()

	root := t.TempDir()
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() {
		done <- New(protocol.Connection{
			InstanceURL: server.URL,
			SessionID:   "session-1",
			Secret:      "secret-1",
		}, root).Run(ctx)
	}()

	events <- testEvent{id: 1, eventType: "snapshot.published", data: map[string]any{
		"browserGeneration": "browser-1",
		"patchRevision":     0,
		"representation":    testRepresentation(path, "first"),
	}}
	codePath := filepath.Join(root, filepath.FromSlash(path))
	waitForFile(t, codePath, "first")

	if err := os.WriteFile(codePath, []byte("filesystem one"), 0o644); err != nil {
		t.Fatalf("write first filesystem edit: %v", err)
	}
	first := receiveOperation(t, operations)
	if first.BaseRevision != 0 || first.Content != "filesystem one" {
		t.Fatalf("first operation = %#v", first)
	}
	events <- testEvent{id: 2, eventType: "commit.published", data: testCommit(path, first.OperationID, 0, 1, "filesystem one")}
	waitForFile(t, codePath, "filesystem one")

	events <- testEvent{id: 3, eventType: "commit.published", data: testCommit(path, "", 1, 2, "Patchies two")}
	waitForFile(t, codePath, "Patchies two")

	if err := os.WriteFile(codePath, []byte("filesystem three"), 0o644); err != nil {
		t.Fatalf("write second filesystem edit: %v", err)
	}
	second := receiveOperation(t, operations)
	if second.BaseRevision != 2 || second.Content != "filesystem three" {
		t.Fatalf("second operation = %#v", second)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run mount session: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("mount session did not stop")
	}
}

func TestSessionRetriesWhileAStaleClientIsWithinAttachGrace(t *testing.T) {
	remote := &attachSequenceClient{}
	session := &Session{remote: remote}

	snapshot, err := session.attach(t.Context())
	if err != nil {
		t.Fatalf("attach session: %v", err)
	}
	if remote.attempts != 2 {
		t.Fatalf("attach attempts = %d, want 2", remote.attempts)
	}
	if snapshot.ClientID != "client-2" {
		t.Fatalf("client ID = %q, want client-2", snapshot.ClientID)
	}
}

func TestCommitCanReplaceDirectoryWithFile(t *testing.T) {
	root := t.TempDir()
	watcher, err := mount.NewWatcher(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := watcher.Close(); err != nil {
			t.Error(err)
		}
	})
	if err := watcher.ApplySnapshot(mount.Representation{
		Format:  mount.RepresentationVersion,
		Entries: []mount.Entry{{Path: "patch/a/child.js", Kind: "file", Content: "old"}},
	}); err != nil {
		t.Fatal(err)
	}

	err = applyCommit(watcher, client.CanonicalCommit{Changes: []client.EntryChange{
		{Path: "patch/a", Entry: json.RawMessage(`{"path":"patch/a","kind":"file","content":"new"}`)},
		{Path: "patch/a/child.js", Entry: json.RawMessage(`null`)},
	}})
	if err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(root, "patch/a"))
	if err != nil || string(content) != "new" {
		t.Fatalf("replacement = %q: %v", content, err)
	}
}

type attachSequenceClient struct {
	attempts int
}

func (remote *attachSequenceClient) Attach(context.Context) (client.SessionSnapshot, error) {
	remote.attempts++

	if remote.attempts == 1 {
		return client.SessionSnapshot{}, &client.HTTPError{
			Status: http.StatusConflict,
			Code:   "client_attached",
		}
	}

	return client.SessionSnapshot{ClientID: "client-2"}, nil
}

func (*attachSequenceClient) SubmitOperation(context.Context, string, client.OperationRequest) error {
	return nil
}

func (*attachSequenceClient) StreamEvents(context.Context, string, int64, func(client.Event) error) error {
	return nil
}

type testEvent struct {
	id        int64
	eventType string
	data      any
}

func testRepresentation(path, code string) map[string]any {
	return map[string]any{
		"format":  "patchies.vfs-mount.v1",
		"patchId": "patch-1",
		"entries": []any{testEntry(path, code)},
	}
}

func testEntry(path, code string) map[string]any {
	return map[string]any{
		"path":    path,
		"kind":    "file",
		"content": code,
	}
}

func testCommit(path, operationID string, baseRevision, patchRevision int64, code string) map[string]any {
	return map[string]any{
		"commitId":          fmt.Sprintf("commit-%d", patchRevision),
		"operationId":       operationID,
		"browserGeneration": "browser-1",
		"baseRevision":      baseRevision,
		"patchRevision":     patchRevision,
		"applied":           true,
		"changes": []map[string]any{{
			"path":  path,
			"entry": testEntry(path, code),
		}},
	}
}

func receiveOperation(t *testing.T, operations <-chan client.OperationRequest) client.OperationRequest {
	t.Helper()

	select {
	case operation := <-operations:
		return operation
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for filesystem operation")
		return client.OperationRequest{}
	}
}

func waitForFile(t *testing.T, path, content string) {
	t.Helper()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		value, err := os.ReadFile(path)
		if err == nil && string(value) == content {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}

	t.Fatalf("file %s did not contain %q", path, content)
}

func writeTestJSON(response http.ResponseWriter, body any) {
	response.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(response).Encode(body)
}

package mountsession

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/heypoom/patchies/cli/internal/client"
	"github.com/heypoom/patchies/cli/internal/mount"
	"github.com/heypoom/patchies/cli/internal/protocol"
)

func TestResumeReplaysOfflineEditsBeforeBrowserProjection(t *testing.T) {
	root := t.TempDir()
	path := "patch/a.js"
	connection := protocol.Connection{InstanceURL: "http://localhost:8090", SessionID: "session", Secret: "not-persisted"}
	session := New(connection, root)
	state := newRunState()
	state.patchID = "patch-1"
	state.baseline[path] = "baseline"
	if err := mount.ApplySnapshot(root, mount.Representation{Format: mount.RepresentationVersion, PatchID: state.patchID, Entries: []mount.Entry{{Path: "objects", Kind: "directory"}, {Path: "patch", Kind: "directory"}, {Path: path, Kind: "file", Content: "offline"}}}); err != nil {
		t.Fatal(err)
	}
	if err := session.saveState(state); err != nil {
		t.Fatal(err)
	}

	remote := &controlledClient{events: make(chan client.Event, 8), operations: make(chan client.OperationRequest, 8), results: make(chan error, 8), streams: make(chan struct{}, 8)}
	resumed := New(connection, root).Resume()
	resumed.remote = remote
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- resumed.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-done:
			if err != nil {
				t.Error(err)
			}
		case <-time.After(3 * time.Second):
			t.Error("resume did not stop")
		}
	})
	<-remote.streams
	data, _ := json.Marshal(map[string]any{"representation": testRepresentation(path, "new browser"), "browserGeneration": "browser-1", "patchRevision": 0})
	remote.events <- client.Event{ID: 1, Type: "snapshot.published", Data: data}
	operation := receiveOperation(t, remote.operations)

	if operation.Content != "offline" {
		t.Fatalf("offline save replaced: %#v", operation)
	}
	waitForFile(t, filepath.Join(root, path), "offline")
	encoded, err := os.ReadFile(filepath.Join(root, ".patchies", "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), connection.Secret) {
		t.Fatal("credential persisted in mount state")
	}
}

func TestResumeRejectsWrongSessionAndSecondOwner(t *testing.T) {
	root := t.TempDir()
	unlock, err := lockMount(root)
	if err != nil {
		t.Fatal(err)
	}
	defer unlock()
	if _, err := lockMount(root); err == nil {
		t.Fatal("second owner acquired lock")
	}

	session := New(protocol.Connection{SessionID: "original"}, root)
	state := newRunState()
	state.patchID = "patch"
	if err := session.saveState(state); err != nil {
		t.Fatal(err)
	}
	other := New(protocol.Connection{SessionID: "other"}, root)
	if _, err := other.loadState(); err == nil {
		t.Fatal("accepted another session")
	}
}

func TestResumeDistinguishesInterruptedProjectionFromOfflineEdits(t *testing.T) {
	root := t.TempDir()
	session := New(protocol.Connection{SessionID: "session"}, root)
	state := newRunState()
	state.patchID = "patch"
	state.baseline = map[string]string{"patch/applied.js": "old", "patch/edited.js": "old"}
	state.projection = map[string]string{"patch/applied.js": "new browser", "patch/edited.js": "new browser"}
	if err := session.saveState(state); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "patch"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "patch/applied.js"), []byte("new browser"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "patch/edited.js"), []byte("offline"), 0o644); err != nil {
		t.Fatal(err)
	}

	loaded, err := session.loadState()
	if err != nil {
		t.Fatal(err)
	}
	if loaded.baseline["patch/applied.js"] != "new browser" {
		t.Fatal("projected content interpreted as a local edit")
	}
	if loaded.baseline["patch/edited.js"] != "old" {
		t.Fatal("offline edit adopted as canonical")
	}
}

func TestSocketReturnsBrowserResultAndRemovesLocatorOnStop(t *testing.T) {
	root := t.TempDir()
	session := New(protocol.Connection{}, root)
	closeSocket, err := session.serveSocket(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		request := <-session.commands
		request.reply <- localResponse{OperationID: request.id, Result: json.RawMessage(`{"nodes":[{"id":"button-1"}]}`), PatchRevision: 7}
	}()
	var output strings.Builder
	if err := ExecuteLocal(t.Context(), root, json.RawMessage(`{"kind":"graph.query"}`), &output); err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(output.String(), `"button-1"`) || !strings.Contains(output.String(), `"patchRevision":7`) {
		t.Fatalf("socket result: %s", output.String())
	}
	closeSocket()
	if _, err := os.Stat(filepath.Join(root, ".patchies", "socket.json")); !os.IsNotExist(err) {
		t.Fatal("socket locator survived stop")
	}
}

func TestResumeKeepsRejectedSaveUntilARealNewEdit(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "patch"), 0o755); err != nil {
		t.Fatal(err)
	}
	path := "patch/a.js"
	state := newRunState()
	state.baseline[path] = "canonical"
	state.unsynced[path] = "rejected"
	if err := os.WriteFile(filepath.Join(root, path), []byte("rejected"), 0o644); err != nil {
		t.Fatal(err)
	}
	watcher, err := mount.NewWatcher(root)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = watcher.Close() }()
	session := New(protocol.Connection{}, root)
	if err := session.seedResume(watcher, state); err != nil {
		t.Fatal(err)
	}
	state.collectLocal(watcher)

	if len(state.pending) != 0 || state.unsynced[path] != "rejected" {
		t.Fatal("rejected edit retried without a save")
	}
	if err := os.WriteFile(filepath.Join(root, path), []byte("canonical"), 0o644); err != nil {
		t.Fatal(err)
	}
	state.collectLocal(watcher)
	if state.pending[path] != "canonical" {
		t.Fatal("new save matching browser content ignored")
	}
	if _, exists := state.unsynced[path]; exists {
		t.Fatal("new save retained old rejection")
	}
}

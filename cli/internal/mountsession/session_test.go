package mountsession

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/heypoom/patchies/cli/internal/client"
	"github.com/heypoom/patchies/cli/internal/protocol"
)

func TestSessionRemainsBidirectionalAcrossAlternatingEdits(t *testing.T) {
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
					fmt.Fprintf(response, "id: %d\nevent: %s\ndata: %s\n\n", event.id, event.eventType, payload)
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
		"representation":    testRepresentation("first"),
	}}
	codePath := filepath.Join(root, "glsl-24", "shader.frag")
	waitForFile(t, codePath, "first")

	if err := os.WriteFile(codePath, []byte("filesystem one"), 0o644); err != nil {
		t.Fatalf("write first filesystem edit: %v", err)
	}
	first := receiveOperation(t, operations)
	if first.BaseRevision != 0 || first.Content != "filesystem one" {
		t.Fatalf("first operation = %#v", first)
	}
	events <- testEvent{id: 2, eventType: "commit.published", data: testCommit(first.OperationID, 0, 1, "filesystem one")}
	waitForFile(t, codePath, "filesystem one")

	events <- testEvent{id: 3, eventType: "commit.published", data: testCommit("", 1, 2, "Patchies two")}
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

type testEvent struct {
	id        int64
	eventType string
	data      any
}

func testRepresentation(code string) map[string]any {
	return map[string]any{
		"format":  "patchies.representation.v1",
		"patchId": "patch-1",
		"objects": []any{testObject(code)},
	}
}

func testObject(code string) map[string]any {
	return map[string]any{
		"id": "glsl-24",
		"metadata": map[string]any{
			"format":     "patchies.representation.v1",
			"id":         "glsl-24",
			"objectType": "glsl",
			"files":      []string{"shader.frag"},
		},
		"files": map[string]string{"shader.frag": code},
	}
}

func testCommit(operationID string, baseRevision, patchRevision int64, code string) map[string]any {
	return map[string]any{
		"commitId":          fmt.Sprintf("commit-%d", patchRevision),
		"operationId":       operationID,
		"browserGeneration": "browser-1",
		"baseRevision":      baseRevision,
		"patchRevision":     patchRevision,
		"applied":           true,
		"changes": []map[string]any{{
			"objectId": "glsl-24",
			"object":   testObject(code),
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

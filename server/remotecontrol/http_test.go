package remotecontrol

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPHandlerOperationAcknowledgementControlsRevision(t *testing.T) {
	handler := NewHTTPHandler(NewRelay())

	created := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions", "", map[string]string{
		"protocolVersion":   ProtocolVersion,
		"patchId":           "patch-1",
		"browserGeneration": "browser-1",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d: %s", created.Code, http.StatusCreated, created.Body.String())
	}

	var credentials SessionCredentials
	decodeResponse(t, created, &credentials)

	attached := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions/"+credentials.SessionID+"/client", credentials.Secret, nil)
	if attached.Code != http.StatusOK {
		t.Fatalf("attach status = %d, want %d: %s", attached.Code, http.StatusOK, attached.Body.String())
	}

	var client SessionSnapshot
	decodeResponse(t, attached, &client)

	pending := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions/"+credentials.SessionID+"/operations", credentials.Secret, map[string]any{
		"clientId":          client.ClientID,
		"operationId":       "operation-1",
		"browserGeneration": "browser-1",
		"patchRevision":     0,
		"path":              "glsl-24/shader.frag",
		"content":           "void main() {}",
	})
	if pending.Code != http.StatusAccepted {
		t.Fatalf("submit status = %d, want %d: %s", pending.Code, http.StatusAccepted, pending.Body.String())
	}

	var pendingResult OperationResult
	decodeResponse(t, pending, &pendingResult)
	if pendingResult.Terminal || pendingResult.PatchRevision != 0 {
		t.Fatalf("pending result = %#v, want non-terminal revision 0", pendingResult)
	}

	acknowledged := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions/"+credentials.SessionID+"/operations/operation-1/ack", credentials.Secret, map[string]any{
		"browserGeneration": "browser-1",
		"patchRevision":     1,
		"applied":           true,
		"objectId":          "glsl-24",
		"object": map[string]any{
			"id": "glsl-24",
			"metadata": map[string]any{
				"format":     "patchies.representation.v1",
				"id":         "glsl-24",
				"objectType": "glsl",
				"files":      []string{"shader.frag"},
			},
			"files": map[string]string{"shader.frag": "void main() {}"},
		},
	})
	if acknowledged.Code != http.StatusOK {
		t.Fatalf("acknowledge status = %d, want %d: %s", acknowledged.Code, http.StatusOK, acknowledged.Body.String())
	}

	var result OperationResult
	decodeResponse(t, acknowledged, &result)
	if !result.Terminal || !result.Applied || result.PatchRevision != 1 {
		t.Fatalf("acknowledged result = %#v, want applied revision 1", result)
	}
	if result.ObjectID != "glsl-24" || len(result.Object) == 0 {
		t.Fatalf("acknowledged result = %#v, want canonical object", result)
	}
}

func TestHTTPHandlerRequiresProtocolAndSecret(t *testing.T) {
	handler := NewHTTPHandler(NewRelay())

	created := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions", "", map[string]string{
		"protocolVersion":   "patchies.remote-control.v0",
		"patchId":           "patch-1",
		"browserGeneration": "browser-1",
	})
	if created.Code != http.StatusBadRequest {
		t.Fatalf("protocol mismatch status = %d, want %d", created.Code, http.StatusBadRequest)
	}

	created = serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions", "", map[string]string{
		"protocolVersion":   ProtocolVersion,
		"patchId":           "patch-1",
		"browserGeneration": "browser-1",
	})

	var credentials SessionCredentials
	decodeResponse(t, created, &credentials)

	attached := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions/"+credentials.SessionID+"/client", "wrong", nil)
	if attached.Code != http.StatusUnauthorized {
		t.Fatalf("invalid secret status = %d, want %d", attached.Code, http.StatusUnauthorized)
	}
}

func TestHTTPHandlerRejectsUnknownJSONFields(t *testing.T) {
	handler := NewHTTPHandler(NewRelay())
	created := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions", "", map[string]string{
		"protocolVersion":   ProtocolVersion,
		"patchId":           "patch-1",
		"browserGeneration": "browser-1",
		"unexpected":        "value",
	})
	if created.Code != http.StatusBadRequest {
		t.Fatalf("unknown JSON field status = %d, want %d", created.Code, http.StatusBadRequest)
	}
}

func TestHTTPHandlerRevokesSession(t *testing.T) {
	handler := NewHTTPHandler(NewRelay())
	created := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions", "", map[string]string{
		"protocolVersion":   ProtocolVersion,
		"patchId":           "patch-1",
		"browserGeneration": "browser-1",
	})

	var credentials SessionCredentials
	decodeResponse(t, created, &credentials)

	revoked := serveJSON(t, handler, http.MethodDelete, "/api/remote-control/sessions/"+credentials.SessionID, credentials.Secret, nil)
	if revoked.Code != http.StatusNoContent {
		t.Fatalf("revoke status = %d, want %d: %s", revoked.Code, http.StatusNoContent, revoked.Body.String())
	}

	attached := serveJSON(t, handler, http.MethodPost, "/api/remote-control/sessions/"+credentials.SessionID+"/client", credentials.Secret, nil)
	if attached.Code != http.StatusNotFound {
		t.Fatalf("attach revoked session status = %d, want %d", attached.Code, http.StatusNotFound)
	}
}

func serveJSON(t *testing.T, handler http.Handler, method, path, secret string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
	}

	request := httptest.NewRequestWithContext(t.Context(), method, path, bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	if secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}

	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	return response
}

func decodeResponse(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()

	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

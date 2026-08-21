package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

func TestHealthz(t *testing.T) {
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/healthz", nil)
	response := httptest.NewRecorder()
	event := &core.RequestEvent{
		Event: router.Event{Request: request, Response: response},
	}

	if err := healthz(event); err != nil {
		t.Fatalf("healthz returned an error: %v", err)
	}

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	if contentType := response.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", contentType)
	}

	var body map[string]string
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("status = %q, want ok", body["status"])
	}
}

func TestFrontendHandlerProxiesToVite(t *testing.T) {
	vite := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.WriteHeader(http.StatusOK)
		_, _ = response.Write([]byte(request.URL.RequestURI()))
	}))
	defer vite.Close()

	frontend, err := newFrontendHandler(vite.URL)
	if err != nil {
		t.Fatalf("create frontend handler: %v", err)
	}

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/_app/immutable/start.js?version=1", nil)
	response := httptest.NewRecorder()
	frontend.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	if body := response.Body.String(); body != "/_app/immutable/start.js?version=1" {
		t.Fatalf("proxied path = %q", body)
	}
}

func TestStaticFrontendHandlerServesPrerenderedCleanURLs(t *testing.T) {
	frontend := newStaticFrontendHandler(fstest.MapFS{
		"output.html": &fstest.MapFile{Data: []byte("output page")},
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/output?preview=true", nil)
	response := httptest.NewRecorder()
	frontend.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	if body := response.Body.String(); body != "output page" {
		t.Fatalf("body = %q, want output page", body)
	}
}

func TestStaticFrontendHandlerKeepsMissingRoutesMissing(t *testing.T) {
	frontend := newStaticFrontendHandler(fstest.MapFS{})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/missing", nil)
	response := httptest.NewRecorder()
	frontend.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

func TestStaticFrontendHandlerRedirectsPrerenderedHTMLRoutes(t *testing.T) {
	frontend := newStaticFrontendHandler(fstest.MapFS{
		"docs/ai-chat.html": &fstest.MapFile{Data: []byte("AI chat")},
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/docs/ai-chat.html?source=bookmark", nil)
	response := httptest.NewRecorder()
	frontend.ServeHTTP(response, request)

	if response.Code != http.StatusPermanentRedirect {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusPermanentRedirect)
	}

	if location := response.Header().Get("Location"); location != "/docs/ai-chat?source=bookmark" {
		t.Fatalf("Location = %q, want %q", location, "/docs/ai-chat?source=bookmark")
	}
}

func TestNewAppUsesConfiguredDataDir(t *testing.T) {
	dataDir := t.TempDir()
	app := newApp(dataDir)

	if app.DataDir() != dataDir {
		t.Fatalf("data directory = %q, want %q", app.DataDir(), dataDir)
	}

	if app.EncryptionEnv() != encryptionKeyEnv {
		t.Fatalf("encryption environment = %q, want %q", app.EncryptionEnv(), encryptionKeyEnv)
	}
}

func TestRuntimeIdentityFromEnvironment(t *testing.T) {
	t.Setenv(runUIDEnv, "65532")
	t.Setenv(runGIDEnv, "65531")

	identity, err := runtimeIdentityFromEnvironment()
	if err != nil {
		t.Fatalf("read runtime identity: %v", err)
	}

	if identity == nil {
		t.Fatal("runtime identity is nil")
	}

	if identity.uid != 65532 || identity.gid != 65531 {
		t.Fatalf("runtime identity = %d:%d, want 65532:65531", identity.uid, identity.gid)
	}
}

func TestRuntimeIdentityRequiresUIDAndGID(t *testing.T) {
	t.Setenv(runUIDEnv, "65532")

	if _, err := runtimeIdentityFromEnvironment(); err == nil {
		t.Fatal("expected an error when only the runtime UID is configured")
	}
}

func TestRuntimeIdentityRejectsRoot(t *testing.T) {
	t.Setenv(runUIDEnv, "0")
	t.Setenv(runGIDEnv, "0")

	if _, err := runtimeIdentityFromEnvironment(); err == nil {
		t.Fatal("expected an error for a root runtime identity")
	}
}

func TestInitializePatchesCollection(t *testing.T) {
	app := newApp(t.TempDir())
	if err := initializeApp(app); err != nil {
		t.Fatalf("initialize app: %v", err)
	}

	collection, err := app.FindCollectionByNameOrId("patches")
	if err != nil {
		t.Fatalf("find patches collection: %v", err)
	}

	if collection.Id != "pbc_2440861534" {
		t.Fatalf("collection id = %q, want production id", collection.Id)
	}

	if collection.Fields.GetByName("name") == nil || collection.Fields.GetByName("patch") == nil || collection.Fields.GetByName("public") == nil {
		t.Fatal("patches collection is missing an expected field")
	}
}

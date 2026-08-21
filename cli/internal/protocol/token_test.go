package protocol

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestParseConnectionNormalizesURL(t *testing.T) {
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"instanceURL":"https://patchies.example.com/editor?x=1","sessionID":"session-1","secret":"secret-1"}`))

	connection, err := ParseConnection(ConnectionPrefix + payload)
	if err != nil {
		t.Fatalf("parse connection: %v", err)
	}

	if connection.InstanceURL != "https://patchies.example.com" {
		t.Fatalf("instance URL = %q, want normalized origin", connection.InstanceURL)
	}
}

func TestConnectionRequiresHTTPSOutsideLoopback(t *testing.T) {
	for _, test := range []struct {
		url     string
		allowed bool
	}{
		{"http://localhost:8090", true}, {"http://127.0.0.2:8090", true},
		{"http://[::1]:8090", true}, {"https://patchies.example.com", true},
		{"http://patchies.example.com", false}, {"http://192.168.1.2", false},
		{"http://localhost.example.com", false},
	} {
		t.Run(test.url, func(t *testing.T) {
			payload, err := json.Marshal(Connection{InstanceURL: test.url, SessionID: "session", Secret: "secret"})
			if err != nil {
				t.Fatal(err)
			}
			_, err = ParseConnection(ConnectionPrefix + base64.RawURLEncoding.EncodeToString(payload))
			if (err == nil) != test.allowed {
				t.Fatalf("allowed=%v, error=%v", test.allowed, err)
			}
		})
	}
}

func TestParseConnectionRejectsUnsupportedURLScheme(t *testing.T) {
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"instanceURL":"ftp://patchies.example.com","sessionID":"session-1","secret":"secret-1"}`))

	if _, err := ParseConnection(ConnectionPrefix + payload); err == nil {
		t.Fatal("ParseConnection accepted ftp URL")
	}
}

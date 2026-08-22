package protocol

import (
	"encoding/base64"
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

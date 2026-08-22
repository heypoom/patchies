package client

import (
	"context"
	"strings"
	"testing"

	"github.com/heypoom/patchies/cli/internal/protocol"
)

func TestParseEventStream(t *testing.T) {
	var events []Event
	err := parseEventStream(strings.NewReader("id: 4\nevent: snapshot.published\ndata: {\"patchRevision\":0}\n\nid: 5\nevent: commit.published\ndata: {\"patchRevision\":1}\n\n"), func(event Event) error {
		events = append(events, event)
		return nil
	})
	if err != nil {
		t.Fatalf("parse event stream: %v", err)
	}

	if len(events) != 2 || events[0].ID != 4 || events[0].Type != "snapshot.published" || events[1].ID != 5 || string(events[1].Data) != `{"patchRevision":1}` {
		t.Fatalf("events = %#v", events)
	}
}

func TestNewRequestAllowsNoBody(t *testing.T) {
	client := New(protocol.Connection{
		InstanceURL: "http://localhost:8090",
		SessionID:   "session-1",
		Secret:      "secret-1",
	})

	request, err := client.newRequest(context.Background(), "GET", "/events", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if request.Body != nil {
		t.Fatalf("request body = %#v, want nil", request.Body)
	}
}

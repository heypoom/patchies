package remotecontrol

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestRelayAllowsOneStreamingMutatingClient(t *testing.T) {
	relay, credentials := createTestSession(t)

	first, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach first client: %v", err)
	}
	_, stop, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, first.ClientID, 0)
	if err != nil {
		t.Fatalf("subscribe first client: %v", err)
	}
	defer stop()

	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); !errors.Is(err, ErrClientAttached) {
		t.Fatalf("attach second client error = %v, want ErrClientAttached", err)
	}
}

func TestRelayPublishesOneCanonicalCommitForAnOperation(t *testing.T) {
	relay, credentials := createTestSession(t)

	browserEvents, stopBrowser, err := relay.SubscribeBrowser(credentials.SessionID, credentials.Secret, 0)
	if err != nil {
		t.Fatalf("subscribe browser: %v", err)
	}
	defer stopBrowser()

	client := attachTestClient(t, relay, credentials)

	clientEvents, stopClient, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, client.ClientID, 0)
	if err != nil {
		t.Fatalf("subscribe client: %v", err)
	}
	defer stopClient()

	if event := receiveEvent(t, browserEvents); event.Type != "client.attached" {
		t.Fatalf("browser event = %q, want client.attached", event.Type)
	}
	if err := relay.PublishSnapshot(credentials.SessionID, credentials.Secret, SnapshotRequest{
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Representation:    json.RawMessage(`{"format":"patchies.representation.v1","patchId":"patch-1","objects":[]}`),
	}); err != nil {
		t.Fatalf("publish initial snapshot: %v", err)
	}
	if event := receiveEvent(t, clientEvents); event.Type != "snapshot.published" {
		t.Fatalf("client event = %q, want snapshot.published", event.Type)
	}

	pending, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Path:              "glsl-24/shader.frag",
		Content:           "void main() {}",
	})
	if err != nil {
		t.Fatalf("submit operation: %v", err)
	}
	if pending.Terminal {
		t.Fatal("new operation is already terminal")
	}
	if event := receiveEvent(t, browserEvents); event.Type != "operation.submitted" {
		t.Fatalf("browser event = %q, want operation.submitted", event.Type)
	}

	commit, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "commit-1",
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"void main() {}"}}`),
		}},
	})
	if err != nil {
		t.Fatalf("publish commit: %v", err)
	}
	if commit.PatchRevision != 1 {
		t.Fatalf("commit revision = %d, want 1", commit.PatchRevision)
	}

	event := receiveEvent(t, clientEvents)
	if event.Type != "commit.published" {
		t.Fatalf("client event = %q, want commit.published", event.Type)
	}
	published := event.Data.(CanonicalCommit)
	if published.OperationID != "operation-1" || published.PatchRevision != 1 || len(published.Changes) != 1 {
		t.Fatalf("published commit = %#v", published)
	}

	retry, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "commit-1",
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Applied:           true,
		Changes:           published.Changes,
	})
	if err != nil {
		t.Fatalf("retry commit: %v", err)
	}
	if retry.PatchRevision != 1 {
		t.Fatalf("retry revision = %d, want 1", retry.PatchRevision)
	}
}

func TestRelayAcceptsStaleLocalOperationButSerializesItsCommit(t *testing.T) {
	relay, credentials := createTestSession(t)
	client := attachTestClient(t, relay, credentials)

	_, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "browser-commit",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"browser"}}`),
		}},
	})
	if err != nil {
		t.Fatalf("publish browser commit: %v", err)
	}

	_, err = relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "local-operation",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Path:              "glsl-24/shader.frag",
		Content:           "local",
	})
	if err != nil {
		t.Fatalf("submit stale local operation: %v", err)
	}

	if _, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "local-commit",
		OperationID:       "local-operation",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"local"}}`),
		}},
	}); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("stale canonical commit error = %v, want ErrRevisionConflict", err)
	}

	commit, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "local-commit",
		OperationID:       "local-operation",
		BrowserGeneration: "browser-1",
		BaseRevision:      1,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"local"}}`),
		}},
	})
	if err != nil {
		t.Fatalf("publish rebased local commit: %v", err)
	}
	if commit.PatchRevision != 2 {
		t.Fatalf("local commit revision = %d, want 2", commit.PatchRevision)
	}
}

func TestRelayReplaysMissedCommitAfterLastEventID(t *testing.T) {
	relay, credentials := createTestSession(t)
	client := attachTestClient(t, relay, credentials)

	events, stop, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, client.ClientID, 0)
	if err != nil {
		t.Fatalf("subscribe client: %v", err)
	}
	if err := relay.PublishSnapshot(credentials.SessionID, credentials.Secret, SnapshotRequest{
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Representation:    json.RawMessage(`{"format":"patchies.representation.v1","patchId":"patch-1","objects":[]}`),
	}); err != nil {
		t.Fatalf("publish initial snapshot: %v", err)
	}
	initial := receiveEvent(t, events)
	stop()

	commit, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "commit-1",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"new"}}`),
		}},
	})
	if err != nil {
		t.Fatalf("publish commit: %v", err)
	}

	replayed, stopReplay, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, client.ClientID, initial.ID)
	if err != nil {
		t.Fatalf("resume client stream: %v", err)
	}
	defer stopReplay()

	event := receiveEvent(t, replayed)
	if event.Type != "commit.published" || event.ID <= initial.ID {
		t.Fatalf("replayed event = %#v", event)
	}
	published := event.Data.(CanonicalCommit)
	if published.CommitID != commit.CommitID || published.PatchRevision != 1 {
		t.Fatalf("replayed commit = %#v", published)
	}
}

func TestRelayReplaysAnUnresolvedOperationOnAFreshBrowserStream(t *testing.T) {
	relay, credentials := createTestSession(t)
	client := attachTestClient(t, relay, credentials)

	_, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-before-stream",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Path:              "glsl-24/shader.frag",
		Content:           "local",
	})
	if err != nil {
		t.Fatalf("submit operation: %v", err)
	}

	browserEvents, stop, err := relay.SubscribeBrowser(credentials.SessionID, credentials.Secret, 0)
	if err != nil {
		t.Fatalf("subscribe fresh browser stream: %v", err)
	}
	defer stop()

	event := receiveEvent(t, browserEvents)
	if event.Type != "operation.submitted" {
		t.Fatalf("browser event = %q, want operation.submitted", event.Type)
	}
	request := event.Data.(OperationRequest)
	if request.OperationID != "operation-before-stream" {
		t.Fatalf("operation = %#v", request)
	}
}

func TestRelayReclaimDropsOldGenerationOperations(t *testing.T) {
	relay, credentials := createTestSession(t)
	client := attachTestClient(t, relay, credentials)

	_, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "old-operation",
		BrowserGeneration: "browser-1",
		BaseRevision:      0,
		Path:              "glsl-24/shader.frag",
		Content:           "old",
	})
	if err != nil {
		t.Fatalf("submit old operation: %v", err)
	}

	if _, err := relay.Reclaim(credentials.SessionID, credentials.Secret, "patch-1", "browser-2", 0); err != nil {
		t.Fatalf("reclaim session: %v", err)
	}

	if _, err := relay.PublishCommit(credentials.SessionID, credentials.Secret, CommitRequest{
		CommitID:          "old-commit",
		OperationID:       "old-operation",
		BrowserGeneration: "browser-2",
		BaseRevision:      0,
		Applied:           true,
		Changes: []ObjectChange{{
			ObjectID: "glsl-24",
			Object:   json.RawMessage(`{"id":"glsl-24"}`),
		}},
	}); !errors.Is(err, ErrOperationNotFound) {
		t.Fatalf("old operation commit error = %v, want ErrOperationNotFound", err)
	}
}

func createTestSession(t *testing.T) (*Relay, SessionCredentials) {
	t.Helper()

	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	return relay, credentials
}

func attachTestClient(t *testing.T, relay *Relay, credentials SessionCredentials) SessionSnapshot {
	t.Helper()

	client, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach client: %v", err)
	}

	return client
}

func receiveEvent(t *testing.T, events <-chan Event) Event {
	t.Helper()

	select {
	case event, ok := <-events:
		if !ok {
			t.Fatal("relay event stream closed")
		}

		return event
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for relay event")

		return Event{}
	}
}

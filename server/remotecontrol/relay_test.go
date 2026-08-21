package remotecontrol

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestRelayAllowsOneMutatingClient(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	first, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach first client: %v", err)
	}
	_, stop, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, first.ClientID)
	if err != nil {
		t.Fatalf("subscribe first client: %v", err)
	}
	defer stop()

	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); !errors.Is(err, ErrClientAttached) {
		t.Fatalf("attach second client error = %v, want ErrClientAttached", err)
	}

	if err := relay.DetachClient(credentials.SessionID, credentials.Secret, first.ClientID); err != nil {
		t.Fatalf("detach client: %v", err)
	}

	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); err != nil {
		t.Fatalf("attach replacement client: %v", err)
	}
}

func TestRelayReclaimsClientSlotBeforeItStartsEventStream(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	first, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach first client: %v", err)
	}

	second, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("reclaim client slot: %v", err)
	}
	if second.ClientID == first.ClientID {
		t.Fatal("reclaimed client slot reused the old client ID")
	}

	if _, _, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, second.ClientID); err != nil {
		t.Fatalf("subscribe replacement client: %v", err)
	}
	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); !errors.Is(err, ErrClientAttached) {
		t.Fatalf("attach concurrent streamed client error = %v, want ErrClientAttached", err)
	}
}

func TestRelayRevokesSession(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := relay.Revoke(credentials.SessionID, credentials.Secret); err != nil {
		t.Fatalf("revoke session: %v", err)
	}

	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("attach revoked session error = %v, want ErrSessionNotFound", err)
	}
}

func TestRelayStreamsOperationsAndSnapshots(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	browserEvents, stopBrowser, err := relay.SubscribeBrowser(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("subscribe browser: %v", err)
	}
	defer stopBrowser()

	client, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach client: %v", err)
	}
	if event := receiveEvent(t, browserEvents); event.Type != "client.attached" {
		t.Fatalf("browser event = %q, want client.attached", event.Type)
	}

	clientEvents, stopClient, err := relay.SubscribeClient(credentials.SessionID, credentials.Secret, client.ClientID)
	if err != nil {
		t.Fatalf("subscribe client: %v", err)
	}
	defer stopClient()

	initial := receiveEvent(t, clientEvents)
	if initial.Type != "session.snapshot" {
		t.Fatalf("initial event = %q, want session.snapshot", initial.Type)
	}

	if err := relay.PublishSnapshot(credentials.SessionID, credentials.Secret, SnapshotRequest{
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Representation:    json.RawMessage(`{"objects":[]}`),
	}); err != nil {
		t.Fatalf("publish snapshot: %v", err)
	}

	if event := receiveEvent(t, clientEvents); event.Type != "snapshot.published" {
		t.Fatalf("snapshot event = %q, want snapshot.published", event.Type)
	}

	if _, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
		Content:           "void main() {}",
	}); err != nil {
		t.Fatalf("submit operation: %v", err)
	}

	if event := receiveEvent(t, browserEvents); event.Type != "operation.submitted" {
		t.Fatalf("browser event = %q, want operation.submitted", event.Type)
	}
}

func TestRelayAllowsBrowserSnapshotsToAdvanceOneRevision(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := relay.PublishSnapshot(credentials.SessionID, credentials.Secret, SnapshotRequest{
		BrowserGeneration: "browser-1",
		PatchRevision:     1,
		Representation:    json.RawMessage(`{"objects":[]}`),
	}); err != nil {
		t.Fatalf("advance snapshot: %v", err)
	}

	if err := relay.PublishSnapshot(credentials.SessionID, credentials.Secret, SnapshotRequest{
		BrowserGeneration: "browser-1",
		PatchRevision:     3,
		Representation:    json.RawMessage(`{"objects":[]}`),
	}); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("skipped revision error = %v, want ErrRevisionConflict", err)
	}
}

func receiveEvent(t *testing.T, events <-chan Event) Event {
	t.Helper()

	select {
	case event := <-events:
		return event
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for relay event")
		return Event{}
	}
}

func TestRelayRejectsStaleGenerationAndRevision(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	client, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach client: %v", err)
	}

	if _, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-0",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
	}); !errors.Is(err, ErrGenerationStale) {
		t.Fatalf("stale generation error = %v, want ErrGenerationStale", err)
	}

	pending, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
	})
	if err != nil {
		t.Fatalf("submit operation: %v", err)
	}

	if pending.Terminal {
		t.Fatal("submitted operation is terminal before browser acknowledgement")
	}

	result, err := relay.AcknowledgeOperation(credentials.SessionID, credentials.Secret, OperationAcknowledgement{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     1,
		Applied:           true,
		ObjectID:          "glsl-24",
		Object:            json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"void main() {}"}}`),
	})
	if err != nil {
		t.Fatalf("acknowledge operation: %v", err)
	}

	if result.PatchRevision != 1 || !result.Applied || !result.Terminal {
		t.Fatalf("result = %#v, want an applied terminal revision 1", result)
	}
	if result.ObjectID != "glsl-24" || string(result.Object) == "" {
		t.Fatalf("result = %#v, want canonical object representation", result)
	}

	if _, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-2",
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
	}); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("stale revision error = %v, want ErrRevisionConflict", err)
	}
}

func TestRelayReclaimAndOperationRetry(t *testing.T) {
	relay := NewRelay()
	credentials, err := relay.CreateSession("patch-1", "browser-1")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	client, err := relay.AttachClient(credentials.SessionID, credentials.Secret)
	if err != nil {
		t.Fatalf("attach client: %v", err)
	}

	first, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
	})
	if err != nil {
		t.Fatalf("submit operation: %v", err)
	}

	retry, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     0,
		Path:              "glsl-24/shader.frag",
	})
	if err != nil {
		t.Fatalf("retry operation: %v", err)
	}

	if retry.OperationID != first.OperationID || retry.PatchRevision != first.PatchRevision || retry.Terminal {
		t.Fatalf("retry result = %#v, want %#v", retry, first)
	}

	if _, err := relay.AcknowledgeOperation(credentials.SessionID, credentials.Secret, OperationAcknowledgement{
		OperationID:       "operation-1",
		BrowserGeneration: "browser-1",
		PatchRevision:     1,
		Applied:           true,
		ObjectID:          "glsl-24",
		Object:            json.RawMessage(`{"id":"glsl-24","files":{"shader.frag":"void main() {}"}}`),
	}); err != nil {
		t.Fatalf("acknowledge operation: %v", err)
	}

	reclaimed, err := relay.Reclaim(credentials.SessionID, credentials.Secret, "patch-1", "browser-2", 1)
	if err != nil {
		t.Fatalf("reclaim session: %v", err)
	}

	if reclaimed.BrowserGeneration != "browser-2" {
		t.Fatalf("generation = %q, want browser-2", reclaimed.BrowserGeneration)
	}

	if _, err := relay.SubmitOperation(credentials.SessionID, credentials.Secret, client.ClientID, OperationRequest{
		OperationID:       "operation-2",
		BrowserGeneration: "browser-2",
		PatchRevision:     1,
		Path:              "glsl-24/shader.frag",
	}); !errors.Is(err, ErrClientNotAttached) {
		t.Fatalf("old client after reclaim error = %v, want ErrClientNotAttached", err)
	}

	if _, err := relay.AttachClient(credentials.SessionID, credentials.Secret); err != nil {
		t.Fatalf("attach client after reclaim: %v", err)
	}

	if _, err := relay.Reclaim(credentials.SessionID, credentials.Secret, "patch-2", "browser-3", 1); !errors.Is(err, ErrPatchMismatch) {
		t.Fatalf("patch mismatch error = %v, want ErrPatchMismatch", err)
	}
}

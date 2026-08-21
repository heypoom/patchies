package syncqueue

import (
	"testing"

	"github.com/heypoom/patchies/cli/internal/mount"
)

func TestQueueUsesLatestLocalContentAndAcknowledgedRevision(t *testing.T) {
	queue := New()
	queue.Activate("browser-1", "client-1", 4)
	queue.Offer(mount.FileChange{Path: "glsl-24/shader.frag", Content: "first"})
	queue.Offer(mount.FileChange{Path: "glsl-24/shader.frag", Content: "latest"})

	operation, ok := queue.Next()
	if !ok || operation.Content != "latest" || operation.Revision != 4 {
		t.Fatalf("first operation = %#v, ok = %t", operation, ok)
	}

	queue.Offer(mount.FileChange{Path: "glsl-25/shader.frag", Content: "next"})
	if _, ok := queue.Next(); ok {
		t.Fatal("queue allowed a second operation before acknowledgement")
	}

	queue.Acknowledge(5)
	operation, ok = queue.Next()
	if !ok || operation.Path != "glsl-25/shader.frag" || operation.Revision != 5 {
		t.Fatalf("second operation = %#v, ok = %t", operation, ok)
	}
}

func TestQueuePreservesLatestChangeUntilReattachedToAReclaimedSession(t *testing.T) {
	queue := New()
	queue.Activate("browser-1", "client-1", 4)
	queue.Offer(mount.FileChange{Path: "glsl-24/shader.frag", Content: "before reload"})

	if _, ok := queue.Next(); !ok {
		t.Fatal("queue did not start the first operation")
	}

	queue.Disconnect()
	queue.Offer(mount.FileChange{Path: "glsl-24/shader.frag", Content: "latest local change"})
	if _, ok := queue.Next(); ok {
		t.Fatal("queue submitted while waiting for the reclaimed session snapshot")
	}

	queue.Activate("browser-2", "client-2", 7)
	operation, ok := queue.Next()
	if !ok {
		t.Fatal("queue did not resume after the reclaimed session snapshot")
	}
	if operation.ClientID != "client-2" || operation.BrowserGeneration != "browser-2" || operation.Revision != 7 || operation.Content != "latest local change" {
		t.Fatalf("reattached operation = %#v, want latest content for new session", operation)
	}
}

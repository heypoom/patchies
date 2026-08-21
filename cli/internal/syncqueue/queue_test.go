package syncqueue

import (
	"testing"

	"github.com/heypoom/patchies/cli/internal/mount"
)

func TestQueueUsesLatestLocalContentAndAcknowledgedRevision(t *testing.T) {
	queue := New("browser-1", 4)
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

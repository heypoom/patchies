package mount

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWatcherReportsFullChangeQueueWithoutAcceptingContent(t *testing.T) {
	root := t.TempDir()
	objectRoot := filepath.Join(root, "glsl-24")
	if err := os.Mkdir(objectRoot, 0o755); err != nil {
		t.Fatalf("create object directory: %v", err)
	}

	path := "glsl-24/shader.frag"
	if err := os.WriteFile(filepath.Join(objectRoot, "shader.frag"), []byte("local"), 0o644); err != nil {
		t.Fatalf("write local edit: %v", err)
	}

	watcher := &Watcher{
		changes:  make(chan FileChange, 1),
		errors:   make(chan error, 1),
		expected: map[string]string{path: "browser"},
		root:     root,
	}
	watcher.changes <- FileChange{Path: "occupied"}

	watcher.capture(path)

	if watcher.expected[path] != "browser" {
		t.Fatalf("expected content = %q, want browser", watcher.expected[path])
	}

	select {
	case err := <-watcher.errors:
		if !strings.Contains(err.Error(), path) {
			t.Fatalf("watcher error = %q, want path", err)
		}
	default:
		t.Fatal("expected full queue error")
	}
}

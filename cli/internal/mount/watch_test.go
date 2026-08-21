package mount

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWatcherReportsFullChangeQueueWithoutAcceptingContent(t *testing.T) {
	root := t.TempDir()
	objectRoot := filepath.Join(root, "objects", "glsl-24")
	if err := os.MkdirAll(objectRoot, 0o755); err != nil {
		t.Fatalf("create object directory: %v", err)
	}

	path := "objects/glsl-24/shader.glsl"
	if err := os.WriteFile(filepath.Join(objectRoot, "shader.glsl"), []byte("local"), 0o644); err != nil {
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

func TestReferencesAreReadonlyAndNeverBecomeLocalOperations(t *testing.T) {
	for _, path := range []string{"references/docs/objects/glsl.md", objectCodeSkillRoot + "/SKILL.md"} {
		t.Run(path, func(t *testing.T) { testReadonlyCompanion(t, path) })
	}
}

func testReadonlyCompanion(t *testing.T, path string) {
	t.Helper()
	root := t.TempDir()
	watcher, err := NewWatcher(root)
	if err != nil {
		t.Fatal(err)
	}
	defer watcher.Close()
	tree := Representation{Format: RepresentationVersion, Entries: []Entry{{Path: path, Kind: "file", Content: "source docs"}}}
	if err := watcher.ApplySnapshot(tree); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(root, path))
	if err != nil || info.Mode().Perm()&0o222 != 0 {
		t.Fatalf("reference permissions: %v %v", info, err)
	}

	// An editor can override permissions; even then references never submit saves.
	if err := os.Chmod(filepath.Join(root, path), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, path), []byte("local reference edit"), 0o644); err != nil {
		t.Fatal(err)
	}
	watcher.capture(path)
	if changes := watcher.PendingChanges(); len(changes) != 0 {
		t.Fatalf("reference edits became operations: %#v", changes)
	}

	if err := watcher.ApplySnapshot(tree); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(root, path))
	if err != nil || string(content) != "source docs" {
		t.Fatalf("reference refresh: %q %v", content, err)
	}

	if err := watcher.ApplySnapshot(Representation{Format: RepresentationVersion}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, path)); !os.IsNotExist(err) {
		t.Fatalf("stale reference not pruned: %v", err)
	}
}

func TestWatcherTracksNewNestedFilesAndRemovesDirectoryWatches(t *testing.T) {
	root := t.TempDir()
	watcher, err := NewWatcher(root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := watcher.Close(); err != nil {
			t.Error(err)
		}
	})
	if err := watcher.ApplySnapshot(Representation{Format: RepresentationVersion}); err != nil {
		t.Fatal(err)
	}
	path := "patch/new/nested/a.js"
	if err := watcher.ApplyEntry(Entry{Path: path, Kind: "file", Content: "browser"}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, path), []byte("local"), 0o644); err != nil {
		t.Fatal(err)
	}
	select {
	case change := <-watcher.Changes():
		if change.Path != path || change.Content != "local" {
			t.Fatalf("unexpected change: %#v", change)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("nested file edit was not observed")
	}
	if err := watcher.RemoveEntry("patch/new"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "patch/new")); !os.IsNotExist(err) {
		t.Fatalf("directory remains: %v", err)
	}
	for _, path := range watcher.watcher.WatchList() {
		if strings.Contains(path, "/patch/new") {
			t.Fatalf("stale watch: %s", path)
		}
	}
}

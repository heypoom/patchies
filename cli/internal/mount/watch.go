package mount

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type FileChange struct {
	Path    string
	Content string
}

type Watcher struct {
	changes  chan FileChange
	errors   chan error
	expected map[string]string
	mu       sync.Mutex
	root     string
	watcher  *fsnotify.Watcher
}

func NewWatcher(root string) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create filesystem watcher: %w", err)
	}
	if err := watcher.Add(root); err != nil {
		_ = watcher.Close()
		return nil, fmt.Errorf("watch mount root: %w", err)
	}

	result := &Watcher{
		changes:  make(chan FileChange, 32),
		errors:   make(chan error, 1),
		expected: make(map[string]string),
		root:     root,
		watcher:  watcher,
	}
	go result.run()

	return result, nil
}

func (w *Watcher) Changes() <-chan FileChange { return w.changes }

func (w *Watcher) Errors() <-chan error { return w.errors }

func (w *Watcher) Close() error {
	return w.watcher.Close()
}

func (w *Watcher) ApplySnapshot(representation Representation) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := ApplySnapshot(w.root, representation); err != nil {
		return err
	}
	w.expected = make(map[string]string)
	for _, entry := range representation.Entries {
		if entry.Kind == "file" && !isReadOnlyPath(entry.Path) {
			w.expected[entry.Path] = entry.Content
		}
	}

	return w.refreshWatches()
}

func (w *Watcher) ApplyEntry(entry Entry) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if err := ApplyEntry(w.root, entry); err != nil {
		return err
	}
	if isReadOnlyPath(entry.Path) {
		return nil
	}
	if entry.Kind == "file" {
		w.expected[entry.Path] = entry.Content
	}
	path := filepath.Join(w.root, filepath.FromSlash(entry.Path))
	if entry.Kind == "file" {
		path = filepath.Dir(path)
	}
	for path != w.root {
		if err := w.watcher.Add(path); err != nil {
			return err
		}
		path = filepath.Dir(path)
	}
	return nil
}

func (w *Watcher) RemoveEntry(removed string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, err := safePath(w.root, removed); err != nil {
		return err
	}
	prefix := removed + "/"
	for path := range w.expected {
		if path == removed || strings.HasPrefix(path, prefix) {
			delete(w.expected, path)
		}
	}
	for _, path := range w.watcher.WatchList() {
		relative, _ := filepath.Rel(w.root, path)
		relative = filepath.ToSlash(relative)
		if relative == removed || strings.HasPrefix(relative, prefix) {
			if err := w.watcher.Remove(path); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
				return err
			}
		}
	}
	return RemoveEntry(w.root, removed)
}

func (w *Watcher) refreshWatches() error {
	for _, path := range w.watcher.WatchList() {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			if err := w.watcher.Remove(path); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
				return err
			}
		}
	}
	for _, namespace := range []string{"objects", "patch"} {
		if err := filepath.WalkDir(filepath.Join(w.root, namespace), func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				return w.watcher.Add(path)
			}
			return nil
		}); err != nil {
			return err
		}
	}
	return nil
}

func (w *Watcher) run() {
	pending := make(map[string]*time.Timer)
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) == 0 {
				continue
			}
			path, ok := w.representationPath(event.Name)
			if !ok {
				continue
			}
			if previous := pending[path]; previous != nil {
				previous.Stop()
			}
			pending[path] = time.AfterFunc(200*time.Millisecond, func() { w.capture(path) })
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			select {
			case w.errors <- err:
			default:
			}
		}
	}
}

func (w *Watcher) representationPath(filePath string) (string, bool) {
	relative, err := filepath.Rel(w.root, filePath)
	if err != nil || relative == "." || filepath.IsAbs(relative) {
		return "", false
	}
	relative = filepath.ToSlash(relative)

	w.mu.Lock()
	defer w.mu.Unlock()
	_, ok := w.expected[relative]
	return relative, ok
}

func (w *Watcher) capture(path string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	expected, ok := w.expected[path]
	if !ok {
		return
	}

	target, err := safePath(w.root, path)
	if err != nil {
		select {
		case w.errors <- err:
		default:
		}
		return
	}
	content, err := os.ReadFile(target)
	if err != nil {
		objectRoot, fileName := filepath.Split(filepath.Join(w.root, filepath.FromSlash(path)))
		if err := writeFile(objectRoot, fileName, []byte(expected)); err != nil {
			select {
			case w.errors <- err:
			default:
			}
		}
		return
	}
	if string(content) == expected {
		return
	}

	next := string(content)

	select {
	case w.changes <- FileChange{Path: path, Content: next}:
		w.expected[path] = next
	default:
		select {
		case w.errors <- fmt.Errorf("local change queue is full; file remains unsynchronized: %s", path):
		default:
		}
	}
}

// Collect settled and not-yet-debounced saves before projecting a browser update.
func (w *Watcher) PendingChanges() []FileChange {
	w.mu.Lock()
	defer w.mu.Unlock()
	latest := make(map[string]string)
	for {
		select {
		case change := <-w.changes:
			latest[change.Path] = change.Content
		default:
			goto drained
		}
	}
drained:
	for path, expected := range w.expected {
		target, err := safePath(w.root, path)
		if err != nil {
			continue
		}
		content, err := os.ReadFile(target)
		if err == nil && string(content) != expected {
			latest[path] = string(content)
			w.expected[path] = string(content)
		}
	}
	changes := make([]FileChange, 0, len(latest))
	for path, content := range latest {
		changes = append(changes, FileChange{Path: path, Content: content})
	}
	return changes
}

// Keep an unsent or rejected local save visible without echoing it as a new save.
func (w *Watcher) PreserveLocal(path, content string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if expected, exists := w.expected[path]; !exists || expected == content {
		return nil
	}
	if err := ApplyEntry(w.root, Entry{Path: path, Kind: "file", Content: content}); err != nil {
		return err
	}
	w.expected[path] = content
	return nil
}

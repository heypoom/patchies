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
	previousObjects := expectedObjectIDs(w.expected)
	w.expected = make(map[string]string)
	for _, object := range representation.Objects {
		for _, fileName := range object.Metadata.Files {
			w.expected[filepath.ToSlash(filepath.Join(object.ID, fileName))] = object.Files[fileName]
		}
	}
	w.mu.Unlock()

	currentObjects := make(map[string]struct{}, len(representation.Objects))
	for _, object := range representation.Objects {
		currentObjects[object.ID] = struct{}{}
	}
	for objectID := range previousObjects {
		if _, ok := currentObjects[objectID]; ok {
			continue
		}
		if err := w.watcher.Remove(filepath.Join(w.root, objectID)); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
			return fmt.Errorf("unwatch removed object directory: %w", err)
		}
	}

	if err := ApplySnapshot(w.root, representation); err != nil {
		return err
	}
	for _, object := range representation.Objects {
		if err := w.watcher.Add(filepath.Join(w.root, object.ID)); err != nil {
			return fmt.Errorf("watch object directory: %w", err)
		}
	}

	return nil
}

func (w *Watcher) ApplyObject(object RepresentationObject) error {
	w.mu.Lock()
	prefix := filepath.ToSlash(object.ID) + "/"
	for path := range w.expected {
		if strings.HasPrefix(path, prefix) {
			delete(w.expected, path)
		}
	}
	for _, fileName := range object.Metadata.Files {
		w.expected[filepath.ToSlash(filepath.Join(object.ID, fileName))] = object.Files[fileName]
	}
	w.mu.Unlock()

	if err := ApplyObject(w.root, object); err != nil {
		return err
	}
	if err := w.watcher.Add(filepath.Join(w.root, object.ID)); err != nil {
		return fmt.Errorf("watch object directory: %w", err)
	}

	return nil
}

func (w *Watcher) RemoveObject(objectID string) error {
	w.mu.Lock()
	prefix := filepath.ToSlash(objectID) + "/"
	for path := range w.expected {
		if strings.HasPrefix(path, prefix) {
			delete(w.expected, path)
		}
	}
	w.mu.Unlock()

	if err := w.watcher.Remove(filepath.Join(w.root, objectID)); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
		return fmt.Errorf("unwatch object directory: %w", err)
	}

	return RemoveObject(w.root, objectID)
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
	expected, ok := w.expected[path]
	w.mu.Unlock()
	if !ok {
		return
	}

	content, err := os.ReadFile(filepath.Join(w.root, filepath.FromSlash(path)))
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

	select {
	case w.changes <- FileChange{Path: path, Content: string(content)}:
		w.mu.Lock()
		w.expected[path] = string(content)
		w.mu.Unlock()
	default:
	}
}

func expectedObjectIDs(expected map[string]string) map[string]struct{} {
	objects := make(map[string]struct{})
	for path := range expected {
		objectID, _, ok := strings.Cut(path, "/")
		if ok {
			objects[objectID] = struct{}{}
		}
	}

	return objects
}

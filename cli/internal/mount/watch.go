package mount

import (
	"fmt"
	"os"
	"path/filepath"
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
		watcher.Close()
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

func (w *Watcher) SetSnapshot(representation Representation) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.expected = make(map[string]string)
	for _, object := range representation.Objects {
		objectRoot := filepath.Join(w.root, object.ID)
		if err := w.watcher.Add(objectRoot); err != nil {
			return fmt.Errorf("watch object directory: %w", err)
		}
		for _, fileName := range object.Metadata.Files {
			w.expected[filepath.ToSlash(filepath.Join(object.ID, fileName))] = object.Files[fileName]
		}
	}

	return nil
}

func (w *Watcher) SetObject(object RepresentationObject) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	objectRoot := filepath.Join(w.root, object.ID)
	if err := w.watcher.Add(objectRoot); err != nil {
		return fmt.Errorf("watch object directory: %w", err)
	}
	for _, fileName := range object.Metadata.Files {
		w.expected[filepath.ToSlash(filepath.Join(object.ID, fileName))] = object.Files[fileName]
	}

	return nil
}

func (w *Watcher) RemoveObject(objectID string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	prefix := filepath.ToSlash(objectID) + "/"
	for path := range w.expected {
		if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
			delete(w.expected, path)
		}
	}
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

	w.mu.Lock()
	w.expected[path] = string(content)
	w.mu.Unlock()

	select {
	case w.changes <- FileChange{Path: path, Content: string(content)}:
	default:
	}
}

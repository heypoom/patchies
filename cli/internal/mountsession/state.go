package mountsession

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"syscall"

	"github.com/heypoom/patchies/cli/internal/mount"
)

const stateFormat = "patchies.mount-state.v1"

type diskState struct {
	Format      string            `json:"format"`
	InstanceURL string            `json:"instanceURL"`
	SessionID   string            `json:"sessionId"`
	PatchID     string            `json:"patchId"`
	Projection  map[string]string `json:"projection,omitempty"`
	Baseline    map[string]string `json:"baseline"`
	Pending     map[string]string `json:"pending"`
	PendingBase map[string]string `json:"pendingBase"`
	Unsynced    map[string]string `json:"unsynced"`
	InFlight    *savedOperation   `json:"inFlight,omitempty"`
}

type savedOperation struct {
	ID         string          `json:"id"`
	Path       string          `json:"path"`
	Content    string          `json:"content"`
	Baseline   string          `json:"baseline"`
	Command    json.RawMessage `json:"command,omitempty"`
	Generation string          `json:"generation"`
}

func privateDirectory(root string) (string, error) {
	path := filepath.Join(root, ".patchies")
	if info, err := os.Lstat(path); err == nil {
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New(".patchies must be a real directory")
		}
	} else if !os.IsNotExist(err) {
		return "", err
	}

	if err := os.MkdirAll(path, 0o700); err != nil {
		return "", err
	}
	if err := os.Chmod(path, 0o700); err != nil {
		return "", err
	}
	return path, nil
}

func lockMount(root string) (func(), error) {
	directory, err := privateDirectory(root)
	if err != nil {
		return nil, err
	}

	path := filepath.Join(directory, "lock")
	fd, err := syscall.Open(path, syscall.O_CREAT|syscall.O_RDWR|syscall.O_NOFOLLOW, 0o600)
	if err != nil {
		return nil, err
	}
	file := os.NewFile(uintptr(fd), path)
	if err := syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = file.Close()
		return nil, errors.New("mount directory is already in use")
	}

	return func() { _ = syscall.Flock(fd, syscall.LOCK_UN); _ = file.Close() }, nil
}

func atomicState(root, name string, value any) error {
	directory, err := privateDirectory(root)
	if err != nil {
		return err
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(directory, "state-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(file.Name()) }()
	defer func() { _ = file.Close() }()

	if _, err := file.Write(encoded); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(file.Name(), filepath.Join(directory, name)); err != nil {
		return err
	}
	dir, err := os.Open(directory)
	if err != nil {
		return err
	}
	defer func() { _ = dir.Close() }()
	return dir.Sync()
}

func (s *Session) saveState(state *sessionRunState) error {
	saved := diskState{Format: stateFormat, InstanceURL: s.connection.InstanceURL, SessionID: s.connection.SessionID, PatchID: state.patchID, Baseline: state.baseline, Projection: state.projection, Pending: state.pending, PendingBase: state.pendingBase, Unsynced: state.unsynced}
	if op := state.inFlight; op != nil {
		saved.InFlight = &savedOperation{ID: op.operationID, Path: op.path, Content: op.content, Baseline: op.baseline, Command: op.command, Generation: op.generation}
	}
	return atomicState(s.path, "state.json", saved)
}

func (s *Session) loadState() (*sessionRunState, error) {
	path := filepath.Join(s.path, ".patchies", "state.json")
	if info, err := os.Lstat(path); err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return nil, errors.New("resume requires a regular .patchies/state.json")
	}
	encoded, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var saved diskState
	if err := json.Unmarshal(encoded, &saved); err != nil {
		return nil, fmt.Errorf("decode mount state: %w", err)
	}
	if saved.Format != stateFormat || saved.InstanceURL != s.connection.InstanceURL || saved.SessionID != s.connection.SessionID || saved.PatchID == "" || saved.Baseline == nil {
		return nil, errors.New("mount state does not match this session or has no ready baseline")
	}
	state := newRunState()
	state.patchID = saved.PatchID
	state.baseline = saved.Baseline
	for path, content := range saved.Projection {
		if err := mount.ValidateWritablePath(s.path, path); err != nil {
			return nil, err
		}
		actual, err := os.ReadFile(filepath.Join(s.path, filepath.FromSlash(path)))
		if err == nil && string(actual) == content {
			state.baseline[path] = content
		}
	}
	if saved.Pending != nil {
		state.pending = saved.Pending
	}
	if saved.PendingBase != nil {
		state.pendingBase = saved.PendingBase
	}
	if saved.Unsynced != nil {
		state.unsynced = saved.Unsynced
	}
	if op := saved.InFlight; op != nil {
		state.inFlight = &pendingOperation{operationID: op.ID, path: op.Path, content: op.Content, baseline: op.Baseline, command: op.Command, generation: op.Generation}
	}

	// Validate every writable path before it is tracked or used for recovery.
	for _, files := range []map[string]string{state.baseline, state.pending, state.unsynced} {
		for path := range files {
			if err := mount.ValidateWritablePath(s.path, path); err != nil {
				return nil, err
			}
		}
	}
	return state, nil
}

func newRunState() *sessionRunState {
	return &sessionRunState{pending: make(map[string]string), unsynced: make(map[string]string), baseline: make(map[string]string), pendingBase: make(map[string]string)}
}

func (s *Session) seedResume(watcher *mount.Watcher, state *sessionRunState) error {
	expected := make(map[string]string, len(state.baseline))
	for path, canonical := range state.baseline {
		expected[path] = canonical
		known, hasKnown := state.unsynced[path]
		if op := state.inFlight; op != nil && op.path == path {
			known, hasKnown = op.content, true
		}
		if value, exists := state.pending[path]; exists {
			known, hasKnown = value, true
		}
		if !hasKnown {
			continue
		}

		actual, err := os.ReadFile(filepath.Join(s.path, filepath.FromSlash(path)))
		if err != nil {
			continue
		}
		if string(actual) == known {
			expected[path] = known
		} else {
			state.pending[path] = string(actual)
			delete(state.unsynced, path)
			if _, exists := state.pendingBase[path]; !exists {
				state.pendingBase[path] = canonical
			}
			expected[path] = string(actual)
		}
	}
	return watcher.Seed(expected)
}

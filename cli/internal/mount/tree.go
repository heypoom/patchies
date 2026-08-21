package mount

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const RepresentationVersion = "patchies.vfs-mount.v1"

const objectCodeSkillRoot = ".agents/skills/writing-patchies-object-code"

type Representation struct {
	Format  string  `json:"format"`
	PatchID string  `json:"patchId"`
	Entries []Entry `json:"entries"`
}

type Entry struct {
	Path    string `json:"path"`
	Kind    string `json:"kind"`
	Content string `json:"content,omitempty"`
}

// Own only the generated skill, not the user's other agent configuration.
func safePath(root, path string) (string, error) {
	parts := strings.Split(path, "/")
	managedAgentPath := path == ".agents" || path == ".agents/skills" || path == objectCodeSkillRoot || strings.HasPrefix(path, objectCodeSkillRoot+"/")
	if parts[0] != "objects" && parts[0] != "patch" && parts[0] != "references" && !managedAgentPath {
		return "", fmt.Errorf("invalid mount namespace: %q", path)
	}

	current := root
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || strings.ContainsAny(part, "\\\\\x00") {
			return "", fmt.Errorf("invalid mount path: %q", path)
		}
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if err != nil && !os.IsNotExist(err) {
			return "", err
		}
		if err == nil && info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("mount path is a symlink: %q", path)
		}
	}

	return current, nil
}

func validateEntry(root string, entry Entry) error {
	if _, err := safePath(root, entry.Path); err != nil {
		return err
	}
	if entry.Kind != "file" && entry.Kind != "directory" {
		return fmt.Errorf("invalid entry kind: %q", entry.Kind)
	}
	if (!strings.Contains(entry.Path, "/") || entry.Path == ".agents/skills" || entry.Path == objectCodeSkillRoot) && entry.Kind != "directory" {
		return fmt.Errorf("namespace root must be a directory")
	}
	return nil
}

func ApplySnapshot(root string, tree Representation) error {
	if tree.Format != RepresentationVersion {
		return fmt.Errorf("unsupported mount format %q", tree.Format)
	}
	expected := map[string]bool{"objects": true, "patch": true, "references": true, objectCodeSkillRoot: true}
	for _, entry := range tree.Entries {
		if err := validateEntry(root, entry); err != nil {
			return err
		}
		expected[entry.Path] = true
		for parent := filepath.ToSlash(filepath.Dir(entry.Path)); parent != "."; parent = filepath.ToSlash(filepath.Dir(parent)) {
			expected[parent] = true
		}
	}

	for _, namespace := range []string{"objects", "patch", "references", objectCodeSkillRoot} {
		path, err := safePath(root, namespace)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(path, 0o755); err != nil {
			return err
		}
		err = filepath.WalkDir(path, func(path string, entry os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			relative, err := filepath.Rel(root, path)
			if err != nil {
				return err
			}
			if expected[filepath.ToSlash(relative)] {
				return nil
			}
			if err := RemoveEntry(root, filepath.ToSlash(relative)); err != nil {
				return err
			}
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	for _, entry := range tree.Entries {
		if err := ApplyEntry(root, entry); err != nil {
			return err
		}
	}
	return nil
}

func ApplyEntry(root string, entry Entry) error {
	if err := validateEntry(root, entry); err != nil {
		return err
	}
	target, err := safePath(root, entry.Path)
	if err != nil {
		return err
	}
	if info, err := os.Lstat(target); err == nil && info.IsDir() != (entry.Kind == "directory") {
		if err := RemoveEntry(root, entry.Path); err != nil {
			return err
		}
	}
	if entry.Kind == "directory" {
		return os.MkdirAll(target, 0o755)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	if err := writeFile(filepath.Dir(target), filepath.Base(target), []byte(entry.Content)); err != nil {
		return err
	}
	if isReadOnlyPath(entry.Path) {
		return os.Chmod(target, 0o444)
	}
	return nil
}

func isReadOnlyPath(path string) bool {
	return path == "references" || strings.HasPrefix(path, "references/") || path == ".agents" || strings.HasPrefix(path, ".agents/")
}

func RemoveEntry(root, path string) error {
	if !strings.Contains(path, "/") || path == ".agents/skills" || path == objectCodeSkillRoot {
		return fmt.Errorf("cannot remove mount namespace: %q", path)
	}
	target, err := safePath(root, path)
	if err != nil {
		return err
	}
	return os.RemoveAll(target)
}

func writeFile(root, name string, content []byte) error {
	target := filepath.Join(root, name)
	temporary, err := os.CreateTemp(root, ".patchies-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer func() { _ = os.Remove(temporaryPath) }()
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Chmod(0o644); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, target)
}

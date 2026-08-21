package mount

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMountMirrorsNamespacesAndPrunesDeletedEntries(t *testing.T) {
	root := t.TempDir()
	tree := Representation{Format: RepresentationVersion, PatchID: "patch-1", Entries: []Entry{
		{Path: "objects/glsl-24/shader.glsl", Kind: "file", Content: "void main() {}"},
		{Path: "patch/lib/a.js", Kind: "file", Content: "export default 'こんにちは'"},
		{Path: "patch/empty", Kind: "directory"},
	}}
	if err := ApplySnapshot(root, tree); err != nil {
		t.Fatal(err)
	}
	for _, entry := range tree.Entries {
		path := filepath.Join(root, filepath.FromSlash(entry.Path))
		if entry.Kind == "file" {
			content, err := os.ReadFile(path)
			if err != nil || string(content) != entry.Content {
				t.Fatalf("%s = %q: %v", path, content, err)
			}
		} else if info, err := os.Stat(path); err != nil || !info.IsDir() {
			t.Fatalf("missing directory %s", path)
		}
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 4 {
		t.Fatalf("mount roots = %v: %v", entries, err)
	}
	if err := ApplySnapshot(root, Representation{Format: RepresentationVersion}); err != nil {
		t.Fatal(err)
	}
	for _, namespace := range []string{"objects", "patch", "references"} {
		entries, err := os.ReadDir(filepath.Join(root, namespace))
		if err != nil || len(entries) != 0 {
			t.Fatalf("namespace not empty: %v, %v", entries, err)
		}
	}
}

func TestMountRejectsTraversalAndSymlinks(t *testing.T) {
	root := t.TempDir()
	for _, path := range []string{".", "..", "objects/../outside", "patch/./a", "patch//a", `patch/a\b`, "/patch/a", "user/a", ".agents/config.json", ".agents/skills/other/SKILL.md", objectCodeSkillRoot + "/../other/SKILL.md", ".agents/skills"} {
		if err := ApplyEntry(root, Entry{Path: path, Kind: "file"}); err == nil {
			t.Fatalf("accepted %q", path)
		}
		if err := RemoveEntry(root, path); err == nil {
			t.Fatalf("removed %q", path)
		}
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "objects")); err != nil {
		t.Fatal(err)
	}
	if err := ApplyEntry(root, Entry{Path: "objects/a/code.js", Kind: "file"}); err == nil {
		t.Fatal("followed symlink")
	}
	if err := RemoveEntry(root, "objects/a"); err == nil {
		t.Fatal("deleted through symlink")
	}
}

func TestSkillRefreshPreservesUnmanagedAgentFiles(t *testing.T) {
	root := t.TempDir()
	other := filepath.Join(root, ".agents", "skills", "personal", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(other), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(other, []byte("personal skill"), 0o644); err != nil {
		t.Fatal(err)
	}
	config := filepath.Join(root, ".agents", "config.json")
	if err := os.WriteFile(config, []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, entries := range [][]Entry{
		{{Path: objectCodeSkillRoot + "/SKILL.md", Kind: "file", Content: "generated skill"}},
		nil,
	} {
		if err := ApplySnapshot(root, Representation{Format: RepresentationVersion, Entries: entries}); err != nil {
			t.Fatal(err)
		}
	}

	for path, expected := range map[string]string{other: "personal skill", config: "{}"} {
		content, err := os.ReadFile(path)
		if err != nil || string(content) != expected {
			t.Fatalf("unmanaged file changed: %s %q %v", path, content, err)
		}
	}
}

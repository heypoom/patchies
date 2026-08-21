package mount

import (
	"os"
	"path/filepath"
	"testing"
)

func TestApplySnapshotWritesObjectsAndRemovesDeletedObjects(t *testing.T) {
	root := t.TempDir()
	representation := Representation{
		Format:  RepresentationVersion,
		PatchID: "patch-1",
		Objects: []RepresentationObject{{
			ID:       "glsl-24",
			Metadata: ObjectMetadata{Format: RepresentationVersion, ID: "glsl-24", ObjectType: "glsl", Files: []string{"shader.frag"}},
			Files:    map[string]string{"shader.frag": "void main() {}"},
		}},
	}

	if err := ApplySnapshot(root, representation); err != nil {
		t.Fatalf("apply first snapshot: %v", err)
	}

	code, err := os.ReadFile(filepath.Join(root, "glsl-24", "shader.frag"))
	if err != nil || string(code) != "void main() {}" {
		t.Fatalf("shader contents = %q, err = %v", code, err)
	}

	if err := ApplySnapshot(root, Representation{Format: RepresentationVersion, PatchID: "patch-1"}); err != nil {
		t.Fatalf("apply deletion snapshot: %v", err)
	}

	if _, err := os.Stat(filepath.Join(root, "glsl-24")); !os.IsNotExist(err) {
		t.Fatalf("deleted object directory error = %v, want not exist", err)
	}
}

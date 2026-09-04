package mount

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const RepresentationVersion = "patchies.representation.v1"

type Representation struct {
	Format  string                 `json:"format"`
	PatchID string                 `json:"patchId"`
	Objects []RepresentationObject `json:"objects"`
}

type RepresentationObject struct {
	ID       string            `json:"id"`
	Metadata ObjectMetadata    `json:"metadata"`
	Files    map[string]string `json:"files"`
}

type ObjectMetadata struct {
	Format     string   `json:"format"`
	ID         string   `json:"id"`
	ObjectType string   `json:"objectType"`
	Files      []string `json:"files"`
}

func ApplySnapshot(root string, representation Representation) error {
	if representation.Format != RepresentationVersion {
		return fmt.Errorf("unsupported representation format %q", representation.Format)
	}

	if err := os.MkdirAll(root, 0o755); err != nil {
		return fmt.Errorf("create mount root: %w", err)
	}

	expected := make(map[string]struct{}, len(representation.Objects))
	for _, object := range representation.Objects {
		expected[object.ID] = struct{}{}
		if err := ApplyObject(root, object); err != nil {
			return err
		}
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return fmt.Errorf("read mount root: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, ok := expected[entry.Name()]; ok {
			continue
		}
		if _, err := os.Stat(filepath.Join(root, entry.Name(), "patchies.object.json")); err == nil {
			if err := os.RemoveAll(filepath.Join(root, entry.Name())); err != nil {
				return fmt.Errorf("remove deleted object directory: %w", err)
			}
		}
	}

	manifest, err := json.MarshalIndent(struct {
		Format  string `json:"format"`
		PatchID string `json:"patchId"`
	}{representation.Format, representation.PatchID}, "", "  ")
	if err != nil {
		return fmt.Errorf("encode mount manifest: %w", err)
	}

	return writeFile(root, "patchies.json", append(manifest, '\n'))
}

func ApplyObject(root string, object RepresentationObject) error {
	if !validObjectID(object.ID) || object.ID != object.Metadata.ID || object.Metadata.Format != RepresentationVersion {
		return fmt.Errorf("invalid representation object")
	}

	objectRoot := filepath.Join(root, object.ID)
	if err := os.MkdirAll(objectRoot, 0o755); err != nil {
		return fmt.Errorf("create object directory: %w", err)
	}

	metadata, err := json.MarshalIndent(object.Metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("encode object metadata: %w", err)
	}
	if err := writeFile(objectRoot, "patchies.object.json", append(metadata, '\n')); err != nil {
		return err
	}

	for _, fileName := range object.Metadata.Files {
		content, ok := object.Files[fileName]
		if !ok || !validObjectID(fileName) || fileName == "patchies.object.json" {
			return fmt.Errorf("invalid object file %q", fileName)
		}
		if err := writeFile(objectRoot, fileName, []byte(content)); err != nil {
			return err
		}
	}

	return nil
}

func RemoveObject(root, objectID string) error {
	if !validObjectID(objectID) {
		return fmt.Errorf("invalid representation object")
	}

	objectRoot := filepath.Join(root, objectID)
	if _, err := os.Stat(filepath.Join(objectRoot, "patchies.object.json")); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("inspect object directory: %w", err)
	}

	if err := os.RemoveAll(objectRoot); err != nil {
		return fmt.Errorf("remove object directory: %w", err)
	}

	return nil
}

func writeFile(root, name string, content []byte) error {
	target := filepath.Join(root, name)
	temporary, err := os.CreateTemp(root, ".patchies-*")
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() { _ = os.Remove(temporaryPath) }()

	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write temporary file: %w", err)
	}
	if err := temporary.Chmod(0o644); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("set file permissions: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary file: %w", err)
	}
	if err := os.Rename(temporaryPath, target); err != nil {
		return fmt.Errorf("replace file: %w", err)
	}

	return nil
}

func validObjectID(id string) bool {
	return id != "" && id != "." && id != ".." && !strings.ContainsAny(id, `/\\`) && filepath.Base(id) == id && filepath.Clean(id) == id
}

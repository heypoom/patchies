package main

import (
	"archive/zip"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	source := flag.String("source", "", "directory containing static files")
	destination := flag.String("destination", "", "path for the static ZIP archive")
	flag.Parse()

	if *source == "" || *destination == "" {
		fmt.Fprintln(os.Stderr, "-source and -destination are required")
		os.Exit(2)
	}

	if err := archiveDirectory(*source, *destination); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func archiveDirectory(source string, destination string) error {
	output, err := os.Create(destination)
	if err != nil {
		return fmt.Errorf("create archive: %w", err)
	}

	archive := zip.NewWriter(output)
	err = filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if entry.IsDir() {
			return nil
		}

		relativePath, err := filepath.Rel(source, path)
		if err != nil {
			return fmt.Errorf("get relative path: %w", err)
		}

		input, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("open %s: %w", relativePath, err)
		}

		entryWriter, err := archive.Create(strings.ReplaceAll(relativePath, string(filepath.Separator), "/"))
		if err != nil {
			input.Close()
			return fmt.Errorf("add %s: %w", relativePath, err)
		}

		if _, err := io.Copy(entryWriter, input); err != nil {
			input.Close()
			return fmt.Errorf("archive %s: %w", relativePath, err)
		}

		return input.Close()
	})
	if err != nil {
		archive.Close()
		output.Close()
		return fmt.Errorf("walk static files: %w", err)
	}

	if err := archive.Close(); err != nil {
		output.Close()
		return fmt.Errorf("finish archive: %w", err)
	}

	if err := output.Close(); err != nil {
		return fmt.Errorf("close archive: %w", err)
	}

	return nil
}

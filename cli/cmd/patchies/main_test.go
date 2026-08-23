package main

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestReadMountOptionsPromptsForMissingTokenAndPath(t *testing.T) {
	var output bytes.Buffer

	token, path, err := readMountOptions(
		nil,
		strings.NewReader("patchies://v2/example\n./spectral-garden\n"),
		&output,
	)
	if err != nil {
		t.Fatalf("read mount options: %v", err)
	}

	if token != "patchies://v2/example" {
		t.Fatalf("token = %q", token)
	}
	if path != "./spectral-garden" {
		t.Fatalf("path = %q", path)
	}
	if output.String() != "Remote Control token: Mount path: " {
		t.Fatalf("prompt output = %q", output.String())
	}
}

func TestReadTokenFileDescriptor(t *testing.T) {
	read, write, err := os.Pipe()
	if err != nil {
		t.Fatalf("create pipe: %v", err)
	}
	defer read.Close()

	if _, err := write.WriteString("patchies://v2/token\n"); err != nil {
		t.Fatalf("write token: %v", err)
	}
	if err := write.Close(); err != nil {
		t.Fatalf("close token writer: %v", err)
	}

	token, err := readTokenFileDescriptor(int(read.Fd()))
	if err != nil {
		t.Fatalf("read token: %v", err)
	}
	if token != "patchies://v2/token" {
		t.Fatalf("token = %q", token)
	}
}

func TestReadMountOptionsKeepsProvidedFlags(t *testing.T) {
	var output bytes.Buffer

	token, path, err := readMountOptions(
		[]string{"--token", "patchies://v2/example", "--path", "./spectral-garden"},
		strings.NewReader(""),
		&output,
	)
	if err != nil {
		t.Fatalf("read mount options: %v", err)
	}

	if token != "patchies://v2/example" || path != "./spectral-garden" {
		t.Fatalf("options = (%q, %q)", token, path)
	}
	if output.Len() != 0 {
		t.Fatalf("expected no prompts, got %q", output.String())
	}
}

func TestReadMountOptionsRejectsEmptyPrompt(t *testing.T) {
	var output bytes.Buffer

	_, _, err := readMountOptions(nil, strings.NewReader("\n"), &output)
	if err == nil || err.Error() != "remote control token cannot be empty" {
		t.Fatalf("error = %v", err)
	}
}

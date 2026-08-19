package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"io/fs"
)

// frontendArchive contains the generated static SvelteKit application. Release
// builds generate static.zip from ui/build before compiling. An archive keeps
// object documentation filenames such as *~.md valid for Go embedding.
//
//go:embed static.zip
var frontendArchive []byte

func frontendFiles() (fs.FS, error) {
	return zip.NewReader(bytes.NewReader(frontendArchive), int64(len(frontendArchive)))
}

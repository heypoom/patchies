package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"io/fs"
	"net/http"
	"strings"
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

func newStaticFrontendHandler(frontend fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(frontend))

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		cleanPath := strings.Trim(request.URL.Path, "/")
		if cleanPath == "" || strings.HasSuffix(cleanPath, ".html") {
			fileServer.ServeHTTP(response, request)

			return
		}

		htmlPath := cleanPath + ".html"
		info, err := fs.Stat(frontend, htmlPath)
		if err != nil || info.IsDir() {
			fileServer.ServeHTTP(response, request)

			return
		}

		rewrittenRequest := request.Clone(request.Context())
		rewrittenURL := *request.URL
		rewrittenURL.Path = "/" + htmlPath
		rewrittenURL.RawPath = ""
		rewrittenRequest.URL = &rewrittenURL

		fileServer.ServeHTTP(response, rewrittenRequest)
	})
}

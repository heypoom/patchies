package mountsession

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/heypoom/patchies/cli/internal/client"
)

type localRequest struct {
	id      string
	command json.RawMessage
	reply   chan localResponse
	ctx     context.Context
}

type localResponse struct {
	OperationID       string          `json:"operationId,omitempty"`
	Error             string          `json:"error,omitempty"`
	Result            json.RawMessage `json:"result,omitempty"`
	BrowserGeneration string          `json:"browserGeneration,omitempty"`
	Fresh             bool            `json:"fresh"`
	PatchRevision     int64           `json:"patchRevision"`
}

func (s *Session) finishCommand(op *pendingOperation, commit *client.CanonicalCommit) error {
	if len(op.command) == 0 {
		return nil
	}

	result := localResponse{Fresh: commit.Error == "", OperationID: op.operationID, Error: commit.Error, Result: commit.Result, BrowserGeneration: commit.BrowserGeneration, PatchRevision: commit.PatchRevision}
	if err := atomicState(s.path, "last-command.json", struct {
		Command  json.RawMessage `json:"command"`
		Response localResponse   `json:"response"`
	}{op.command, result}); err != nil {
		return err
	}
	if op.reply != nil {
		op.reply <- result
		op.reply = nil
	}

	return nil
}

func (s *Session) serveSocket(ctx context.Context) (func(), error) {
	// Unix socket paths are short even when the chosen mount root is very long.
	directory, err := os.MkdirTemp("/tmp", "patchies-remote-")
	if err != nil {
		return nil, err
	}
	path := filepath.Join(directory, "control.sock")
	listener, err := net.Listen("unix", path)
	if err != nil {
		_ = os.RemoveAll(directory)
		return nil, err
	}
	cleanup := func() { _ = listener.Close(); _ = os.RemoveAll(directory) }
	if err := os.Chmod(path, 0o600); err != nil {
		cleanup()
		return nil, err
	}
	if err := atomicState(s.path, "socket.json", struct {
		Path string `json:"path"`
	}{path}); err != nil {
		cleanup()
		return nil, err
	}

	handler := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		if request.Method != http.MethodPost || request.URL.Path != "/command" {
			response.WriteHeader(http.StatusNotFound)
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(response, request.Body, 1<<20))
		if err != nil || !json.Valid(body) {
			response.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(response).Encode(localResponse{Error: "invalid command JSON"})
			return
		}
		id, err := randomID()
		if err != nil {
			response.WriteHeader(http.StatusInternalServerError)
			return
		}
		deadline, cancel := context.WithTimeout(request.Context(), 30*time.Second)
		defer cancel()
		local := &localRequest{id: id, command: body, reply: make(chan localResponse, 1), ctx: deadline}

		select {
		case s.commands <- local:
		case <-deadline.Done():
			_ = json.NewEncoder(response).Encode(localResponse{Error: "browser_unavailable: mount is reconnecting"})
			return
		case <-ctx.Done():
			_ = json.NewEncoder(response).Encode(localResponse{Error: "mount stopped"})
			return
		}
		select {
		case result := <-local.reply:
			_ = json.NewEncoder(response).Encode(result)
		case <-deadline.Done():
			_ = json.NewEncoder(response).Encode(localResponse{OperationID: id, Error: "outcome_unknown: command deadline reached; inspect graph and .patchies/last-command.json before repeating"})
		case <-ctx.Done():
			_ = json.NewEncoder(response).Encode(localResponse{OperationID: id, Error: "outcome_unknown: mount stopped"})
		}
	})
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = server.Serve(listener) }()

	return func() {
		_ = server.Close()
		cleanup()
		_ = os.Remove(filepath.Join(s.path, ".patchies", "socket.json"))
	}, nil
}

func ExecuteLocal(ctx context.Context, root string, command json.RawMessage, output io.Writer) error {
	encoded, err := os.ReadFile(filepath.Join(root, ".patchies", "socket.json"))
	if err != nil {
		return errors.New("no running mount at this path")
	}
	var locator struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal(encoded, &locator); err != nil {
		return errors.New("invalid mount socket locator")
	}
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", locator.Path)
	}}
	defer transport.CloseIdleConnections()
	remote := &http.Client{Transport: transport, Timeout: 35 * time.Second}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://mount/command", bytes.NewReader(command))
	if err != nil {
		return err
	}
	response, err := remote.Do(request)
	if err != nil {
		return fmt.Errorf("mount command unavailable: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	var result localResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return err
	}
	if err := json.NewEncoder(output).Encode(result); err != nil {
		return err
	}
	if result.Error != "" {
		return errors.New(result.Error)
	}
	return nil
}

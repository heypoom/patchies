package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/heypoom/patchies/cli/internal/client"
	"github.com/heypoom/patchies/cli/internal/mount"
	"github.com/heypoom/patchies/cli/internal/protocol"
	"github.com/heypoom/patchies/cli/internal/syncqueue"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "patchies:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 || args[0] != "mount" {
		return errors.New("usage: patchies mount --token <connection-string> --path <directory>")
	}

	flags := flag.NewFlagSet("mount", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	token := flags.String("token", "", "Remote Control connection string")
	path := flags.String("path", "", "empty or new mount directory")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if *token == "" || *path == "" {
		return errors.New("--token and --path are required")
	}

	connection, err := protocol.ParseConnection(*token)
	if err != nil {
		return err
	}

	return mountRemotePatch(connection, *path)
}

func mountRemotePatch(connection protocol.Connection, path string) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	remote := client.New(connection)
	if err := os.MkdirAll(path, 0o755); err != nil {
		return fmt.Errorf("create mount directory: %w", err)
	}

	watcher, err := mount.NewWatcher(path)
	if err != nil {
		return err
	}
	defer watcher.Close()

	queue := syncqueue.New()
	var submitContext context.Context
	var submitContextMu sync.RWMutex
	var submitWG sync.WaitGroup
	submitNext := func() {}
	submitNext = func() {
		operation, ok := queue.Next()
		if !ok {
			return
		}

		operationID, err := randomOperationID()
		if err != nil {
			queue.Reject()
			fmt.Fprintln(os.Stderr, "patchies: generate operation ID:", err)
			return
		}

		submitContextMu.RLock()
		operationContext := submitContext
		submitContextMu.RUnlock()
		if operationContext == nil {
			queue.Reject()
			return
		}

		submitWG.Add(1)
		go func() {
			defer submitWG.Done()

			err := remote.SubmitOperation(operationContext, operation.ClientID, client.OperationRequest{
				OperationID:       operationID,
				BrowserGeneration: operation.BrowserGeneration,
				PatchRevision:     operation.Revision,
				Path:              operation.Path,
				Content:           operation.Content,
			})
			if err == nil {
				return
			}

			queue.Reject()
			fmt.Fprintln(os.Stderr, "patchies: submit local change:", err)
		}()
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case change := <-watcher.Changes():
				queue.Offer(change)
				submitNext()
			case err := <-watcher.Errors():
				fmt.Fprintln(os.Stderr, "patchies: filesystem watcher:", err)
			}
		}
	}()

	fmt.Fprintf(os.Stderr, "patchies: mounted %s; waiting for browser snapshot\n", path)
	for {
		session, err := remote.Attach(ctx)
		if err != nil {
			return err
		}

		streamContext, cancelStream := context.WithCancel(ctx)
		submitContextMu.Lock()
		submitContext = streamContext
		submitContextMu.Unlock()

		err = remote.StreamEvents(streamContext, session.ClientID, func(event client.Event) error {
			if event.Type == "session.reclaimed" {
				queue.Disconnect()
				cancelStream()
				return errSessionReclaimed
			}
			if revision, ok := revisionFromEvent(event); ok {
				queue.SetRevision(revision)
			}

			if acknowledgement, ok := acknowledgementFromEvent(event); ok {
				queue.Acknowledge(acknowledgement.PatchRevision)
				if acknowledgement.Applied {
					if err := applyAcknowledgedObject(path, watcher, acknowledgement); err != nil {
						return err
					}
				}
				submitNext()
				return nil
			}
			if objectID, object, ok, err := objectFromEvent(event); err != nil {
				return err
			} else if ok {
				if object == nil {
					fmt.Fprintf(os.Stderr, "patchies: removed object %s\n", objectID)
					watcher.RemoveObject(objectID)
					return mount.RemoveObject(path, objectID)
				}
				fmt.Fprintf(os.Stderr, "patchies: synchronized object %s\n", objectID)
				if err := mount.ApplyObject(path, *object); err != nil {
					return err
				}
				return watcher.SetObject(*object)
			}

			representation, ok, err := representationFromEvent(event)
			if err != nil {
				return err
			}
			if !ok {
				return nil
			}

			if err := mount.ApplySnapshot(path, representation); err != nil {
				return err
			}
			if err := watcher.SetSnapshot(representation); err != nil {
				return err
			}

			queue.Activate(session.BrowserGeneration, session.ClientID, patchRevisionFromEvent(event, session.PatchRevision))
			submitNext()
			fmt.Fprintf(os.Stderr, "patchies: synchronized patch revision from %s\n", event.Type)
			return nil
		})
		cancelStream()

		if !errors.Is(err, errSessionReclaimed) {
			submitWG.Wait()
			return err
		}

		submitWG.Wait()
		fmt.Fprintln(os.Stderr, "patchies: browser reloaded; reattaching local client")
	}
}

var errSessionReclaimed = errors.New("remote control session reclaimed")

func objectFromEvent(event client.Event) (string, *mount.RepresentationObject, bool, error) {
	if event.Type != "object.published" {
		return "", nil, false, nil
	}

	var body struct {
		ObjectID string                      `json:"objectId"`
		Object   *mount.RepresentationObject `json:"object"`
	}
	if err := json.Unmarshal(event.Data, &body); err != nil {
		return "", nil, false, fmt.Errorf("decode object update: %w", err)
	}
	if body.ObjectID == "" {
		return "", nil, false, errors.New("object update is missing object ID")
	}

	return body.ObjectID, body.Object, true, nil
}

func acknowledgementFromEvent(event client.Event) (client.OperationResult, bool) {
	if event.Type != "operation.acknowledged" {
		return client.OperationResult{}, false
	}

	var acknowledgement client.OperationResult
	if err := json.Unmarshal(event.Data, &acknowledgement); err != nil || !acknowledgement.Terminal {
		return client.OperationResult{}, false
	}

	return acknowledgement, true
}

func applyAcknowledgedObject(root string, watcher *mount.Watcher, acknowledgement client.OperationResult) error {
	if acknowledgement.ObjectID == "" || len(acknowledgement.Object) == 0 {
		return errors.New("applied operation acknowledgement is missing its canonical object")
	}

	var object mount.RepresentationObject
	if err := json.Unmarshal(acknowledgement.Object, &object); err != nil {
		return fmt.Errorf("decode acknowledged object: %w", err)
	}
	if object.ID != acknowledgement.ObjectID {
		return errors.New("acknowledged object ID does not match operation result")
	}
	if err := mount.ApplyObject(root, object); err != nil {
		return err
	}
	if err := watcher.SetObject(object); err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "patchies: synchronized object %s from operation acknowledgement\n", object.ID)
	return nil
}

func revisionFromEvent(event client.Event) (int64, bool) {
	revision := patchRevisionFromEvent(event, 0)
	return revision, revision != 0
}

func patchRevisionFromEvent(event client.Event, fallback int64) int64 {
	var body struct {
		PatchRevision int64 `json:"patchRevision"`
	}
	if err := json.Unmarshal(event.Data, &body); err != nil {
		return fallback
	}

	return body.PatchRevision
}

func randomOperationID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func representationFromEvent(event client.Event) (mount.Representation, bool, error) {
	var body struct {
		Representation json.RawMessage `json:"representation"`
	}
	switch event.Type {
	case "session.snapshot", "snapshot.published":
		if err := json.Unmarshal(event.Data, &body); err != nil {
			return mount.Representation{}, false, fmt.Errorf("decode %s: %w", event.Type, err)
		}
	default:
		return mount.Representation{}, false, nil
	}

	if len(body.Representation) == 0 || string(body.Representation) == "null" {
		return mount.Representation{}, false, nil
	}

	var representation mount.Representation
	if err := json.Unmarshal(body.Representation, &representation); err != nil {
		return mount.Representation{}, false, fmt.Errorf("decode patch representation: %w", err)
	}

	return representation, true, nil
}

package main

import (
	"testing"

	"github.com/heypoom/patchies/cli/internal/client"
)

func TestRepresentationFromSnapshotEvent(t *testing.T) {
	representation, ok, err := representationFromEvent(client.Event{
		Type: "session.snapshot",
		Data: []byte(`{"representation":{"format":"patchies.representation.v1","patchId":"patch-1","objects":[]}}`),
	})
	if err != nil || !ok {
		t.Fatalf("representationFromEvent error = %v, ok = %t", err, ok)
	}
	if representation.PatchID != "patch-1" {
		t.Fatalf("patch ID = %q, want patch-1", representation.PatchID)
	}
}

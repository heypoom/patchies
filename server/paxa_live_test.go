package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

func dialRelay(t *testing.T, server *httptest.Server) *websocket.Conn {
	t.Helper()
	client, err := websocket.Dial("ws"+strings.TrimPrefix(server.URL, "http"), "", server.URL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	_ = client.SetDeadline(time.Now().Add(3 * time.Second))
	return client
}

func TestPaxaRelayPassesCredentialsAndPreservesFrames(t *testing.T) {
	received := make(chan string, 1)
	upstreamClosed := make(chan struct{})
	upstream := httptest.NewServer(websocket.Handler(func(socket *websocket.Conn) {
		defer close(upstreamClosed)
		received <- socket.Request().Header.Get("Authorization")
		var frame relayFrame
		if err := relayCodec.Receive(socket, &frame); err != nil {
			t.Error(err)
			return
		}
		if frame.kind != websocket.TextFrame || string(frame.payload) != `{"type":"start"}` {
			t.Errorf("first provider frame = %s, kind %d; auth must not be forwarded", frame.payload, frame.kind)
			return
		}
		_ = relayCodec.Send(socket, relayFrame{kind: websocket.BinaryFrame, payload: []byte{0, 1, 255}})
		_ = websocket.Message.Send(socket, `{"type":"done"}`)
		// The relay must close upstream when the browser disconnects.
		_ = relayCodec.Receive(socket, &frame)
	}))
	defer upstream.Close()

	relay := httptest.NewServer(paxaLiveRelay("ws" + strings.TrimPrefix(upstream.URL, "http")))
	defer relay.Close()
	client := dialRelay(t, relay)
	if err := websocket.JSON.Send(client, map[string]string{"type": "auth", "apiKey": "test-key"}); err != nil {
		t.Fatal(err)
	}
	var ready map[string]string
	if err := websocket.JSON.Receive(client, &ready); err != nil || ready["type"] != "relayReady" {
		t.Fatalf("relay ready = %v, error %v", ready, err)
	}
	if header := <-received; header != "Bearer test-key" {
		t.Fatalf("upstream Authorization = %q", header)
	}
	if err := websocket.Message.Send(client, `{"type":"start"}`); err != nil {
		t.Fatal(err)
	}
	var frame relayFrame
	if err := relayCodec.Receive(client, &frame); err != nil {
		t.Fatal(err)
	}
	if frame.kind != websocket.BinaryFrame || !bytes.Equal(frame.payload, []byte{0, 1, 255}) {
		t.Fatalf("audio frame = %v, kind %d", frame.payload, frame.kind)
	}
	if err := relayCodec.Receive(client, &frame); err != nil {
		t.Fatal(err)
	}
	if frame.kind != websocket.TextFrame || string(frame.payload) != `{"type":"done"}` {
		t.Fatalf("event frame = %s, kind %d", frame.payload, frame.kind)
	}
	_ = client.Close()
	select {
	case <-upstreamClosed:
	case <-time.After(3 * time.Second):
		t.Fatal("upstream remained open after browser disconnected")
	}
}

func TestPaxaRelayRequiresAuthBeforeDialing(t *testing.T) {
	relay := httptest.NewServer(paxaLiveRelay("ws://127.0.0.1:1"))
	defer relay.Close()
	client := dialRelay(t, relay)
	_ = websocket.Message.Send(client, `{"type":"start"}`)
	var event map[string]string
	if err := websocket.JSON.Receive(client, &event); err != nil {
		t.Fatal(err)
	}
	if event["code"] != "relay_auth_required" {
		t.Fatalf("error code = %q", event["code"])
	}
}

func TestPaxaRelayRejectsCrossOriginUpgrade(t *testing.T) {
	relay := httptest.NewServer(paxaLiveRelay("ws://127.0.0.1:1"))
	defer relay.Close()
	client, err := websocket.Dial("ws"+strings.TrimPrefix(relay.URL, "http"), "", "https://unrelated.example")
	if err == nil {
		_ = client.Close()
		t.Fatal("cross-origin upgrade was accepted")
	}
}

func TestPaxaRelayReportsUpstreamUpgradeFailure(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}))
	defer upstream.Close()
	relay := httptest.NewServer(paxaLiveRelay("ws" + strings.TrimPrefix(upstream.URL, "http")))
	defer relay.Close()
	client := dialRelay(t, relay)
	_ = websocket.JSON.Send(client, map[string]string{"type": "auth", "apiKey": "rejected-key"})
	var event map[string]string
	if err := websocket.JSON.Receive(client, &event); err != nil {
		t.Fatal(err)
	}
	if event["code"] != "relay_upstream_unavailable" {
		t.Fatalf("error code = %q", event["code"])
	}
}

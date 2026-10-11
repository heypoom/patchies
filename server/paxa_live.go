package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

const paxaLiveURL = "wss://api.paxalabs.com/v1/tts/live"

// Keep frame types intact: Paxa sends JSON events and binary MP3 on the same socket.
type relayFrame struct {
	payload []byte
	kind    byte
}

var relayCodec = websocket.Codec{
	Marshal: func(value any) ([]byte, byte, error) {
		frame := value.(relayFrame)
		return frame.payload, frame.kind, nil
	},
	Unmarshal: func(data []byte, kind byte, value any) error {
		*value.(*relayFrame) = relayFrame{payload: data, kind: kind}
		return nil
	},
}

func paxaLiveRelay(upstreamURL string) http.Handler {
	return websocket.Server{
		Handshake: func(_ *websocket.Config, request *http.Request) error {
			origin, err := url.Parse(request.Header.Get("Origin"))
			if err != nil || origin.Host != request.Host || (origin.Scheme != "http" && origin.Scheme != "https") {
				return errors.New("same-origin WebSocket required")
			}
			return nil
		},
		Handler: func(client *websocket.Conn) {
			defer client.Close()
			client.MaxPayloadBytes = 4096
			_ = client.SetReadDeadline(time.Now().Add(10 * time.Second))

			var auth struct {
				Type   string `json:"type"`
				APIKey string `json:"apiKey"`
			}
			if err := websocket.JSON.Receive(client, &auth); err != nil || auth.Type != "auth" || strings.TrimSpace(auth.APIKey) == "" {
				relayError(client, "relay_auth_required")
				return
			}

			config, err := websocket.NewConfig(upstreamURL, "https://api.paxalabs.com")
			if err != nil {
				relayError(client, "relay_upstream_unavailable")
				return
			}
			config.Header.Set("Authorization", "Bearer "+strings.TrimSpace(auth.APIKey))
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			upstream, err := config.DialContext(ctx)
			cancel()
			if err != nil {
				relayError(client, "relay_upstream_unavailable")
				return
			}
			defer upstream.Close()

			client.MaxPayloadBytes = 1 << 20
			upstream.MaxPayloadBytes = 1 << 20
			if err := websocket.JSON.Send(client, map[string]string{"type": "relayReady"}); err != nil {
				return
			}

			done := make(chan struct{}, 2)
			forward := func(destination, source *websocket.Conn) {
				defer func() { done <- struct{}{} }()
				for {
					_ = source.SetReadDeadline(time.Now().Add(5 * time.Minute))
					var frame relayFrame
					if err := relayCodec.Receive(source, &frame); err != nil {
						return
					}
					_ = destination.SetWriteDeadline(time.Now().Add(30 * time.Second))
					if err := relayCodec.Send(destination, frame); err != nil {
						return
					}
				}
			}

			go forward(upstream, client)
			go forward(client, upstream)
			<-done
			_ = client.Close()
			_ = upstream.Close()
			<-done
		},
	}
}

func relayError(client *websocket.Conn, code string) {
	_ = client.SetWriteDeadline(time.Now().Add(5 * time.Second))
	payload, _ := json.Marshal(map[string]string{"type": "error", "code": code})
	_ = websocket.Message.Send(client, string(payload))
}

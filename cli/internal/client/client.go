package client

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/heypoom/patchies/cli/internal/protocol"
)

const requestTimeout = 30 * time.Second

type Client struct {
	connection protocol.Connection
	httpClient *http.Client
}

type SessionSnapshot struct {
	SessionID         string `json:"sessionId"`
	PatchID           string `json:"patchId"`
	BrowserGeneration string `json:"browserGeneration"`
	PatchRevision     int64  `json:"patchRevision"`
	ClientID          string `json:"clientId"`
}

type OperationRequest struct {
	OperationID       string `json:"operationId"`
	BrowserGeneration string `json:"browserGeneration"`
	BaseRevision      int64  `json:"baseRevision"`
	Path              string `json:"path"`
	Content           string `json:"content"`
}

type ObjectChange struct {
	ObjectID string          `json:"objectId"`
	Object   json.RawMessage `json:"object"`
}

type CanonicalCommit struct {
	CommitID          string         `json:"commitId"`
	OperationID       string         `json:"operationId,omitempty"`
	BrowserGeneration string         `json:"browserGeneration"`
	BaseRevision      int64          `json:"baseRevision"`
	PatchRevision     int64          `json:"patchRevision"`
	Applied           bool           `json:"applied"`
	Changes           []ObjectChange `json:"changes"`
}

type Event struct {
	ID   int64
	Type string
	Data json.RawMessage
}

type HTTPError struct {
	Status  int
	Code    string
	Message string
}

func (e *HTTPError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("remote control %s: %s", e.Code, e.Message)
	}

	return fmt.Sprintf("remote control request failed: %d", e.Status)
}

func New(connection protocol.Connection) *Client {
	return &Client{connection: connection, httpClient: http.DefaultClient}
}

func (c *Client) Attach(ctx context.Context) (SessionSnapshot, error) {
	var snapshot SessionSnapshot
	if err := c.requestJSON(ctx, http.MethodPost, "/api/remote-control/sessions/"+c.connection.SessionID+"/client", nil, &snapshot); err != nil {
		return SessionSnapshot{}, err
	}

	return snapshot, nil
}

func (c *Client) SubmitOperation(ctx context.Context, clientID string, operation OperationRequest) error {
	body := struct {
		ClientID string `json:"clientId"`
		OperationRequest
	}{clientID, operation}

	return c.requestJSON(ctx, http.MethodPost, "/api/remote-control/sessions/"+c.connection.SessionID+"/operations", body, nil)
}

func (c *Client) StreamEvents(ctx context.Context, clientID string, afterEventID int64, handle func(Event) error) error {
	path := "/api/remote-control/sessions/" + c.connection.SessionID + "/client/events?clientId=" + url.QueryEscape(clientID)
	request, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	if afterEventID > 0 {
		request.Header.Set("Last-Event-ID", strconv.FormatInt(afterEventID, 10))
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("open event stream: %w", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusOK {
		return decodeHTTPError(response)
	}

	return parseEventStream(response.Body, handle)
}

func (c *Client) requestJSON(ctx context.Context, method, path string, body, target any) error {
	var payload *bytes.Reader
	if body == nil {
		payload = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	requestContext, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	request, err := c.newRequest(requestContext, method, path, payload)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("remote control request: %w", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return decodeHTTPError(response)
	}

	if target == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}

	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	return nil
}

func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	request, err := http.NewRequestWithContext(ctx, method, c.connection.InstanceURL+path, body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+c.connection.Secret)

	return request, nil
}

func decodeHTTPError(response *http.Response) error {
	var body struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err == nil {
		return &HTTPError{Status: response.StatusCode, Code: body.Code, Message: body.Message}
	}

	return &HTTPError{Status: response.StatusCode}
}

func parseEventStream(body io.Reader, handle func(Event) error) error {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 64*1024), 64<<20)

	var event Event
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if event.Type != "" {
				if err := handle(event); err != nil {
					return err
				}
			}
			event = Event{}
			continue
		}

		if value, ok := strings.CutPrefix(line, "event: "); ok {
			event.Type = value
			continue
		}

		if value, ok := strings.CutPrefix(line, "id: "); ok {
			eventID, err := strconv.ParseInt(value, 10, 64)
			if err != nil || eventID < 0 {
				return fmt.Errorf("parse event ID %q", value)
			}
			event.ID = eventID
			continue
		}

		if value, ok := strings.CutPrefix(line, "data: "); ok {
			if event.Data != nil {
				event.Data = append(event.Data, '\n')
			}
			event.Data = append(event.Data, value...)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read event stream: %w", err)
	}

	return nil
}

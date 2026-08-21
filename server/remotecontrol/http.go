package remotecontrol

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
)

const ProtocolVersion = "patchies.remote-control.v2"
const maxProtocolPayload = 64 << 20

type HTTPHandler struct {
	app                    *echo.Echo
	relay                  *Relay
	sessionCreationLimiter *sessionCreationLimiter
}

type createSessionRequest struct {
	ProtocolVersion   string `json:"protocolVersion"`
	PatchID           string `json:"patchId"`
	BrowserGeneration string `json:"browserGeneration"`
}

type reclaimRequest struct {
	PatchID           string `json:"patchId"`
	BrowserGeneration string `json:"browserGeneration"`
	PatchRevision     int64  `json:"patchRevision"`
}

type detachClientRequest struct {
	ClientID string `json:"clientId"`
}

type submitOperationRequest struct {
	ClientID string `json:"clientId"`
	OperationRequest
}

type strictJSONBinder struct{}

func (strictJSONBinder) Bind(c *echo.Context, target any) error {
	mediaType, _, err := mime.ParseMediaType(c.Request().Header.Get(echo.HeaderContentType))
	if err != nil || mediaType != echo.MIMEApplicationJSON {
		return echo.ErrUnsupportedMediaType
	}

	request := c.Request()
	request.Body = http.MaxBytesReader(c.Response(), request.Body, maxProtocolPayload)
	defer func() { _ = request.Body.Close() }()

	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return echo.ErrBadRequest.Wrap(err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return echo.ErrBadRequest.Wrap(errors.New("request body must contain one JSON value"))
	}

	return nil
}

func NewHTTPHandler(relay *Relay) *HTTPHandler {
	handler := &HTTPHandler{relay: relay, sessionCreationLimiter: newSessionCreationLimiter()}
	app := echo.New()
	app.Binder = strictJSONBinder{}
	handler.app = app

	sessions := app.Group("/api/remote-control/sessions")
	sessions.POST("", func(c *echo.Context) error {
		var body createSessionRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.createSession(c.Response(), c.Request(), body)
		return nil
	})
	sessions.DELETE("/:sessionId", func(c *echo.Context) error {
		handler.revoke(c.Response(), c.Request(), c.Param("sessionId"))
		return nil
	})
	sessions.POST("/:sessionId/client", func(c *echo.Context) error {
		handler.attachClient(c.Response(), c.Request(), c.Param("sessionId"))
		return nil
	})
	sessions.DELETE("/:sessionId/client", func(c *echo.Context) error {
		var body detachClientRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.detachClient(c.Response(), c.Request(), c.Param("sessionId"), body)
		return nil
	})
	sessions.POST("/:sessionId/reclaim", func(c *echo.Context) error {
		var body reclaimRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.reclaim(c.Response(), c.Request(), c.Param("sessionId"), body)
		return nil
	})
	sessions.POST("/:sessionId/snapshot", func(c *echo.Context) error {
		var body SnapshotRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.publishSnapshot(c.Response(), c.Request(), c.Param("sessionId"), body)
		return nil
	})
	sessions.POST("/:sessionId/commits", func(c *echo.Context) error {
		var body CommitRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.publishCommit(c.Response(), c.Request(), c.Param("sessionId"), body)
		return nil
	})
	sessions.GET("/:sessionId/browser/events", func(c *echo.Context) error {
		handler.browserEvents(c.Response(), c.Request(), c.Param("sessionId"))
		return nil
	})
	sessions.GET("/:sessionId/client/events", func(c *echo.Context) error {
		handler.clientEvents(c.Response(), c.Request(), c.Param("sessionId"))
		return nil
	})
	sessions.POST("/:sessionId/operations", func(c *echo.Context) error {
		var body submitOperationRequest
		if !handler.bindJSON(c, &body) {
			return nil
		}
		handler.submitOperation(c.Response(), c.Request(), c.Param("sessionId"), body)
		return nil
	})

	return handler
}

func (h *HTTPHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	h.app.ServeHTTP(response, request)
}

func (h *HTTPHandler) revoke(response http.ResponseWriter, request *http.Request, sessionID string) {
	if err := h.relay.Revoke(sessionID, bearerToken(request)); err != nil {
		h.writeRelayError(response, err)
		return
	}

	response.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) publishSnapshot(response http.ResponseWriter, request *http.Request, sessionID string, body SnapshotRequest) {
	if err := h.relay.PublishSnapshot(sessionID, bearerToken(request), body); err != nil {
		h.writeRelayError(response, err)
		return
	}

	response.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) publishCommit(response http.ResponseWriter, request *http.Request, sessionID string, body CommitRequest) {
	commit, err := h.relay.PublishCommit(sessionID, bearerToken(request), body)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}

	h.writeJSON(response, http.StatusOK, commit)
}

func (h *HTTPHandler) browserEvents(response http.ResponseWriter, request *http.Request, sessionID string) {
	afterEventID, err := lastEventID(request)
	if err != nil {
		h.writeError(response, http.StatusBadRequest, "invalid_last_event_id", err.Error())
		return
	}

	events, stop, err := h.relay.SubscribeBrowser(sessionID, bearerToken(request), afterEventID)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}
	defer stop()

	h.streamEvents(response, request, events)
}

func (h *HTTPHandler) clientEvents(response http.ResponseWriter, request *http.Request, sessionID string) {
	afterEventID, err := lastEventID(request)
	if err != nil {
		h.writeError(response, http.StatusBadRequest, "invalid_last_event_id", err.Error())
		return
	}

	events, stop, err := h.relay.SubscribeClient(sessionID, bearerToken(request), request.URL.Query().Get("clientId"), afterEventID)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}
	defer stop()
	defer h.relay.DisconnectClient(sessionID, request.URL.Query().Get("clientId"))

	h.streamEvents(response, request, events)
}

func (h *HTTPHandler) streamEvents(response http.ResponseWriter, request *http.Request, events <-chan Event) {
	response.Header().Set("Cache-Control", "no-cache")
	response.Header().Set("Connection", "keep-alive")
	response.Header().Set("Content-Type", "text/event-stream")
	response.WriteHeader(http.StatusOK)

	controller := http.NewResponseController(response)
	if err := controller.Flush(); err != nil {
		return
	}
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-request.Context().Done():
			return
		case <-heartbeat.C:
			if err := controller.SetWriteDeadline(time.Now().Add(15 * time.Second)); err != nil {
				return
			}
			if _, err := fmt.Fprint(response, ": keep-alive\n\n"); err != nil {
				return
			}
			if err := controller.Flush(); err != nil {
				return
			}
		case event, ok := <-events:
			if !ok {
				return
			}

			payload, err := json.Marshal(event.Data)
			if err != nil {
				continue
			}

			if err := controller.SetWriteDeadline(time.Now().Add(15 * time.Second)); err != nil {
				return
			}
			if _, err := fmt.Fprintf(response, "id: %d\nevent: %s\ndata: %s\n\n", event.ID, event.Type, payload); err != nil {
				return
			}

			if err := controller.Flush(); err != nil {
				return
			}
		}
	}
}

func (h *HTTPHandler) createSession(response http.ResponseWriter, request *http.Request, body createSessionRequest) {
	if body.ProtocolVersion != ProtocolVersion {
		h.writeError(response, http.StatusBadRequest, "protocol_mismatch", "unsupported remote control protocol")
		return
	}
	if !h.sessionCreationLimiter.allow(remoteAddressKey(request)) {
		response.Header().Set("Retry-After", strconv.Itoa(int(sessionCreationWindow.Seconds())))
		h.writeError(response, http.StatusTooManyRequests, "session_rate_limited", "too many remote control sessions created")
		return
	}

	credentials, err := h.relay.CreateSession(body.PatchID, body.BrowserGeneration)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}

	h.writeJSON(response, http.StatusCreated, map[string]string{
		"protocolVersion": ProtocolVersion,
		"sessionId":       credentials.SessionID,
		"secret":          credentials.Secret,
	})
}

func (h *HTTPHandler) attachClient(response http.ResponseWriter, request *http.Request, sessionID string) {
	snapshot, err := h.relay.AttachClient(sessionID, bearerToken(request))
	if err != nil {
		h.writeRelayError(response, err)
		return
	}

	h.writeJSON(response, http.StatusOK, snapshot)
}

func (h *HTTPHandler) detachClient(response http.ResponseWriter, request *http.Request, sessionID string, body detachClientRequest) {
	if err := h.relay.DetachClient(sessionID, bearerToken(request), body.ClientID); err != nil {
		h.writeRelayError(response, err)
		return
	}

	response.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) reclaim(response http.ResponseWriter, request *http.Request, sessionID string, body reclaimRequest) {
	snapshot, err := h.relay.Reclaim(sessionID, bearerToken(request), body.PatchID, body.BrowserGeneration, body.PatchRevision)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}

	h.writeJSON(response, http.StatusOK, snapshot)
}

func (h *HTTPHandler) submitOperation(response http.ResponseWriter, request *http.Request, sessionID string, body submitOperationRequest) {
	result, err := h.relay.SubmitOperation(sessionID, bearerToken(request), body.ClientID, body.OperationRequest)
	if err != nil {
		h.writeRelayError(response, err)
		return
	}

	h.writeJSON(response, http.StatusAccepted, result)
}

func (h *HTTPHandler) bindJSON(c *echo.Context, target any) bool {
	if err := c.Bind(target); err != nil {
		h.writeError(c.Response(), http.StatusBadRequest, "invalid_request", "invalid remote control request")
		return false
	}

	return true
}

func (h *HTTPHandler) writeRelayError(response http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrSessionNotFound):
		h.writeError(response, http.StatusNotFound, "session_not_found", err.Error())
	case errors.Is(err, ErrInvalidSecret):
		h.writeError(response, http.StatusUnauthorized, "invalid_secret", err.Error())
	case errors.Is(err, ErrClientAttached):
		h.writeError(response, http.StatusConflict, "client_attached", err.Error())
	case errors.Is(err, ErrClientNotAttached):
		h.writeError(response, http.StatusConflict, "client_not_attached", err.Error())
	case errors.Is(err, ErrGenerationStale):
		h.writeError(response, http.StatusConflict, "generation_stale", err.Error())
	case errors.Is(err, ErrPatchMismatch):
		h.writeError(response, http.StatusConflict, "patch_mismatch", err.Error())
	case errors.Is(err, ErrRevisionConflict):
		h.writeError(response, http.StatusConflict, "revision_conflict", err.Error())
	case errors.Is(err, ErrOperationNotFound):
		h.writeError(response, http.StatusNotFound, "operation_not_found", err.Error())
	case errors.Is(err, ErrReplayUnavailable):
		h.writeError(response, http.StatusConflict, "replay_unavailable", err.Error())
	case errors.Is(err, ErrSessionLimit):
		h.writeError(response, http.StatusServiceUnavailable, "session_limit", err.Error())
	default:
		h.writeError(response, http.StatusBadRequest, "invalid_request", err.Error())
	}
}

func (h *HTTPHandler) writeError(response http.ResponseWriter, status int, code, message string) {
	h.writeJSON(response, status, map[string]string{"code": code, "message": message})
}

func (h *HTTPHandler) writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(body)
}

func bearerToken(request *http.Request) string {
	return strings.TrimSpace(strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer "))
}

func lastEventID(request *http.Request) (int64, error) {
	value := strings.TrimSpace(request.Header.Get("Last-Event-ID"))
	if value == "" {
		return 0, nil
	}

	eventID, err := strconv.ParseInt(value, 10, 64)
	if err != nil || eventID < 0 {
		return 0, errors.New("Last-Event-ID must be a non-negative integer")
	}

	return eventID, nil
}

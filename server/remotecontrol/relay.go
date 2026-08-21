package remotecontrol

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
)

var (
	ErrSessionNotFound   = errors.New("remote control session not found")
	ErrInvalidSecret     = errors.New("remote control secret is invalid")
	ErrClientAttached    = errors.New("a mutating client is already attached")
	ErrClientNotAttached = errors.New("mutating client is not attached")
	ErrGenerationStale   = errors.New("browser generation is stale")
	ErrPatchMismatch     = errors.New("patch does not match remote control session")
	ErrRevisionConflict  = errors.New("patch revision is stale")
	ErrOperationNotFound = errors.New("remote control operation not found")
)

type SessionCredentials struct {
	SessionID string `json:"sessionId"`
	Secret    string `json:"secret"`
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
	PatchRevision     int64  `json:"patchRevision"`
	Path              string `json:"path"`
	Content           string `json:"content"`
}

type OperationResult struct {
	OperationID   string `json:"operationId"`
	PatchRevision int64  `json:"patchRevision"`
	Applied       bool   `json:"applied"`
	Terminal      bool   `json:"terminal"`
}

type OperationAcknowledgement struct {
	OperationID       string `json:"operationId"`
	BrowserGeneration string `json:"browserGeneration"`
	PatchRevision     int64  `json:"patchRevision"`
	Applied           bool   `json:"applied"`
}

type SnapshotRequest struct {
	BrowserGeneration string          `json:"browserGeneration"`
	PatchRevision     int64           `json:"patchRevision"`
	Representation    json.RawMessage `json:"representation"`
}

type ObjectUpdateRequest struct {
	BrowserGeneration string          `json:"browserGeneration"`
	PatchRevision     int64           `json:"patchRevision"`
	ObjectID          string          `json:"objectId"`
	Object            json.RawMessage `json:"object"`
}

type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type Relay struct {
	mu       sync.Mutex
	sessions map[string]*session
}

type session struct {
	id                string
	secretHash        [sha256.Size]byte
	patchID           string
	browserGeneration string
	patchRevision     int64
	clientID          string
	operations        map[string]OperationResult
	representation    json.RawMessage
	browserListeners  map[chan Event]struct{}
	clientListeners   map[chan Event]struct{}
}

func NewRelay() *Relay {
	return &Relay{sessions: make(map[string]*session)}
}

func (r *Relay) CreateSession(patchID, browserGeneration string) (SessionCredentials, error) {
	if patchID == "" || browserGeneration == "" {
		return SessionCredentials{}, errors.New("patch ID and browser generation are required")
	}

	sessionID, err := randomID()
	if err != nil {
		return SessionCredentials{}, fmt.Errorf("generate session ID: %w", err)
	}

	secret, err := randomID()
	if err != nil {
		return SessionCredentials{}, fmt.Errorf("generate session secret: %w", err)
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.sessions[sessionID] = &session{
		id:                sessionID,
		secretHash:        sha256.Sum256([]byte(secret)),
		patchID:           patchID,
		browserGeneration: browserGeneration,
		operations:        make(map[string]OperationResult),
		browserListeners:  make(map[chan Event]struct{}),
		clientListeners:   make(map[chan Event]struct{}),
	}

	return SessionCredentials{SessionID: sessionID, Secret: secret}, nil
}

func (r *Relay) AttachClient(sessionID, secret string) (SessionSnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return SessionSnapshot{}, err
	}

	if session.clientID != "" {
		if len(session.clientListeners) > 0 {
			return SessionSnapshot{}, ErrClientAttached
		}

		session.clientID = ""
	}

	clientID, err := randomID()
	if err != nil {
		return SessionSnapshot{}, fmt.Errorf("generate client ID: %w", err)
	}

	session.clientID = clientID
	r.emitToBrowser(session, Event{Type: "client.attached", Data: snapshot(session)})

	return snapshot(session), nil
}

func (r *Relay) DetachClient(sessionID, secret, clientID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return err
	}

	if session.clientID == "" || session.clientID != clientID {
		return ErrClientNotAttached
	}

	session.clientID = ""
	r.emitToClient(session, Event{Type: "session.detached", Data: map[string]string{"clientId": clientID}})

	return nil
}

func (r *Relay) DisconnectClient(sessionID, clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, ok := r.sessions[sessionID]
	if !ok || session.clientID != clientID {
		return
	}

	session.clientID = ""
	r.emitToClient(session, Event{Type: "session.disconnected", Data: map[string]string{"clientId": clientID}})
}

func (r *Relay) Revoke(sessionID, secret string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, err := r.authenticate(sessionID, secret); err != nil {
		return err
	}

	delete(r.sessions, sessionID)

	return nil
}

func (r *Relay) Reclaim(sessionID, secret, patchID, browserGeneration string, patchRevision int64) (SessionSnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return SessionSnapshot{}, err
	}

	if session.patchID != patchID {
		return SessionSnapshot{}, ErrPatchMismatch
	}

	if browserGeneration == "" || browserGeneration == session.browserGeneration {
		return SessionSnapshot{}, ErrGenerationStale
	}

	if patchRevision < session.patchRevision {
		return SessionSnapshot{}, ErrRevisionConflict
	}

	session.browserGeneration = browserGeneration
	session.patchRevision = patchRevision
	session.clientID = ""
	session.representation = nil
	r.emitToClient(session, Event{Type: "session.reclaimed", Data: snapshot(session)})

	return snapshot(session), nil
}

func (r *Relay) SubmitOperation(sessionID, secret, clientID string, request OperationRequest) (OperationResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return OperationResult{}, err
	}

	if session.clientID == "" || session.clientID != clientID {
		return OperationResult{}, ErrClientNotAttached
	}

	if result, ok := session.operations[request.OperationID]; ok {
		return result, nil
	}

	if request.BrowserGeneration != session.browserGeneration {
		return OperationResult{}, ErrGenerationStale
	}

	if request.PatchRevision != session.patchRevision {
		return OperationResult{}, ErrRevisionConflict
	}

	if request.OperationID == "" || request.Path == "" {
		return OperationResult{}, errors.New("operation ID and path are required")
	}

	result := OperationResult{
		OperationID:   request.OperationID,
		PatchRevision: session.patchRevision,
	}
	session.operations[request.OperationID] = result
	r.emitToBrowser(session, Event{Type: "operation.submitted", Data: request})

	return result, nil
}

func (r *Relay) AcknowledgeOperation(sessionID, secret string, acknowledgement OperationAcknowledgement) (OperationResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return OperationResult{}, err
	}

	if acknowledgement.BrowserGeneration != session.browserGeneration {
		return OperationResult{}, ErrGenerationStale
	}

	result, ok := session.operations[acknowledgement.OperationID]
	if !ok {
		return OperationResult{}, ErrOperationNotFound
	}

	if result.Terminal {
		return result, nil
	}

	if acknowledgement.Applied {
		if acknowledgement.PatchRevision <= session.patchRevision {
			return OperationResult{}, ErrRevisionConflict
		}

		session.patchRevision = acknowledgement.PatchRevision
	}

	result.PatchRevision = session.patchRevision
	result.Applied = acknowledgement.Applied
	result.Terminal = true
	session.operations[acknowledgement.OperationID] = result
	r.emitToClient(session, Event{Type: "operation.acknowledged", Data: result})

	return result, nil
}

func (r *Relay) PublishSnapshot(sessionID, secret string, request SnapshotRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return err
	}

	if request.BrowserGeneration != session.browserGeneration {
		return ErrGenerationStale
	}

	if request.PatchRevision < session.patchRevision || request.PatchRevision > session.patchRevision+1 {
		return ErrRevisionConflict
	}

	if !json.Valid(request.Representation) {
		return errors.New("representation must be valid JSON")
	}

	session.representation = append(session.representation[:0], request.Representation...)
	session.patchRevision = request.PatchRevision
	r.emitToClient(session, Event{Type: "snapshot.published", Data: request})

	return nil
}

func (r *Relay) PublishObject(sessionID, secret string, request ObjectUpdateRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return err
	}
	if request.BrowserGeneration != session.browserGeneration {
		return ErrGenerationStale
	}
	if request.ObjectID == "" || (len(request.Object) > 0 && string(request.Object) != "null" && !json.Valid(request.Object)) {
		return errors.New("object update is invalid")
	}
	if request.PatchRevision < session.patchRevision || request.PatchRevision > session.patchRevision+1 {
		return ErrRevisionConflict
	}

	session.patchRevision = request.PatchRevision
	r.emitToClient(session, Event{Type: "object.published", Data: request})

	return nil
}

func (r *Relay) SubscribeBrowser(sessionID, secret string) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return nil, nil, err
	}

	listener := make(chan Event, 32)
	session.browserListeners[listener] = struct{}{}

	return listener, func() { r.unsubscribeBrowser(sessionID, listener) }, nil
}

func (r *Relay) SubscribeClient(sessionID, secret, clientID string) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return nil, nil, err
	}

	if session.clientID == "" || session.clientID != clientID {
		return nil, nil, ErrClientNotAttached
	}

	listener := make(chan Event, 32)
	session.clientListeners[listener] = struct{}{}
	listener <- Event{Type: "session.snapshot", Data: struct {
		SessionSnapshot
		Representation json.RawMessage `json:"representation"`
	}{snapshot(session), session.representation}}

	return listener, func() { r.unsubscribeClient(sessionID, listener) }, nil
}

func (r *Relay) unsubscribeBrowser(sessionID string, listener chan Event) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if session, ok := r.sessions[sessionID]; ok {
		delete(session.browserListeners, listener)
	}
}

func (r *Relay) unsubscribeClient(sessionID string, listener chan Event) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if session, ok := r.sessions[sessionID]; ok {
		delete(session.clientListeners, listener)
	}
}

func (r *Relay) emitToBrowser(session *session, event Event) {
	for listener := range session.browserListeners {
		select {
		case listener <- event:
		default:
		}
	}
}

func (r *Relay) emitToClient(session *session, event Event) {
	for listener := range session.clientListeners {
		select {
		case listener <- event:
		default:
		}
	}
}

func (r *Relay) authenticate(sessionID, secret string) (*session, error) {
	session, ok := r.sessions[sessionID]
	if !ok {
		return nil, ErrSessionNotFound
	}

	secretHash := sha256.Sum256([]byte(secret))
	if subtle.ConstantTimeCompare(session.secretHash[:], secretHash[:]) != 1 {
		return nil, ErrInvalidSecret
	}

	return session, nil
}

func snapshot(session *session) SessionSnapshot {
	return SessionSnapshot{
		SessionID:         session.id,
		PatchID:           session.patchID,
		BrowserGeneration: session.browserGeneration,
		PatchRevision:     session.patchRevision,
		ClientID:          session.clientID,
	}
}

func randomID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

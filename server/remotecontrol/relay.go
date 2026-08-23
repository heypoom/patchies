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
	"time"
)

const (
	eventLogLimit      = 512
	idempotencyWindow  = 512
	maxLiveSessions    = 128
	sessionIdleTimeout = 10 * time.Minute
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
	ErrReplayUnavailable = errors.New("remote control event replay is unavailable")
	ErrSessionLimit      = errors.New("remote control session limit reached")
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
	BaseRevision      int64  `json:"baseRevision"`
	Path              string `json:"path"`
	Content           string `json:"content"`
}

type OperationResult struct {
	OperationID string           `json:"operationId"`
	Terminal    bool             `json:"terminal"`
	Commit      *CanonicalCommit `json:"commit,omitempty"`
}

type ObjectChange struct {
	ObjectID string          `json:"objectId"`
	Object   json.RawMessage `json:"object"`
}

type CommitRequest struct {
	CommitID          string         `json:"commitId"`
	OperationID       string         `json:"operationId,omitempty"`
	BrowserGeneration string         `json:"browserGeneration"`
	BaseRevision      int64          `json:"baseRevision"`
	Applied           bool           `json:"applied"`
	Changes           []ObjectChange `json:"changes"`
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

type SnapshotRequest struct {
	BrowserGeneration string          `json:"browserGeneration"`
	PatchRevision     int64           `json:"patchRevision"`
	Representation    json.RawMessage `json:"representation"`
}

type Event struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
	Data any    `json:"data"`
}

type eventAudience uint8

const (
	audienceBrowser eventAudience = iota + 1
	audienceClient
)

type eventRecord struct {
	Audience eventAudience
	Event    Event
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
	operationOrder    []string
	commits           map[string]CanonicalCommit
	commitOrder       []string
	nextEventID       int64
	eventLog          []eventRecord
	browserListeners  map[chan Event]struct{}
	clientListeners   map[chan Event]struct{}
	idleTimer         *time.Timer
}

func NewRelay() *Relay { return &Relay{sessions: make(map[string]*session)} }

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
	if len(r.sessions) >= maxLiveSessions {
		return SessionCredentials{}, ErrSessionLimit
	}

	created := &session{
		id:                sessionID,
		secretHash:        sha256.Sum256([]byte(secret)),
		patchID:           patchID,
		browserGeneration: browserGeneration,
		operations:        make(map[string]OperationResult),
		commits:           make(map[string]CanonicalCommit),
		browserListeners:  make(map[chan Event]struct{}),
		clientListeners:   make(map[chan Event]struct{}),
	}
	r.sessions[sessionID] = created
	r.scheduleExpiry(created)

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
		return SessionSnapshot{}, ErrClientAttached
	}

	clientID, err := randomID()
	if err != nil {
		return SessionSnapshot{}, fmt.Errorf("generate client ID: %w", err)
	}
	session.clientID = clientID

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
	r.emit(session, audienceClient, "session.detached", map[string]string{"clientId": clientID})

	return nil
}

func (r *Relay) DisconnectClient(sessionID, clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if session, ok := r.sessions[sessionID]; ok && session.clientID == clientID {
		session.clientID = ""
	}
}

func (r *Relay) Revoke(sessionID, secret string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return err
	}
	for listener := range session.browserListeners {
		close(listener)
	}
	for listener := range session.clientListeners {
		close(listener)
	}
	r.removeSession(sessionID, session)

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
	if patchRevision < 0 {
		return SessionSnapshot{}, ErrRevisionConflict
	}
	for listener := range session.browserListeners {
		close(listener)
	}
	session.browserListeners = make(map[chan Event]struct{})

	session.browserGeneration = browserGeneration
	session.patchRevision = patchRevision
	session.clientID = ""
	session.operations = make(map[string]OperationResult)
	session.operationOrder = nil
	session.commits = make(map[string]CanonicalCommit)
	session.commitOrder = nil
	session.eventLog = nil
	r.emit(session, audienceClient, "session.reclaimed", snapshot(session))

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
	if request.BaseRevision < 0 || request.BaseRevision > session.patchRevision {
		return OperationResult{}, ErrRevisionConflict
	}
	if request.OperationID == "" || request.Path == "" {
		return OperationResult{}, errors.New("operation ID and path are required")
	}
	result := OperationResult{OperationID: request.OperationID}
	storeOperation(session, request.OperationID, result)
	r.emit(session, audienceBrowser, "operation.submitted", request)

	return result, nil
}

func (r *Relay) PublishCommit(sessionID, secret string, request CommitRequest) (CanonicalCommit, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return CanonicalCommit{}, err
	}
	if request.BrowserGeneration != session.browserGeneration {
		return CanonicalCommit{}, ErrGenerationStale
	}
	if existing, ok := session.commits[request.CommitID]; ok {
		return existing, nil
	}
	if request.CommitID == "" {
		return CanonicalCommit{}, errors.New("commit ID is required")
	}
	if request.BaseRevision != session.patchRevision {
		return CanonicalCommit{}, ErrRevisionConflict
	}
	if request.OperationID != "" {
		result, ok := session.operations[request.OperationID]
		if !ok {
			return CanonicalCommit{}, ErrOperationNotFound
		}
		if result.Terminal && result.Commit != nil {
			return *result.Commit, nil
		}
	}
	if err := validateCommit(request); err != nil {
		return CanonicalCommit{}, err
	}

	patchRevision := session.patchRevision
	if request.Applied {
		patchRevision++
	}

	commit := CanonicalCommit{
		CommitID:          request.CommitID,
		OperationID:       request.OperationID,
		BrowserGeneration: request.BrowserGeneration,
		BaseRevision:      request.BaseRevision,
		PatchRevision:     patchRevision,
		Applied:           request.Applied,
		Changes:           cloneChanges(request.Changes),
	}
	session.patchRevision = patchRevision
	storeCommit(session, commit)
	if request.OperationID != "" {
		commitCopy := commit
		session.operations[request.OperationID] = OperationResult{
			OperationID: request.OperationID,
			Terminal:    true,
			Commit:      &commitCopy,
		}
	}
	r.emit(session, audienceClient, "commit.published", commit)

	return commit, nil
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
	if request.PatchRevision != session.patchRevision {
		return ErrRevisionConflict
	}
	if !json.Valid(request.Representation) {
		return errors.New("representation must be valid JSON")
	}
	r.emit(session, audienceClient, "snapshot.published", request)

	return nil
}

func (r *Relay) SubscribeBrowser(sessionID, secret string, afterEventID int64) (<-chan Event, func(), error) {
	return r.subscribe(sessionID, secret, "", audienceBrowser, afterEventID)
}

func (r *Relay) SubscribeClient(sessionID, secret, clientID string, afterEventID int64) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return nil, nil, err
	}
	if session.clientID == "" || session.clientID != clientID {
		return nil, nil, ErrClientNotAttached
	}
	if replayUnavailable(session, afterEventID) {
		return nil, nil, ErrReplayUnavailable
	}
	listener := r.addListener(session, audienceClient, afterEventID)
	r.emit(session, audienceBrowser, "client.attached", snapshot(session))

	return listener, func() { r.unsubscribe(sessionID, audienceClient, listener) }, nil
}

func (r *Relay) subscribe(sessionID, secret, clientID string, audience eventAudience, afterEventID int64) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, err := r.authenticate(sessionID, secret)
	if err != nil {
		return nil, nil, err
	}
	if audience == audienceClient && (session.clientID == "" || session.clientID != clientID) {
		return nil, nil, ErrClientNotAttached
	}
	if replayUnavailable(session, afterEventID) {
		return nil, nil, ErrReplayUnavailable
	}
	listener := r.addListener(session, audience, afterEventID)

	return listener, func() { r.unsubscribe(sessionID, audience, listener) }, nil
}

func (r *Relay) addListener(session *session, audience eventAudience, afterEventID int64) chan Event {
	if session.idleTimer != nil {
		session.idleTimer.Stop()
		session.idleTimer = nil
	}
	listener := make(chan Event, eventLogLimit)
	for _, record := range session.eventLog {
		resumeEvent := afterEventID > 0 && record.Event.ID > afterEventID
		unresolvedInitialOperation := afterEventID == 0 && audience == audienceBrowser && record.Event.Type == "operation.submitted"
		if record.Audience == audience && (resumeEvent || unresolvedInitialOperation) && !isResolvedOperation(session, record) {
			listener <- record.Event
		}
	}
	listeners := session.browserListeners
	if audience == audienceClient {
		listeners = session.clientListeners
	}
	listeners[listener] = struct{}{}

	return listener
}

func isResolvedOperation(session *session, record eventRecord) bool {
	if record.Audience != audienceBrowser || record.Event.Type != "operation.submitted" {
		return false
	}

	request, ok := record.Event.Data.(OperationRequest)
	if !ok {
		return false
	}
	result, ok := session.operations[request.OperationID]

	return ok && result.Terminal
}

func (r *Relay) unsubscribe(sessionID string, audience eventAudience, listener chan Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, ok := r.sessions[sessionID]
	if !ok {
		return
	}
	listeners := session.browserListeners
	if audience == audienceClient {
		listeners = session.clientListeners
	}
	delete(listeners, listener)
	if len(session.browserListeners) == 0 && len(session.clientListeners) == 0 {
		r.scheduleExpiry(session)
	}
}

func (r *Relay) scheduleExpiry(session *session) {
	if session.idleTimer != nil {
		session.idleTimer.Stop()
	}
	sessionID := session.id
	session.idleTimer = time.AfterFunc(sessionIdleTimeout, func() {
		r.mu.Lock()
		defer r.mu.Unlock()

		current, ok := r.sessions[sessionID]
		if ok && current == session && len(current.browserListeners) == 0 && len(current.clientListeners) == 0 {
			r.removeSession(sessionID, current)
		}
	})
}

func (r *Relay) removeSession(sessionID string, session *session) {
	if session.idleTimer != nil {
		session.idleTimer.Stop()
	}
	delete(r.sessions, sessionID)
	session.eventLog = nil
	session.operations = nil
	session.commits = nil
	session.browserListeners = nil
	session.clientListeners = nil
}

func (r *Relay) emit(session *session, audience eventAudience, eventType string, data any) {
	session.nextEventID++
	event := Event{ID: session.nextEventID, Type: eventType, Data: data}
	session.eventLog = append(session.eventLog, eventRecord{Audience: audience, Event: event})
	if len(session.eventLog) > eventLogLimit {
		session.eventLog = session.eventLog[len(session.eventLog)-eventLogLimit:]
	}
	listeners := session.browserListeners
	if audience == audienceClient {
		listeners = session.clientListeners
	}
	for listener := range listeners {
		select {
		case listener <- event:
		default:
			close(listener)
			delete(listeners, listener)
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

func validateCommit(request CommitRequest) error {
	if !request.Applied {
		if request.OperationID == "" || len(request.Changes) != 0 {
			return errors.New("unapplied commit must resolve an operation without changes")
		}
		return nil
	}
	if len(request.Changes) == 0 {
		return errors.New("applied commit requires at least one object change")
	}
	for _, change := range request.Changes {
		if change.ObjectID == "" || len(change.Object) == 0 || !json.Valid(change.Object) {
			return errors.New("commit contains an invalid object change")
		}
	}

	return nil
}

func cloneChanges(changes []ObjectChange) []ObjectChange {
	result := make([]ObjectChange, len(changes))
	for index, change := range changes {
		result[index] = ObjectChange{ObjectID: change.ObjectID, Object: append(json.RawMessage(nil), change.Object...)}
	}

	return result
}

func storeOperation(session *session, operationID string, result OperationResult) {
	if _, exists := session.operations[operationID]; !exists {
		session.operationOrder = append(session.operationOrder, operationID)
	}
	session.operations[operationID] = result
	if len(session.operationOrder) <= idempotencyWindow {
		return
	}

	delete(session.operations, session.operationOrder[0])
	session.operationOrder = session.operationOrder[1:]
}

func storeCommit(session *session, commit CanonicalCommit) {
	session.commits[commit.CommitID] = commit
	session.commitOrder = append(session.commitOrder, commit.CommitID)
	if len(session.commitOrder) <= idempotencyWindow {
		return
	}

	delete(session.commits, session.commitOrder[0])
	session.commitOrder = session.commitOrder[1:]
}

func replayUnavailable(session *session, afterEventID int64) bool {
	return afterEventID > 0 && len(session.eventLog) > 0 && afterEventID < session.eventLog[0].Event.ID-1
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

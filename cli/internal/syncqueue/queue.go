package syncqueue

import (
	"sort"
	"sync"

	"github.com/heypoom/patchies/cli/internal/mount"
)

type Operation struct {
	Path     string
	Content  string
	Revision int64
}

type Queue struct {
	generation string
	inFlight   *Operation
	mu         sync.Mutex
	pending    map[string]string
	revision   int64
}

func New(browserGeneration string, patchRevision int64) *Queue {
	return &Queue{
		generation: browserGeneration,
		pending:    make(map[string]string),
		revision:   patchRevision,
	}
}

func (q *Queue) Offer(change mount.FileChange) {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.pending[change.Path] = change.Content
}

func (q *Queue) Next() (Operation, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.inFlight != nil || len(q.pending) == 0 {
		return Operation{}, false
	}

	paths := make([]string, 0, len(q.pending))
	for path := range q.pending {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	path := paths[0]
	operation := Operation{Path: path, Content: q.pending[path], Revision: q.revision}
	delete(q.pending, path)
	q.inFlight = &operation

	return operation, true
}

func (q *Queue) Acknowledge(patchRevision int64) {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.inFlight = nil
	q.revision = patchRevision
}

func (q *Queue) Reject() {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.inFlight != nil {
		q.pending[q.inFlight.Path] = q.inFlight.Content
	}
	q.inFlight = nil
}

func (q *Queue) SetRevision(patchRevision int64) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if patchRevision > q.revision {
		q.revision = patchRevision
	}
}

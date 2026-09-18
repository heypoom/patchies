package remotecontrol

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	sessionCreationLimit  = 8
	sessionCreationWindow = time.Minute
)

type sessionCreationLimiter struct {
	attempts map[string][]time.Time
	mu       sync.Mutex
	now      func() time.Time
}

func newSessionCreationLimiter() *sessionCreationLimiter {
	return &sessionCreationLimiter{attempts: make(map[string][]time.Time), now: time.Now}
}

func (limiter *sessionCreationLimiter) allow(remoteAddress string) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := limiter.now()
	cutoff := now.Add(-sessionCreationWindow)
	recent := limiter.attempts[remoteAddress][:0]

	for _, attempt := range limiter.attempts[remoteAddress] {
		if attempt.After(cutoff) {
			recent = append(recent, attempt)
		}
	}

	if len(recent) >= sessionCreationLimit {
		limiter.attempts[remoteAddress] = recent

		return false
	}

	limiter.attempts[remoteAddress] = append(recent, now)

	return true
}

func remoteAddressKey(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil {
		return host
	}

	return request.RemoteAddr
}

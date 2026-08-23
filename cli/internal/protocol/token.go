package protocol

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"strings"
)

const ConnectionPrefix = "patchies://v2/"

type Connection struct {
	InstanceURL string `json:"instanceURL"`
	SessionID   string `json:"sessionID"`
	Secret      string `json:"secret"`
}

func ParseConnection(value string) (Connection, error) {
	if !strings.HasPrefix(value, ConnectionPrefix) {
		return Connection{}, errors.New("token must use the patchies://v2/ format")
	}

	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, ConnectionPrefix))
	if err != nil {
		return Connection{}, errors.New("token payload is not valid base64url")
	}

	var connection Connection
	if err := json.Unmarshal(payload, &connection); err != nil {
		return Connection{}, errors.New("token payload is not valid JSON")
	}

	instanceURL, err := url.Parse(connection.InstanceURL)
	if err != nil || (instanceURL.Scheme != "http" && instanceURL.Scheme != "https") || instanceURL.Host == "" {
		return Connection{}, errors.New("token instance URL is invalid")
	}

	if connection.SessionID == "" || connection.Secret == "" {
		return Connection{}, errors.New("token is missing session credentials")
	}

	connection.InstanceURL = instanceURL.Scheme + "://" + instanceURL.Host

	return connection, nil
}

// Package obs is the OBS WebSocket v5 controller.
//
// M-10 — this used to report success unconditionally, so the UI showed
// "connected to OBS" when nothing had been attempted. A connection indicator
// that lies is worse than one that is missing: the streamer only finds out
// mid-broadcast.
package obs

import (
	"errors"
	"fmt"
	"log/slog"
)

// ErrNotImplemented is returned until FR-050 lands.
var ErrNotImplemented = errors.New("OBS WebSocket client is not implemented yet (FR-050)")

// Connect is not yet implemented — it returns an explicit error rather than a
// fake success.
//
// TODO(FR-050): dial ws://host:port and complete the OBS WebSocket v5
// Hello/Identify challenge-response (sha256 of password + salt, then base64,
// then sha256 with the challenge). github.com/andreykaipov/goobs already
// implements this and is the intended dependency.
func Connect(host string, port uint16, password string) (bool, error) {
	slog.Warn("OBS connect requested but the client is not implemented yet",
		"url", fmt.Sprintf("ws://%s:%d", host, port))
	return false, ErrNotImplemented
}

// Package rcon is the Source RCON client.
//
// M-10 — this used to return a mock response, which meant the caller could not
// distinguish "the game executed this" from "nothing happened". Gift-triggered
// game actions are visible to the audience, so a silent no-op is a user-facing
// failure.
package rcon

import (
	"errors"
	"log/slog"
)

// MaxCommandLen bounds what the WebView may hand to a game server.
const MaxCommandLen = 512

// ErrNotImplemented is returned until FR-054 lands.
var ErrNotImplemented = errors.New("RCON client is not implemented yet (FR-054)")

// Execute is not yet implemented — it returns an explicit error rather than a
// fake response.
//
// TODO(FR-054): Source RCON packet framing (id/type/body, SERVERDATA_AUTH then
// SERVERDATA_EXECCOMMAND) over TCP, with a read timeout so a wedged game server
// cannot stall the trigger pipeline. github.com/gorcon/rcon implements this.
func Execute(host string, port uint16, password, command string) (string, error) {
	slog.Warn("RCON command requested but the client is not implemented yet",
		"host", host, "port", port, "command", command)
	return "", ErrNotImplemented
}

package bridge

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/livenova/desktop-app/internal/keysim"
)

// Command is what an authenticated Local Bridge client may ask for.
//
// Until now the socket read messages and discarded them, so a gift that matched
// a game-input rule reached this process and stopped dead. The desktop app was
// a user interface with no wire to the product.
type Command struct {
	// Type selects the action. Anything unrecognised is refused rather than
	// ignored, so a client learns immediately that it is speaking the wrong
	// protocol instead of silently doing nothing.
	Type string `json:"type"`

	// ID is echoed back so a client can match replies to requests. Optional.
	ID string `json:"id,omitempty"`

	// VKCode is a Win32 virtual-key code, checked against keysim's allowlist.
	VKCode uint16 `json:"vkCode,omitempty"`

	HoldMS     uint64 `json:"holdMs,omitempty"`
	CooldownMS uint64 `json:"cooldownMs,omitempty"`
}

// Reply is the response to a Command.
type Reply struct {
	ID    string `json:"id,omitempty"`
	Type  string `json:"type"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

const (
	CommandKeyPress = "key_press"
	CommandHalt     = "halt"
	CommandPing     = "ping"
)

// ErrResumeNotRemote is returned when a client asks to lift the emergency stop.
//
// Halting is allowed over the wire because it fails closed: the worst a hostile
// or buggy client can do is stop input the streamer wanted. Resuming is the
// opposite — it would let a web page silently undo an emergency stop the
// streamer pressed deliberately, restoring input to a live game without anyone
// touching the machine. That has to stay a physical action in the desktop UI.
var ErrResumeNotRemote = errors.New(
	"không thể bật lại từ xa — hãy bấm nút trong ứng dụng máy tính",
)

// ErrUnknownCommand is returned for an unrecognised command type.
var ErrUnknownCommand = errors.New("lệnh không hợp lệ")

// handleCommand decodes and executes one message, returning the reply to send.
//
// It never returns an error: a malformed or refused command produces a reply
// with OK=false. Dropping the connection instead would take down every other
// binding because one message was wrong.
func handleCommand(raw []byte) Reply {
	var cmd Command
	if err := json.Unmarshal(raw, &cmd); err != nil {
		return Reply{Type: "error", OK: false, Error: "không đọc được JSON"}
	}

	reply := Reply{ID: cmd.ID, Type: cmd.Type}

	switch cmd.Type {
	case CommandPing:
		reply.OK = true

	case CommandKeyPress:
		// keysim owns the allowlist, the clamping, the per-key cooldown, the
		// per-minute cap and the emergency stop. None of that is re-implemented
		// here, so a caller cannot reach the keyboard by any path that skips it.
		if err := keysim.PressKey(cmd.VKCode, cmd.HoldMS, cmd.CooldownMS); err != nil {
			reply.Error = err.Error()
			return reply
		}
		reply.OK = true

	case CommandHalt:
		keysim.Halt()
		reply.OK = true

	case "resume":
		reply.Error = ErrResumeNotRemote.Error()

	default:
		reply.Type = "error"
		reply.Error = fmt.Sprintf("%v: %q", ErrUnknownCommand, cmd.Type)
	}

	return reply
}

package bridge

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/livenova/desktop-app/internal/keysim"
)

// decode runs one command through the real handler.
//
// IMPORTANT: no test here may use a key that passes keysim's allowlist unless
// the emergency stop is engaged. `handleCommand` calls the real `PressKey`, and
// on Windows that reaches SendInput — a test doing so types into whatever
// window happens to have focus on the developer's machine. Every case below
// either uses a refused key (0x5B, Left Windows) or halts first.
func decode(t *testing.T, raw string) Reply {
	t.Helper()
	return handleCommand([]byte(raw))
}

func TestPingIsAcknowledged(t *testing.T) {
	got := decode(t, `{"type":"ping","id":"a1"}`)
	if !got.OK || got.ID != "a1" {
		t.Fatalf("ping: got %+v", got)
	}
}

func TestMalformedJSONDoesNotDropTheConnection(t *testing.T) {
	// One bad frame must not take down every other binding on the socket.
	got := decode(t, `{"type":`)
	if got.OK {
		t.Fatal("malformed JSON reported success")
	}
	if got.Error == "" {
		t.Fatal("malformed JSON produced no reason")
	}
}

func TestUnknownCommandIsRefusedNotIgnored(t *testing.T) {
	got := decode(t, `{"type":"format_c_drive"}`)
	if got.OK {
		t.Fatal("unknown command reported success")
	}
	if !strings.Contains(got.Error, "format_c_drive") {
		t.Fatalf("reply does not name the offending type: %q", got.Error)
	}
}

func TestKeyPressOutsideTheAllowlistIsRefused(t *testing.T) {
	keysim.Resume()

	// 0x5B is the Left Windows key — Win+R opens Run. keysim refuses it, and the
	// bridge must not become a way around that list.
	got := decode(t, `{"type":"key_press","vkCode":91,"holdMs":50,"cooldownMs":1000}`)
	if got.OK {
		t.Fatal("a key outside the allowlist was accepted")
	}
	if !strings.Contains(got.Error, "allowlist") {
		t.Fatalf("refusal does not cite the allowlist: %q", got.Error)
	}
}

func TestEmergencyStopBlocksKeyPresses(t *testing.T) {
	keysim.Resume()
	t.Cleanup(keysim.Resume)

	decode(t, `{"type":"halt"}`)
	if !keysim.IsHalted() {
		t.Fatal("halt did not engage the emergency stop")
	}

	got := decode(t, `{"type":"key_press","vkCode":32,"holdMs":50,"cooldownMs":1000}`)
	if got.OK {
		t.Fatal("a key press got through while halted")
	}
}

func TestResumeIsRefusedOverTheWire(t *testing.T) {
	keysim.Resume()
	keysim.Halt()
	t.Cleanup(keysim.Resume)

	got := decode(t, `{"type":"resume"}`)

	// Halting fails closed, so it is safe to accept remotely. Resuming is not:
	// it would let a web page undo an emergency stop the streamer pressed, with
	// nobody touching the machine.
	if got.OK {
		t.Fatal("resume was accepted over the socket")
	}
	if !keysim.IsHalted() {
		t.Fatal("the emergency stop was lifted remotely")
	}
}

func TestReplyEchoesTheRequestID(t *testing.T) {
	got := decode(t, `{"type":"key_press","id":"req-7","vkCode":91}`)
	if got.ID != "req-7" {
		t.Fatalf("id not echoed: %+v", got)
	}
}

func TestReplyIsSerialisable(t *testing.T) {
	// The socket writes this with WriteJSON; a field that cannot marshal would
	// only show up at runtime, mid-broadcast.
	raw, err := json.Marshal(decode(t, `{"type":"ping"}`))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(raw), `"ok":true`) {
		t.Fatalf("unexpected payload: %s", raw)
	}
}

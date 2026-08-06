package keysim

import (
	"errors"
	"math"
	"testing"
	"time"
)

func TestAllowlistAcceptsGameKeys(t *testing.T) {
	for _, vk := range []uint16{0x41 /* A */, 0x20 /* Space */, 0x26 /* Up */, 0x70 /* F1 */} {
		if !isAllowedKey(vk) {
			t.Errorf("expected %#04x to be allowed", vk)
		}
	}
}

func TestAllowlistRejectsSystemKeys(t *testing.T) {
	for _, vk := range []uint16{
		0x5B, // Left Windows
		0x11, // Ctrl
		0x12, // Alt
		0x2E, // Delete
		0x1B, // Escape
	} {
		if isAllowedKey(vk) {
			t.Errorf("expected %#04x to be rejected", vk)
		}
	}
}

func TestHoldDurationIsClamped(t *testing.T) {
	// math.MaxUint64 would previously sleep a worker thread effectively forever.
	if got := clampHold(math.MaxUint64); got != MaxHoldMS {
		t.Errorf("clampHold(MaxUint64) = %d, want %d", got, MaxHoldMS)
	}
	if got := clampHold(0); got != MinHoldMS {
		t.Errorf("clampHold(0) = %d, want %d", got, MinHoldMS)
	}
}

func TestCooldownBlocksRapidRepeat(t *testing.T) {
	l := newRateLimiter()
	cooldown := time.Second

	if err := l.checkAndRecord(0x41, cooldown); err != nil {
		t.Fatalf("first press rejected: %v", err)
	}
	if err := l.checkAndRecord(0x41, cooldown); err == nil {
		t.Error("expected the immediate repeat to be blocked by the cooldown")
	}
	// A different key is unaffected by another key's cooldown.
	if err := l.checkAndRecord(0x42, cooldown); err != nil {
		t.Errorf("a different key was blocked: %v", err)
	}
}

func TestGlobalRateLimitApplies(t *testing.T) {
	l := newRateLimiter()

	for i := 0; i < MaxPressesPerMinute; i++ {
		vk := 0x41 + uint16(i%26)
		_ = l.checkAndRecord(vk, 0)
	}
	if err := l.checkAndRecord(0x5A, 0); err == nil {
		t.Errorf("expected press %d to exceed the %d/minute ceiling",
			MaxPressesPerMinute+1, MaxPressesPerMinute)
	}
}

func TestEnforceLimitsRaisesCooldownToMinimum(t *testing.T) {
	// BR-25 — a caller asking for a 1ms cooldown must not get one.
	limiter = newRateLimiter()
	t.Cleanup(func() { limiter = newRateLimiter() })

	if _, err := enforceLimits(0x41, 50, 1); err != nil {
		t.Fatalf("first press rejected: %v", err)
	}
	if _, err := enforceLimits(0x41, 50, 1); err == nil {
		t.Error("expected the requested 1ms cooldown to be raised to MinCooldownMS")
	}
}

func TestEnforceLimitsRejectsDisallowedKey(t *testing.T) {
	limiter = newRateLimiter()
	t.Cleanup(func() { limiter = newRateLimiter() })

	if _, err := enforceLimits(0x5B /* Left Windows */, 50, MinCooldownMS); err == nil {
		t.Error("expected a key outside the allowlist to be rejected")
	}
}

// The emergency stop is the one control a streamer reaches for mid-broadcast,
// and until recently the desktop button behind it only wrote a log line. These
// cover the behaviour that button now promises.

func TestHaltBlocksPressKey(t *testing.T) {
	t.Cleanup(Resume)

	if IsHalted() {
		t.Fatal("expected the emergency stop to start disengaged")
	}

	Halt()

	if !IsHalted() {
		t.Error("IsHalted should report the stop as engaged")
	}
	// 0x41 is on the allowlist, so anything rejecting it here is the stop and
	// not the allowlist or the rate limiter.
	if err := PressKey(0x41, 50, MinCooldownMS); !errors.Is(err, ErrHalted) {
		t.Errorf("expected ErrHalted while stopped, got %v", err)
	}
}

func TestResumeReenablesPressKey(t *testing.T) {
	t.Cleanup(Resume)

	Halt()
	Resume()

	if IsHalted() {
		t.Error("IsHalted should report the stop as released")
	}
	if err := PressKey(0x42, 50, MinCooldownMS); errors.Is(err, ErrHalted) {
		t.Error("presses should be accepted again once the stop is released")
	}
}

// The stop has to hold for presses that arrive over the Local Bridge too, not
// only for the button next to it in the UI — those are the ones a gift can
// trigger while nobody is looking at the window.
func TestHaltBlocksEveryAllowedKey(t *testing.T) {
	t.Cleanup(Resume)
	Halt()

	for _, vk := range []uint16{0x20 /* Space */, 0x57 /* W */, 0x70 /* F1 */, 0x31 /* 1 */} {
		if err := PressKey(vk, 50, MinCooldownMS); !errors.Is(err, ErrHalted) {
			t.Errorf("key %#04x got through the emergency stop: %v", vk, err)
		}
	}
}

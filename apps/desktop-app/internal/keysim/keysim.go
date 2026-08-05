// Package keysim is a Win32 key simulator with mandatory safety limits.
//
// H-03 / BR-25 / FR-056 — an earlier version forwarded any virtual-key code for
// any duration straight to SendInput. Combined with a WebView that had CSP
// disabled, a single XSS in the desktop UI meant arbitrary keystroke injection
// into the operating system. Injecting input into a game is inherently a sharp
// tool; these limits are what keep it pointed at the game.
package keysim

import (
	"fmt"
	"sync"
	"time"
)

// Clamp for how long a key may be held.
const (
	MinHoldMS uint64 = 10
	MaxHoldMS uint64 = 2_000
)

// MinCooldownMS is BR-25 — the minimum gap between two presses of the same key.
const MinCooldownMS uint64 = 1_000

// MaxPressesPerMinute is a global ceiling across all keys, so a fan-out of
// distinct bindings cannot bypass the per-key cooldown.
const MaxPressesPerMinute = 60

// isAllowedKey reports whether a gift trigger may press this virtual-key code.
//
// An allowlist rather than a denylist: enumerating every dangerous combination
// (Ctrl+Alt+Del, Win+R, Alt+F4, …) is not something we can get right, whereas
// enumerating the keys a game actually needs is.
func isAllowedKey(vk uint16) bool {
	switch {
	case vk >= 0x30 && vk <= 0x39: // 0-9
		return true
	case vk >= 0x41 && vk <= 0x5A: // A-Z
		return true
	case vk >= 0x70 && vk <= 0x7B: // F1-F12
		return true
	case vk >= 0x25 && vk <= 0x28: // Arrows
		return true
	case vk == 0x20 || vk == 0x0D || vk == 0x09 || vk == 0x08: // Space, Enter, Tab, Backspace
		return true
	case vk >= 0x60 && vk <= 0x69: // Numpad 0-9
		return true
	default:
		return false
	}
}

type rateLimiter struct {
	mu        sync.Mutex
	lastPress map[uint16]time.Time
	recent    []time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{lastPress: make(map[uint16]time.Time)}
}

func (r *rateLimiter) checkAndRecord(vk uint16, cooldown time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	kept := r.recent[:0]
	for _, t := range r.recent {
		if now.Sub(t) < time.Minute {
			kept = append(kept, t)
		}
	}
	r.recent = kept

	if len(r.recent) >= MaxPressesPerMinute {
		return fmt.Errorf("key error: global rate limit reached (%d presses/minute)", MaxPressesPerMinute)
	}

	if last, ok := r.lastPress[vk]; ok {
		if elapsed := now.Sub(last); elapsed < cooldown {
			return fmt.Errorf("key error: key %#04x is on cooldown for another %dms",
				vk, (cooldown - elapsed).Milliseconds())
		}
	}

	r.lastPress[vk] = now
	r.recent = append(r.recent, now)
	return nil
}

var limiter = newRateLimiter()

func clampHold(holdMS uint64) uint64 {
	if holdMS < MinHoldMS {
		return MinHoldMS
	}
	if holdMS > MaxHoldMS {
		return MaxHoldMS
	}
	return holdMS
}

// enforceLimits validates the request and returns the hold duration to use.
func enforceLimits(vk uint16, holdMS, cooldownMS uint64) (uint64, error) {
	if !isAllowedKey(vk) {
		return 0, fmt.Errorf("key error: virtual-key %#04x is not in the allowlist", vk)
	}

	// Clamp rather than reject: a binding configured slightly out of range should
	// still work, just safely.
	hold := clampHold(holdMS)
	if cooldownMS < MinCooldownMS {
		cooldownMS = MinCooldownMS
	}

	if err := limiter.checkAndRecord(vk, time.Duration(cooldownMS)*time.Millisecond); err != nil {
		return 0, err
	}
	return hold, nil
}

// PressKey holds keyCode down for holdMS, subject to the safety limits.
//
// The caller must state the cooldown it expects to honour; anything below
// MinCooldownMS is raised to it.
func PressKey(keyCode uint16, holdMS, cooldownMS uint64) error {
	hold, err := enforceLimits(keyCode, holdMS, cooldownMS)
	if err != nil {
		return err
	}

	sendKey(keyCode, false)
	time.Sleep(time.Duration(hold) * time.Millisecond)
	sendKey(keyCode, true)
	return nil
}

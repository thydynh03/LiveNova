//go:build !windows

package keysim

import "log/slog"

// sendKey is a no-op off Windows so the limits above stay unit-testable on the
// Linux CI runner.
func sendKey(vk uint16, keyUp bool) {
	slog.Debug("simulated key event (no-op on this platform)", "vk", vk, "keyUp", keyUp)
}

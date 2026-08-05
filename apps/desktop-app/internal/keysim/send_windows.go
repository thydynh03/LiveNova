//go:build windows

package keysim

import (
	"log/slog"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	inputKeyboard  uint32 = 1
	keyEventFKeyUp uint32 = 0x0002
)

// kbdInput mirrors Win32 KEYBDINPUT.
type kbdInput struct {
	wVk         uint16
	wScan       uint16
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

// rawInput mirrors Win32 INPUT. The explicit padding reproduces the layout of
// the union, whose largest member is MOUSEINPUT — Go will not lay out a smaller
// struct to the same size on its own, and SendInput rejects a wrong cbSize.
type rawInput struct {
	inputType uint32
	_         uint32
	ki        kbdInput
	_         [8]byte
}

var (
	user32       = windows.NewLazySystemDLL("user32.dll")
	procSendInpt = user32.NewProc("SendInput")
)

func sendKey(vk uint16, keyUp bool) {
	var flags uint32
	if keyUp {
		flags = keyEventFKeyUp
	}

	in := rawInput{
		inputType: inputKeyboard,
		ki: kbdInput{
			wVk:     vk,
			dwFlags: flags,
		},
	}

	sent, _, err := procSendInpt.Call(
		1,
		uintptr(unsafe.Pointer(&in)),
		unsafe.Sizeof(in),
	)
	if sent != 1 {
		// A blocked SendInput is silent otherwise, and the streamer would only
		// notice because the game did nothing.
		slog.Warn("SendInput did not deliver the key", "vk", vk, "keyUp", keyUp, "err", err)
	}
}

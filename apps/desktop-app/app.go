package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/livenova/desktop-app/internal/bridge"
	"github.com/livenova/desktop-app/internal/keysim"
	"github.com/livenova/desktop-app/internal/netguard"
	"github.com/livenova/desktop-app/internal/obs"
	"github.com/livenova/desktop-app/internal/rcon"
)

// App is the struct bound to the WebView. Every exported method here is
// callable from the frontend, so each one is a trust boundary.
type App struct {
	ctx    context.Context
	cancel context.CancelFunc
	bridge *bridge.State
}

// NewApp builds the application state.
func NewApp() *App {
	return &App{bridge: bridge.New()}
}

// startup is called by Wails once the WebView is ready.
func (a *App) startup(ctx context.Context) {
	a.ctx, a.cancel = context.WithCancel(ctx)

	go func() {
		if err := a.bridge.Start(a.ctx); err != nil {
			slog.Error("Local Bridge failed to start", "err", err)
		}
	}()

	slog.Info("LiveNova Desktop started")
}

// shutdown stops the Local Bridge so the port is free on the next launch.
func (a *App) shutdown(context.Context) {
	if a.cancel != nil {
		a.cancel()
	}
}

// GetBridgeStatus returns the current Local Bridge status.
func (a *App) GetBridgeStatus() bridge.Status {
	return a.bridge.Status()
}

// GetActivity returns the recent Local Bridge activity, newest first.
//
// Đây là thứ trả lời câu hỏi duy nhất mà streamer hỏi giữa buổi live khi quà
// không bấm được phím: chuyện gì vừa xảy ra. Trạng thái "đang chạy" không phân
// biệt được lệnh chưa tới, phím ngoài danh sách, còn cooldown, hay đang dừng
// khẩn cấp — bốn cách sửa khác nhau.
func (a *App) GetActivity() []bridge.Entry {
	return a.bridge.Activity()
}

// ConnectOBS verifies that OBS is reachable and the password is accepted.
func (a *App) ConnectOBS(host string, port uint16, password string) (bool, error) {
	if !netguard.IsPermittedTarget(host) {
		return false, errors.New("OBS host must be loopback or a private address")
	}

	ok, err := obs.Connect(host, port, password)
	// Ghi địa chỉ, không bao giờ ghi mật khẩu: nhật ký này hiện ngay trên giao
	// diện và người ta chụp màn hình nó để nhờ hỗ trợ.
	if err != nil {
		a.bridge.RecordExternal(false, fmt.Sprintf("OBS %s:%d — %v", host, port, err))
	} else {
		a.bridge.RecordExternal(true, fmt.Sprintf("OBS %s:%d — đã kết nối", host, port))
	}
	return ok, err
}

// SetOBSScene switches the current program scene.
func (a *App) SetOBSScene(host string, port uint16, password, scene string) error {
	if !netguard.IsPermittedTarget(host) {
		return errors.New("OBS host must be loopback or a private address")
	}

	err := obs.SetScene(host, port, password, scene)
	if err != nil {
		a.bridge.RecordExternal(false, fmt.Sprintf("OBS đổi cảnh %q — %v", scene, err))
	} else {
		a.bridge.RecordExternal(true, fmt.Sprintf("OBS đã đổi sang cảnh %q", scene))
	}
	return err
}

// SendRconCommand executes a command against a game server over RCON.
func (a *App) SendRconCommand(host string, port uint16, password, command string) (string, error) {
	if !netguard.IsPermittedTarget(host) {
		return "", errors.New("RCON host must be loopback or a private address")
	}
	if len(command) > rcon.MaxCommandLen {
		return "", fmt.Errorf("RCON command too long (max %d bytes)", rcon.MaxCommandLen)
	}

	out, err := rcon.Execute(host, port, password, command)
	// Ghi lệnh chứ không ghi mật khẩu. Lệnh là thứ cần đối chiếu khi một món quà
	// không tạo ra hiệu ứng nào trong game.
	if err != nil {
		a.bridge.RecordExternal(false, fmt.Sprintf("RCON %q — %v", command, err))
	} else {
		a.bridge.RecordExternal(true, fmt.Sprintf("RCON %q — đã chạy", command))
	}
	return out, err
}

// SimulateKeyPress holds a key down for holdMS.
//
// H-03 — the caller states the cooldown it expects to honour; pass 0 to take
// keysim.MinCooldownMS. Wails runs each bound call on its own goroutine, so the
// hold below blocks nothing but this call.
func (a *App) SimulateKeyPress(keyCode uint16, holdMS uint64, cooldownMS uint64) error {
	return keysim.PressKey(keyCode, holdMS, cooldownMS)
}

// EmergencyStop blocks every further simulated key press until ResumeAfterStop.
//
// Previously the button in the UI only wrote a log line, so the one control a
// streamer would reach for mid-broadcast did nothing at all.
func (a *App) EmergencyStop() {
	keysim.Halt()
	slog.Warn("Emergency stop engaged — key simulation blocked")
}

// ResumeAfterStop lifts the emergency stop.
func (a *App) ResumeAfterStop() {
	keysim.Resume()
	slog.Info("Emergency stop released")
}

// IsHalted reports whether the emergency stop is currently engaged.
func (a *App) IsHalted() bool {
	return keysim.IsHalted()
}

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

// ConnectOBS connects to an OBS instance.
func (a *App) ConnectOBS(host string, port uint16, password string) (bool, error) {
	if !netguard.IsPermittedTarget(host) {
		return false, errors.New("OBS host must be loopback or a private address")
	}
	return obs.Connect(host, port, password)
}

// SendRconCommand executes a command against a game server over RCON.
func (a *App) SendRconCommand(host string, port uint16, password, command string) (string, error) {
	if !netguard.IsPermittedTarget(host) {
		return "", errors.New("RCON host must be loopback or a private address")
	}
	if len(command) > rcon.MaxCommandLen {
		return "", fmt.Errorf("RCON command too long (max %d bytes)", rcon.MaxCommandLen)
	}
	return rcon.Execute(host, port, password, command)
}

// SimulateKeyPress holds a key down for holdMS.
//
// H-03 — the caller states the cooldown it expects to honour; pass 0 to take
// keysim.MinCooldownMS. Wails runs each bound call on its own goroutine, so the
// hold below blocks nothing but this call.
func (a *App) SimulateKeyPress(keyCode uint16, holdMS uint64, cooldownMS uint64) error {
	return keysim.PressKey(keyCode, holdMS, cooldownMS)
}

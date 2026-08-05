package main

import (
	"embed"
	"log/slog"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	setupLogging()

	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "LiveNova Desktop",
		Width:  1200,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []any{
			app,
		},
	})
	if err != nil {
		slog.Error("error while running application", "err", err)
		os.Exit(1)
	}
}

func setupLogging() {
	level := slog.LevelInfo
	if strings.EqualFold(os.Getenv("LIVENOVA_LOG"), "debug") {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})))
}

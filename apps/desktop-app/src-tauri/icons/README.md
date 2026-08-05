# Icons — Tauri Desktop App

This folder contains the application icons for the TikTok LIVE Desktop installer.

## Required Icon Files for Tauri v2

Tauri requires the following icon files to build the NSIS Windows installer:

| File | Size | Used for |
|---|---|---|
| `icon.ico` | Multi-resolution | Windows taskbar, installer, Start menu |
| `icon.png` | 512×512 | General purpose |
| `32x32.png` | 32×32 | Windows small icon |
| `128x128.png` | 128×128 | Windows medium icon |
| `128x128@2x.png` | 256×256 | High DPI Windows icon |

## How to Generate All Icons from the SVG

Install the `tauri-cli` icon generator:

```bash
# From the desktop-app directory
pnpm tauri icon apps/desktop-app/src-tauri/icons/app-icon.svg
```

This will auto-generate all required icon formats from the SVG.

## Design Notes

- Replace `app-icon.svg` with your actual brand icon before production.
- The current placeholder uses a soundwave design with violet gradient background
  and a red LIVE indicator dot.
- For the `.ico` file, use https://www.icoconverter.com/ or a design tool.

## Current Status

⚠️ `app-icon.svg` is a **placeholder**. Run `pnpm tauri icon` to generate all required formats.

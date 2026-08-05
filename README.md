<div align="center">

# LiveNova 🚀

**Enterprise TikTok LIVE Automation, Real-time Interaction & TTS Platform**

*A high-performance monorepo platform featuring a Next.js 14 Web Dashboard, NestJS v10 Cloud Engine, and a lightweight Go (Wails v2) Desktop Local Bridge for OBS overlays and game/system input automation.*

[![CI](https://github.com/thydynh03/LiveNova/actions/workflows/ci.yml/badge.svg)](https://github.com/thydynh03/LiveNova/actions/workflows/ci.yml)
[![CodeQL](https://github.com/thydynh03/LiveNova/actions/workflows/codeql.yml/badge.svg)](https://github.com/thydynh03/LiveNova/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/thydynh03/LiveNova?color=6366f1)](https://github.com/thydynh03/LiveNova/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Go](https://img.shields.io/badge/Go-Wails_v2-00ADD8?logo=go&logoColor=white)](https://wails.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**Tiếng Việt** · [English](#english-summary)

[Features](#-features) · [Architecture](#-architecture--tech-stack) · [Quick Start](#-quick-start) · [Project Structure](#-project-structure) · [Security & Audit](#-security--compliance) · [License](#-license)

</div>

---

## 🌟 Tổng Quan Dự Án (Why LiveNova?)

**LiveNova** là hệ thống tự động hóa và tương tác trực tiếp theo thời gian thực (Real-time Interaction Toolkit) dành riêng cho các Creator và Streamer trên nền tảng **TikTok LIVE**.

Sản phẩm giải quyết triệt để các bài toán khó nhất của Streamer:
- 🎙️ **TTS Giọng đọc tự động:** Đọc câu hỏi, lời cảm ơn tặng quà, comment của fan bằng công nghệ Google Cloud TTS tích hợp **SHA256 Audio Cache Engine** (tiết kiệm 90% chi phí credit).
- 🏆 **Overlays Tương tác OBS:** Khung Chatbox hoạt ảnh, Thanh PK so kè 2 đội, Thanh mục tiêu nhận quà (Goal Bar) chạy trực tiếp trên OBS Studio qua Local Bridge siêu mượt.
- 🎮 **Điều khiển Game & Hệ thống (Game/OBS Controller):** Tự động gửi lệnh RCON đến máy chủ game (Minecraft, Source Engine) hoặc giả lập phím bấm Win32 (`SendInput`) có cơ chế chống dồn phím và **Nút dừng khẩn cấp (Emergency Stop)**.
- 💳 **Hệ thống Credit & Chống nợ số dư:** Quản lý hạn ngạch lượt đọc bằng sổ cái (Ledger-based) kết hợp giao dịchDB `optimistic locking` ngăn chặn tuyệt đối lỗi âm credit hay race-condition khi tương tác lớn.

---

## ⚡ Tính Năng Nổi Bật (Features)

### 🎛️ 1. Quản Lý Kịch Bản & Luật Tự Động (Rule Engine)
* Khớp luật theo thứ tự ưu tiên (`priority`).
* Lọc từ cấm (blacklist), lọc theo giá trị quà (`minCoinValue`), hoặc tên người gửi.
* Giới hạn tần suất thực thi (`cooldownMs`) để tránh spam giọng đọc hay làm đơ màn hình live.
* Tính năng **Dry-Run (Chạy thử luật)** giúp kiểm thử kịch bản trước khi lên sóng.

### 🎨 2. OBS Overlays & Local Bridge (Go Powered)
* **Local Bridge WS:** WebSocket Server nội bộ `ws://127.0.0.1:4000` viết bằng Go (goroutine + net/http), đảm bảo độ trễ dưới 1ms và không tiêu tốn quá 40MB RAM.
* **Tự động khôi phục:** Nếu mất kết nối Local Bridge, các khung Overlay trên OBS tự động chuyển vùng fallback về Cloud Server mà không bị ngắt ngang livestream.

### 🌗 3. Dark & Light Theme System
* Hỗ trợ giao diện **Sáng / Tối (Dark & Light Mode)** toàn diện trên cả Web Dashboard và Desktop App.
* Thiết kế theo phong cách Modern Glassmorphism, màu sắc Tailored HSL sang trọng và hiệu ứng vi tương tác mượt mà.

---

## 🛠️ Kiến Trúc & Công Nghệ (Architecture & Tech Stack)

Dự án được xây dựng theo mô hình **Monorepo** chuẩn Enterprise với `pnpm workspaces`:

```
                    ┌─────────────────────────────────────────┐
                    │          Next.js 14 Web Dashboard       │
                    │   (Marketing SSG, Dashboard, Overlays)  │
                    └────────────────────┬────────────────────┘
                                         │ REST / WSS
                                         ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│  Go / Wails v2 Core  │ ◄──┤   NestJS v10 Cloud API Server   │
│ (Local WS Bridge,    │    │ (Auth, Credit Ledger, TTS Cache,│
│  Win32 Input, RCON)  │    │  Socket.IO Events, Rule Engine) │
└──────────────────────┘    └────────────────┬────────────────┘
                                             │ Prisma ORM
                                             ▼
                               ┌──────────────────────────────┐
                               │ Supabase Postgres & Redis 7  │
                               └──────────────────────────────┘
```

| Tầng | Công nghệ | Vai trò & Đặc điểm |
|---|---|---|
| **Web App** | Next.js 14 (App Router) + React 18 | Dashboard điều khiển, Landing Page SSG, OBS Overlays (Dark/Light Theme) |
| **Cloud API** | NestJS v10 + TypeScript | RESTful API, Socket.IO Gateway, JwtAuthGuard, Rate Limiter |
| **Desktop Core** | Go 1.25 + Wails v2 | Local Bridge WebSocket `127.0.0.1:4000`, OBS WS v5, RCON, Win32 `SendInput` |
| **Database** | Supabase Cloud Postgres + Prisma ORM | 10 Models, kết nối qua Transaction Pooler (`pgbouncer`) + Session Direct URL |
| **Cache & Bus** | Redis 7 + EventEmitter2 | Lưu cache audio SHA256, Pub/Sub tín hiệu realtime |

---

## 🚀 Hướng Dẫn Nhanh (Quick Start)

### Yêu Cầu Tiền Đề (Prerequisites)
* Node.js v20+ hoặc **Node.js v22 LTS** (Khuyên dùng)
* `pnpm` v9+ (`npm install -g pnpm`)
* Go 1.25+ và Wails CLI v2 (nếu muốn build ứng dụng Desktop) — `go install github.com/wailsapp/wails/v2/cmd/wails@v2.13.0`
* Docker & Docker Compose (cho môi trường Postgres/Redis local)

---

### Bước 1: Clone Repository & Cài đặt Dependencies

```bash
git clone https://github.com/thydynh03/LiveNova.git
cd LiveNova
pnpm install
```

---

### Bước 2: Cấu Hình Biến Môi Trường (.env)

Tạo file `.env` từ các template đã chuẩn bị sẵn:

```bash
# Copy file .env mẫu ở thư mục gốc và các app
cp .env.example .env
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Cập nhật thông số kết nối Database Supabase trong `apps/server/.env`:
```ini
DATABASE_URL="postgresql://postgres.ljvrnyatrtbhdunyhfst:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.ljvrnyatrtbhdunyhfst:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

---

### Bước 3: Đồng Bộ Cơ Sở Dữ Liệu (Prisma Database Push)

```bash
cd apps/server
pnpm prisma db push
```

---

### Bước 4: Chạy Dự Án Ở Môi Trường Dev

Chạy song song toàn bộ Monorepo từ thư mục gốc:

```bash
# Bật Postgres & Redis Docker (nếu chạy local)
docker compose up -d

# Chạy song song cả Web App (port 3000) và NestJS Server (port 4001)
pnpm dev

# (Tùy chọn) Chạy Desktop App
cd apps/desktop-app
wails dev
```

* 🌐 **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
* ⚙️ **Backend API:** [http://localhost:4001](http://localhost:4001)
* 🔌 **Local Bridge WS:** `ws://127.0.0.1:4000`

---

## 📂 Cấu Trúc Thư Mục (Project Structure)

```text
LiveNova/
├── .github/workflows/          # CI/CD Workflows (CI, Release NSIS, CodeQL)
├── apps/
│   ├── web/                    # Next.js 14 Frontend App Router
│   │   ├── app/(dashboard)/    # Streamer Control Panel (Rules, Speech Queue)
│   │   ├── app/(marketing)/    # Landing Page SSG
│   │   └── app/overlays/       # OBS Browser Source Widgets (Chat, PK, Goal)
│   ├── server/                 # NestJS v10 Cloud API
│   │   ├── prisma/             # Prisma Schema (10 Models)
│   │   └── src/modules/        # Auth, User, Credit, TTS, Rule, Overlay, Tiktok
│   └── desktop-app/            # Go / Wails v2 Desktop Client
│       ├── internal/           # Local Bridge, OBS Controller, RCON, Key Sim, Netguard
│       └── frontend/           # React 18 + Vite WebView UI
├── packages/
│   └── shared/                 # Shared Types, DTOs, Rule Engine, Constants
├── docker-compose.yml          # Postgres + Redis Container Setup
└── pnpm-workspace.yaml         # Monorepo Workspace Config
```

---

## 🛡️ Bảo Mật & Đạt Chuẩn Audit (Security & Compliance)

LiveNova được thiết kế tuân thủ 100% các tiêu chuẩn bảo mật nghiêm ngặt:

- 🔒 **Row Level Security (RLS):** 10/10 bảng dữ liệu trên Supabase Postgres đều được bật RLS (`PROTECTED`).
- 🛡️ **HTTP Security Headers:** Tích hợp `helmet()` với CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- 🔑 **Local Bridge Token Authentication:** Local WS Bridge bắt buộc có Session Token ngẫu nhiên sinh ra mỗi lần khởi động.
- 🛑 **Win32 Input Safety:** Khung giới hạn thời gian giữ phím (cooldown), ngăn đơ bàn phím và nút dừng khẩn cấp ngắt lập tức mọi luồng nhấn phím.
- 🚫 **Chống Open-Redirect:** Kiểm tra đường dẫn điều hướng Auth chỉ chấp nhận path tương đối (`/path`).

---

## 🌐 English Summary

**LiveNova** is an enterprise-grade TikTok LIVE automation and real-time interaction platform built as a modern monorepo (`pnpm` workspaces).

- **Web App:** Next.js 14 App Router, React 18, Dark/Light Mode, OBS Overlays (Chat, PK Bar, Goal Bar).
- **Backend Server:** NestJS v10, Prisma ORM, Supabase Postgres, Redis, Google TTS Engine with SHA256 Audio Cache, Socket.IO Gateway.
- **Desktop Client:** Go (Wails v2) Local WebSocket Bridge (`127.0.0.1:4000`), OBS WebSocket v5, Source RCON client, Win32 Key Simulator (`SendInput`) with Emergency Stop.

---

## 📄 License

Project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ for TikTok LIVE Creators & Streamers by the LiveNova Team.</sub>
</div>

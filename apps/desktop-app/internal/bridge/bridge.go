// Package bridge implements the Local Bridge WebSocket server.
package bridge

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// allowedOrigins are the origins permitted to open a Local Bridge socket.
//
// C-08 — WebSocket connections are NOT subject to the same-origin policy, so
// binding to 127.0.0.1 alone does not keep the browser out: any page the
// streamer happens to visit can open ws://127.0.0.1:4000. Both an Origin
// allowlist and a session token are required.
var allowedOrigins = []string{
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:1420",
	"http://127.0.0.1:1420",
}

// DefaultPort is the loopback port the bridge listens on.
const DefaultPort = 4000

// maxCommandBytes bounds a single incoming frame. Commands are a few dozen
// bytes; anything near this is a client that has lost the plot.
const maxCommandBytes = 4096

// Status is the snapshot the desktop UI polls.
type Status struct {
	IsRunning        bool   `json:"is_running"`
	Port             int    `json:"port"`
	SessionToken     string `json:"session_token"`
	ConnectedClients int    `json:"connected_clients"`
}

// State holds the bridge's runtime state. The zero value is not usable; call New.
type State struct {
	mu               sync.RWMutex
	isRunning        bool
	connectedClients int

	port         int
	sessionToken string

	activity *activityLog
}

// New builds a State with a freshly generated session token.
func New() *State {
	return &State{
		port: DefaultPort,
		// 256 bits — this is a bearer credential, not an id.
		sessionToken: newSessionToken(),
		activity:     newActivityLog(),
	}
}

func newSessionToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand failing means we cannot produce a credential at all.
		// Continuing with a predictable token would be worse than stopping.
		panic(fmt.Sprintf("cannot generate Local Bridge session token: %v", err))
	}
	return hex.EncodeToString(buf)
}

// Status returns the current bridge status.
func (s *State) Status() Status {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return Status{
		IsRunning:        s.isRunning,
		Port:             s.port,
		SessionToken:     s.sessionToken,
		ConnectedClients: s.connectedClients,
	}
}

func (s *State) setRunning(running bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isRunning = running
}

func (s *State) addClient(delta int) {
	s.mu.Lock()
	s.connectedClients += delta
	if s.connectedClients < 0 {
		s.connectedClients = 0
	}
	s.mu.Unlock()

	// Ghi ngoài khoá: `activity` có khoá riêng, và giữ hai khoá lồng nhau là
	// cách một tiến trình tự khoá chính mình về sau.
	//
	// Dòng này quan trọng hơn vẻ ngoài của nó: khi quà không bấm được phím, câu
	// hỏi đầu tiên là bảng điều khiển có nối được tới đây không. Không có nó,
	// "chưa từng kết nối" và "kết nối rồi nhưng lệnh bị từ chối" trông giống hệt
	// nhau trên màn hình.
	if delta > 0 {
		s.activity.add(ActivityClient, true, "bảng điều khiển đã kết nối")
	} else if delta < 0 {
		s.activity.add(ActivityClient, false, "bảng điều khiển đã ngắt")
	}
}

// tokensMatch compares in constant time so a token cannot be recovered
// byte-by-byte by timing repeated handshakes against the loopback listener.
func tokensMatch(expected, presented string) bool {
	return subtle.ConstantTimeCompare([]byte(expected), []byte(presented)) == 1
}

// extractQueryParam pulls a raw (non-decoded) query parameter out of a URI.
func extractQueryParam(uri, key string) (string, bool) {
	_, query, found := strings.Cut(uri, "?")
	if !found {
		return "", false
	}
	for _, pair := range strings.Split(query, "&") {
		k, v, ok := strings.Cut(pair, "=")
		if ok && k == key {
			return v, true
		}
	}
	return "", false
}

func originAllowed(origin string) bool {
	for _, o := range allowedOrigins {
		if o == origin {
			return true
		}
	}
	return false
}

// upgrader relies on the checks performed in handler below rather than on
// gorilla's Host-based default, which would accept any page served from the
// same host.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool { return true },
}

func (s *State) handler(w http.ResponseWriter, r *http.Request) {
	// Defence in depth: even bound to loopback, refuse anything non-local.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		http.Error(w, "bad remote address", http.StatusForbidden)
		return
	}
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		slog.Warn("Local Bridge refused non-loopback connection", "peer", r.RemoteAddr)
		http.Error(w, "non-loopback connection refused", http.StatusForbidden)
		return
	}

	// C-08 — authenticate before the socket is upgraded. An earlier version
	// accepted every caller and never compared the generated token to anything.
	if origin := r.Header.Get("Origin"); origin != "" && !originAllowed(origin) {
		slog.Warn("Local Bridge handshake rejected", "reason", "origin not allowed")
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	presented, _ := extractQueryParam(r.RequestURI, "token")
	if presented == "" || !tokensMatch(s.sessionToken, presented) {
		slog.Warn("Local Bridge handshake rejected", "reason", "invalid session token")
		http.Error(w, "invalid session token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Debug("Local Bridge handshake failed", "err", err)
		return
	}
	defer conn.Close()

	// Only count clients that actually completed an authenticated handshake, so
	// the status readout reflects reality.
	s.addClient(1)
	defer s.addClient(-1)

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			slog.Debug("Local Bridge socket closed", "err", err)
			return
		}
		if msgType != websocket.TextMessage {
			continue
		}

		// Bounded before parsing: an unbounded frame would let one client hold
		// an arbitrary amount of memory on the streamer's machine.
		if len(msg) > maxCommandBytes {
			_ = conn.WriteJSON(Reply{Type: "error", OK: false, Error: "lệnh quá dài"})
			continue
		}

		reply := handleCommand(msg)
		s.recordCommand(reply)
		if !reply.OK {
			slog.Warn("Local Bridge command refused", "type", reply.Type, "err", reply.Error)
		}
		if err := conn.WriteJSON(reply); err != nil {
			slog.Debug("Local Bridge write failed", "err", err)
			return
		}
	}
}

// Start runs the bridge until ctx is cancelled. It blocks.
func (s *State) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handler)

	// Loopback only. Never 0.0.0.0 — that would expose the bridge to the LAN.
	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("Local Bridge cannot bind %s: %w", addr, err)
	}

	s.setRunning(true)
	defer s.setRunning(false)

	slog.Info("Local Bridge running", "addr", addr)
	// The token is a credential; it must not reach the log file.
	slog.Debug("Local Bridge session token generated (not logged)")

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}


// Activity trả về nhật ký gần đây, mới nhất trước.
func (s *State) Activity() []Entry {
	return s.activity.snapshot()
}

// recordCommand ghi lại kết quả của một lệnh vừa xử lý.
//
// Ghi ở đây chứ không ở trong `handleCommand` vì hàm đó là hàm thuần và các
// test của nó dựa vào điều đó. Nhật ký là chuyện của phiên kết nối, không phải
// của phép giải mã lệnh.
func (s *State) recordCommand(reply Reply) {
	switch reply.Type {
	case CommandKeyPress:
		if reply.OK {
			s.activity.add(ActivityKeyPress, true, "đã bấm phím")
		} else {
			// Lý do từ chối chính là thứ streamer cần: phím ngoài danh sách,
			// còn cooldown, hay đang dừng khẩn cấp — ba cách sửa khác nhau.
			s.activity.add(ActivityRejected, false, reply.Error)
		}
	case CommandHalt:
		s.activity.add(ActivityHalt, true, "đã bật dừng khẩn cấp")
	case CommandPing:
		// Ping là nhịp tim; ghi lại chỉ làm trôi mất những dòng đáng xem.
	default:
		if !reply.OK && reply.Error != "" {
			s.activity.add(ActivityRejected, false, reply.Error)
		}
	}
}

package bridge

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestTokensMatchIsExact(t *testing.T) {
	cases := []struct {
		expected, presented string
		want                bool
	}{
		{"abc123", "abc123", true},
		{"abc123", "abc124", false},
		{"abc123", "abc12", false},
		{"abc123", "", false},
	}
	for _, c := range cases {
		if got := tokensMatch(c.expected, c.presented); got != c.want {
			t.Errorf("tokensMatch(%q, %q) = %v, want %v", c.expected, c.presented, got, c.want)
		}
	}
}

func TestExtractsTokenFromQuery(t *testing.T) {
	cases := []struct {
		uri       string
		want      string
		wantFound bool
	}{
		{"/?token=deadbeef", "deadbeef", true},
		{"/socket?a=1&token=xyz&b=2", "xyz", true},
		{"/socket", "", false},
	}
	for _, c := range cases {
		got, found := extractQueryParam(c.uri, "token")
		if got != c.want || found != c.wantFound {
			t.Errorf("extractQueryParam(%q) = (%q, %v), want (%q, %v)",
				c.uri, got, found, c.want, c.wantFound)
		}
	}
}

func TestSessionTokenIsLongEnough(t *testing.T) {
	s := New()
	if len(s.sessionToken) != 64 {
		t.Errorf("session token length = %d, want 64", len(s.sessionToken))
	}
	if New().sessionToken == s.sessionToken {
		t.Error("two States produced the same session token")
	}
}

// dial exercises the real handshake path against an httptest server, which is
// where C-08 actually has to hold.
func dial(t *testing.T, srv *httptest.Server, query, origin string) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + query

	header := http.Header{}
	if origin != "" {
		header.Set("Origin", origin)
	}
	return websocket.DefaultDialer.Dial(url, header)
}

func newTestServer(t *testing.T) (*State, *httptest.Server) {
	t.Helper()
	s := New()
	srv := httptest.NewServer(http.HandlerFunc(s.handler))
	t.Cleanup(srv.Close)
	return s, srv
}

func TestHandshakeRejectsMissingToken(t *testing.T) {
	_, srv := newTestServer(t)

	conn, resp, err := dial(t, srv, "/", "")
	if err == nil {
		conn.Close()
		t.Fatal("expected an unauthenticated handshake to be rejected")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %v, want 401", resp)
	}
}

func TestHandshakeRejectsWrongToken(t *testing.T) {
	_, srv := newTestServer(t)

	conn, resp, err := dial(t, srv, "/?token="+strings.Repeat("0", 64), "")
	if err == nil {
		conn.Close()
		t.Fatal("expected a wrong token to be rejected")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("status = %v, want 401", resp)
	}
}

func TestHandshakeRejectsDisallowedOrigin(t *testing.T) {
	s, srv := newTestServer(t)

	// A valid token is not enough: a page the streamer happens to visit can
	// replay it only if we also let its origin through.
	conn, resp, err := dial(t, srv, "/?token="+s.sessionToken, "https://evil.example.com")
	if err == nil {
		conn.Close()
		t.Fatal("expected a disallowed origin to be rejected")
	}
	if resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Errorf("status = %v, want 403", resp)
	}
}

func TestHandshakeAcceptsValidTokenAndOrigin(t *testing.T) {
	s, srv := newTestServer(t)

	conn, _, err := dial(t, srv, "/?token="+s.sessionToken, "http://localhost:1420")
	if err != nil {
		t.Fatalf("a valid handshake was rejected: %v", err)
	}
	defer conn.Close()

	// The server increments the counter on its own goroutine once the upgrade
	// completes, so poll rather than reading it straight after Dial returns.
	deadline := time.Now().Add(2 * time.Second)
	for s.Status().ConnectedClients != 1 {
		if time.Now().After(deadline) {
			t.Fatalf("connected clients = %d, want 1", s.Status().ConnectedClients)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

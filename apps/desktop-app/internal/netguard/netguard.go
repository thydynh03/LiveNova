// Package netguard restricts which hosts the desktop app may connect out to.
package netguard

import (
	"net"
	"strings"
)

// IsPermittedTarget reports whether host is a legal OBS/RCON target.
//
// M-11 — these commands are callable from the WebView, so accepting an
// arbitrary host turned the desktop app into an SSRF proxy into whatever
// network the streamer happens to be on. Targets are restricted to the local
// machine and private ranges.
func IsPermittedTarget(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}

	ip := net.ParseIP(host)
	if ip == nil {
		// Hostnames cannot be validated without resolving them, and resolution
		// is itself the SSRF primitive. Require an explicit address.
		return false
	}

	if ip.IsLoopback() {
		return true
	}

	// IPv6 is loopback-only: mapping the private-range rules onto ULAs and
	// link-local addresses is not something we need yet, and guessing wrong
	// here re-opens the hole.
	if ip.To4() == nil {
		return false
	}

	return ip.IsPrivate()
}

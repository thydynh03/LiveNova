package netguard

import "testing"

func TestAllowsLocalAndPrivateTargets(t *testing.T) {
	for _, host := range []string{"localhost", "LocalHost", "127.0.0.1", "192.168.1.50", "10.0.0.7", "::1"} {
		if !IsPermittedTarget(host) {
			t.Errorf("expected %q to be permitted", host)
		}
	}
}

func TestRejectsPublicAndUnresolvableTargets(t *testing.T) {
	for _, host := range []string{
		"8.8.8.8",
		"evil.example.com",
		// The cloud metadata endpoint is the classic SSRF target and is not
		// covered by the private-range check.
		"169.254.169.254",
		"",
		"2001:4860:4860::8888",
	} {
		if IsPermittedTarget(host) {
			t.Errorf("expected %q to be rejected", host)
		}
	}
}

package updater

import (
	"os"
	"strings"
	"testing"
)

// ─── IsUpdateAvailable ────────────────────────────────────────────────────────

func TestIsUpdateAvailable_NewVersion(t *testing.T) {
	release := &LatestRelease{TagName: "v1.2.0"}
	if !IsUpdateAvailable("v1.0.0", release) {
		t.Error("expected update to be available when remote is newer")
	}
}

func TestIsUpdateAvailable_SameVersion(t *testing.T) {
	release := &LatestRelease{TagName: "v1.0.0"}
	if IsUpdateAvailable("v1.0.0", release) {
		t.Error("expected no update when versions match")
	}
}

func TestIsUpdateAvailable_DevBuild(t *testing.T) {
	release := &LatestRelease{TagName: "v1.0.0"}
	if IsUpdateAvailable("dev", release) {
		t.Error("dev builds should never be prompted to update")
	}
}

func TestIsUpdateAvailable_VPrefixStripped(t *testing.T) {
	release := &LatestRelease{TagName: "v2.0.0"}
	if !IsUpdateAvailable("v1.9.9", release) {
		t.Error("v-prefix should be stripped before comparison")
	}
}

// ─── platformSuffix ───────────────────────────────────────────────────────────

func TestPlatformSuffix_ReturnsValidExtension(t *testing.T) {
	suffix, err := platformSuffix()
	if err != nil {
		t.Fatalf("platformSuffix() error on CI runner: %v", err)
	}
	if suffix == "" {
		t.Fatal("platformSuffix() returned empty string")
	}
	if !strings.HasSuffix(suffix, ".tar.gz") && !strings.HasSuffix(suffix, ".zip") {
		t.Errorf("unexpected suffix: %q — expected .tar.gz or .zip", suffix)
	}
}

// ─── parseChecksum ────────────────────────────────────────────────────────────

func writeTempChecksumFile(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "checksums-*.txt")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	defer f.Close()
	if _, err := f.WriteString(content); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	return f.Name()
}

func TestParseChecksum_Found(t *testing.T) {
	path := writeTempChecksumFile(t,
		"abc123def456abc123def456abc123def456abc123def456abc123def456abc123  setu_linux_amd64.tar.gz\n"+
			"fedcba9876fedcba9876fedcba9876fedcba9876fedcba9876fedcba9876fedc  setu_darwin_amd64.tar.gz\n",
	)
	got, err := parseChecksum(path, "setu_linux_amd64.tar.gz")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "abc123def456abc123def456abc123def456abc123def456abc123def456abc123" {
		t.Errorf("wrong checksum returned: %q", got)
	}
}

func TestParseChecksum_NotFound(t *testing.T) {
	path := writeTempChecksumFile(t, "abc123  setu_linux_amd64.tar.gz\n")
	_, err := parseChecksum(path, "setu_windows_amd64.zip")
	if err == nil {
		t.Error("expected error when entry is missing from checksums.txt")
	}
}

func TestParseChecksum_EmptyFile(t *testing.T) {
	path := writeTempChecksumFile(t, "")
	_, err := parseChecksum(path, "setu_linux_amd64.tar.gz")
	if err == nil {
		t.Error("expected error for empty checksums file")
	}
}

// ─── findAsset ────────────────────────────────────────────────────────────────

func TestFindAsset_MatchesPlatform(t *testing.T) {
	suffix, err := platformSuffix()
	if err != nil {
		t.Skip("skipping: current platform is unsupported")
	}
	assets := []Asset{
		{Name: "setu_" + suffix, BrowserDownloadURL: "https://example.com/setu_" + suffix},
		{Name: "checksums.txt", BrowserDownloadURL: "https://example.com/checksums.txt"},
	}
	archiveURL, checksumURL, err := findAsset(assets)
	if err != nil {
		t.Fatalf("findAsset() unexpected error: %v", err)
	}
	if !strings.Contains(archiveURL, suffix) {
		t.Errorf("archive URL %q does not contain platform suffix %q", archiveURL, suffix)
	}
	if checksumURL == "" {
		t.Error("checksumURL should be populated when checksums.txt is present")
	}
}

func TestFindAsset_NoBinaryForPlatform(t *testing.T) {
	// Provide only a checksum file — no binary asset
	assets := []Asset{
		{Name: "checksums.txt", BrowserDownloadURL: "https://example.com/checksums.txt"},
	}
	_, _, err := findAsset(assets)
	if err == nil {
		t.Error("expected error when no binary asset matches the platform")
	}
}

func TestFindAsset_NoChecksumFile(t *testing.T) {
	suffix, err := platformSuffix()
	if err != nil {
		t.Skip("skipping: current platform is unsupported")
	}
	assets := []Asset{
		{Name: "setu_" + suffix, BrowserDownloadURL: "https://example.com/setu_" + suffix},
	}
	archiveURL, checksumURL, err := findAsset(assets)
	if err != nil {
		t.Fatalf("findAsset() should succeed even without a checksum file: %v", err)
	}
	if archiveURL == "" {
		t.Error("archiveURL should be populated")
	}
	if checksumURL != "" {
		t.Error("checksumURL should be empty when no checksums.txt is present")
	}
}

// Package updater implements GitHub Releases-based self-update logic.
package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Constants — override GITHUB_OWNER / GITHUB_REPO env vars at runtime.
const (
	defaultOwner = "pranavwaikar"
	defaultRepo  = "setu"
)

func owner() string {
	if v := os.Getenv("GITHUB_OWNER"); v != "" {
		return v
	}
	return defaultOwner
}

func repo() string {
	if v := os.Getenv("GITHUB_REPO"); v != "" {
		return v
	}
	return defaultRepo
}

// LatestRelease represents the GitHub API response for the latest release.
type LatestRelease struct {
	TagName string  `json:"tag_name"`
	Assets  []Asset `json:"assets"`
}

// Asset is a single downloadable file attached to a release.
type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// httpClient is a shared client with a sensible timeout.
var httpClient = &http.Client{Timeout: 30 * time.Second}

// GetLatestRelease queries the GitHub Releases API for the latest version.
func GetLatestRelease() (*LatestRelease, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", owner(), repo())
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "setu-cli")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("GitHub API returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var release LatestRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("decode release JSON: %w", err)
	}
	return &release, nil
}

// CheckConnectivity verifies that the GitHub API is reachable.
func CheckConnectivity() error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner(), repo())
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "setu-cli")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("GitHub returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// IsUpdateAvailable compares currentVersion (e.g. "v1.0.0") with the latest release tag.
// Returns true when the remote tag differs from the local version.
func IsUpdateAvailable(currentVersion string, release *LatestRelease) bool {
	remote := strings.TrimPrefix(release.TagName, "v")
	local := strings.TrimPrefix(currentVersion, "v")
	return remote != local && local != "dev"
}

// platformSuffix returns the expected binary archive suffix for the current OS/arch.
func platformSuffix() (string, error) {
	os_ := runtime.GOOS
	arch := runtime.GOARCH

	switch os_ {
	case "linux":
		switch arch {
		case "amd64":
			return "linux_amd64.tar.gz", nil
		case "arm64":
			return "linux_arm64.tar.gz", nil
		}
	case "darwin":
		switch arch {
		case "amd64":
			return "darwin_amd64.tar.gz", nil
		case "arm64":
			return "darwin_arm64.tar.gz", nil
		}
	case "windows":
		if arch == "amd64" {
			return "windows_amd64.zip", nil
		}
	}
	return "", fmt.Errorf("unsupported platform: %s/%s", os_, arch)
}

// findAsset locates the binary archive and checksum file from the release assets.
func findAsset(assets []Asset) (archiveURL, checksumURL string, err error) {
	suffix, err := platformSuffix()
	if err != nil {
		return "", "", err
	}

	for _, a := range assets {
		name := a.Name
		if strings.HasSuffix(name, suffix) && !strings.Contains(name, "checksums") {
			archiveURL = a.BrowserDownloadURL
		}
		if name == "checksums.txt" {
			checksumURL = a.BrowserDownloadURL
		}
	}

	if archiveURL == "" {
		return "", "", fmt.Errorf("no binary found for platform suffix %q in this release", suffix)
	}
	return archiveURL, checksumURL, nil
}

// downloadFile downloads url to a temporary file and returns its path.
func downloadFile(url string) (string, error) {
	tmp, err := os.CreateTemp("", "setu-update-*")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	defer tmp.Close()

	resp, err := httpClient.Get(url)
	if err != nil {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("download %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("download returned HTTP %d", resp.StatusCode)
	}

	if _, err := io.Copy(tmp, resp.Body); err != nil {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("write download: %w", err)
	}
	return tmp.Name(), nil
}

// verifySHA256 checks that the file at path has the expected SHA256 hex hash.
func verifySHA256(path, expectedHex string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != strings.ToLower(expectedHex) {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedHex, got)
	}
	return nil
}

// parseChecksum reads checksums.txt and finds the expected SHA256 for a given filename.
func parseChecksum(checksumPath, filename string) (string, error) {
	data, err := os.ReadFile(checksumPath)
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && (fields[1] == filename || strings.HasSuffix(fields[1], filename)) {
			return fields[0], nil
		}
	}
	return "", fmt.Errorf("checksum for %q not found in checksums.txt", filename)
}

// extractBinary extracts the setu binary from the downloaded archive.
// It returns the path to the extracted binary.
func extractBinary(archivePath string) (string, error) {
	suffix, _ := platformSuffix()
	if strings.HasSuffix(suffix, ".zip") {
		return extractZip(archivePath)
	}
	return extractTarGz(archivePath)
}

// SelfUpdate performs the complete self-update flow:
//  1. Find the correct asset for this platform
//  2. Download the archive
//  3. Verify SHA256 checksum (if checksum file is available)
//  4. Extract the binary
//  5. Atomically replace the running executable
//  6. Roll back if anything fails after extraction
func SelfUpdate(release *LatestRelease, progressFn func(string)) error {
	archiveURL, checksumURL, err := findAsset(release.Assets)
	if err != nil {
		return err
	}

	progressFn(fmt.Sprintf("Downloading %s...", release.TagName))
	archivePath, err := downloadFile(archiveURL)
	if err != nil {
		return fmt.Errorf("download archive: %w", err)
	}
	defer os.Remove(archivePath)

	// Verify checksum if available
	if checksumURL != "" {
		progressFn("Verifying checksum...")
		checksumPath, err := downloadFile(checksumURL)
		if err != nil {
			return fmt.Errorf("download checksums: %w", err)
		}
		defer os.Remove(checksumPath)

		archiveName := filepath.Base(archiveURL)
		expected, err := parseChecksum(checksumPath, archiveName)
		if err != nil {
			return fmt.Errorf("parse checksum: %w", err)
		}
		if err := verifySHA256(archivePath, expected); err != nil {
			return fmt.Errorf("checksum verification failed: %w", err)
		}
		progressFn("✔ Checksum verified.")
	}

	progressFn("Extracting binary...")
	newBinaryPath, err := extractBinary(archivePath)
	if err != nil {
		return fmt.Errorf("extract binary: %w", err)
	}
	defer os.Remove(newBinaryPath)

	// Locate the running executable
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate current executable: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("resolve symlinks: %w", err)
	}

	// Back up the current binary for rollback
	backupPath := execPath + ".bak"
	progressFn("Backing up current binary for rollback...")
	if err := copyFile(execPath, backupPath); err != nil {
		return fmt.Errorf("backup current binary: %w", err)
	}

	// Atomically replace the binary
	progressFn("Installing new binary...")
	if err := replaceExecutable(newBinaryPath, execPath); err != nil {
		// Attempt rollback
		progressFn("⚠ Install failed, rolling back...")
		if rbErr := copyFile(backupPath, execPath); rbErr != nil {
			progressFn(fmt.Sprintf("⚠ Rollback failed: %v — original binary saved at %s", rbErr, backupPath))
		} else {
			os.Remove(backupPath)
			progressFn("✔ Rolled back to previous version.")
		}
		return fmt.Errorf("replace binary: %w", err)
	}

	os.Remove(backupPath)
	return nil
}

// copyFile copies src to dst, preserving permissions.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	stat, err := in.Stat()
	if err != nil {
		return err
	}

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, stat.Mode())
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

package updater

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// extractTarGz extracts a .tar.gz archive and returns the path to the setu binary found inside.
func extractTarGz(archivePath string) (string, error) {
	f, err := os.Open(archivePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return "", fmt.Errorf("open gzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("read tar: %w", err)
		}

		base := filepath.Base(hdr.Name)
		// Match the setu binary (no extension on linux/darwin)
		if hdr.Typeflag == tar.TypeReg && (base == "setu" || base == "setu.exe") {
			tmp, err := os.CreateTemp("", "setu-new-*")
			if err != nil {
				return "", err
			}
			if _, err := io.Copy(tmp, io.LimitReader(tr, 100<<20)); err != nil { // 100 MiB safety limit
				tmp.Close()
				os.Remove(tmp.Name())
				return "", fmt.Errorf("extract binary: %w", err)
			}
			tmp.Close()
			if err := os.Chmod(tmp.Name(), 0755); err != nil {
				os.Remove(tmp.Name())
				return "", err
			}
			return tmp.Name(), nil
		}
	}
	return "", fmt.Errorf("setu binary not found in archive")
}

// extractZip extracts a .zip archive and returns the path to the setu binary.
func extractZip(archivePath string) (string, error) {
	// Use archive/zip from stdlib
	// We do this import inline via a helper to keep the file cross-platform without build tags.
	return extractZipImpl(archivePath)
}

// binaryName returns "setu" on unix and "setu.exe" on windows.
func binaryName() string {
	if strings.ToLower(os.Getenv("GOOS")) == "windows" {
		return "setu.exe"
	}
	// Check runtime
	switch {
	case strings.Contains(os.Getenv("OS"), "Windows"):
		return "setu.exe"
	}
	return "setu"
}

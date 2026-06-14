package updater

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// extractZipImpl extracts the setu binary from a .zip archive (Windows).
func extractZipImpl(archivePath string) (string, error) {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", fmt.Errorf("open zip: %w", err)
	}
	defer r.Close()

	for _, f := range r.File {
		base := filepath.Base(f.Name)
		if base == "setu.exe" || base == "setu" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}

			tmp, err := os.CreateTemp("", "setu-new-*.exe")
			if err != nil {
				rc.Close()
				return "", err
			}
			_, err = io.Copy(tmp, io.LimitReader(rc, 100<<20))
			rc.Close()
			tmp.Close()
			if err != nil {
				os.Remove(tmp.Name())
				return "", fmt.Errorf("extract zip entry: %w", err)
			}
			if err := os.Chmod(tmp.Name(), 0755); err != nil {
				os.Remove(tmp.Name())
				return "", err
			}
			return tmp.Name(), nil
		}
	}
	return "", fmt.Errorf("setu binary not found in zip archive")
}

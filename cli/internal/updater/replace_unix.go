//go:build !windows

package updater

import (
	"fmt"
	"os"
	"path/filepath"
)

// replaceExecutable atomically replaces the running binary on Unix systems.
// Strategy: write new binary to a sibling temp file, then rename (atomic on same filesystem).
func replaceExecutable(newBinaryPath, execPath string) error {
	dir := filepath.Dir(execPath)
	tmp, err := os.CreateTemp(dir, ".setu-update-*")
	if err != nil {
		return fmt.Errorf("create staging file: %w", err)
	}
	stagingPath := tmp.Name()
	tmp.Close()

	// Copy new binary into staging location
	if err := copyFile(newBinaryPath, stagingPath); err != nil {
		os.Remove(stagingPath)
		return fmt.Errorf("stage new binary: %w", err)
	}

	// Make it executable
	if err := os.Chmod(stagingPath, 0755); err != nil {
		os.Remove(stagingPath)
		return err
	}

	// Atomic rename
	if err := os.Rename(stagingPath, execPath); err != nil {
		os.Remove(stagingPath)
		return fmt.Errorf("rename: %w", err)
	}
	return nil
}

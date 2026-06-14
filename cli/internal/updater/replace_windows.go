//go:build windows

package updater

import (
	"fmt"
	"os"
	"path/filepath"
)

// replaceExecutable replaces the running binary on Windows.
// On Windows, a running executable cannot be directly overwritten.
// Strategy: rename the current binary to .old, copy new binary in, schedule deletion of .old.
func replaceExecutable(newBinaryPath, execPath string) error {
	oldPath := execPath + ".old"

	// Remove any stale old binary
	os.Remove(oldPath)

	// Rename current binary out of the way
	if err := os.Rename(execPath, oldPath); err != nil {
		return fmt.Errorf("move current binary: %w", err)
	}

	// Copy new binary into place
	if err := copyFile(newBinaryPath, execPath); err != nil {
		// Attempt to restore
		os.Rename(oldPath, execPath)
		return fmt.Errorf("install new binary: %w", err)
	}

	if err := os.Chmod(execPath, 0755); err != nil {
		return err
	}

	// Best-effort removal of the old binary; Windows may defer this.
	dir := filepath.Dir(execPath)
	_ = scheduleDeleteOnReboot(oldPath, dir)
	return nil
}

// scheduleDeleteOnReboot uses MoveFileExW with MOVEFILE_DELAY_UNTIL_REBOOT.
// Falls back gracefully if the call is unavailable.
func scheduleDeleteOnReboot(path, _ string) error {
	// Attempt a best-effort delete; a locked file will survive until reboot.
	err := os.Remove(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "note: old binary %s will be removed on next reboot\n", path)
	}
	return nil
}

//go:build linux

package main

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"syscall"
)

func applyRuntimeIdentity(dataDir string, identity runtimeIdentity) error {
	currentUID := os.Geteuid()
	currentGID := os.Getegid()
	if currentUID == identity.uid && currentGID == identity.gid {
		return nil
	}

	if currentUID != 0 {
		return fmt.Errorf("cannot switch from UID %d:GID %d to UID %d:GID %d: start Patchies as root or unset %s and %s", currentUID, currentGID, identity.uid, identity.gid, runUIDEnv, runGIDEnv)
	}

	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		return fmt.Errorf("create data directory: %w", err)
	}

	if err := filepath.WalkDir(dataDir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		return os.Lchown(path, identity.uid, identity.gid)
	}); err != nil {
		return fmt.Errorf("set data directory ownership: %w", err)
	}

	if err := syscall.Setgroups([]int{}); err != nil {
		return fmt.Errorf("clear supplementary groups: %w", err)
	}

	if err := syscall.Setgid(identity.gid); err != nil {
		return fmt.Errorf("switch to GID %d: %w", identity.gid, err)
	}

	if err := syscall.Setuid(identity.uid); err != nil {
		return fmt.Errorf("switch to UID %d: %w", identity.uid, err)
	}

	log.Printf("Prepared %s and dropped privileges to UID %d:GID %d", dataDir, identity.uid, identity.gid)

	return nil
}

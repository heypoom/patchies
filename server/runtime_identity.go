package main

import (
	"fmt"
	"os"
	"strconv"
)

const (
	runUIDEnv = "PATCHIES_RUN_UID"
	runGIDEnv = "PATCHIES_RUN_GID"
)

type runtimeIdentity struct {
	uid int
	gid int
}

func prepareRuntimeDataDir(dataDir string) error {
	identity, err := runtimeIdentityFromEnvironment()
	if err != nil {
		return err
	}

	if identity == nil {
		return nil
	}

	return applyRuntimeIdentity(dataDir, *identity)
}

func runtimeIdentityFromEnvironment() (*runtimeIdentity, error) {
	uidValue := os.Getenv(runUIDEnv)
	gidValue := os.Getenv(runGIDEnv)
	if uidValue == "" && gidValue == "" {
		return nil, nil
	}

	if uidValue == "" || gidValue == "" {
		return nil, fmt.Errorf("%s and %s must be set together", runUIDEnv, runGIDEnv)
	}

	uid, err := parseNonRootID(runUIDEnv, uidValue)
	if err != nil {
		return nil, err
	}

	gid, err := parseNonRootID(runGIDEnv, gidValue)
	if err != nil {
		return nil, err
	}

	return &runtimeIdentity{uid: uid, gid: gid}, nil
}

func parseNonRootID(name string, value string) (int, error) {
	id, err := strconv.Atoi(value)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}

	return id, nil
}

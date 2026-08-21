//go:build !linux

package main

import "fmt"

func applyRuntimeIdentity(_ string, _ runtimeIdentity) error {
	return fmt.Errorf("%s and %s are supported only on Linux", runUIDEnv, runGIDEnv)
}

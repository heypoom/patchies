package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/heypoom/patchies/cli/internal/mountsession"
	"github.com/heypoom/patchies/cli/internal/protocol"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "patchies:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 || args[0] != "mount" {
		return errors.New("usage: patchies mount --token <connection-string> --path <directory>")
	}

	flags := flag.NewFlagSet("mount", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	token := flags.String("token", "", "Remote Control connection string")
	path := flags.String("path", "", "empty or new mount directory")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if *token == "" || *path == "" {
		return errors.New("--token and --path are required")
	}

	connection, err := protocol.ParseConnection(*token)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return mountsession.New(connection, *path).Run(ctx)
}

package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
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
		return errors.New("usage: patchies mount [--token <connection-string>] [--path <directory>]")
	}

	token, path, err := readMountOptions(args[1:], os.Stdin, os.Stderr)
	if err != nil {
		return err
	}

	connection, err := protocol.ParseConnection(token)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return mountsession.New(connection, path).Run(ctx)
}

func readMountOptions(args []string, input io.Reader, output io.Writer) (string, string, error) {
	flags := flag.NewFlagSet("mount", flag.ContinueOnError)
	flags.SetOutput(output)
	token := flags.String("token", "", "Remote Control connection string")
	path := flags.String("path", "", "empty or new mount directory")
	if err := flags.Parse(args); err != nil {
		return "", "", err
	}

	reader := bufio.NewReader(input)
	if *token == "" {
		value, err := prompt(reader, output, "Remote Control token")
		if err != nil {
			return "", "", err
		}
		*token = value
	}

	if *path == "" {
		value, err := prompt(reader, output, "Mount path")
		if err != nil {
			return "", "", err
		}
		*path = value
	}

	return *token, *path, nil
}

func prompt(reader *bufio.Reader, output io.Writer, label string) (string, error) {
	fmt.Fprintf(output, "%s: ", label)

	value, err := reader.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("read %s: %w", strings.ToLower(label), err)
	}

	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%s cannot be empty", strings.ToLower(label))
	}

	return value, nil
}

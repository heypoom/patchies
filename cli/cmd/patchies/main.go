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
		return errors.New("usage: patchies mount [--token <connection-string> | --token-fd <file-descriptor>] [--path <directory>]")
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
	tokenFD := flags.Int("token-fd", -1, "file descriptor containing the Remote Control connection string")
	path := flags.String("path", "", "empty or new mount directory")
	if err := flags.Parse(args); err != nil {
		return "", "", err
	}

	if *token != "" && *tokenFD >= 0 {
		return "", "", errors.New("token and token-fd cannot be used together")
	}

	reader := bufio.NewReader(input)
	if *tokenFD >= 0 {
		value, err := readTokenFileDescriptor(*tokenFD)
		if err != nil {
			return "", "", err
		}
		*token = value
	}
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

func readTokenFileDescriptor(fd int) (string, error) {
	duplicate, err := syscall.Dup(fd)
	if err != nil {
		return "", fmt.Errorf("duplicate token file descriptor: %w", err)
	}
	file := os.NewFile(uintptr(duplicate), "remote-control-token")
	defer func() { _ = file.Close() }()

	value, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read token file descriptor: %w", err)
	}

	value = []byte(strings.TrimSpace(string(value)))
	if len(value) == 0 {
		return "", errors.New("remote control token cannot be empty")
	}

	return string(value), nil
}

func prompt(reader *bufio.Reader, output io.Writer, label string) (string, error) {
	if _, err := fmt.Fprintf(output, "%s: ", label); err != nil {
		return "", fmt.Errorf("write %s prompt: %w", strings.ToLower(label), err)
	}

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

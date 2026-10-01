package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/heypoom/patchies/cli/internal/mountsession"
)

func graphCommand(args []string, output io.Writer) error {
	command, path, err := readGraphCommand(args)
	if err != nil {
		return err
	}
	return mountsession.ExecuteLocal(context.Background(), path, command, output)
}

func readGraphCommand(args []string) (json.RawMessage, string, error) {
	if len(args) == 0 {
		return nil, "", errors.New("graph, node or wire command required")
	}
	group := args[0]
	action := ""
	rest := args[1:]
	if group != "graph" {
		if len(rest) == 0 {
			return nil, "", errors.New("node create|delete|inspect, or wire connect|disconnect required")
		}
		action, rest = rest[0], rest[1:]
	}
	// Go flags normally stop at the first positional argument; accept flags after IDs too.
	flagsArgs, positional := []string{}, []string{}
	for i := 0; i < len(rest); i++ {
		value := rest[i]
		if strings.HasPrefix(value, "--") {
			flagsArgs = append(flagsArgs, value)
			if value != "--json" && !strings.Contains(value, "=") {
				if i+1 >= len(rest) {
					return nil, "", fmt.Errorf("%s requires a value", value)
				}
				i++
				flagsArgs = append(flagsArgs, rest[i])
			}
		} else {
			positional = append(positional, value)
		}
	}
	flags := flag.NewFlagSet("graph", flag.ContinueOnError)
	path := flags.String("path", ".", "running mount directory")
	position := flags.String("position", "", "x,y in canvas coordinates")
	data := flags.String("data", "", "initial node data as JSON")
	_ = flags.Bool("json", false, "structured output (always enabled)")
	if err := flags.Parse(flagsArgs); err != nil {
		return nil, "", err
	}
	command := map[string]any{}
	switch group + "." + action {
	case "graph.":
		if len(positional) != 0 {
			return nil, "", errors.New("graph takes no IDs")
		}
		command["kind"] = "graph.query"
	case "node.inspect":
		if len(positional) != 1 {
			return nil, "", errors.New("node inspect requires one ID")
		}
		command["kind"], command["nodeId"] = "graph.query", positional[0]
	case "node.create":
		if len(positional) != 1 {
			return nil, "", errors.New("node create requires an object name or expression")
		}
		command["kind"], command["name"] = "node.create", positional[0]
		if *position != "" {
			parts := strings.Split(*position, ",")
			if len(parts) != 2 {
				return nil, "", errors.New("position must be x,y")
			}
			x, errX := strconv.ParseFloat(parts[0], 64)
			y, errY := strconv.ParseFloat(parts[1], 64)
			if errX != nil || errY != nil {
				return nil, "", errors.New("position must be numeric")
			}
			command["position"] = map[string]float64{"x": x, "y": y}
		}
		if *data != "" {
			var value map[string]any
			if err := json.Unmarshal([]byte(*data), &value); err != nil || value == nil {
				return nil, "", errors.New("data must be a JSON object")
			}
			command["data"] = value
		}
	case "node.delete":
		if len(positional) == 0 {
			return nil, "", errors.New("node delete requires IDs")
		}
		command["kind"], command["nodeIds"] = "node.delete", positional
	case "wire.connect", "wire.disconnect":
		if len(positional) != 2 {
			return nil, "", errors.New("wire command requires source:handle and target:handle")
		}
		src, srcHandle, err := endpoint(positional[0])
		if err != nil {
			return nil, "", err
		}
		target, targetHandle, err := endpoint(positional[1])
		if err != nil {
			return nil, "", err
		}
		wire := map[string]any{"source": src, "sourceHandle": srcHandle, "target": target, "targetHandle": targetHandle}
		command["kind"], command["add"], command["remove"] = "wire.change", []any{}, []any{}
		if action == "connect" {
			command["add"] = []any{wire}
		} else {
			command["remove"] = []any{wire}
		}
	default:
		return nil, "", errors.New("unknown graph command")
	}
	encoded, err := json.Marshal(command)
	return encoded, *path, err
}

func endpoint(value string) (string, any, error) {
	node, rest, _, err := endpointIdentifier(value)
	if err != nil || !strings.HasPrefix(rest, ":") {
		return "", nil, errors.New("endpoint must be node-id:handle-id")
	}
	port, rest, quoted, err := endpointIdentifier(rest[1:])
	if err != nil || rest != "" {
		return "", nil, errors.New("invalid endpoint handle ID")
	}
	if port == "@default" && !quoted {
		return node, nil, nil
	}
	return node, port, nil
}

func endpointIdentifier(value string) (string, string, bool, error) {
	if strings.HasPrefix(value, "\"") {
		decoder := json.NewDecoder(strings.NewReader(value))
		var identifier string
		if err := decoder.Decode(&identifier); err != nil || identifier == "" {
			return "", "", true, errors.New("invalid quoted endpoint ID")
		}
		return identifier, value[decoder.InputOffset():], true, nil
	}
	end := strings.IndexAny(value, ": \t\r\n\"")
	if end < 0 {
		end = len(value)
	}
	if end == 0 {
		return "", "", false, errors.New("endpoint ID cannot be empty")
	}
	return value[:end], value[end:], false, nil
}

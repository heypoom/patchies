package main

import (
	"encoding/json"
	"testing"
)

func TestGraphCommandAcceptsFlagsAfterEndpoints(t *testing.T) {
	command, path, err := readGraphCommand([]string{"wire", "connect", "a:out-0", "b:in-1", "--path", "./mount", "--json"})
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Kind string
		Add  []struct{ Source, SourceHandle, Target, TargetHandle string }
	}
	if err := json.Unmarshal(command, &body); err != nil {
		t.Fatal(err)
	}
	if path != "./mount" || body.Kind != "wire.change" || len(body.Add) != 1 || body.Add[0].SourceHandle != "out-0" || body.Add[0].TargetHandle != "in-1" {
		t.Fatalf("command: %s at %s", command, path)
	}
}

func TestCreateCommandReadsPositionAndInitialData(t *testing.T) {
	command, _, err := readGraphCommand([]string{"node", "create", "glsl", "--position", "100,200", "--data", `{"code":"shader"}`})
	if err != nil {
		t.Fatal(err)
	}
	var body struct {
		Name     string
		Position struct{ X, Y float64 }
		Data     map[string]string
	}
	if err := json.Unmarshal(command, &body); err != nil {
		t.Fatal(err)
	}
	if body.Name != "glsl" || body.Position.X != 100 || body.Position.Y != 200 || body.Data["code"] != "shader" {
		t.Fatalf("create: %s", command)
	}
}

func TestEndpointsPreserveQuotedIDsAndLiteralDefaultNames(t *testing.T) {
	node, port, err := endpoint(`"node:with spaces":"@default"`)
	if err != nil || node != "node:with spaces" || port != "@default" {
		t.Fatalf("quoted endpoint: %s %v %v", node, port, err)
	}
	_, port, err = endpoint("a:@default")
	if err != nil || port != nil {
		t.Fatalf("default endpoint: %v %v", port, err)
	}
}

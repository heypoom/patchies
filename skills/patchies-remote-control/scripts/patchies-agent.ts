#!/usr/bin/env bun

import { joinRoom, type DataPayload } from "trystero";
import { RTCPeerConnection } from "werift";

interface RequestMessage {
  type: "request";
  id: string;
  capability: string;
  tool: string;
  args: Record<string, unknown>;
}

interface ResponseMessage {
  type: "response";
  id: string;
  result: unknown;
}

const CHANNEL = "__remote-control";
const CONNECT_TIMEOUT_MS = 5_000;
const RESPONSE_TIMEOUT_MS = 15_000;

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(value: string | undefined): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail("--args must be a JSON object");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    fail(
      `Could not parse --args: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function waitForPeer(room: ReturnType<typeof joinRoom>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the Patchies editor")),
      CONNECT_TIMEOUT_MS,
    );

    room.onPeerJoin(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function requestEditor(message: RequestMessage): Promise<unknown> {
  const room = joinRoom(
    { appId: "patchies", rtcPolyfill: RTCPeerConnection },
    getOption("--room")!,
  );
  const [send, onMessage] = room.makeAction(CHANNEL);
  let responseTimeout: ReturnType<typeof setTimeout> | null = null;

  const response = new Promise<unknown>((resolve, reject) => {
    responseTimeout = setTimeout(
      () =>
        reject(new Error("Timed out waiting for the Patchies editor response")),
      RESPONSE_TIMEOUT_MS,
    );

    onMessage((data) => {
      const response = data as Partial<ResponseMessage>;
      if (response.type !== "response" || response.id !== message.id) return;

      if (responseTimeout) clearTimeout(responseTimeout);
      resolve(response.result);
    });
  });

  try {
    await waitForPeer(room);
    await send(message as DataPayload);

    return await response;
  } finally {
    if (responseTimeout) clearTimeout(responseTimeout);
    room.leave();
  }
}

const command = process.argv[2];
if (command !== "request") {
  fail(
    "Usage: patchies-agent.ts request --room <room> --capability <token> --tool <tool> [--args <json>]",
  );
}

const room = getOption("--room");
const capability = getOption("--capability");
const tool = getOption("--tool");

if (!room || !capability || !tool) {
  fail("Missing --room, --capability, or --tool");
}

const message: RequestMessage = {
  type: "request",
  id: crypto.randomUUID(),
  capability,
  tool,
  args: parseArgs(getOption("--args")),
};

try {
  const result = await requestEditor(message);

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

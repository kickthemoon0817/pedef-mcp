import { spawn } from "node:child_process";
import { createContentLengthParser } from "../src/protocol.js";

function encode(payload) {
  const json = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

function send(proc, payload) {
  proc.stdin.write(encode(payload));
}

async function run() {
  const proc = spawn("node", ["src/server.js"], { stdio: ["pipe", "pipe", "pipe"] });
  const replies = new Map();
  let nextId = 1;

  proc.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  proc.stdout.on(
    "data",
    createContentLengthParser((message) => {
      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        replies.set(message.id, message);
      }
    })
  );

  const expectReply = async (id) => {
    const timeoutMs = 2000;
    const started = Date.now();

    while (!replies.has(id)) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for reply id=${id}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const reply = replies.get(id);
    replies.delete(id);
    return reply;
  };

  function assert(condition, message) {
    if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
  }

  // --- Initialize ---
  const initId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: initId,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.1.0" }
    }
  });
  const initReply = await expectReply(initId);
  assert(initReply.result?.serverInfo?.name === "pedef-mcp", "initialize returned serverInfo");

  send(proc, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  // --- tools/list ---
  const listId = nextId++;
  send(proc, { jsonrpc: "2.0", id: listId, method: "tools/list", params: {} });
  const listReply = await expectReply(listId);
  assert(Array.isArray(listReply.result?.tools) && listReply.result.tools.length === 5, "tools/list returned 5 tools");

  // --- reader.list_entrypoints ---
  const entryId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: entryId,
    method: "tools/call",
    params: { name: "reader.list_entrypoints", arguments: {} }
  });
  const entryReply = await expectReply(entryId);
  assert(entryReply.result?.content?.[0]?.text?.includes("reader"), "list_entrypoints has reader data");

  // --- reader.get_text (single page) ---
  const textId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: textId,
    method: "tools/call",
    params: {
      name: "reader.get_text",
      arguments: { session_id: "demo-session", page_index: 0 }
    }
  });
  const textReply = await expectReply(textId);
  assert(textReply.result?.content?.[0]?.text?.includes("demo page text"), "get_text returns page text");

  // --- reader.get_text (page range) ---
  const rangeId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: rangeId,
    method: "tools/call",
    params: {
      name: "reader.get_text",
      arguments: { session_id: "demo-session", page_start: 0, page_end_exclusive: 2 }
    }
  });
  const rangeReply = await expectReply(rangeId);
  assert(rangeReply.result?.content?.[0]?.text?.includes("sources"), "get_text range returns sources");

  // --- reader.caption_region ---
  const captionId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: captionId,
    method: "tools/call",
    params: {
      name: "reader.caption_region",
      arguments: {
        session_id: "demo-session",
        page_index: 1,
        rect: { x: 10, y: 20, width: 80, height: 60 }
      }
    }
  });
  const captionReply = await expectReply(captionId);
  assert(captionReply.result?.content?.[0]?.text?.includes("caption"), "caption_region has caption");

  // --- reader.capture_region ---
  const captureId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: captureId,
    method: "tools/call",
    params: {
      name: "reader.capture_region",
      arguments: {
        session_id: "demo-session",
        page_index: 0,
        rect: { x: 0, y: 0, width: 120, height: 120 },
        appearance: "light"
      }
    }
  });
  const captureReply = await expectReply(captureId);
  assert(captureReply.result?.content?.[0]?.data, "capture_region returns image data");

  // --- reader.snapshot_state ---
  const snapId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: snapId,
    method: "tools/call",
    params: {
      name: "reader.snapshot_state",
      arguments: { session_id: "demo-session" }
    }
  });
  const snapReply = await expectReply(snapId);
  assert(snapReply.result?.content?.[0]?.text?.includes("Demo Paper"), "snapshot_state has paper title");

  // --- Error: unknown tool ---
  const unknownId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: unknownId,
    method: "tools/call",
    params: { name: "nonexistent.tool", arguments: {} }
  });
  const unknownReply = await expectReply(unknownId);
  assert(unknownReply.result?.isError === true, "unknown tool returns isError");

  // --- Error: unknown session ---
  const badSessionId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: badSessionId,
    method: "tools/call",
    params: {
      name: "reader.get_text",
      arguments: { session_id: "no-such-session", page_index: 0 }
    }
  });
  const badSessionReply = await expectReply(badSessionId);
  assert(badSessionReply.result?.isError === true, "unknown session returns isError");

  // --- Error: unknown method ---
  const badMethodId = nextId++;
  send(proc, {
    jsonrpc: "2.0",
    id: badMethodId,
    method: "nonexistent/method",
    params: {}
  });
  const badMethodReply = await expectReply(badMethodId);
  assert(badMethodReply.error?.code === -32601, "unknown method returns -32601");

  proc.kill();
  console.log("Smoke test passed (all assertions ok).");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  // Ensure child process is killed on failure
  try { process.kill(0); } catch { /* ignore */ }
});

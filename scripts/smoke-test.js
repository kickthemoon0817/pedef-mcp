import { spawn } from "node:child_process";

function encode(payload) {
  const json = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

function createParser(onMessage) {
  let buffer = Buffer.alloc(0);

  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const lengthLine = header
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));

      if (!lengthLine) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }

      const length = Number(lengthLine.split(":")[1].trim());
      const end = headerEnd + 4 + length;
      if (buffer.length < end) {
        return;
      }

      const body = buffer.subarray(headerEnd + 4, end).toString("utf8");
      buffer = buffer.subarray(end);

      onMessage(JSON.parse(body));
    }
  };
}

function send(proc, payload) {
  proc.stdin.write(encode(payload));
}

async function run() {
  const proc = spawn("node", ["src/server.js"], { stdio: ["pipe", "pipe", "pipe"] });
  const replies = new Map();

  proc.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  proc.stdout.on(
    "data",
    createParser((message) => {
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

  send(proc, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.1.0" }
    }
  });
  const initReply = await expectReply(1);
  if (!initReply.result?.serverInfo?.name) {
    throw new Error("initialize did not return serverInfo");
  }

  send(proc, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send(proc, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const listReply = await expectReply(2);
  if (!Array.isArray(listReply.result?.tools) || listReply.result.tools.length === 0) {
    throw new Error("tools/list returned no tools");
  }

  send(proc, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "reader.list_entrypoints",
      arguments: {}
    }
  });
  const entryReply = await expectReply(3);
  if (!entryReply.result?.content?.[0]?.text?.includes("reader")) {
    throw new Error("reader.list_entrypoints returned unexpected content");
  }

  send(proc, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "reader.caption_region",
      arguments: {
        session_id: "demo-session",
        page_index: 1,
        rect: { x: 10, y: 20, width: 80, height: 60 },
        appearance: "dark"
      }
    }
  });
  const captionReply = await expectReply(4);
  if (!captionReply.result?.content?.[0]?.text?.includes("caption")) {
    throw new Error("reader.caption_region missing caption payload");
  }

  send(proc, {
    jsonrpc: "2.0",
    id: 5,
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
  const captureReply = await expectReply(5);
  if (!captureReply.result?.content?.[0]?.data) {
    throw new Error("reader.capture_region missing image payload");
  }

  proc.kill();
  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

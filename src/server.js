import { createContentLengthParser, writeMessage } from "./protocol.js";
import { tools } from "./tools.js";
import { ToolQueue } from "./queue.js";

const queue = new ToolQueue();

function asToolResult(result) {
  if (result?.payload?.image_base64 && result?.payload?.mime_type) {
    const { image_base64, ...metadataPayload } = result.payload;
    return {
      content: [
        {
          type: "image",
          data: image_base64,
          mimeType: result.payload.mime_type
        },
        {
          type: "text",
          text: JSON.stringify({ ...result, payload: metadataPayload }, null, 2)
        }
      ]
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

async function handleRequest(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;

  if (!message.method || typeof message.method !== "string") {
    if (id !== null) {
      return writeMessage(process.stdout, {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32600,
          message: "Invalid Request: missing or non-string method"
        }
      });
    }
    return;
  }

  if (message.method === "initialize") {
    return writeMessage(process.stdout, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-11-25",
        serverInfo: {
          name: "pedef-mcp",
          version: "0.1.0"
        },
        capabilities: {
          tools: {
            listChanged: false
          }
        }
      }
    });
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    return writeMessage(process.stdout, {
      jsonrpc: "2.0",
      id,
      result: { tools }
    });
  }

  if (message.method === "tools/call") {
    const toolName = message.params?.name;
    const args = message.params?.arguments ?? {};

    if (!toolName || !tools.find((item) => item.name === toolName)) {
      return writeMessage(process.stdout, {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${toolName ?? "<missing>"}` }]
        }
      });
    }

    try {
      const result = await queue.enqueue({ toolName, args });
      return writeMessage(process.stdout, {
        jsonrpc: "2.0",
        id,
        result: asToolResult(result)
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unknown error";
      return writeMessage(process.stdout, {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: messageText }]
        }
      });
    }
  }

  if (id !== null) {
    return writeMessage(process.stdout, {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`
      }
    });
  }
}

const parser = createContentLengthParser((message) => {
  handleRequest(message).catch((error) => {
    process.stderr.write(`Unhandled error: ${error?.message ?? error}\n`);
  });
});

process.stdin.on("data", parser);
process.stdin.on("error", () => {
  process.exitCode = 1;
});

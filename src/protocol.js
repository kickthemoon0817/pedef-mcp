export function writeMessage(stream, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  stream.write(Buffer.concat([header, body]));
}

export function createContentLengthParser(onMessage) {
  let buffer = Buffer.alloc(0);

  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const headerBlock = buffer.subarray(0, headerEnd).toString("utf8");
      const lengthLine = headerBlock
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));

      if (!lengthLine) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }

      const length = Number(lengthLine.split(":")[1]?.trim() ?? "0");
      const total = headerEnd + 4 + length;
      if (buffer.length < total) {
        return;
      }

      const body = buffer.subarray(headerEnd + 4, total).toString("utf8");
      buffer = buffer.subarray(total);

      try {
        const parsed = JSON.parse(body);
        onMessage(parsed);
      } catch {
        // Ignore malformed payload.
      }
    }
  };
}

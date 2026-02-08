export const tools = [
  {
    name: "reader.list_entrypoints",
    description: "List reader and developer entrypoints exposed by Pedef bridge.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "reader.get_text",
    description: "Get source-linked text payload by session and page or page range.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        page_index: { type: "integer", minimum: 0 },
        page_start: { type: "integer", minimum: 0 },
        page_end_exclusive: { type: "integer", minimum: 1 }
      },
      required: ["session_id"],
      additionalProperties: false
    }
  },
  {
    name: "reader.capture_region",
    description: "Capture internal reader image region with appearance control.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        page_index: { type: "integer", minimum: 0 },
        rect: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 }
          },
          required: ["x", "y", "width", "height"],
          additionalProperties: false
        },
        appearance: { type: "string", enum: ["system", "light", "dark"] }
      },
      required: ["session_id", "page_index", "rect"],
      additionalProperties: false
    }
  },
  {
    name: "reader.caption_region",
    description: "Create caption and evidence from captured region.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        page_index: { type: "integer", minimum: 0 },
        rect: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 }
          },
          required: ["x", "y", "width", "height"],
          additionalProperties: false
        },
        appearance: { type: "string", enum: ["system", "light", "dark"] }
      },
      required: ["session_id", "page_index"],
      additionalProperties: false
    }
  },
  {
    name: "reader.snapshot_state",
    description: "Inspect current paper/session state for development workflows.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" }
      },
      required: ["session_id"],
      additionalProperties: false
    }
  }
];

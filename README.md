# pedef-mcp

Model Context Protocol server for Pedef reader entrypoints.

## Purpose

`pedef-mcp` exposes a tool surface for agents to interact with Pedef reader capabilities:

- list reader and developer entrypoints
- extract source-linked text
- capture internal reader regions
- generate caption payloads
- inspect reader state snapshots

This server can run with a static demo dataset or a bridge JSON exported by the Pedef app.

## Tool Surface

- `reader.list_entrypoints`
- `reader.get_text`
- `reader.capture_region`
- `reader.caption_region`
- `reader.snapshot_state`

## Bridge File

If `PEDEF_MCP_BRIDGE_FILE` is set, the server reads runtime data from that JSON file.
Otherwise, it falls back to a built-in demo session `demo-session`.

Expected bridge shape:

```json
{
  "reader_entrypoints": ["pdf.open", "pdf.get_text"],
  "developer_entrypoints": ["dev.capture_page"],
  "sessions": {
    "session-id": {
      "session_id": "session-id",
      "paper_id": "paper-id",
      "paper_title": "Paper Title",
      "current_page": 0,
      "page_count": 10,
      "annotations": 2,
      "pages": {
        "0": "Text for page 1",
        "1": "Text for page 2"
      }
    }
  }
}
```

## Run

```bash
npm run start
```

## Smoke Test

```bash
npm run smoke
```

The smoke test starts the MCP server over stdio, calls initialize, lists tools, and executes representative tool calls.

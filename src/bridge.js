import fs from "node:fs";

function loadBridgeData() {
  const bridgePath = process.env.PEDEF_MCP_BRIDGE_FILE;
  if (!bridgePath) {
    return null;
  }

  try {
    const raw = fs.readFileSync(bridgePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fallbackData() {
  return {
    reader_entrypoints: [
      "pdf.open",
      "pdf.close",
      "pdf.list_pages",
      "pdf.get_text",
      "pdf.capture_region",
      "pdf.caption_region",
      "pdf.add_source_annotation"
    ],
    developer_entrypoints: ["dev.capture_page", "dev.snapshot_reader_state"],
    sessions: {
      "demo-session": {
        session_id: "demo-session",
        paper_id: "demo-paper",
        paper_title: "Demo Paper",
        current_page: 0,
        page_count: 3,
        annotations: 0,
        pages: {
          "0": "This is a demo page text for MCP integration.",
          "1": "Figure 1 compares model variants and reports F1 scores.",
          "2": "Conclusion and future work."
        }
      }
    }
  };
}

function getDataset() {
  return loadBridgeData() ?? fallbackData();
}

export const pedefBridge = {
  listEntrypoints() {
    const data = getDataset();
    return {
      reader: data.reader_entrypoints ?? [],
      developer: data.developer_entrypoints ?? []
    };
  },

  getText({ session_id, page_index, page_start, page_end_exclusive }) {
    const data = getDataset();
    const session = data.sessions?.[session_id];
    if (!session) {
      throw new Error(`Unknown session_id: ${session_id}`);
    }

    const pages = session.pages ?? {};

    if (Number.isInteger(page_index)) {
      return {
        text: pages[String(page_index)] ?? "",
        sources: [{ session_id, page_index }],
        spans: []
      };
    }

    if (Number.isInteger(page_start) && Number.isInteger(page_end_exclusive)) {
      const textParts = [];
      const sources = [];

      for (let index = page_start; index < page_end_exclusive; index += 1) {
        textParts.push(pages[String(index)] ?? "");
        sources.push({ session_id, page_index: index });
      }

      return {
        text: textParts.join("\n\n"),
        sources,
        spans: []
      };
    }

    throw new Error("Provide page_index or page_start/page_end_exclusive.");
  },

  captureRegion({ session_id, page_index, rect, appearance }) {
    const data = getDataset();
    if (!data.sessions?.[session_id]) {
      throw new Error(`Unknown session_id: ${session_id}`);
    }

    const pseudoImage = Buffer.from(
      `pedef-mock-image:${session_id}:${page_index}:${JSON.stringify(rect)}:${appearance ?? "system"}`,
      "utf8"
    ).toString("base64");

    return {
      mime_type: "image/png",
      image_base64: pseudoImage,
      source: {
        session_id,
        page_index,
        rect,
        appearance: appearance ?? "system"
      }
    };
  },

  captionRegion({ session_id, page_index, rect }) {
    const textPayload = this.getText({ session_id, page_index });
    const text = textPayload.text?.trim() ?? "";

    let caption = `Captured region on page ${page_index + 1}.`;
    if (text.toLowerCase().includes("figure") || text.toLowerCase().includes("fig.")) {
      caption = `Figure-oriented region on page ${page_index + 1}. ${text.slice(0, 120)}`;
    } else if (text.length > 0) {
      caption = `Captured region on page ${page_index + 1}. ${text.slice(0, 120)}`;
    }

    return {
      caption,
      confidence: text.length > 40 ? 0.82 : 0.58,
      evidence: text.length > 0 ? ["Local page text context"] : ["Image only"],
      source: { session_id, page_index, rect: rect ?? null }
    };
  },

  snapshotState({ session_id }) {
    const data = getDataset();
    const session = data.sessions?.[session_id];
    if (!session) {
      throw new Error(`Unknown session_id: ${session_id}`);
    }

    return {
      session_id,
      paper_id: session.paper_id,
      paper_title: session.paper_title,
      current_page: session.current_page,
      page_count: session.page_count,
      annotations: session.annotations
    };
  }
};

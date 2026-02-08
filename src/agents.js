import { pedefBridge } from "./bridge.js";

class IntegratorAgent {
  execute(toolName, args) {
    switch (toolName) {
      case "reader.list_entrypoints":
        return pedefBridge.listEntrypoints();
      case "reader.get_text":
        return pedefBridge.getText(args);
      case "reader.capture_region":
        return pedefBridge.captureRegion(args);
      case "reader.caption_region":
        return pedefBridge.captionRegion(args);
      case "reader.snapshot_state":
        return pedefBridge.snapshotState(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

class ReviewerAgent {
  execute(toolName, payload) {
    if (toolName === "reader.capture_region") {
      if (!payload?.image_base64 || !payload?.mime_type) {
        throw new Error("Capture payload missing image metadata.");
      }
    }

    if (toolName === "reader.get_text") {
      if (typeof payload?.text !== "string") {
        throw new Error("Text payload missing text field.");
      }
    }

    if (toolName === "reader.caption_region") {
      if (typeof payload?.caption !== "string") {
        throw new Error("Caption payload missing caption field.");
      }
    }

    return payload;
  }
}

class RunnerAgent {
  execute(toolName, reviewedPayload) {
    return {
      tool: toolName,
      produced_at: new Date().toISOString(),
      payload: reviewedPayload
    };
  }
}

export function createAgentPipeline() {
  return {
    integrator: new IntegratorAgent(),
    reviewer: new ReviewerAgent(),
    runner: new RunnerAgent()
  };
}

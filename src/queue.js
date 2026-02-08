import { createAgentPipeline } from "./agents.js";

export class ToolQueue {
  constructor() {
    this.pipeline = createAgentPipeline();
    this.queue = [];
    this.running = false;
  }

  enqueue(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      this.drain();
    });
  }

  async drain() {
    if (this.running) {
      return;
    }

    this.running = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        continue;
      }

      try {
        const integrated = this.pipeline.integrator.execute(next.item.toolName, next.item.args);
        const reviewed = this.pipeline.reviewer.execute(next.item.toolName, integrated);
        const finalized = this.pipeline.runner.execute(next.item.toolName, reviewed);
        next.resolve(finalized);
      } catch (error) {
        next.reject(error);
      }
    }
    this.running = false;
  }
}

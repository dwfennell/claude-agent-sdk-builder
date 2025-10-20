import { query } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";

/**
 * AIClient wraps the Claude Agent SDK query function
 * Provides default configuration and reusable query methods
 */

export interface AIQueryOptions {
  maxTurns?: number;
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  mcpServers?: any;
  hooks?: any;
  resume?: string;
}

export class AIClient {
  private defaultOptions: AIQueryOptions;

  constructor(options?: Partial<AIQueryOptions>) {
    this.defaultOptions = {
      maxTurns: 100,
      cwd: path.join(process.cwd(), 'workspace'),
      model: "sonnet",
      allowedTools: [
        "Task", "Bash", "Glob", "Grep",
        "Read", "Edit", "Write",
        "WebFetch", "TodoWrite"
      ],
      appendSystemPrompt: `
        You are a helpful AI assistant.

        When working on tasks:
        - Be thorough and methodical
        - Explain your reasoning
        - Ask for clarification if needed
      `,
      mcpServers: {},
      hooks: {},
      ...options
    };
  }

  async *queryStream(
    prompt: string | AsyncIterable<any>,
    options?: Partial<AIQueryOptions>
  ) {
    const mergedOptions = { ...this.defaultOptions, ...options };

    for await (const message of query({
      prompt,
      options: mergedOptions
    })) {
      yield message;
    }
  }

  async querySingle(prompt: string, options?: Partial<AIQueryOptions>) {
    const messages = [];
    let totalCost = 0;
    let duration = 0;

    for await (const message of this.queryStream(prompt, options)) {
      messages.push(message);

      if (message.type === "result" && message.subtype === "success") {
        totalCost = message.total_cost_usd;
        duration = message.duration_ms;
      }
    }

    return { messages, cost: totalCost, duration };
  }
}

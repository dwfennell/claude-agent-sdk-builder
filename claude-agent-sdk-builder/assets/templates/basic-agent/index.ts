import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Basic Agent Example
 *
 * Demonstrates:
 * - Simple query execution
 * - Message handling
 * - Result extraction
 */

async function basicAgent(userPrompt: string) {
  console.log("Starting agent...\n");

  for await (const message of query({
    prompt: userPrompt,
    options: {
      maxTurns: 20,
      model: "sonnet",
      allowedTools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
    }
  })) {
    // Handle different message types
    if (message.type === 'system') {
      if (message.subtype === 'init') {
        console.log(`Session ID: ${message.session_id}\n`);
      }
    }

    if (message.type === 'assistant') {
      const content = message.message.content;

      if (typeof content === 'string') {
        console.log(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            console.log(block.text);
          } else if (block.type === 'tool_use') {
            console.log(`[Using tool: ${block.name}]`);
          }
        }
      }
    }

    if (message.type === 'result') {
      console.log("\n--- Result ---");

      if (message.subtype === 'success') {
        console.log("Status: Success");
        console.log("Result:", message.result);
      } else {
        console.log("Status:", message.subtype);
      }

      console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
      console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
    }
  }
}

// Run the agent
const prompt = process.argv[2] || "What is 2 + 2?";
basicAgent(prompt);

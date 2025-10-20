import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

/**
 * Custom Tools Example
 *
 * Demonstrates:
 * - Creating custom tools
 * - Building an MCP server
 * - Using custom tools in queries
 */

// Define custom tools
const calculatorServer = createSdkMcpServer({
  name: "calculator",
  version: "1.0.0",
  tools: [
    tool(
      "add",
      "Add two numbers together",
      {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      },
      async (args) => {
        const result = args.a + args.b;
        console.log(`[Calculator] ${args.a} + ${args.b} = ${result}`);

        return {
          content: [{
            type: "text",
            text: String(result)
          }]
        };
      }
    ),

    tool(
      "multiply",
      "Multiply two numbers",
      {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      },
      async (args) => {
        const result = args.a * args.b;
        console.log(`[Calculator] ${args.a} × ${args.b} = ${result}`);

        return {
          content: [{
            type: "text",
            text: String(result)
          }]
        };
      }
    ),

    tool(
      "power",
      "Calculate a number raised to a power",
      {
        base: z.number().describe("Base number"),
        exponent: z.number().describe("Exponent")
      },
      async (args) => {
        const result = Math.pow(args.base, args.exponent);
        console.log(`[Calculator] ${args.base}^${args.exponent} = ${result}`);

        return {
          content: [{
            type: "text",
            text: String(result)
          }]
        };
      }
    )
  ]
});

async function agentWithCustomTools(userPrompt: string) {
  console.log("Starting agent with custom calculator tools...\n");

  for await (const message of query({
    prompt: userPrompt,
    options: {
      maxTurns: 20,
      model: "sonnet",
      mcpServers: {
        "calc": calculatorServer
      },
      allowedTools: [
        "mcp__calc__add",
        "mcp__calc__multiply",
        "mcp__calc__power"
      ],
      appendSystemPrompt: `
        You have access to a calculator with the following tools:
        - add: Add two numbers
        - multiply: Multiply two numbers
        - power: Raise a number to a power

        Use these tools to perform calculations when requested.
      `
    }
  })) {
    if (message.type === 'assistant') {
      const content = message.message.content;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            console.log(block.text);
          }
        }
      }
    }

    if (message.type === 'result') {
      console.log("\n--- Result ---");
      console.log("Status:", message.subtype);
      console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
    }
  }
}

// Run with a calculation request
const prompt = process.argv[2] || "What is (5 + 3) × 2 to the power of 2?";
agentWithCustomTools(prompt);

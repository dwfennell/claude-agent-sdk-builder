import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * In-Code Subagents Example
 *
 * Demonstrates:
 * - Programmatic subagent configuration
 * - Subagent factory functions
 * - Using Task tool to spawn subagents
 */

// Subagent factory functions
function createSearchSubagent() {
  return {
    name: "file-searcher",
    description: "Specialized in finding and analyzing files",
    tools: ["Read", "Grep", "Glob"],
    systemPrompt: `
      You are a file search specialist.

      Your workflow:
      1. Use Glob to find files matching patterns
      2. Use Grep to search within files for specific content
      3. Use Read to examine full file contents
      4. Return concise findings with file paths and line numbers

      Always be specific and provide actionable information.
    `,
    maxTurns: 10
  };
}

function createCodeAnalyzerSubagent() {
  return {
    name: "code-analyzer",
    description: "Analyzes code quality and patterns",
    tools: ["Read", "Grep", "Glob"],
    systemPrompt: `
      You are a code analysis specialist.

      Analyze code for:
      - Common patterns and anti-patterns
      - Potential bugs or issues
      - Code organization and structure
      - Best practices

      Provide specific, actionable feedback with file references.
    `,
    maxTurns: 15
  };
}

function createDocWriterSubagent() {
  return {
    name: "doc-writer",
    description: "Writes documentation and README files",
    tools: ["Read", "Write", "Edit"],
    systemPrompt: `
      You are a documentation specialist.

      Write clear, comprehensive documentation:
      - README files
      - API documentation
      - Code comments
      - Usage examples

      Focus on clarity and helpfulness for developers.
    `,
    maxTurns: 10
  };
}

async function orchestratorAgent(userPrompt: string) {
  console.log("Starting orchestrator agent with subagents...\n");

  // Register subagents programmatically
  const subagents = [
    createSearchSubagent(),
    createCodeAnalyzerSubagent(),
    createDocWriterSubagent()
  ];

  for await (const message of query({
    prompt: userPrompt,
    options: {
      maxTurns: 50,
      model: "sonnet",
      subagents: subagents,
      allowedTools: ["Task", "Read", "Write"],
      appendSystemPrompt: `
        You are an orchestrator that coordinates specialized subagents.

        Available subagents:
        1. file-searcher - Use for finding files and searching content
        2. code-analyzer - Use for analyzing code quality and patterns
        3. doc-writer - Use for writing documentation

        Delegate tasks to the appropriate subagent using the Task tool:

        Example:
        Task({
          subagent_type: "file-searcher",
          description: "Find TypeScript files",
          prompt: "Find all .ts files in the src/ directory"
        })

        Break down complex requests into subtasks and delegate appropriately.
      `
    }
  })) {
    if (message.type === 'assistant') {
      const content = message.message.content;

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            console.log(block.text);
          } else if (block.type === 'tool_use' && block.name === 'Task') {
            console.log(`\n[Spawning subagent: ${block.input.subagent_type}]`);
            console.log(`Task: ${block.input.description}\n`);
          }
        }
      }
    }

    if (message.type === 'result') {
      console.log("\n--- Result ---");
      console.log("Status:", message.subtype);
      console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
      console.log(`Duration: ${(message.duration_ms / 1000).toFixed(2)}s`);
    }
  }
}

// Run with a task that requires multiple subagents
const prompt = process.argv[2] ||
  "Analyze the code structure of this project and create documentation for the main components";

orchestratorAgent(prompt);

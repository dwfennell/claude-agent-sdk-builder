# Claude Agent SDK API Reference

This reference covers the core API for the Claude Agent SDK (TypeScript/Node.js).

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Requirements:**
- Node.js 18+
- Anthropic API key set in `ANTHROPIC_API_KEY` environment variable

## Core Functions

### `query()`

The primary function for creating agent interactions. Returns an async iterator of messages.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Your task here",
  options: {
    // ... options
  }
})) {
  // Handle messages
}
```

**Parameters:**

- `prompt`: `string | AsyncIterable<SDKUserMessage>` - The user's request or an async iterable for multi-turn
- `options`: `ClaudeAgentOptions` - Configuration options

### `ClaudeAgentOptions`

Configuration object for agents:

```typescript
interface ClaudeAgentOptions {
  maxTurns?: number;              // Max conversation turns (default: 100)
  cwd?: string;                   // Working directory for file operations
  model?: string;                 // Model to use: "opus", "sonnet", etc.
  allowedTools?: string[];        // Tools the agent can use
  appendSystemPrompt?: string;    // Additional system instructions
  mcpServers?: Record<string, any>; // MCP servers to attach
  hooks?: HookConfig;             // Pre/Post tool use hooks
  resume?: string;                // Session ID to resume multi-turn conversation
}
```

**Common Options:**

```typescript
{
  maxTurns: 50,
  model: "sonnet",
  cwd: path.join(process.cwd(), 'workspace'),
  allowedTools: [
    "Read", "Write", "Edit", "Bash", "Grep",
    "mcp__myserver__mytool"
  ],
  appendSystemPrompt: "You are a helpful coding assistant.",
  mcpServers: {
    "myserver": customMcpServer
  }
}
```

## Custom Tools

### `tool()`

Create custom tools that the agent can use:

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const myTool = tool(
  "tool_name",
  "Description of what the tool does",
  {
    param1: z.string().describe("Description of param1"),
    param2: z.number().optional().describe("Optional number parameter")
  },
  async (args) => {
    // Tool implementation
    return {
      content: [{
        type: "text",
        text: "Result of the tool execution"
      }]
    };
  }
);
```

**Tool Return Format:**

```typescript
{
  content: [
    { type: "text", text: "Text content" }
    // Can also include other content types
  ]
}
```

### `createSdkMcpServer()`

Create an MCP server with custom tools:

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

const myServer = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [
    tool("greet", "Greet a user", {
      name: z.string()
    }, async (args) => ({
      content: [{ type: "text", text: `Hello, ${args.name}!` }]
    })),
    // ... more tools
  ]
});

// Use in query options
const options = {
  mcpServers: {
    "tools": myServer
  },
  allowedTools: ["mcp__tools__greet"]
};
```

**MCP Tool Naming:**
- Format: `mcp__<server-name>__<tool-name>`
- Example: `mcp__tools__greet` for the greet tool in the "tools" server

## Message Types

### Message Stream

The `query()` function yields different message types:

```typescript
type SDKMessage =
  | SystemMessage      // System events (init, context updates, etc.)
  | UserMessage        // User messages echoed back
  | AssistantMessage   // Assistant responses and tool calls
  | ResultMessage;     // Final result with success/failure

// System Message
{
  type: "system",
  subtype: "init" | "context_window_update" | ...,
  session_id?: string  // Capture for multi-turn
}

// Assistant Message
{
  type: "assistant",
  message: {
    content: Array<TextBlock | ToolUseBlock | ToolResultBlock>
  }
}

// Result Message
{
  type: "result",
  subtype: "success" | "max_turns_reached" | "error",
  result?: string,
  total_cost_usd: number,
  duration_ms: number
}
```

### Multi-Turn Conversations

Capture the session ID and use `resume` option:

```typescript
let sessionId: string | null = null;

// First turn
for await (const message of query({ prompt: "Hello", options })) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id;
  }
}

// Subsequent turns
const resumeOptions = {
  ...options,
  resume: sessionId
};

for await (const message of query({
  prompt: "Continue the conversation",
  options: resumeOptions
})) {
  // Handle messages
}
```

## Hooks

Hooks allow you to intercept tool usage for permissions or validation:

### PreToolUse Hook

```typescript
{
  hooks: {
    PreToolUse: [
      {
        matcher: "Write|Edit",  // Regex pattern for tool names
        hooks: [
          async (input: HookInput): Promise<HookJSONOutput> => {
            const { tool_name, tool_input } = input;

            // Validation logic
            if (shouldBlock) {
              return {
                decision: 'block',
                stopReason: 'Reason for blocking',
                continue: false
              };
            }

            return { continue: true };
          }
        ]
      }
    ]
  }
}
```

**Hook Input:**
```typescript
{
  tool_name: string;
  tool_input: any;  // Tool-specific parameters
}
```

**Hook Output:**
```typescript
{
  continue: boolean;
  decision?: 'block' | 'allow';
  stopReason?: string;  // Shown to agent if blocked
}
```

## Common Patterns

### Basic One-Shot Query

```typescript
async function basicQuery() {
  for await (const message of query({
    prompt: "What is 2 + 2?",
    options: { maxTurns: 1 }
  })) {
    if (message.type === 'assistant') {
      console.log(message.message.content);
    }
  }
}
```

### Query with Custom Tools

```typescript
const calculator = createSdkMcpServer({
  name: "calc",
  version: "1.0.0",
  tools: [
    tool("add", "Add two numbers", {
      a: z.number(),
      b: z.number()
    }, async (args) => ({
      content: [{ type: "text", text: String(args.a + args.b) }]
    }))
  ]
});

for await (const message of query({
  prompt: "What is 5 + 3?",
  options: {
    mcpServers: { calc: calculator },
    allowedTools: ["mcp__calc__add"]
  }
})) {
  // Handle messages
}
```

### Streaming to UI

```typescript
for await (const message of query({ prompt, options })) {
  if (message.type === 'assistant') {
    const content = message.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          sendToUI(block.text);
        } else if (block.type === 'tool_use') {
          sendToUI({ tool: block.name, input: block.input });
        }
      }
    }
  }
}
```

## Available Built-in Tools

Common tools available by default (include in `allowedTools`):

- **File Operations:** `Read`, `Write`, `Edit`, `Glob`, `Grep`
- **Execution:** `Bash`, `BashOutput`, `KillShell`
- **Task Management:** `Task`, `TodoWrite`
- **Web:** `WebFetch`, `WebSearch`
- **Other:** `ExitPlanMode`, `NotebookEdit`

## Error Handling

```typescript
try {
  for await (const message of query({ prompt, options })) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('Success:', message.result);
      } else {
        console.error('Failed:', message.subtype);
      }
    }
  }
} catch (error) {
  console.error('Query error:', error);
}
```

## Best Practices

1. **Always capture session IDs** for multi-turn conversations
2. **Use specific tool allowlists** - only enable tools the agent needs
3. **Set reasonable maxTurns** to prevent runaway execution
4. **Use hooks for safety** - validate file paths, block dangerous operations
5. **Handle all message types** - don't assume only assistant messages
6. **Set appropriate cwd** - isolate agent operations to specific directories

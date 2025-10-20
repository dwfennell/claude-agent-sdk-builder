# Custom Tools Template

Example of creating and using custom tools with the Claude Agent SDK.

## Setup

```bash
npm install
# or
bun install
```

## Usage

```bash
npm start
# or
npm start "Calculate 10 + 20 and then multiply by 5"
```

## What it demonstrates

- Creating custom tools with the `tool()` function
- Defining tool parameters with Zod schemas
- Creating an MCP server with `createSdkMcpServer()`
- Configuring the agent to use custom tools
- Handling tool results

## Key concepts

### Tool Structure

```typescript
tool(
  "tool_name",              // Name
  "Description",            // What it does
  { /* Zod schema */ },     // Parameters
  async (args) => { ... }   // Implementation
)
```

### MCP Server

Bundle tools into a server:

```typescript
const server = createSdkMcpServer({
  name: "server-name",
  version: "1.0.0",
  tools: [tool1, tool2, ...]
});
```

### Using in Agent

```typescript
options: {
  mcpServers: { "name": server },
  allowedTools: ["mcp__name__tool1", "mcp__name__tool2"]
}
```

## Extending

Add your own tools:
- Database queries
- API integrations
- File operations
- Data processing

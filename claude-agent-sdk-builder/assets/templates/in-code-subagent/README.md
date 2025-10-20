# In-Code Subagents Template

Example of configuring subagents programmatically (recommended approach).

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
npm start "Find all React components and analyze their structure"
```

## What it demonstrates

- **Programmatic subagent configuration** (preferred over markdown files)
- Factory functions for creating subagents
- Orchestrator pattern with specialized subagents
- Using the Task tool to spawn subagents
- Breaking down complex tasks across multiple agents

## Key Concepts

### Subagent Configuration

```typescript
{
  name: "agent-name",
  description: "What this agent does",
  tools: ["Tool1", "Tool2"],
  systemPrompt: "Instructions for the agent",
  maxTurns: 10
}
```

### Factory Pattern

Create reusable subagent configurations:

```typescript
function createSearchSubagent() {
  return {
    name: "searcher",
    description: "Searches files",
    tools: ["Grep", "Glob"],
    systemPrompt: "Search instructions..."
  };
}
```

### Spawning Subagents

The orchestrator uses the Task tool:

```typescript
Task({
  subagent_type: "searcher",
  description: "Find TypeScript files",
  prompt: "Find all .ts files"
})
```

## Benefits over Markdown Subagents

- **Type safety** - Catch errors at compile time
- **Dynamic configuration** - Adjust behavior at runtime
- **Code reuse** - Share configuration logic
- **Better testing** - Unit test configurations
- **Version control** - Changes tracked in code

## Extending

Add your own subagents:
- Data processing specialist
- Testing specialist
- Deployment specialist
- Monitoring specialist

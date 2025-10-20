# Full App Template

Complete production-ready agent application with WebSocket streaming, session management, and persistence.

## Features

- **WebSocket Streaming** - Real-time message streaming to clients
- **Session Management** - Multi-turn conversations with session persistence
- **Database Storage** - SQLite database for session data
- **Web UI** - Built-in HTML/JavaScript client
- **Auto Cleanup** - Automatic cleanup of inactive sessions
- **Error Handling** - Comprehensive error handling and recovery

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
bun run server.ts
```

Then open your browser to `http://localhost:3000`

## Architecture

```
server.ts       - WebSocket server and HTTP endpoints
session.ts      - Session management and conversation state
ai-client.ts    - Claude Agent SDK wrapper
```

### Server (server.ts)

- Handles WebSocket connections
- Manages session lifecycle
- Serves HTML client
- Provides health check endpoint

### Session (session.ts)

- Manages multi-turn conversations
- Handles WebSocket subscriptions
- Broadcasts messages to clients
- Persists session data

### AIClient (ai-client.ts)

- Wraps Claude Agent SDK
- Provides default configuration
- Handles streaming and one-shot queries

## Endpoints

- `ws://localhost:3000/ws` - WebSocket connection
- `http://localhost:3000/` - Web UI client
- `http://localhost:3000/health` - Health check

## WebSocket Protocol

### Client -> Server

```json
{
  "type": "message",
  "content": "User's message"
}
```

```json
{
  "type": "reset"
}
```

### Server -> Client

```json
{
  "type": "assistant_message",
  "content": "Assistant response",
  "sessionId": "session-id"
}
```

```json
{
  "type": "tool_use",
  "toolName": "Read",
  "toolId": "tool-id",
  "toolInput": {},
  "sessionId": "session-id"
}
```

```json
{
  "type": "result",
  "success": true,
  "cost": 0.0123,
  "duration": 5000,
  "sessionId": "session-id"
}
```

## Extending

### Add Custom Tools

Modify `ai-client.ts`:

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

const myServer = createSdkMcpServer({
  name: "mytools",
  version: "1.0.0",
  tools: [/* your tools */]
});

// Add to defaultOptions
mcpServers: { "mytools": myServer }
allowedTools: [..., "mcp__mytools__mytool"]
```

### Add Hooks

Modify `ai-client.ts`:

```typescript
hooks: {
  PreToolUse: [{
    matcher: "Write|Edit",
    hooks: [async (input) => {
      // Validation logic
      return { continue: true };
    }]
  }]
}
```

### Add Subagents

Modify `ai-client.ts`:

```typescript
subagents: [
  {
    name: "specialist",
    description: "Specialized agent",
    tools: ["Read", "Grep"],
    systemPrompt: "Instructions..."
  }
]
```

## Production Checklist

- [ ] Set up proper authentication
- [ ] Add rate limiting
- [ ] Configure CORS for production
- [ ] Set up logging and monitoring
- [ ] Add database migrations
- [ ] Configure backups
- [ ] Set up SSL/TLS
- [ ] Add input validation
- [ ] Configure timeouts
- [ ] Add cost tracking

## Development

Watch mode for auto-reload:

```bash
bun --watch server.ts
```

## Database

SQLite database (`sessions.db`) stores:
- Session IDs
- SDK session IDs (for multi-turn)
- Creation and last active timestamps
- Message counts

## Cleanup

Sessions are automatically cleaned up after 1 minute of inactivity (no WebSocket subscribers).

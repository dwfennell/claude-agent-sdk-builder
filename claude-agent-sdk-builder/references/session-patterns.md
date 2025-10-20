# Session Management and Patterns

Common patterns for managing Claude Agent SDK sessions, streaming, multi-turn conversations, and production deployments.

## Basic Patterns

### One-Shot Query

Single query with immediate response:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function oneShot(prompt: string) {
  const messages = [];

  for await (const message of query({ prompt, options: { maxTurns: 10 } })) {
    messages.push(message);

    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log('Success:', message.result);
      }
    }
  }

  return messages;
}
```

### Multi-Turn Conversation

Maintain conversation context across multiple user messages:

```typescript
class ConversationSession {
  private sessionId: string | null = null;

  async sendMessage(prompt: string, options: any) {
    // Resume existing session or start new
    const queryOptions = this.sessionId
      ? { ...options, resume: this.sessionId }
      : options;

    for await (const message of query({ prompt, options: queryOptions })) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        this.sessionId = message.session_id;
        console.log(`Session ID: ${this.sessionId}`);
      }

      yield message;
    }
  }

  reset() {
    this.sessionId = null;
  }
}

// Usage
const session = new ConversationSession();

await session.sendMessage("Hello, I need help with TypeScript", options);
await session.sendMessage("Can you show me an example?", options);
await session.sendMessage("Thanks!", options);
```

## Streaming Patterns

### Stream to Console

```typescript
async function streamToConsole(prompt: string) {
  for await (const message of query({ prompt })) {
    if (message.type === 'assistant') {
      const content = message.message.content;

      if (typeof content === 'string') {
        process.stdout.write(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            process.stdout.write(block.text);
          }
        }
      }
    }
  }
  console.log(); // New line at end
}
```

### Stream to WebSocket

```typescript
import type { ServerWebSocket } from "bun";

async function streamToWebSocket(
  ws: ServerWebSocket,
  prompt: string,
  options: any
) {
  try {
    for await (const message of query({ prompt, options })) {
      // Send each message to WebSocket client
      ws.send(JSON.stringify({
        type: message.type,
        data: message
      }));

      // Handle different message types
      if (message.type === 'assistant') {
        const content = message.message.content;

        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              ws.send(JSON.stringify({
                type: 'text',
                content: block.text
              }));
            } else if (block.type === 'tool_use') {
              ws.send(JSON.stringify({
                type: 'tool_use',
                name: block.name,
                input: block.input
              }));
            }
          }
        }
      }

      if (message.type === 'result') {
        ws.send(JSON.stringify({
          type: 'complete',
          success: message.subtype === 'success',
          cost: message.total_cost_usd,
          duration: message.duration_ms
        }));
      }
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      error: (error as Error).message
    }));
  }
}
```

### Stream with React State

```typescript
import { useState } from 'react';

function useAgentStream() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  async function stream(prompt: string) {
    setIsStreaming(true);
    setMessages([]);

    try {
      for await (const message of query({ prompt })) {
        setMessages(prev => [...prev, message]);

        if (message.type === 'result') {
          setIsStreaming(false);
        }
      }
    } catch (error) {
      setIsStreaming(false);
      console.error(error);
    }
  }

  return { messages, isStreaming, stream };
}
```

## Session Management Patterns

### Session Manager Class

```typescript
import { Database } from "bun:sqlite";

interface SessionData {
  id: string;
  sessionId: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  messageCount: number;
}

class SessionManager {
  private sessions = new Map<string, SessionData>();
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  private initDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        created_at INTEGER,
        last_active_at INTEGER,
        message_count INTEGER
      )
    `);
  }

  createSession(id: string): SessionData {
    const session: SessionData = {
      id,
      sessionId: null,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      messageCount: 0
    };

    this.sessions.set(id, session);

    this.db.run(
      `INSERT INTO sessions VALUES (?, ?, ?, ?, ?)`,
      id, null, Date.now(), Date.now(), 0
    );

    return session;
  }

  getSession(id: string): SessionData | null {
    return this.sessions.get(id) || null;
  }

  updateSession(id: string, sdkSessionId: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.sessionId = sdkSessionId;
      session.lastActiveAt = new Date();
      session.messageCount++;

      this.db.run(
        `UPDATE sessions SET session_id = ?, last_active_at = ?, message_count = ? WHERE id = ?`,
        sdkSessionId, Date.now(), session.messageCount, id
      );
    }
  }

  deleteSession(id: string) {
    this.sessions.delete(id);
    this.db.run(`DELETE FROM sessions WHERE id = ?`, id);
  }

  cleanup(maxAge: number = 3600000) {
    const cutoff = Date.now() - maxAge;

    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt.getTime() < cutoff) {
        this.deleteSession(id);
      }
    }
  }
}
```

### Message Queue Pattern

```typescript
class MessageQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private closed = false;

  async add(item: T): Promise<void> {
    if (this.closed) {
      throw new Error('Queue is closed');
    }
    this.queue.push(item);
  }

  async *process(): AsyncGenerator<T> {
    this.processing = true;

    while (!this.closed || this.queue.length > 0) {
      if (this.queue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const item = this.queue.shift();
      if (item) {
        yield item;
      }
    }

    this.processing = false;
  }

  close() {
    this.closed = true;
  }

  isClosed() {
    return this.closed;
  }
}
```

## Production Patterns

### AIClient Wrapper

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";

export interface AIQueryOptions {
  maxTurns?: number;
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  mcpServers?: any;
  hooks?: any;
}

export class AIClient {
  private defaultOptions: AIQueryOptions;

  constructor(options?: Partial<AIQueryOptions>) {
    this.defaultOptions = {
      maxTurns: 100,
      cwd: path.join(process.cwd(), 'workspace'),
      model: "sonnet",
      allowedTools: [
        "Task", "Bash", "Read", "Write", "Edit",
        "Glob", "Grep", "WebFetch", "TodoWrite"
      ],
      appendSystemPrompt: "",
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
```

### Full Session Class

```typescript
import { Database } from "bun:sqlite";
import { MessageQueue } from "./message-queue";
import { AIClient } from "./ai-client";

export class Session {
  public readonly id: string;
  private messageQueue: MessageQueue<string>;
  private queryPromise: Promise<void> | null = null;
  private subscribers: Set<WebSocket> = new Set();
  private db: Database;
  private messageCount = 0;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;

  constructor(id: string, db: Database, aiClient: AIClient) {
    this.id = id;
    this.db = db;
    this.messageQueue = new MessageQueue();
    this.aiClient = aiClient;
  }

  async addUserMessage(content: string): Promise<void> {
    if (this.queryPromise) {
      await this.queryPromise;
    }

    this.messageCount++;
    console.log(`Processing message ${this.messageCount} in session ${this.id}`);

    this.queryPromise = (async () => {
      try {
        const options = this.sdkSessionId
          ? { resume: this.sdkSessionId }
          : {};

        for await (const message of this.aiClient.queryStream(content, options)) {
          this.broadcastToSubscribers(message);

          if (message.type === 'system' && message.subtype === 'init') {
            this.sdkSessionId = message.session_id;
            console.log(`Captured SDK session ID: ${this.sdkSessionId}`);
          }

          if (message.type === 'result') {
            console.log('Result received, ready for next message');
          }
        }
      } catch (error) {
        console.error(`Error in session ${this.id}:`, error);
        this.broadcastError((error as Error).message);
      } finally {
        this.queryPromise = null;
      }
    })();

    await this.queryPromise;
  }

  subscribe(ws: WebSocket) {
    this.subscribers.add(ws);
  }

  unsubscribe(ws: WebSocket) {
    this.subscribers.delete(ws);
  }

  private broadcastToSubscribers(message: any) {
    const messageStr = JSON.stringify(message);
    for (const ws of this.subscribers) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting:', error);
        this.subscribers.delete(ws);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcastToSubscribers({
      type: 'error',
      error: error,
      sessionId: this.id
    });
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  async cleanup() {
    this.messageQueue.close();
    this.subscribers.clear();
  }

  reset() {
    this.sdkSessionId = null;
    this.queryPromise = null;
  }
}
```

## WebSocket Server Pattern

```typescript
import type { ServerWebSocket } from "bun";

const sessions = new Map<string, Session>();

Bun.serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("session") || crypto.randomUUID();

      const success = server.upgrade(req, {
        data: { sessionId }
      });

      return success
        ? undefined
        : new Response("WebSocket upgrade failed", { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket) {
      const sessionId = ws.data.sessionId;

      let session = sessions.get(sessionId);
      if (!session) {
        session = new Session(sessionId, db, aiClient);
        sessions.set(sessionId, session);
      }

      session.subscribe(ws);
      console.log(`WebSocket connected to session ${sessionId}`);
    },

    async message(ws: ServerWebSocket, message: string) {
      const data = JSON.parse(message);
      const sessionId = ws.data.sessionId;
      const session = sessions.get(sessionId);

      if (!session) {
        ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
        return;
      }

      if (data.type === 'message') {
        await session.addUserMessage(data.content);
      } else if (data.type === 'reset') {
        session.reset();
      }
    },

    close(ws: ServerWebSocket) {
      const sessionId = ws.data.sessionId;
      const session = sessions.get(sessionId);

      if (session) {
        session.unsubscribe(ws);

        if (!session.hasSubscribers()) {
          setTimeout(() => {
            if (session && !session.hasSubscribers()) {
              session.cleanup();
              sessions.delete(sessionId);
            }
          }, 60000); // Clean up after 1 minute
        }
      }
    }
  }
});
```

## Error Handling Patterns

### Retry Pattern

```typescript
async function queryWithRetry(
  prompt: string,
  options: any,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const messages = [];

      for await (const message of query({ prompt, options })) {
        messages.push(message);

        if (message.type === 'result') {
          if (message.subtype === 'success') {
            return { success: true, messages };
          }
        }
      }

      return { success: false, messages };
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
```

### Timeout Pattern

```typescript
async function queryWithTimeout(
  prompt: string,
  options: any,
  timeoutMs: number = 300000
) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  const queryPromise = (async () => {
    const messages = [];
    for await (const message of query({ prompt, options })) {
      messages.push(message);
    }
    return messages;
  })();

  return Promise.race([queryPromise, timeoutPromise]);
}
```

## Best Practices

1. **Capture session IDs** - Always capture from init messages for multi-turn
2. **Clean up sessions** - Implement cleanup for inactive sessions
3. **Handle WebSocket disconnects** - Gracefully handle client disconnections
4. **Use message queues** - Queue messages when agent is busy
5. **Implement timeouts** - Prevent indefinite execution
6. **Log extensively** - Log all session events for debugging
7. **Monitor costs** - Track total_cost_usd from result messages
8. **Validate inputs** - Validate user inputs before passing to agent
9. **Rate limit** - Implement rate limiting for production
10. **Error recovery** - Handle errors gracefully and inform users

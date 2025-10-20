import type { Database } from "bun:sqlite";
import type { ServerWebSocket } from "bun";
import type { AIClient } from "./ai-client";

/**
 * Session class manages a single Claude conversation
 *
 * Handles:
 * - Multi-turn conversation state
 * - WebSocket subscriber management
 * - Message queuing and processing
 */

export class Session {
  public readonly id: string;
  private queryPromise: Promise<void> | null = null;
  private subscribers: Set<ServerWebSocket> = new Set();
  private db: Database;
  private messageCount = 0;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;

  constructor(id: string, db: Database, aiClient: AIClient) {
    this.id = id;
    this.db = db;
    this.aiClient = aiClient;

    // Initialize in database
    this.db.run(
      `INSERT OR IGNORE INTO sessions VALUES (?, ?, ?, ?, ?)`,
      id, null, Date.now(), Date.now(), 0
    );
  }

  async addUserMessage(content: string): Promise<void> {
    // Wait for any existing query to complete
    if (this.queryPromise) {
      await this.queryPromise;
    }

    this.messageCount++;
    console.log(`Processing message ${this.messageCount} in session ${this.id}`);

    this.queryPromise = (async () => {
      try {
        // Resume session if exists, otherwise start new
        const options = this.sdkSessionId
          ? { resume: this.sdkSessionId }
          : {};

        for await (const message of this.aiClient.queryStream(content, options)) {
          this.broadcastToSubscribers(message);

          // Capture SDK session ID for multi-turn
          if (message.type === 'system' && message.subtype === 'init') {
            this.sdkSessionId = message.session_id;
            console.log(`Captured SDK session ID: ${this.sdkSessionId}`);

            // Update database
            this.db.run(
              `UPDATE sessions SET session_id = ?, last_active_at = ?, message_count = ? WHERE id = ?`,
              this.sdkSessionId, Date.now(), this.messageCount, this.id
            );
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

  subscribe(ws: ServerWebSocket) {
    this.subscribers.add(ws);

    // Send session info to new subscriber
    ws.send(JSON.stringify({
      type: 'session_info',
      sessionId: this.id,
      messageCount: this.messageCount,
      isActive: this.queryPromise !== null
    }));
  }

  unsubscribe(ws: ServerWebSocket) {
    this.subscribers.delete(ws);
  }

  private broadcastToSubscribers(message: any) {
    let wsMessage: any = null;

    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === 'string') {
        wsMessage = {
          type: 'assistant_message',
          content: content,
          sessionId: this.id
        };
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            wsMessage = {
              type: 'assistant_message',
              content: block.text,
              sessionId: this.id
            };
          } else if (block.type === 'tool_use') {
            wsMessage = {
              type: 'tool_use',
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              sessionId: this.id
            };
          }

          if (wsMessage) {
            this.broadcast(wsMessage);
            wsMessage = null;
          }
        }
        return;
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        wsMessage = {
          type: 'result',
          success: true,
          result: message.result,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
          sessionId: this.id
        };
      } else {
        wsMessage = {
          type: 'result',
          success: false,
          error: message.subtype,
          sessionId: this.id
        };
      }
    } else if (message.type === "user") {
      wsMessage = {
        type: 'user_message',
        content: message.message.content,
        sessionId: this.id
      };
    }

    if (wsMessage) {
      this.broadcast(wsMessage);
    }
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    for (const ws of this.subscribers) {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        this.subscribers.delete(ws);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({
      type: 'error',
      error: error,
      sessionId: this.id
    });
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  async cleanup() {
    this.subscribers.clear();
  }

  reset() {
    this.sdkSessionId = null;
    this.queryPromise = null;
    this.messageCount = 0;
  }
}

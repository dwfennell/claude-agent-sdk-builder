import type { ServerWebSocket } from "bun";
import { Database } from "bun:sqlite";
import { Session } from "./session";
import { AIClient} from "./ai-client";

/**
 * Full App Template - Production-Ready Agent Server
 *
 * Features:
 * - WebSocket streaming
 * - Session management
 * - Multi-turn conversations
 * - Database persistence
 * - Custom tools integration
 */

const db = new Database("sessions.db");
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    created_at INTEGER,
    last_active_at INTEGER,
    message_count INTEGER
  )
`);

const sessions = new Map<string, Session>();
const aiClient = new AIClient();

console.log("Starting agent server on port 3000...");

Bun.serve({
  port: 3000,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket endpoint
    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("session") || crypto.randomUUID();

      const success = server.upgrade(req, {
        data: { sessionId }
      });

      return success
        ? undefined
        : new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        activeSessions: sessions.size
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Serve a simple HTML client
    if (url.pathname === "/") {
      return new Response(getHTMLClient(), {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket) {
      const sessionId = ws.data.sessionId;

      // Get or create session
      let session = sessions.get(sessionId);
      if (!session) {
        session = new Session(sessionId, db, aiClient);
        sessions.set(sessionId, session);
        console.log(`Created new session: ${sessionId}`);
      }

      session.subscribe(ws);
      console.log(`WebSocket connected to session ${sessionId}`);
    },

    async message(ws: ServerWebSocket, message: string) {
      const data = JSON.parse(message);
      const sessionId = ws.data.sessionId;
      const session = sessions.get(sessionId);

      if (!session) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Session not found'
        }));
        return;
      }

      if (data.type === 'message') {
        try {
          await session.addUserMessage(data.content);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: (error as Error).message
          }));
        }
      } else if (data.type === 'reset') {
        session.reset();
        ws.send(JSON.stringify({
          type: 'system',
          message: 'Conversation reset'
        }));
      }
    },

    close(ws: ServerWebSocket) {
      const sessionId = ws.data.sessionId;
      const session = sessions.get(sessionId);

      if (session) {
        session.unsubscribe(ws);
        console.log(`WebSocket disconnected from session ${sessionId}`);

        // Clean up session after 1 minute if no subscribers
        if (!session.hasSubscribers()) {
          setTimeout(() => {
            if (session && !session.hasSubscribers()) {
              session.cleanup();
              sessions.delete(sessionId);
              console.log(`Cleaned up session: ${sessionId}`);
            }
          }, 60000);
        }
      }
    }
  }
});

console.log("Server ready!");
console.log("- WebSocket: ws://localhost:3000/ws");
console.log("- Web Client: http://localhost:3000");
console.log("- Health: http://localhost:3000/health");

function getHTMLClient() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Claude Agent SDK - Full App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { margin-bottom: 20px; }
    #messages { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
    .message { margin-bottom: 10px; padding: 8px; border-radius: 4px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .tool { background: #fff3e0; font-size: 0.9em; }
    .error { background: #ffebee; }
    #input { width: calc(100% - 80px); padding: 10px; }
    button { padding: 10px 20px; cursor: pointer; }
    #status { margin-bottom: 10px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>Claude Agent SDK - Full App</h1>
  <div id="status">Connecting...</div>
  <div id="messages"></div>
  <input id="input" type="text" placeholder="Type your message...">
  <button onclick="send()">Send</button>
  <button onclick="reset()">Reset</button>

  <script>
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');
    const status = document.getElementById('status');

    const ws = new WebSocket('ws://localhost:3000/ws');

    ws.onopen = () => {
      status.textContent = 'Connected';
      status.style.color = 'green';
    };

    ws.onclose = () => {
      status.textContent = 'Disconnected';
      status.style.color = 'red';
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'assistant_message') {
        addMessage(data.content, 'assistant');
      } else if (data.type === 'user_message') {
        addMessage(data.content, 'user');
      } else if (data.type === 'tool_use') {
        addMessage(\`Using tool: \${data.toolName}\`, 'tool');
      } else if (data.type === 'result') {
        addMessage(\`Result: \${data.success ? 'Success' : 'Failed'}\`, 'assistant');
      } else if (data.type === 'error') {
        addMessage(\`Error: \${data.error}\`, 'error');
      }

      messages.scrollTop = messages.scrollHeight;
    };

    function addMessage(text, className) {
      const div = document.createElement('div');
      div.className = 'message ' + className;
      div.textContent = text;
      messages.appendChild(div);
    }

    function send() {
      const text = input.value.trim();
      if (!text) return;

      ws.send(JSON.stringify({
        type: 'message',
        content: text
      }));

      input.value = '';
    }

    function reset() {
      ws.send(JSON.stringify({ type: 'reset' }));
      messages.innerHTML = '';
    }

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') send();
    });
  </script>
</body>
</html>`;
}

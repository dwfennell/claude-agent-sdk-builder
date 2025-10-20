# Custom Tools Guide

Create custom tools that extend Claude's capabilities with domain-specific functionality.

## Overview

Custom tools are functions that the agent can call to perform specific operations. Tools are defined using the `tool()` function and bundled into MCP servers using `createSdkMcpServer()`.

## Basic Tool Creation

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const greetTool = tool(
  "greet",                          // Tool name
  "Greet a user by name",           // Description
  {
    name: z.string().describe("The user's name")
  },                                 // Input schema
  async (args) => {                  // Implementation
    return {
      content: [{
        type: "text",
        text: `Hello, ${args.name}!`
      }]
    };
  }
);
```

## Tool Components

### 1. Tool Name

Short, descriptive identifier (lowercase, underscores allowed):

```typescript
tool("search_emails", ...)
tool("calculate_sum", ...)
tool("fetch_weather", ...)
```

### 2. Description

Clear description of what the tool does (shown to the agent):

```typescript
tool(
  "search_emails",
  "Search emails in the inbox using Gmail query syntax",
  ...
)
```

**Best practices:**
- Be specific about what the tool does
- Mention key parameters or constraints
- Use active voice

### 3. Input Schema

Define expected parameters using Zod:

```typescript
{
  query: z.string().describe("Search query"),
  limit: z.number().optional().describe("Max results (default: 10)")
}
```

**Common Zod types:**

```typescript
// String
name: z.string()
name: z.string().describe("User's full name")

// Number
age: z.number()
age: z.number().min(0).max(120)

// Boolean
isActive: z.boolean()

// Optional
email: z.string().optional()

// Array
tags: z.array(z.string())

// Enum
status: z.enum(["pending", "active", "complete"])

// Object
user: z.object({
  name: z.string(),
  email: z.string()
})

// Union
value: z.union([z.string(), z.number()])
```

### 4. Implementation

Async function that executes the tool logic:

```typescript
async (args) => {
  // Tool logic here
  const result = await performOperation(args);

  return {
    content: [{
      type: "text",
      text: JSON.stringify(result, null, 2)
    }]
  };
}
```

**Return format:**

```typescript
{
  content: [
    { type: "text", text: "Result text" }
  ]
}
```

## Creating an MCP Server

Bundle tools into an MCP server:

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

const calculatorServer = createSdkMcpServer({
  name: "calculator",
  version: "1.0.0",
  tools: [
    tool("add", "Add two numbers", {
      a: z.number(),
      b: z.number()
    }, async (args) => ({
      content: [{ type: "text", text: String(args.a + args.b) }]
    })),

    tool("multiply", "Multiply two numbers", {
      a: z.number(),
      b: z.number()
    }, async (args) => ({
      content: [{ type: "text", text: String(args.a * args.b) }]
    }))
  ]
});

// Use in agent
const options = {
  mcpServers: {
    "calc": calculatorServer
  },
  allowedTools: [
    "mcp__calc__add",
    "mcp__calc__multiply"
  ]
};
```

**MCP Tool Naming Convention:**
- Format: `mcp__<server-name>__<tool-name>`
- Example: `mcp__calc__add`

## Real-World Examples

### Example 1: Email Search Tool

```typescript
import { EmailAPI } from './email-api';

const emailAPI = new EmailAPI();

const searchEmailsTool = tool(
  "search_inbox",
  "Search emails using Gmail query syntax",
  {
    gmailQuery: z.string().describe(
      "Gmail query (e.g., 'from:user@example.com subject:invoice')"
    ),
    limit: z.number().optional().describe("Max results (default: 30)")
  },
  async (args) => {
    try {
      const results = await emailAPI.searchEmails({
        gmailQuery: args.gmailQuery,
        limit: args.limit || 30
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalResults: results.length,
            emails: results.map(email => ({
              id: email.id,
              from: email.from,
              subject: email.subject,
              date: email.date
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  }
);
```

### Example 2: Database Query Tool

```typescript
import { Database } from "bun:sqlite";

const db = new Database("data.db");

const queryDatabaseTool = tool(
  "query_database",
  "Execute a SELECT query on the database",
  {
    query: z.string().describe("SQL SELECT query to execute"),
  },
  async (args) => {
    try {
      // Validate query is SELECT only
      if (!args.query.trim().toLowerCase().startsWith('select')) {
        return {
          content: [{
            type: "text",
            text: "Error: Only SELECT queries are allowed"
          }]
        };
      }

      const results = db.query(args.query).all();

      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Database error: ${(error as Error).message}`
          }]
        };
    }
  }
);
```

### Example 3: API Integration Tool

```typescript
const fetchWeatherTool = tool(
  "fetch_weather",
  "Get current weather for a location",
  {
    location: z.string().describe("City name or zip code"),
    units: z.enum(["metric", "imperial"]).optional()
  },
  async (args) => {
    const apiKey = process.env.WEATHER_API_KEY;
    const units = args.units || "metric";

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${args.location}&units=${units}&appid=${apiKey}`
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        content: [{
          type: "text",
          text: `Weather API error: ${data.message}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          location: data.name,
          temperature: data.main.temp,
          conditions: data.weather[0].description,
          humidity: data.main.humidity
        }, null, 2)
      }]
    };
  }
);
```

### Example 4: File Operations Tool

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

const listDirectoryTool = tool(
  "list_directory",
  "List files in a directory with optional filtering",
  {
    directory: z.string().describe("Directory path to list"),
    pattern: z.string().optional().describe("Glob pattern to filter (e.g., '*.ts')")
  },
  async (args) => {
    try {
      const files = await fs.readdir(args.directory);

      let filtered = files;
      if (args.pattern) {
        const regex = new RegExp(args.pattern.replace('*', '.*'));
        filtered = files.filter(f => regex.test(f));
      }

      const fileInfo = await Promise.all(
        filtered.map(async (file) => {
          const filePath = path.join(args.directory, file);
          const stats = await fs.stat(filePath);

          return {
            name: file,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            modified: stats.mtime
          };
        })
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            directory: args.directory,
            totalFiles: fileInfo.length,
            files: fileInfo
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  }
);
```

### Example 5: Data Processing Tool

```typescript
const analyzeDataTool = tool(
  "analyze_csv",
  "Analyze a CSV file and provide statistics",
  {
    filePath: z.string().describe("Path to CSV file"),
    columns: z.array(z.string()).optional().describe("Columns to analyze")
  },
  async (args) => {
    try {
      const fileContent = await fs.readFile(args.filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(line => line.split(','));

      const columnsToAnalyze = args.columns || headers;
      const stats: Record<string, any> = {};

      for (const col of columnsToAnalyze) {
        const colIndex = headers.indexOf(col);
        if (colIndex === -1) continue;

        const values = rows
          .map(row => row[colIndex])
          .filter(v => v && !isNaN(Number(v)))
          .map(Number);

        if (values.length > 0) {
          stats[col] = {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            mean: values.reduce((a, b) => a + b, 0) / values.length
          };
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            file: args.filePath,
            totalRows: rows.length,
            columns: headers,
            statistics: stats
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Analysis error: ${(error as Error).message}`
        }]
      };
    }
  }
);
```

## Tool Patterns

### Pattern 1: Logging Tool Calls

```typescript
const createLoggingTool = (baseTool: any, toolName: string) => {
  return tool(
    toolName,
    baseTool.description,
    baseTool.schema,
    async (args) => {
      console.log(`[${new Date().toISOString()}] Tool called: ${toolName}`);
      console.log('Arguments:', args);

      const result = await baseTool.handler(args);

      console.log('Result:', result);
      return result;
    }
  );
};
```

### Pattern 2: Error Handling Wrapper

```typescript
const withErrorHandling = (handler: any) => {
  return async (args: any) => {
    try {
      return await handler(args);
    } catch (error) {
      console.error('Tool error:', error);
      return {
        content: [{
          type: "text",
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  };
};

const safeTool = tool(
  "safe_operation",
  "Operation with error handling",
  { input: z.string() },
  withErrorHandling(async (args) => {
    // Logic that might throw
    return { content: [{ type: "text", text: "Success" }] };
  })
);
```

### Pattern 3: Caching Tool Results

```typescript
const cache = new Map<string, any>();

const createCachedTool = (handler: any, ttl: number = 60000) => {
  return async (args: any) => {
    const cacheKey = JSON.stringify(args);
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log('Cache hit');
      return cached.result;
    }

    const result = await handler(args);

    cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  };
};
```

## Complete Example: Email Tools Server

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { EmailAPI } from './email-api';

const emailAPI = new EmailAPI();

export const emailServer = createSdkMcpServer({
  name: "email",
  version: "1.0.0",
  tools: [
    // Search tool
    tool(
      "search_inbox",
      "Search emails using Gmail query syntax",
      {
        gmailQuery: z.string(),
        limit: z.number().optional()
      },
      async (args) => {
        const results = await emailAPI.searchEmails({
          gmailQuery: args.gmailQuery,
          limit: args.limit || 30
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ results }, null, 2)
          }]
        };
      }
    ),

    // Read tool
    tool(
      "read_emails",
      "Read full content of specific emails by ID",
      {
        ids: z.array(z.string())
      },
      async (args) => {
        const emails = await emailAPI.getEmailsByIds(args.ids);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ emails }, null, 2)
          }]
        };
      }
    ),

    // Send tool
    tool(
      "send_email",
      "Send an email",
      {
        to: z.string().email(),
        subject: z.string(),
        body: z.string()
      },
      async (args) => {
        await emailAPI.sendEmail(args);

        return {
          content: [{
            type: "text",
            text: "Email sent successfully"
          }]
        };
      }
    )
  ]
});
```

## Best Practices

1. **Clear descriptions** - Help the agent understand when to use the tool
2. **Validate inputs** - Check parameters before processing
3. **Handle errors gracefully** - Return meaningful error messages
4. **Use Zod descriptions** - Describe each parameter clearly
5. **Return structured data** - Use JSON for complex results
6. **Log tool calls** - Log for debugging and monitoring
7. **Keep tools focused** - One tool should do one thing well
8. **Consider caching** - Cache expensive operations
9. **Set timeouts** - Prevent tools from hanging
10. **Document examples** - Show example inputs in descriptions

## Testing Tools

```typescript
// tool.test.ts
import { describe, it, expect } from 'vitest';

describe('Search Tool', () => {
  it('should search emails successfully', async () => {
    const result = await searchEmailsTool.handler({
      gmailQuery: "from:test@example.com",
      limit: 10
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  it('should handle errors', async () => {
    const result = await searchEmailsTool.handler({
      gmailQuery: "invalid query!!!",
      limit: 10
    });

    expect(result.content[0].text).toContain('Error');
  });
});
```

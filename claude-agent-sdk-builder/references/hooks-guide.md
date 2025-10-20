# Hooks System Guide

Hooks allow you to intercept and control tool usage before and after execution. Use hooks to implement permissions, validation, logging, and safety guardrails.

## Hook Types

### PreToolUse Hooks

Execute **before** a tool is called. Can block or allow the tool execution.

### PostToolUse Hooks

Execute **after** a tool completes. Can modify results or trigger side effects.

## Hook Configuration

```typescript
interface HookConfig {
  PreToolUse?: Array<{
    matcher: string;  // Regex pattern for tool names
    hooks: Array<(input: HookInput) => Promise<HookOutput>>;
  }>;
  PostToolUse?: Array<{
    matcher: string;
    hooks: Array<(input: HookInput, result: any) => Promise<HookOutput>>;
  }>;
}
```

## PreToolUse Hooks

### Basic Example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const options = {
  hooks: {
    PreToolUse: [
      {
        matcher: "Write|Edit",  // Match Write or Edit tools
        hooks: [
          async (input) => {
            const { tool_name, tool_input } = input;

            console.log(`Tool ${tool_name} about to execute`);
            console.log(`Input:`, tool_input);

            // Allow execution
            return { continue: true };
          }
        ]
      }
    ]
  }
};
```

### Blocking Tool Execution

```typescript
{
  PreToolUse: [
    {
      matcher: "Bash",
      hooks: [
        async (input) => {
          const command = input.tool_input.command;

          // Block destructive commands
          if (command.includes('rm -rf')) {
            return {
              decision: 'block',
              stopReason: 'Destructive commands are not allowed for safety reasons.',
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
}
```

### File Path Validation

```typescript
{
  PreToolUse: [
    {
      matcher: "Write|Edit|MultiEdit",
      hooks: [
        async (input) => {
          const { tool_name, tool_input } = input;

          // Get file path based on tool
          let filePath = '';
          if (tool_name === 'Write' || tool_name === 'Edit') {
            filePath = tool_input.file_path || '';
          } else if (tool_name === 'MultiEdit') {
            filePath = tool_input.file_path || '';
          }

          // Restrict to specific directory
          const allowedDir = '/workspace/src';
          if (!filePath.startsWith(allowedDir)) {
            return {
              decision: 'block',
              stopReason: `Files can only be modified within ${allowedDir}`,
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
}
```

### Environment-Based Restrictions

```typescript
const isProduction = process.env.NODE_ENV === 'production';

const hooks = {
  PreToolUse: [
    {
      matcher: "Bash",
      hooks: [
        async (input) => {
          if (isProduction) {
            return {
              decision: 'block',
              stopReason: 'Command execution is disabled in production',
              continue: false
            };
          }
          return { continue: true };
        }
      ]
    }
  ]
};
```

## Multiple Matchers

```typescript
{
  PreToolUse: [
    {
      matcher: "Write|Edit",
      hooks: [/* validation for file operations */]
    },
    {
      matcher: "Bash",
      hooks: [/* validation for commands */]
    },
    {
      matcher: "WebFetch|WebSearch",
      hooks: [/* validation for web access */]
    }
  ]
}
```

## Hook Input Types

### PreToolUse Input

```typescript
interface HookInput {
  tool_name: string;
  tool_input: any;  // Tool-specific parameters
}

// Examples for different tools:

// Write tool
{
  tool_name: "Write",
  tool_input: {
    file_path: "/path/to/file.ts",
    content: "file contents..."
  }
}

// Bash tool
{
  tool_name: "Bash",
  tool_input: {
    command: "npm install",
    description: "Install dependencies"
  }
}

// Custom MCP tool
{
  tool_name: "mcp__email__search_inbox",
  tool_input: {
    gmailQuery: "from:user@example.com"
  }
}
```

### Hook Output

```typescript
interface HookOutput {
  continue: boolean;
  decision?: 'block' | 'allow';
  stopReason?: string;  // Message shown to agent when blocked
}

// Allow execution
return { continue: true };

// Block execution
return {
  decision: 'block',
  stopReason: 'Reason visible to agent',
  continue: false
};
```

## Real-World Examples

### Example 1: Safe Workspace Enforcement

```typescript
import * as path from 'path';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

const safeWorkspaceHook = {
  PreToolUse: [
    {
      matcher: "Write|Edit|MultiEdit|Bash",
      hooks: [
        async (input) => {
          const { tool_name, tool_input } = input;

          // Extract file paths or working directory
          let targetPath = '';

          if (tool_name === 'Write' || tool_name === 'Edit') {
            targetPath = tool_input.file_path;
          } else if (tool_name === 'MultiEdit') {
            targetPath = tool_input.file_path;
          } else if (tool_name === 'Bash') {
            // Check if command references files outside workspace
            const command = tool_input.command;
            if (command.match(/\/(?!workspace)/)) {
              return {
                decision: 'block',
                stopReason: 'Commands must operate within the workspace directory',
                continue: false
              };
            }
            return { continue: true };
          }

          // Validate path is within workspace
          const absolutePath = path.resolve(targetPath);
          if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
            return {
              decision: 'block',
              stopReason: `File operations must be within ${WORKSPACE_ROOT}`,
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
};
```

### Example 2: File Type Restrictions

```typescript
const fileTypeHook = {
  PreToolUse: [
    {
      matcher: "Write|Edit",
      hooks: [
        async (input) => {
          const filePath = input.tool_input.file_path || '';
          const ext = path.extname(filePath).toLowerCase();

          // Only allow specific file types
          const allowedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

          if (!allowedExtensions.includes(ext)) {
            return {
              decision: 'block',
              stopReason: `File type ${ext} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
};
```

### Example 3: Custom Script Directory Enforcement

```typescript
const scriptDirHook = {
  PreToolUse: [
    {
      matcher: "Write|Edit|MultiEdit",
      hooks: [
        async (input) => {
          const { tool_name, tool_input } = input;

          let filePath = '';
          if (tool_name === 'Write' || tool_name === 'Edit') {
            filePath = tool_input.file_path || '';
          } else if (tool_name === 'MultiEdit') {
            filePath = tool_input.file_path || '';
          }

          const ext = path.extname(filePath).toLowerCase();

          // Enforce that .js/.ts files go in custom_scripts/
          if (ext === '.js' || ext === '.ts') {
            const customScriptsPath = path.join(process.cwd(), 'custom_scripts');

            if (!filePath.startsWith(customScriptsPath)) {
              return {
                decision: 'block',
                stopReason: `Script files (.js and .ts) must be written to the custom_scripts directory. Use: ${customScriptsPath}/${path.basename(filePath)}`,
                continue: false
              };
            }
          }

          return { continue: true };
        }
      ]
    }
  ]
};
```

### Example 4: Command Allowlist

```typescript
const commandAllowlist = [
  'npm install',
  'npm test',
  'npm run build',
  'git status',
  'git diff',
  'ls',
  'cat'
];

const commandAllowlistHook = {
  PreToolUse: [
    {
      matcher: "Bash",
      hooks: [
        async (input) => {
          const command = input.tool_input.command;

          // Check if command starts with any allowed command
          const isAllowed = commandAllowlist.some(allowed =>
            command.trim().startsWith(allowed)
          );

          if (!isAllowed) {
            return {
              decision: 'block',
              stopReason: `Command not in allowlist. Allowed commands: ${commandAllowlist.join(', ')}`,
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
};
```

### Example 5: Logging Hook

```typescript
const loggingHook = {
  PreToolUse: [
    {
      matcher: ".*",  // Match all tools
      hooks: [
        async (input) => {
          console.log('[TOOL CALL]', {
            tool: input.tool_name,
            timestamp: new Date().toISOString(),
            input: input.tool_input
          });

          // Always allow - this is just logging
          return { continue: true };
        }
      ]
    }
  ]
};
```

### Example 6: Rate Limiting

```typescript
const rateLimitMap = new Map<string, number>();

const rateLimitHook = {
  PreToolUse: [
    {
      matcher: "Bash",
      hooks: [
        async (input) => {
          const now = Date.now();
          const lastCall = rateLimitMap.get('Bash') || 0;
          const timeSinceLastCall = now - lastCall;

          // Minimum 1 second between Bash calls
          if (timeSinceLastCall < 1000) {
            return {
              decision: 'block',
              stopReason: 'Rate limit: Wait 1 second between command executions',
              continue: false
            };
          }

          rateLimitMap.set('Bash', now);
          return { continue: true };
        }
      ]
    }
  ]
};
```

## Combining Multiple Hooks

Hooks can be composed for layered validation:

```typescript
const comprehensiveHooks = {
  PreToolUse: [
    // Layer 1: Logging
    {
      matcher: ".*",
      hooks: [loggingHook]
    },
    // Layer 2: Workspace safety
    {
      matcher: "Write|Edit|Bash",
      hooks: [safeWorkspaceHook]
    },
    // Layer 3: File type restrictions
    {
      matcher: "Write|Edit",
      hooks: [fileTypeHook]
    },
    // Layer 4: Rate limiting
    {
      matcher: "Bash",
      hooks: [rateLimitHook]
    }
  ]
};
```

## PostToolUse Hooks

Execute after a tool completes:

```typescript
{
  PostToolUse: [
    {
      matcher: "Bash",
      hooks: [
        async (input, result) => {
          console.log('Command completed:', input.tool_input.command);
          console.log('Result:', result);

          // Can modify result or trigger side effects
          return { continue: true };
        }
      ]
    }
  ]
}
```

## Hook Best Practices

1. **Keep hooks fast** - They run synchronously in the agent loop
2. **Clear error messages** - Provide helpful `stopReason` messages
3. **Test thoroughly** - Test both allow and block paths
4. **Log for debugging** - Log hook decisions for troubleshooting
5. **Layer hooks** - Separate concerns (logging, validation, safety)
6. **Document restrictions** - Document what hooks enforce and why
7. **Use type guards** - Validate tool_input structure before accessing
8. **Handle edge cases** - Consider empty inputs, missing fields, etc.
9. **Environment-aware** - Different rules for dev/staging/production
10. **Fail closed** - Default to blocking when in doubt

## Testing Hooks

```typescript
// hook.test.ts
import { describe, it, expect } from 'vitest';

describe('File Path Hook', () => {
  it('should block writes outside workspace', async () => {
    const hook = safeWorkspaceHook.PreToolUse[0].hooks[0];

    const result = await hook({
      tool_name: 'Write',
      tool_input: { file_path: '/etc/passwd' }
    });

    expect(result.continue).toBe(false);
    expect(result.decision).toBe('block');
  });

  it('should allow writes inside workspace', async () => {
    const hook = safeWorkspaceHook.PreToolUse[0].hooks[0];

    const result = await hook({
      tool_name: 'Write',
      tool_input: { file_path: '/workspace/file.ts' }
    });

    expect(result.continue).toBe(true);
  });
});
```

## Complete Example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as path from 'path';

const WORKSPACE = path.join(process.cwd(), 'workspace');

const productionSafeHooks = {
  PreToolUse: [
    // Logging
    {
      matcher: ".*",
      hooks: [
        async (input) => {
          console.log(`[${new Date().toISOString()}] ${input.tool_name}`);
          return { continue: true };
        }
      ]
    },
    // Workspace enforcement
    {
      matcher: "Write|Edit|Bash",
      hooks: [
        async (input) => {
          if (input.tool_name === 'Bash') {
            const cmd = input.tool_input.command;
            if (cmd.includes('rm -rf') || cmd.includes('sudo')) {
              return {
                decision: 'block',
                stopReason: 'Destructive/privileged commands not allowed',
                continue: false
              };
            }
          }

          const filePath = input.tool_input.file_path;
          if (filePath && !path.resolve(filePath).startsWith(WORKSPACE)) {
            return {
              decision: 'block',
              stopReason: 'Operations must be within workspace',
              continue: false
            };
          }

          return { continue: true };
        }
      ]
    }
  ]
};

// Use in agent
for await (const message of query({
  prompt: "Build a new feature",
  options: {
    cwd: WORKSPACE,
    hooks: productionSafeHooks,
    allowedTools: ["Read", "Write", "Edit", "Bash"]
  }
})) {
  // Handle messages
}
```

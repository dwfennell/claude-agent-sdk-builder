# In-Code Subagents (Programmatic Configuration)

**Preferred Approach:** This is the recommended way to configure subagents in the Claude Agent SDK.

## Overview

Subagents are specialized agents that can be spawned to handle specific tasks. Instead of defining them in markdown files (`.claude/agents/*.md`), configure them programmatically in your code for better type safety, version control, and integration with your application logic.

## Why In-Code Subagents?

**Advantages over markdown-based subagents:**
- **Type safety** - Catch configuration errors at compile time
- **Dynamic configuration** - Adjust subagent behavior based on runtime conditions
- **Code reuse** - Share configuration logic across multiple agents
- **Testing** - Easier to unit test subagent configurations
- **Integration** - Better integration with existing TypeScript/JavaScript codebases
- **Version control** - Changes tracked in your application code

**When to use markdown subagents instead:**
- User explicitly requests markdown-based configuration
- Non-technical users need to modify agent behavior
- Quick prototyping without code changes

## Basic In-Code Subagent Pattern

### Option 1: Direct Configuration in Query Options

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const searcherSubagent = {
  name: "data-searcher",
  description: "Specialized in searching and analyzing data files",
  tools: ["Read", "Grep", "Glob"],
  systemPrompt: `You are a data search specialist.
  Your job is to find and extract relevant information from files.
  Always return concise summaries of what you find.`
};

// Use the subagent configuration in your main agent
for await (const message of query({
  prompt: "Search for error patterns in logs",
  options: {
    allowedTools: ["Task"],  // Allow spawning subagents
    subagents: [searcherSubagent],  // Register subagents
    appendSystemPrompt: `
      When you need to search through files,
      spawn the data-searcher subagent using the Task tool.
    `
  }
})) {
  // Handle messages
}
```

### Option 2: Subagent Factory Pattern

Create reusable subagent factories:

```typescript
// subagent-factory.ts
interface SubagentConfig {
  name: string;
  description: string;
  tools: string[];
  systemPrompt: string;
  maxTurns?: number;
}

export function createSearchSubagent(): SubagentConfig {
  return {
    name: "searcher",
    description: "Finds and analyzes files based on patterns",
    tools: ["Read", "Grep", "Glob", "Bash"],
    systemPrompt: `
      You are a search specialist.

      Your workflow:
      1. Use Glob to find files matching patterns
      2. Use Grep to search within files
      3. Use Read to examine full file contents
      4. Return concise findings with file paths and line numbers
    `,
    maxTurns: 10
  };
}

export function createAnalyzerSubagent(): SubagentConfig {
  return {
    name: "analyzer",
    description: "Analyzes code and provides insights",
    tools: ["Read", "Grep", "Bash"],
    systemPrompt: `
      You are a code analysis specialist.

      Analyze code for:
      - Patterns and anti-patterns
      - Potential bugs
      - Performance issues
      - Security vulnerabilities

      Provide actionable recommendations.
    `,
    maxTurns: 20
  };
}

// Usage in main agent
import { createSearchSubagent, createAnalyzerSubagent } from './subagent-factory';

const options = {
  subagents: [
    createSearchSubagent(),
    createAnalyzerSubagent()
  ],
  allowedTools: ["Task"]
};
```

### Option 3: Class-Based Subagents

For complex subagents with state and methods:

```typescript
// EmailSearchSubagent.ts
export class EmailSearchSubagent {
  private config: SubagentConfig;

  constructor(
    private emailProvider: EmailAPI,
    private maxResults: number = 30
  ) {
    this.config = this.buildConfig();
  }

  private buildConfig(): SubagentConfig {
    return {
      name: "email-searcher",
      description: "Searches emails using Gmail query syntax",
      tools: ["mcp__email__search_inbox", "mcp__email__read_emails", "Read", "Grep"],
      systemPrompt: this.buildSystemPrompt(),
      maxTurns: 15
    };
  }

  private buildSystemPrompt(): string {
    return `
      You are an email search specialist.

      Available tools:
      - mcp__email__search_inbox: Search with Gmail query syntax
      - mcp__email__read_emails: Get full content of specific emails
      - Read: Read log files with search results
      - Grep: Search through log files

      Workflow:
      1. Start with targeted Gmail queries
      2. Analyze log file results
      3. Use read_emails for detailed information
      4. Return findings with email IDs

      Maximum results per search: ${this.maxResults}
    `;
  }

  getConfig(): SubagentConfig {
    return this.config;
  }

  // Methods to dynamically update configuration
  setMaxResults(max: number) {
    this.maxResults = max;
    this.config = this.buildConfig();
  }
}

// Usage
const emailSearcher = new EmailSearchSubagent(emailAPI, 50);

const options = {
  subagents: [emailSearcher.getConfig()],
  mcpServers: { email: emailMcpServer },
  allowedTools: ["Task", "mcp__email__search_inbox", "mcp__email__read_emails"]
};
```

## Spawning Subagents from Main Agent

The main agent uses the `Task` tool to spawn subagents:

```typescript
// Main agent configuration
const mainAgentOptions = {
  appendSystemPrompt: `
    You have access to specialized subagents:

    1. data-searcher - Use for finding and analyzing files
    2. code-analyzer - Use for analyzing code quality

    To spawn a subagent, use the Task tool with:
    - subagent_type: The name of the subagent
    - prompt: The specific task for the subagent
    - description: Brief description of the task

    Example:
    Task({
      subagent_type: "data-searcher",
      description: "Search log files",
      prompt: "Find all error messages in logs/ directory from the last 24 hours"
    })
  `,
  subagents: [
    createSearchSubagent(),
    createAnalyzerSubagent()
  ],
  allowedTools: ["Task", "Read", "Write"]
};
```

## Dynamic Subagent Configuration

Configure subagents based on runtime conditions:

```typescript
function createSubagentsForEnvironment(env: 'dev' | 'prod') {
  const baseSearcher = createSearchSubagent();

  if (env === 'prod') {
    // Production: more restrictive
    return {
      ...baseSearcher,
      tools: ["Read", "Grep"],  // No Bash in production
      maxTurns: 5,
      systemPrompt: baseSearcher.systemPrompt + "\n\nREAD-ONLY MODE: Do not modify any files."
    };
  } else {
    // Development: full access
    return {
      ...baseSearcher,
      tools: ["Read", "Grep", "Glob", "Bash"],
      maxTurns: 20
    };
  }
}

const options = {
  subagents: [createSubagentsForEnvironment(process.env.NODE_ENV)]
};
```

## Passing Context to Subagents

Share state between main agent and subagents:

```typescript
interface ProjectContext {
  projectRoot: string;
  language: string;
  frameworks: string[];
}

function createContextAwareSubagent(context: ProjectContext): SubagentConfig {
  return {
    name: "code-helper",
    description: `Helps with ${context.language} development`,
    tools: ["Read", "Write", "Edit", "Bash"],
    systemPrompt: `
      You are working on a ${context.language} project.
      Frameworks in use: ${context.frameworks.join(', ')}
      Project root: ${context.projectRoot}

      Follow the conventions and patterns typical for ${context.language}.
    `
  };
}

// Usage
const projectContext = {
  projectRoot: '/app',
  language: 'TypeScript',
  frameworks: ['React', 'Express']
};

const options = {
  subagents: [createContextAwareSubagent(projectContext)]
};
```

## Multi-Level Subagents

Subagents can spawn their own subagents:

```typescript
const orchestratorSubagent = {
  name: "orchestrator",
  description: "Coordinates multiple specialized subagents",
  tools: ["Task"],
  systemPrompt: `
    You coordinate complex tasks by delegating to specialists:
    - file-searcher: Find files and patterns
    - data-processor: Process and transform data
    - report-generator: Create reports from findings

    Break down the user's request into subtasks and delegate appropriately.
  `,
  subagents: [
    { name: "file-searcher", tools: ["Glob", "Grep"], ... },
    { name: "data-processor", tools: ["Read", "Bash"], ... },
    { name: "report-generator", tools: ["Write"], ... }
  ]
};
```

## Error Handling in Subagents

Configure error handling behavior:

```typescript
const resilientSubagent = {
  name: "resilient-worker",
  description: "Worker that handles errors gracefully",
  tools: ["Bash", "Read"],
  systemPrompt: `
    You are a resilient worker.

    Error handling strategy:
    1. If a tool fails, try an alternative approach
    2. If Bash fails, read files directly instead
    3. Always return partial results if complete execution fails
    4. Document any errors encountered in your response
  `,
  maxTurns: 30,
  hooks: {
    PreToolUse: [{
      matcher: "Bash",
      hooks: [async (input) => {
        // Validate bash commands before execution
        if (input.tool_input.command.includes('rm -rf')) {
          return {
            decision: 'block',
            stopReason: 'Destructive commands not allowed',
            continue: false
          };
        }
        return { continue: true };
      }]
    }]
  }
};
```

## Testing Subagent Configurations

```typescript
// subagent.test.ts
import { describe, it, expect } from 'vitest';
import { createSearchSubagent } from './subagent-factory';

describe('SearchSubagent', () => {
  it('should have required tools', () => {
    const config = createSearchSubagent();
    expect(config.tools).toContain('Grep');
    expect(config.tools).toContain('Glob');
  });

  it('should have proper description', () => {
    const config = createSearchSubagent();
    expect(config.description).toBeTruthy();
    expect(config.description.length).toBeGreaterThan(10);
  });

  it('should have system prompt with instructions', () => {
    const config = createSearchSubagent();
    expect(config.systemPrompt).toContain('search');
  });
});
```

## Best Practices

1. **Single Responsibility** - Each subagent should have one clear purpose
2. **Clear Naming** - Use descriptive names that indicate the subagent's role
3. **Tool Minimalism** - Only grant tools the subagent actually needs
4. **Explicit Instructions** - Provide clear workflow steps in system prompts
5. **Limit Scope** - Use `maxTurns` to prevent runaway execution
6. **Type Safety** - Use TypeScript interfaces for subagent configs
7. **Reusability** - Create factory functions for common subagent patterns
8. **Testing** - Unit test subagent configurations
9. **Documentation** - Document what each subagent does and when to use it
10. **Context Awareness** - Pass relevant context to customize behavior

## Complete Example

```typescript
// agent-system.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

// Define subagent configurations
const subagents = [
  {
    name: "file-analyzer",
    description: "Analyzes file structure and content",
    tools: ["Read", "Grep", "Glob"],
    systemPrompt: "Analyze files and provide detailed reports on structure and content.",
    maxTurns: 10
  },
  {
    name: "code-writer",
    description: "Writes and edits code files",
    tools: ["Write", "Edit", "Read"],
    systemPrompt: "Write clean, well-documented code following best practices.",
    maxTurns: 15
  },
  {
    name: "test-runner",
    description: "Runs tests and reports results",
    tools: ["Bash", "Read"],
    systemPrompt: "Execute test suites and analyze results for failures.",
    maxTurns: 5
  }
];

// Main agent that coordinates subagents
async function runAgentWithSubagents(userPrompt: string) {
  for await (const message of query({
    prompt: userPrompt,
    options: {
      subagents,
      allowedTools: ["Task", "Read", "Write"],
      appendSystemPrompt: `
        You coordinate specialized subagents to accomplish tasks.
        Delegate appropriately based on the task requirements.
      `,
      maxTurns: 50
    }
  })) {
    if (message.type === 'assistant') {
      console.log(message.message.content);
    }
  }
}
```

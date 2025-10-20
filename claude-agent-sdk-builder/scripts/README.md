# Helper Scripts

These scripts automate common tasks when building Claude Agent SDK applications.

## Prerequisites

- **Bun** or **Node.js 18+**
- **Git** (for init-agent-project.sh)
- **npm** or **bun** package manager

## Scripts

### init-agent-project.sh

**Purpose:** Interactive project scaffolder that creates a new agent project from templates.

**Usage:**
```bash
./scripts/init-agent-project.sh
```

**Features:**
- Prompts for project name
- Lets you choose a template:
  - basic-agent
  - custom-tools
  - in-code-subagent
  - full-app
- Copies template files
- Creates `.env` and `.gitignore`
- Initializes git repository
- Installs dependencies automatically
- Creates workspace directory

**Requirements:** Git, npm or bun

---

### generate-tool.ts

**Purpose:** Generates boilerplate code for custom tools with proper TypeScript types and Zod schemas.

**Usage:**
```bash
bun run scripts/generate-tool.ts
# or
npx tsx scripts/generate-tool.ts
```

**Interactive Prompts:**
- Tool name (e.g., `search_database`)
- Tool description
- Parameters with types (string, number, boolean, array)
- Optional/required flags
- Parameter descriptions

**Output:** Complete TypeScript code ready to paste into your MCP server

---

### generate-subagent.ts

**Purpose:** Generates in-code subagent configurations using factory functions or classes.

**Usage:**
```bash
bun run scripts/generate-subagent.ts
# or
npx tsx scripts/generate-subagent.ts
```

**Interactive Prompts:**
- Subagent name
- Description and role
- Tool selection
- Max turns
- Pattern choice (factory function or class-based)

**Output:** TypeScript configuration code for programmatic subagents

---

### validate-agent-config.ts

**Purpose:** Validates agent configuration before running to catch common errors.

**Usage:**
```bash
bun run scripts/validate-agent-config.ts config.ts
# or
npx tsx scripts/validate-agent-config.ts config.ts
```

**Checks:**
- Tool name typos and case sensitivity
- Missing MCP servers
- Invalid tool references (mcp__server__tool format)
- Subagent configuration errors
- Hook configuration issues
- Common mistakes

**Example config file:**
```typescript
export const config = {
  options: {
    maxTurns: 20,
    model: "sonnet",
    allowedTools: ["Read", "Write", "mcp__calc__add"],
    mcpServers: {
      calc: calculatorServer
    }
  }
};
```

---

### add-hooks.ts

**Purpose:** Generates common hook patterns for agent safety and validation.

**Usage:**
```bash
bun run scripts/add-hooks.ts
# or
npx tsx scripts/add-hooks.ts
```

**Available Templates:**
1. **File Path Validation** - Restrict file operations to specific directories
2. **Command Allowlist** - Only allow specific bash commands
3. **File Type Restriction** - Only allow certain file extensions
4. **Rate Limiting** - Limit frequency of tool calls
5. **Logging** - Log all tool usage
6. **Environment-Based** - Different rules for dev/prod

**Output:** Complete hook code ready to paste into agent options

---

## Running Scripts

### With Bun (Recommended)
```bash
bun run scripts/script-name.ts
```

### With Node.js
```bash
npx tsx scripts/script-name.ts
```

### Bash Scripts
```bash
./scripts/init-agent-project.sh
```

Make sure bash scripts are executable:
```bash
chmod +x scripts/*.sh
```

## Tips

- **Start with init-agent-project.sh** for new projects - it handles everything automatically
- **Use generate-tool.ts** when adding new custom tools to save typing boilerplate
- **Use generate-subagent.ts** for creating in-code subagents (preferred over markdown)
- **Run validate-agent-config.ts** before launching agents to catch configuration errors early
- **Use add-hooks.ts** to quickly add safety guardrails with proven patterns

## Troubleshooting

**"Permission denied" when running bash scripts:**
```bash
chmod +x scripts/init-agent-project.sh
```

**"Module not found" errors:**
```bash
cd your-project
npm install
# or
bun install
```

**Scripts not working with Node.js:**

Install tsx globally:
```bash
npm install -g tsx
```

Or use bun which has built-in TypeScript support.

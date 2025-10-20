#!/usr/bin/env bun

/**
 * add-hooks.ts
 * Generates common hook patterns for agent safety
 */

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const HOOK_TEMPLATES = {
  "file-path-validation": {
    name: "File Path Validation",
    description: "Restrict file operations to specific directory",
    code: (dir: string) => `{
  matcher: "Write|Edit|MultiEdit",
  hooks: [
    async (input: HookInput): Promise<HookOutput> => {
      const { tool_name, tool_input } = input;

      let filePath = '';
      if (tool_name === 'Write' || tool_name === 'Edit') {
        filePath = tool_input.file_path || '';
      } else if (tool_name === 'MultiEdit') {
        filePath = tool_input.file_path || '';
      }

      const allowedDir = '${dir}';
      const absolutePath = path.resolve(filePath);

      if (!absolutePath.startsWith(allowedDir)) {
        return {
          decision: 'block',
          stopReason: \`File operations must be within \${allowedDir}\`,
          continue: false
        };
      }

      return { continue: true };
    }
  ]
}`
  },
  "command-allowlist": {
    name: "Command Allowlist",
    description: "Only allow specific bash commands",
    code: (commands: string[]) => `{
  matcher: "Bash",
  hooks: [
    async (input: HookInput): Promise<HookOutput> => {
      const command = input.tool_input.command;
      const allowedCommands = ${JSON.stringify(commands, null, 2)};

      const isAllowed = allowedCommands.some(allowed =>
        command.trim().startsWith(allowed)
      );

      if (!isAllowed) {
        return {
          decision: 'block',
          stopReason: \`Command not allowed. Allowed: \${allowedCommands.join(', ')}\`,
          continue: false
        };
      }

      return { continue: true };
    }
  ]
}`
  },
  "file-type-restriction": {
    name: "File Type Restriction",
    description: "Only allow specific file extensions",
    code: (extensions: string[]) => `{
  matcher: "Write|Edit",
  hooks: [
    async (input: HookInput): Promise<HookOutput> => {
      const filePath = input.tool_input.file_path || '';
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = ${JSON.stringify(extensions)};

      if (!allowedExtensions.includes(ext)) {
        return {
          decision: 'block',
          stopReason: \`File type \${ext} not allowed. Allowed: \${allowedExtensions.join(', ')}\`,
          continue: false
        };
      }

      return { continue: true };
    }
  ]
}`
  },
  "rate-limiting": {
    name: "Rate Limiting",
    description: "Limit frequency of tool calls",
    code: (delayMs: number) => `{
  matcher: "Bash",
  hooks: [
    (() => {
      const lastCallTime = new Map<string, number>();

      return async (input: HookInput): Promise<HookOutput> => {
        const now = Date.now();
        const lastCall = lastCallTime.get('Bash') || 0;
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall < ${delayMs}) {
          return {
            decision: 'block',
            stopReason: \`Rate limit: Wait \${${delayMs} / 1000}s between commands\`,
            continue: false
          };
        }

        lastCallTime.set('Bash', now);
        return { continue: true };
      };
    })()
  ]
}`
  },
  "logging": {
    name: "Logging Hook",
    description: "Log all tool calls",
    code: () => `{
  matcher: ".*",  // Match all tools
  hooks: [
    async (input: HookInput): Promise<HookOutput> => {
      console.log(\`[\${new Date().toISOString()}] Tool: \${input.tool_name}\`);
      console.log('Input:', JSON.stringify(input.tool_input, null, 2));

      return { continue: true };  // Always allow - just logging
    }
  ]
}`
  },
  "environment-based": {
    name: "Environment-Based Restrictions",
    description: "Different rules for dev/prod",
    code: () => `{
  matcher: "Bash",
  hooks: [
    async (input: HookInput): Promise<HookOutput> => {
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        return {
          decision: 'block',
          stopReason: 'Command execution disabled in production',
          continue: false
        };
      }

      return { continue: true };
    }
  ]
}`
  }
};

async function main() {
  console.log("🛡️  Hooks Generator\n");

  console.log("Available hook templates:");
  const templateKeys = Object.keys(HOOK_TEMPLATES);
  templateKeys.forEach((key, i) => {
    const template = HOOK_TEMPLATES[key as keyof typeof HOOK_TEMPLATES];
    console.log(`${i + 1}. ${template.name} - ${template.description}`);
  });

  const choice = await question("\nChoose template (1-" + templateKeys.length + "): ");
  const index = parseInt(choice) - 1;

  if (index < 0 || index >= templateKeys.length) {
    console.error("❌ Invalid choice");
    process.exit(1);
  }

  const templateKey = templateKeys[index];
  const template = HOOK_TEMPLATES[templateKey as keyof typeof HOOK_TEMPLATES];

  let hookCode: string;

  // Get template-specific parameters
  switch (templateKey) {
    case "file-path-validation": {
      const dir = await question("Allowed directory path (e.g., /workspace): ");
      hookCode = template.code(dir);
      break;
    }
    case "command-allowlist": {
      console.log("\nEnter allowed commands (comma-separated):");
      console.log("Example: npm install,npm test,git status");
      const commandsStr = await question("Commands: ");
      const commands = commandsStr.split(',').map(c => c.trim());
      hookCode = template.code(commands);
      break;
    }
    case "file-type-restriction": {
      console.log("\nEnter allowed file extensions (comma-separated):");
      console.log("Example: .ts,.js,.json");
      const extStr = await question("Extensions: ");
      const extensions = extStr.split(',').map(e => e.trim());
      hookCode = template.code(extensions);
      break;
    }
    case "rate-limiting": {
      const delayStr = await question("Minimum delay between calls (ms, e.g., 1000): ");
      const delay = parseInt(delayStr) || 1000;
      hookCode = template.code(delay);
      break;
    }
    default:
      hookCode = template.code();
  }

  rl.close();

  console.log("\n📝 Generated hook:\n");
  console.log("import * as path from 'path';");
  console.log("\ntype HookInput = { tool_name: string; tool_input: any };");
  console.log("type HookOutput = { continue: boolean; decision?: 'block' | 'allow'; stopReason?: string };");
  console.log("\n// Add to your agent options:");
  console.log("options: {");
  console.log("  hooks: {");
  console.log("    PreToolUse: [");
  console.log("      " + hookCode.split('\n').join('\n      '));
  console.log("    ]");
  console.log("  }");
  console.log("}");
  console.log("\n✅ Hook generated! Copy the code above into your agent configuration.\n");
}

main().catch(console.error);

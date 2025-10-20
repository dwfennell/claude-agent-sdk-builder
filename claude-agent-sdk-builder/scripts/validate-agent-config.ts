#!/usr/bin/env bun

/**
 * validate-agent-config.ts
 * Validates agent configuration before running
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const BUILT_IN_TOOLS = [
  "Read", "Write", "Edit", "MultiEdit",
  "Bash", "BashOutput", "KillShell",
  "Grep", "Glob",
  "Task", "TodoWrite",
  "WebFetch", "WebSearch",
  "NotebookEdit",
  "ExitPlanMode"
];

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.options) {
    errors.push("Configuration must have 'options' field");
    return { valid: false, errors, warnings };
  }

  const options = config.options;

  // Validate maxTurns
  if (options.maxTurns !== undefined) {
    if (typeof options.maxTurns !== 'number') {
      errors.push("maxTurns must be a number");
    } else if (options.maxTurns < 1) {
      errors.push("maxTurns must be at least 1");
    } else if (options.maxTurns > 200) {
      warnings.push(`maxTurns is ${options.maxTurns} (very high - may be expensive)`);
    }
  }

  // Validate model
  if (options.model !== undefined) {
    const validModels = ["opus", "sonnet", "haiku"];
    if (!validModels.includes(options.model)) {
      warnings.push(`Unknown model "${options.model}" - valid: ${validModels.join(", ")}`);
    }
  }

  // Validate allowedTools
  if (options.allowedTools) {
    if (!Array.isArray(options.allowedTools)) {
      errors.push("allowedTools must be an array");
    } else {
      for (const tool of options.allowedTools) {
        // Check if it's a built-in tool
        if (BUILT_IN_TOOLS.includes(tool)) {
          continue;
        }

        // Check if it's an MCP tool
        if (tool.startsWith("mcp__")) {
          const parts = tool.split("__");
          if (parts.length !== 3) {
            errors.push(`Invalid MCP tool name: "${tool}" (format: mcp__server__tool)`);
          } else {
            const serverName = parts[1];
            const toolName = parts[2];

            // Check if server exists
            if (options.mcpServers && !options.mcpServers[serverName]) {
              errors.push(`Tool "${tool}" references undefined MCP server "${serverName}"`);
            }
          }
        } else {
          warnings.push(`Unknown tool: "${tool}" - is this a typo?`);
        }
      }

      // Check for common typos
      const commonTypos: Record<string, string> = {
        "read": "Read",
        "write": "Write",
        "edit": "Edit",
        "bash": "Bash",
        "grep": "Grep",
        "glob": "Glob"
      };

      for (const [typo, correct] of Object.entries(commonTypos)) {
        if (options.allowedTools.includes(typo)) {
          errors.push(`Tool names are case-sensitive: use "${correct}" not "${typo}"`);
        }
      }
    }
  } else {
    warnings.push("No allowedTools specified - agent may not be able to use any tools");
  }

  // Validate mcpServers
  if (options.mcpServers) {
    if (typeof options.mcpServers !== 'object') {
      errors.push("mcpServers must be an object");
    } else {
      // Check if any MCP tools are allowed
      const mcpToolsAllowed = options.allowedTools?.some((t: string) => t.startsWith("mcp__"));
      if (!mcpToolsAllowed) {
        warnings.push("mcpServers defined but no MCP tools in allowedTools");
      }
    }
  }

  // Validate subagents
  if (options.subagents) {
    if (!Array.isArray(options.subagents)) {
      errors.push("subagents must be an array");
    } else {
      for (const subagent of options.subagents) {
        if (!subagent.name) {
          errors.push("Each subagent must have a 'name' field");
        }
        if (!subagent.description) {
          warnings.push(`Subagent "${subagent.name}" missing description`);
        }
        if (!subagent.tools || subagent.tools.length === 0) {
          warnings.push(`Subagent "${subagent.name}" has no tools`);
        }
        if (!subagent.systemPrompt) {
          warnings.push(`Subagent "${subagent.name}" missing system prompt`);
        }
      }

      // Check if Task tool is allowed
      if (!options.allowedTools?.includes("Task")) {
        errors.push("Subagents defined but 'Task' tool not in allowedTools");
      }
    }
  }

  // Validate hooks
  if (options.hooks) {
    if (options.hooks.PreToolUse) {
      if (!Array.isArray(options.hooks.PreToolUse)) {
        errors.push("hooks.PreToolUse must be an array");
      } else {
        for (const hookGroup of options.hooks.PreToolUse) {
          if (!hookGroup.matcher) {
            errors.push("Each PreToolUse hook group must have a 'matcher' field");
          }
          if (!hookGroup.hooks || !Array.isArray(hookGroup.hooks)) {
            errors.push("Each PreToolUse hook group must have a 'hooks' array");
          }
        }
      }
    }
  }

  // Validate cwd
  if (options.cwd && typeof options.cwd !== 'string') {
    errors.push("cwd must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult) {
  console.log("\n🔍 Agent Configuration Validation\n");

  if (result.errors.length > 0) {
    console.log("❌ Errors:");
    result.errors.forEach(err => console.log(`   - ${err}`));
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log("⚠️  Warnings:");
    result.warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log();
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("✅ Configuration is valid!\n");
  } else if (result.valid) {
    console.log("✅ Configuration is valid (with warnings)\n");
  } else {
    console.log("❌ Configuration has errors - please fix before running\n");
    process.exit(1);
  }
}

// CLI usage
if (import.meta.main) {
  const configPath = process.argv[2];

  if (!configPath) {
    console.error("Usage: bun run validate-agent-config.ts <config-file.ts>");
    console.error("\nExample config file:");
    console.error(`
export const config = {
  options: {
    maxTurns: 20,
    model: "sonnet",
    allowedTools: ["Read", "Write", "Edit"],
    mcpServers: {},
    hooks: {}
  }
};
`);
    process.exit(1);
  }

  try {
    // Dynamic import the config file
    import(configPath).then((module) => {
      const config = module.config || module.default;
      if (!config) {
        console.error("❌ Config file must export 'config' or default export");
        process.exit(1);
      }

      const result = validateAgentConfig(config);
      printResults(result);
    }).catch((error) => {
      console.error("❌ Error loading config file:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  }
}

# Basic Agent Template

A minimal example of using the Claude Agent SDK.

## Setup

```bash
npm install
# or
bun install
```

## Usage

```bash
# Run with default prompt
npm start

# Run with custom prompt
npm start "Your question here"

# Using bun
bun run index.ts "Your question here"
```

## What it does

- Creates a simple agent
- Handles different message types
- Prints assistant responses
- Shows cost and duration

## Next steps

- Add custom tools (see `custom-tools` template)
- Implement multi-turn conversation
- Add WebSocket streaming (see `full-app` template)

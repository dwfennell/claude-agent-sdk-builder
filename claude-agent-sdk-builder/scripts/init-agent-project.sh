#!/bin/bash

# init-agent-project.sh
# Scaffolds a new Claude Agent SDK project from templates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../assets/templates"

echo "🤖 Claude Agent SDK - Project Initializer"
echo ""

# Get project name
read -p "Project name: " PROJECT_NAME

if [ -z "$PROJECT_NAME" ]; then
  echo "❌ Project name is required"
  exit 1
fi

if [ -d "$PROJECT_NAME" ]; then
  echo "❌ Directory '$PROJECT_NAME' already exists"
  exit 1
fi

# Show template options
echo ""
echo "Available templates:"
echo "1. basic-agent - Simple one-shot agent"
echo "2. custom-tools - Agent with custom MCP tools"
echo "3. in-code-subagent - Agent with programmatic subagents"
echo "4. full-app - Production WebSocket application"
echo ""
read -p "Choose template (1-4): " TEMPLATE_CHOICE

case $TEMPLATE_CHOICE in
  1)
    TEMPLATE="basic-agent"
    ;;
  2)
    TEMPLATE="custom-tools"
    ;;
  3)
    TEMPLATE="in-code-subagent"
    ;;
  4)
    TEMPLATE="full-app"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "📦 Creating project from $TEMPLATE template..."

# Copy template
cp -r "$TEMPLATES_DIR/$TEMPLATE" "$PROJECT_NAME"

# Update package.json with project name
if [ -f "$PROJECT_NAME/package.json" ]; then
  # Use sed to replace the name field (compatible with macOS)
  sed -i.bak "s/\"name\": \".*\"/\"name\": \"$PROJECT_NAME\"/" "$PROJECT_NAME/package.json"
  rm "$PROJECT_NAME/package.json.bak"
fi

# Create .env template
cat > "$PROJECT_NAME/.env" << 'EOF'
# Anthropic API Key
ANTHROPIC_API_KEY=your-api-key-here

# Optional: Model preference
# MODEL=sonnet

# Optional: Working directory
# CWD=./workspace
EOF

# Create .gitignore
cat > "$PROJECT_NAME/.gitignore" << 'EOF'
node_modules/
.env
*.db
*.log
dist/
.DS_Store
EOF

# Create workspace directory for file operations
mkdir -p "$PROJECT_NAME/workspace"

cd "$PROJECT_NAME"

# Initialize git
git init -q
echo "✅ Git repository initialized"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
if command -v bun &> /dev/null; then
  bun install
else
  npm install
fi

echo ""
echo "✅ Project '$PROJECT_NAME' created successfully!"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_NAME"
echo "  # Edit .env and add your ANTHROPIC_API_KEY"
if [ "$TEMPLATE" = "full-app" ]; then
  echo "  bun run server.ts  (or npm start)"
  echo "  # Open http://localhost:3000 in your browser"
else
  echo "  bun run index.ts   (or npm start)"
fi
echo ""

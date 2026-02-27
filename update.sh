#!/bin/bash

# Configuration
APP_DIR="/home/$(whoami)/Memory-Lane"

echo "🔄 Starting Lean Update..."

cd $APP_DIR

# 1. Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# 2. Clean up Frontend (optional, as per request)
if [ -d "$APP_DIR/Frontend" ]; then
    echo "🗑️ Removing Frontend directory to save space..."
    rm -rf "$APP_DIR/Frontend"
fi

# 3. Rebuild Go RAG Engine
echo "🏗️  Rebuilding Go RAG Engine..."
cd "$APP_DIR/rag-engine"
go build -o rag-server ./cmd/server
chmod +x rag-server

# 4. Update Node Backend
cd "$APP_DIR/backend"
pnpm install --prod

# 5. Restart Services
echo "🔄 Restarting all PM2 services..."
pm2 start ecosystem.config.js --env production --update-env

echo "✅ Update Complete!"
pm2 status

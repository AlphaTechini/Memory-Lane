#!/bin/bash

# Configuration
REPO_URL="https://github.com/AlphaTechini/Memory-Lane.git"
APP_DIR="/home/ec2-user/memory-lane"

echo "🚀 Starting Deployment on EC2 ($HOSTTYPE)..."

# 1. Update and Dependencies
sudo yum update -y
sudo yum install -y git golang

# Install Node.js 20 (Amazon Linux 2023 way)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# 2. Clone/Pull Code
if [ ! -d "$APP_DIR" ]; then
    echo "🌐 Cloning repository..."
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
else
    echo "📥 Pulling latest code..."
    cd $APP_DIR
    git pull origin main
fi

# 3. Setup Go RAG Engine
echo "🏗️  Building Go RAG Engine..."
cd "$APP_DIR/rag-engine"
go build -o rag-server ./cmd/server
chmod +x rag-server

# 4. Setup Node Backend
echo "🏗️  Setting up Node Backend..."
cd "$APP_DIR/backend"
npm install --production

# 5. Start with PM2
echo "🔄 Restarting Services..."
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment Successful!"
echo "Check status with: pm2 status"

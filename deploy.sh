#!/bin/bash

# Configuration
REPO_URL="https://github.com/AlphaTechini/Memory-Lane.git"
# Detect user (ubuntu for Ubuntu, ec2-user for Amazon Linux)
CURRENT_USER=$(whoami)
APP_DIR="/home/$CURRENT_USER/Memory-Lane"

echo "🚀 Starting Deployment on EC2 ($HOSTTYPE) as $CURRENT_USER..."

# 1. Update and Dependencies
if command -v apt-get &> /dev/null; then
    echo "📦 Using APT (Ubuntu/Debian)..."
    sudo apt-get update -y
    sudo apt-get install -y git golang-go
    
    # Install Node.js 20 for Ubuntu
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
elif command -v yum &> /dev/null; then
    echo "📦 Using YUM (Amazon Linux/RHEL)..."
    sudo yum update -y
    sudo yum install -y git golang
    
    # Install Node.js 20 for RHEL/AL
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js..."
        curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    fi
else
    echo "❌ Error: Unsupported package manager (need apt or yum)."
    exit 1
fi

# Install PM2 permanently (we recommend using npm/pnpm depending on availability)
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
    # Ensure pnpm is also installed globally
    sudo npm install -g pnpm
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
# Ensure we use native architecture (aarch64 handles this automatically with go build)
go build -o rag-server ./cmd/server
chmod +x rag-server

# 4. Setup Node Backend
echo "🏗️  Setting up Node Backend..."
cd "$APP_DIR/backend"
# Use pnpm as per project preference
pnpm install --prod

# 5. Start with PM2
echo "🔄 Restarting Services..."
cd $APP_DIR
# Use the config file in the root
pm2 start ecosystem.config.js --env production
pm2 save

echo "✅ Deployment Successful!"
echo "Check status with: pm2 status"

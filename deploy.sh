#!/bin/bash
# ==========================================================
# Orca Express Logistics Automatic Deployment Script for VPS
# Ubuntu 24.04 LTS
# ==========================================================

set -e

echo "🚀 Starting Orca Express Deployment Script..."

# Update System Packages
echo "📦 Updating Ubuntu package index..."
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Engine & Docker Compose..."
    sudo apt install -y docker.io docker-compose-v2 git curl certbot python3-certbot-nginx
    sudo systemctl enable --now docker
else
    echo "✅ Docker is already installed."
fi

# Prepare Environment File
if [ ! -f .env ]; then
    echo "⚙️ Creating .env configuration file from template..."
    cp .env.production.example .env
    echo "⚠️ Please update password in .env if needed."
fi

# Build and Start Containers
echo "🏗️ Building and starting Docker Compose containers..."
docker compose down || true
docker compose up -d --build

echo "=========================================================="
echo "✅ Orca Express Logistics is now running!"
echo "🌐 Local container access: http://localhost:3000"
echo "📊 Database status endpoint: http://localhost:3000/api/db/status"
echo "=========================================================="

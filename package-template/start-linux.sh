#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  🎮 RL MAZE TRAINER - STARTING"
echo "========================================"
echo ""

# Make this script executable
chmod +x start-linux.sh

echo "📋 IMPORTANT: This will open TWO terminal windows"
echo "  1. Python Training Server (WebSocket:8765)"
echo "  2. Game Server (HTTP:3000)"
echo "  3. Browser will open automatically"
echo ""
echo "⚠️  Keep BOTH terminals open during training!"
echo ""

# Check for Python
echo "🔍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found!"
    echo "📥 Please install Python 3.9+: sudo apt install python3 python3-pip"
    echo "📥 Then restart this launcher"
    read -p "Press any key to exit..."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1)
echo "✅ Found $PYTHON_VERSION"

# Check for Node.js
echo "🔍 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "📥 Please install Node.js: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "📥 Then restart this launcher"
    read -p "Press any key to exit..."
    exit 1
fi

NODE_VERSION=$(node --version 2>&1)
echo "✅ Found $NODE_VERSION"

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
cd training
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    read -p "Press any key to exit..."
    exit 1
fi
cd ..

# Install Node.js dependencies
echo "📦 Installing game dependencies..."
cd game
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install game dependencies"
    read -p "Press any key to exit..."
    exit 1
fi
cd ..

echo ""
echo "✅ All dependencies installed successfully!"
echo ""

# Start Python training server
echo "🤖 Starting Python Training Server..."
echo "📍 This will listen on WebSocket port 8765"
gnome-terminal -- bash -c "cd '$PWD/training' && echo 'Starting Python training server...' && python3 train_sphere_agent.py; exec bash"

# Wait for server to start
sleep 3

# Start game server
echo "🌐 Starting Game Server..."
echo "📍 This will serve game on http://localhost:3000"
gnome-terminal -- bash -c "cd '$PWD/game' && echo 'Starting game server...' && npm run dev; exec bash"

# Wait for game server to start
echo "⏳ Waiting for servers to start..."
sleep 8

# Open browser
echo "🚀 Opening game in browser..."
xdg-open http://localhost:3000

echo ""
echo "========================================"
echo "  ✅ SETUP COMPLETE!"
echo "========================================"
echo ""
echo "📍 Game URL: http://localhost:3000"
echo "📍 Training WebSocket: localhost:8765"
echo ""
echo "⚠️  IMPORTANT:"
echo "   • Keep BOTH terminal windows open"
echo "   • Training starts automatically when game loads"
echo "   • Models save to: training/models/"
echo "   • Close both terminals to stop training"
echo ""
echo "🎮 Happy training!"
read -p "Press any key to exit..."
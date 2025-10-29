@echo off
chcp 65001 >nul
title RL Maze Trainer Launcher
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   🎮 RL MAZE TRAINER - STARTING
echo ========================================
echo.

echo 📋 IMPORTANT: This will open TWO separate windows
echo   1. Python Training Server (WebSocket:8765)
echo   2. Game Server (HTTP:3000) 
echo   3. Browser will open automatically
echo.
echo ⚠️  Keep BOTH windows open during training!
echo.

:: Check for Python
echo 🔍 Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found!
    echo 📥 Please install Python 3.9+ from: https://python.org
    echo 📥 Then restart this launcher
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ Found !PYTHON_VERSION!

:: Check for Node.js
echo 🔍 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo 📥 Please install Node.js from: https://nodejs.org
    echo 📥 Then restart this launcher
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version 2^>^&1') do set NODE_VERSION=%%i
echo ✅ Found !NODE_VERSION!

:: Install Python dependencies
echo.
echo 📦 Installing Python dependencies...
cd training
call python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install Python dependencies
    pause
    exit /b 1
)
cd ..

:: Install Node.js dependencies
echo 📦 Installing game dependencies...
cd game
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install game dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ✅ All dependencies installed successfully!
echo.

:: Start Python training server in NEW window that stays open
echo 🤖 Starting Python Training Server...
echo 📍 This will listen on WebSocket port 8765
start "RL Maze Trainer - Python Server" cmd /k "cd /d %~dp0training && echo [PYTHON SERVER] Starting training server on port 8765... && echo [PYTHON SERVER] Waiting for game connection... && python train_maze_solver.py && echo [PYTHON SERVER] Training completed or stopped. && pause"

:: Wait for Python server to start
echo ⏳ Waiting for Python server to start...
timeout /t 5 /nobreak >nul

:: Start game server in NEW window that stays open  
echo 🌐 Starting Game Server...
echo 📍 This will serve game on http://localhost:3000
start "RL Maze Trainer - Game Server" cmd /k "cd /d %~dp0game && echo [GAME SERVER] Starting development server... && npm run dev"

:: Wait for game server to start
echo ⏳ Waiting for game server to start...
timeout /t 10 /nobreak >nul

:: Open browser
echo 🚀 Opening game in browser...
start http://localhost:3000

echo.
echo ========================================
echo   ✅ LAUNCHER COMPLETE!
echo ========================================
echo.
echo 📍 Game URL: http://localhost:3000
echo 📍 Training WebSocket: localhost:8765
echo.
echo ⚠️  IMPORTANT:
echo    • TWO new windows should have opened
echo    • Python Server: Training brain (port 8765)
echo    • Game Server: 3D visualization (port 3000) 
echo    • Keep BOTH windows open during training
echo    • Training starts when browser game loads
echo    • Models save to: training\models\
echo.
echo 🎮 Check the new windows for server status!
echo 📝 Close this window when done - it's safe to close now.
pause
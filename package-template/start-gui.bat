@echo off
chcp 65001 >nul
title RL Maze Trainer - GUI Launcher

echo.
echo ========================================
echo   RL MAZE TRAINER - GUI LAUNCHER
echo ========================================
echo.

echo This will start the graphical control panel
echo   - No separate command windows
echo   - All logs visible in the GUI
echo   - Easy start/stop controls
echo.

:: Check for Python
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.9+ from: https://python.org
    pause
    exit /b 1
)

:: Install tkinter if needed
echo Checking for GUI dependencies...
python -c "import tkinter" 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Tkinter not available!
    echo Tkinter usually comes with Python installation
    echo Try reinstalling Python and make sure 'tcl/tk' is included
    pause
    exit /b 1
)

:: Install other Python dependencies
echo Installing Python dependencies for GUI...
cd training
call python -m pip install -r requirements.txt
cd ..

:: Install Node.js dependencies  
echo Installing game dependencies...
cd game
call npm install
cd ..

echo.
echo Starting GUI application...
python rl-maze-trainer-gui.py

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start GUI
    echo Make sure you're in the correct directory
    echo The 'training' and 'game' folders should be here
)

echo.
echo GUI closed. Training stopped.
pause
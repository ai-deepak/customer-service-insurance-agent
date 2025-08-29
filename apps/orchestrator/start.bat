@echo off
REM Startup script for the Insurance Orchestrator (Windows)

echo 🚀 Starting Insurance Orchestrator...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8+ first.
    pause
    exit /b 1
)

REM Check if requirements.txt exists
if not exist "requirements.txt" (
    echo ❌ requirements.txt not found. Please run: pip install -r requirements.txt
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Creating from example...
    if exist "env.example" (
        copy env.example .env
        echo 📝 Please edit .env file with your configuration before starting.
        echo    Required: OPENAI_API_KEY, NEST_API_URL
        pause
        exit /b 1
    ) else (
        echo ❌ env.example not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

echo ✅ Environment file found
echo 🔑 Please ensure OPENAI_API_KEY and NEST_API_URL are set in .env file
echo 🌐 API URL should point to your NestJS backend (e.g., http://localhost:3000)
echo ""

REM Install requirements if needed
echo 📦 Installing/updating Python dependencies...
pip install -r requirements.txt

REM Start the orchestrator
echo 🚀 Starting orchestrator...
python main.py

pause

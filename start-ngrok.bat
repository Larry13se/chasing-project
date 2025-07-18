@echo off
title Starting Ngrok Tunnel for Orchestration Gateway
color 0A

echo.
echo 🚀 Starting Ngrok Tunnel for Orchestration Gateway Server...
echo.

REM Check if Orchestration server is running
echo 🔍 Checking Orchestration server health...
curl -s http://localhost:3003/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Orchestration server is not running on port 3003
    echo.
    echo Please start the orchestration server first:
    echo npm start
    echo.
    pause
    exit /b 1
)

echo ✅ Orchestration server is healthy
echo.

REM Start ngrok with single tunnel
echo 🌐 Starting ngrok tunnel...
echo.

ngrok start orchestration

echo.
echo 🎯 Ngrok tunnel started!
echo 📋 Copy the HTTPS URL from above and update your Google Script:
echo.
echo var ORCHESTRATION_SERVER_URL = "https://xxxx-orchestration.ngrok-free.app";
echo.

pause 
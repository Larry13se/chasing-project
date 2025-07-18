@echo off
echo ========================================
echo   🚀 STARTING CONTINUOUS AUTOMATION SYSTEM
echo ========================================
echo.

echo 🔄 Starting all servers for continuous lead processing...
echo.

echo 📝 Starting Form Submission Server (Port 5000)...
start "Form Server" cmd /k "cd FormSubmission && python form-server.py"
timeout /t 3 >nul

echo 👨‍⚕️ Starting Doctor Fetching Server (Port 3002)...
start "Doctor Server" cmd /k "cd MedicareAutomation && node doctor-fetching-server.js"
timeout /t 3 >nul

echo 🏥 Starting Medicare Server (Port 3001)...
start "Medicare Server" cmd /k "cd MedicareAutomation && node medicare-server.js"
timeout /t 3 >nul

echo 🎯 Starting Orchestration Gateway Server (Port 3003)...
start "Orchestration Server" cmd /k "node orchestration-server.js"
timeout /t 5 >nul

echo.
echo ⏳ Waiting for all servers to initialize...
timeout /t 10 >nul

echo.
echo 🔍 Checking server status...
curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Form Server (Port 5000): Running
) else (
    echo ❌ Form Server (Port 5000): Not responding
)

curl -s http://localhost:3002/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Doctor Server (Port 3002): Running
) else (
    echo ❌ Doctor Server (Port 3002): Not responding
)

curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Medicare Server (Port 3001): Running
) else (
    echo ❌ Medicare Server (Port 3001): Not responding
)

curl -s http://localhost:3003/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Orchestration Server (Port 3003): Running
) else (
    echo ❌ Orchestration Server (Port 3003): Not responding
)

echo.
echo ========================================
echo   🎉 CONTINUOUS SYSTEM STARTED
echo ========================================
echo.
echo 📊 System Status:
echo    🎯 Orchestration Gateway: http://localhost:3003/health
echo    🔄 Queue Status: http://localhost:3003/queue/status
echo    📝 Form Server: http://localhost:5000/health
echo    👨‍⚕️ Doctor Server: http://localhost:3002/health
echo    🏥 Medicare Server: http://localhost:3001/health
echo.
echo 🔄 The system is now running continuously and will:
echo    ✅ Listen for Medicare account completions
echo    ✅ Automatically add leads to processing queue
echo    ✅ Process leads when 2 conditions are met
echo    ✅ Run doctor fetching automatically
echo    ✅ Submit forms automatically
echo.
echo 📝 To add a lead manually: POST to http://localhost:3003/queue/add-lead
echo 🛑 To stop all servers: Run stop-servers-safe.bat
echo.
pause 
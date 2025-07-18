@echo off
echo 🎯 Starting Updated Automation Servers...
echo.

echo 🔄 Killing any existing Node.js processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
echo ✅ Processes cleaned up
echo.

echo 📝 Starting Form Submission Server (Port 5000)...
start "Form Server" cmd /k "cd FormSubmission && python form-server.py"
timeout /t 3 /nobreak >nul

echo 👨‍⚕️ Starting Doctor Fetching Server (Port 3002)...
start "Doctor Server" cmd /k "cd MedicareAutomation && node doctor-fetching-server.js"
timeout /t 3 /nobreak >nul

echo 🎯 Starting Orchestration Server (Port 3003)...
start "Orchestration Server" cmd /k "node orchestration-server.js"
timeout /t 3 /nobreak >nul

echo.
echo 🎉 All Updated Servers Started!
echo.
echo ✅ Form Server (with queue): http://localhost:5000/health
echo ✅ Doctor Server (no form submission): http://localhost:3002/health  
echo ✅ Orchestration Server (auto form trigger): http://localhost:3003/health
echo.
echo 📋 Queue Status: http://localhost:5000/queue-status
echo.
echo 🔄 New Workflow:
echo   1. Doctor fetching saves ONLY to BZ-CH columns (not CLOSER NAME)
echo   2. Doctor server notifies orchestration when complete
echo   3. Orchestration automatically triggers form submission
echo   4. Form server processes with queue and fills blanks with "..."
echo.
pause 
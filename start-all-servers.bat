@echo off
echo 🚀 Starting All Automation Servers...
echo.

echo 📦 Checking dependencies...
if not exist "node_modules" (
    echo Installing root dependencies...
    npm install
    echo.
)

if not exist "MedicareAutomation\node_modules" (
    echo Installing MedicareAutomation dependencies...
    cd MedicareAutomation
    npm install
    cd ..
    echo.
)

if not exist "FormSubmission\venv" (
    echo Setting up Python virtual environment...
    cd FormSubmission
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
    echo.
)

echo 🏥 Starting Medicare Account Creation Server (Port 3001)...
start "Medicare Server" cmd /k "cd MedicareAutomation && npm run server"

echo Waiting 5 seconds for Medicare server to start...
timeout /t 5 /nobreak >nul

echo 👨‍⚕️ Starting Doctor Fetching Server (Port 3002)...
start "Doctor Server" cmd /k "cd MedicareAutomation && node doctor-fetching-server.js"

echo Waiting 3 seconds for Doctor server to start...
timeout /t 3 /nobreak >nul

echo 📝 Starting Form Submission Server (Port 5000)...
start "Form Server" cmd /k "cd FormSubmission && python form-server.py"

echo Waiting 3 seconds for Form server to start...
timeout /t 3 /nobreak >nul

echo 🎯 Starting Orchestration Server (Port 3003) [Optional]...
start "Orchestration Server" cmd /k "node orchestration-server.js"

echo.
echo ✅ All servers started!
echo.
echo 🏥 Medicare Account Creation: http://localhost:3001/health
echo 👨‍⚕️ Doctor Fetching: http://localhost:3002/health
echo 📝 Form Submission: http://localhost:5000/health
echo 🎯 Orchestration: http://localhost:3003/health
echo.
echo 📋 Google Sheets trigger will automatically orchestrate the 3-step workflow.
echo The Orchestration Server is optional and provides additional monitoring.
echo.
echo Press any key to exit...
pause >nul 
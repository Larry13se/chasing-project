@echo off
echo ========================================
echo   🛑 STOPPING ALL AUTOMATION SERVERS
echo ========================================
echo.

echo 🔍 Checking active servers...
netstat -ano | findstr ":3001 :3002 :3003 :5000"
echo.

echo 🛑 Stopping servers on ports 3001, 3002, 3003, 5000...
echo.

REM Stop processes on port 3001 (Medicare Server)
echo 🏥 Stopping Medicare Server (Port 3001)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    if not "%%a"=="0" (
        echo Killing process %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Stop processes on port 3002 (Doctor Fetching Server)
echo 👨‍⚕️ Stopping Doctor Fetching Server (Port 3002)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do (
    if not "%%a"=="0" (
        echo Killing process %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Stop processes on port 3003 (Orchestration Server)
echo 🎯 Stopping Orchestration Server (Port 3003)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003"') do (
    if not "%%a"=="0" (
        echo Killing process %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Stop processes on port 5000 (Form Submission Server)
echo 📝 Stopping Form Submission Server (Port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
    if not "%%a"=="0" (
        echo Killing process %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo ⏳ Waiting 2 seconds for processes to close...
timeout /t 2 >nul

echo.
echo 🔍 Checking if any servers are still running...
netstat -ano | findstr ":3001 :3002 :3003 :5000"

if %errorlevel% equ 0 (
    echo ⚠️  Some servers may still be running
) else (
    echo ✅ All servers stopped successfully!
)

echo.
echo 🔄 Additional cleanup - Killing any remaining Node.js and Python processes...

REM Kill any remaining node processes (be careful - this kills ALL node processes)
echo 🟨 Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

REM Kill any remaining python processes that might be form servers
echo 🐍 Stopping Python form server processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq*form-server*" >nul 2>&1

echo.
echo ========================================
echo   ✅ SERVER SHUTDOWN COMPLETE
echo ========================================
echo.
echo 📊 Final port check:
netstat -ano | findstr ":3001 :3002 :3003 :5000"
if %errorlevel% neq 0 (
    echo 🎉 All automation server ports are now free!
) else (
    echo ⚠️  Some ports may still be in use
)

echo.
pause 
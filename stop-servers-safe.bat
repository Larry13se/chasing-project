@echo off
echo ========================================
echo   🛑 STOPPING AUTOMATION SERVERS (SAFE)
echo ========================================
echo.

echo 🔍 Checking active servers...
netstat -ano | findstr ":3001 :3002 :3003 :5000"
echo.

echo 🛑 Stopping servers by port (safe method)...
echo.

REM Stop processes on port 3001 (Medicare Server)
echo 🏥 Stopping Medicare Server (Port 3001)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo   Killing process %%a on port 3001
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Successfully stopped process %%a
        ) else (
            echo   ❌ Failed to stop process %%a
        )
    )
)

REM Stop processes on port 3002 (Doctor Fetching Server)
echo 👨‍⚕️ Stopping Doctor Fetching Server (Port 3002)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo   Killing process %%a on port 3002
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Successfully stopped process %%a
        ) else (
            echo   ❌ Failed to stop process %%a
        )
    )
)

REM Stop processes on port 3003 (Orchestration Server)
echo 🎯 Stopping Orchestration Server (Port 3003)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo   Killing process %%a on port 3003
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Successfully stopped process %%a
        ) else (
            echo   ❌ Failed to stop process %%a
        )
    )
)

REM Stop processes on port 5000 (Form Submission Server)
echo 📝 Stopping Form Submission Server (Port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        echo   Killing process %%a on port 5000
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! equ 0 (
            echo   ✅ Successfully stopped process %%a
        ) else (
            echo   ❌ Failed to stop process %%a
        )
    )
)

echo.
echo ⏳ Waiting 3 seconds for processes to fully close...
timeout /t 3 >nul

echo.
echo 🔍 Final verification - checking if servers are still running...
set "servers_running="
for /f %%a in ('netstat -ano ^| findstr ":3001 :3002 :3003 :5000" ^| findstr "LISTENING" ^| find /c /v ""') do set servers_running=%%a

if "%servers_running%"=="0" (
    echo ✅ All automation servers stopped successfully!
    echo 🎉 Ports 3001, 3002, 3003, and 5000 are now free
) else (
    echo ⚠️  Some servers may still be running:
    netstat -ano | findstr ":3001 :3002 :3003 :5000" | findstr "LISTENING"
)

echo.
echo ========================================
echo   ✅ SAFE SHUTDOWN COMPLETE
echo ========================================
echo.
pause 
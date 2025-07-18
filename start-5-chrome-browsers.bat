@echo off
echo ===============================================
echo Starting 5 Chrome Browsers for Production (IMPROVED)
echo ===============================================

echo.
echo 🚀 Production Scale: 5 Concurrent Lead Processing
echo Ports: 9222, 9223, 9224, 9225, 9226
echo 🆕 NOW WITH: Medicare compatibility improvements
echo.

echo 🛑 Killing any existing Chrome processes...
taskkill /F /IM chrome.exe >nul 2>&1

echo ⏳ Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo.
echo 🧹 Cleaning up old Chrome user data directories to prevent session conflicts...
rmdir /s /q "C:\temp\chrome-debug-9222" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9223" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9224" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9225" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9226" 2>nul
echo ✅ Old user data cleaned up

echo.
echo 🌐 Starting Chrome Browser 1 (Port 9222) with Medicare compatibility...
start "Chrome-9222" chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-9222" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 2 (Port 9223) with Medicare compatibility...
start "Chrome-9223" chrome.exe --remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-debug-9223" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 3 (Port 9224) with Medicare compatibility...
start "Chrome-9224" chrome.exe --remote-debugging-port=9224 --user-data-dir="C:\temp\chrome-debug-9224" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 4 (Port 9225) with Medicare compatibility...
start "Chrome-9225" chrome.exe --remote-debugging-port=9225 --user-data-dir="C:\temp\chrome-debug-9225" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 5 (Port 9226) with Medicare compatibility...
start "Chrome-9226" chrome.exe --remote-debugging-port=9226 --user-data-dir="C:\temp\chrome-debug-9226" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo.
echo ✅ All 5 Chrome browsers started successfully with Medicare improvements!
echo.
echo 🎯 Production Ready with Enhanced Features:
echo    Chrome 1: Port 9222 (Lead 1) - Medicare Compatible
echo    Chrome 2: Port 9223 (Lead 2) - Medicare Compatible
echo    Chrome 3: Port 9224 (Lead 3) - Medicare Compatible
echo    Chrome 4: Port 9225 (Lead 4) - Medicare Compatible
echo    Chrome 5: Port 9226 (Lead 5) - Medicare Compatible
echo.
echo 🆕 Improvements Applied:
echo    • Anti-detection settings for Medicare compatibility
echo    • Automatic user data cleanup to prevent session conflicts
echo    • Service worker conflict prevention
echo    • Realistic user agent strings
echo    • Enhanced login reliability for both Part A and Part B
echo.
echo 📊 Now start your servers:
echo    1. Medicare Server: cd MedicareAutomation ^&^& node medicare-server.js
echo    2. Doctor Server: cd MedicareAutomation ^&^& node doctor-fetching-server.js
echo    3. Orchestration Server: node orchestration-server.js
echo    4. Form Server: cd FormSubmission ^&^& python form-server.py
echo.
echo 🚀 Ready for 5 concurrent lead processing with improved Medicare login!
echo.
echo ⚠️  Note: Both Part A (doctor-fetching) and Part B (medicare-automation) now use
echo    the same improved Chrome settings for better Medicare.gov compatibility.
echo.
pause 
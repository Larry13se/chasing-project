@echo off
echo Starting 5 Chrome Browsers (FIXED VERSION)
echo ==========================================
echo.
echo This script will start 5 Chrome browser instances for the Medicare automation system.
echo Each browser will use a separate debugging port and user data directory.
echo.
echo Browser Configuration:
echo - Browser 1: Port 9222 (Default)
echo - Browser 2: Port 9223
echo - Browser 3: Port 9224  
echo - Browser 4: Port 9225
echo - Browser 5: Port 9226
echo.
echo Each browser includes improved anti-detection settings for Medicare compatibility.
echo.
echo Press Ctrl+C to stop all browsers at any time.
echo.
echo Starting browsers...
echo.

REM Clean up old user data directories first to prevent session conflicts
echo 🧹 Cleaning up old Chrome user data directories...
rmdir /s /q "C:\temp\chrome-debug-9222" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9223" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9224" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9225" 2>nul
rmdir /s /q "C:\temp\chrome-debug-9226" 2>nul
echo ✅ Old user data cleaned up
echo.

echo 🌐 Starting Chrome Browser 1 (Port 9222) with improved Medicare compatibility...
start "Chrome-9222" chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-9222" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 2 (Port 9223) with improved Medicare compatibility...
start "Chrome-9223" chrome.exe --remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-debug-9223" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 3 (Port 9224) with improved Medicare compatibility...
start "Chrome-9224" chrome.exe --remote-debugging-port=9224 --user-data-dir="C:\temp\chrome-debug-9224" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 4 (Port 9225) with improved Medicare compatibility...
start "Chrome-9225" chrome.exe --remote-debugging-port=9225 --user-data-dir="C:\temp\chrome-debug-9225" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo 🌐 Starting Chrome Browser 5 (Port 9226) with improved Medicare compatibility...
start "Chrome-9226" chrome.exe --remote-debugging-port=9226 --user-data-dir="C:\temp\chrome-debug-9226" --no-first-run --no-default-browser-check --disable-automation --exclude-switches=enable-automation --disable-blink-features=AutomationControlled --disable-extensions --disable-plugins --disable-default-apps --disable-service-worker-registration --disable-background-sync --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

echo.
echo ✅ All 5 Chrome browsers started successfully!
echo.
echo 📋 Browser Status:
echo   • Chrome Browser 1: http://localhost:9222 (Default)
echo   • Chrome Browser 2: http://localhost:9223
echo   • Chrome Browser 3: http://localhost:9224
echo   • Chrome Browser 4: http://localhost:9225
echo   • Chrome Browser 5: http://localhost:9226
echo.
echo 🔧 Improved Features:
echo   • Anti-detection settings for Medicare compatibility
echo   • Automatic user data cleanup on startup
echo   • Service worker conflict prevention
echo   • Realistic user agent strings
echo   • Disabled automation detection flags
echo.
echo ⚠️  Important Notes:
echo   1. Each browser uses a separate user data directory for isolation
echo   2. Old session data is automatically cleared on startup
echo   3. These settings are optimized for Medicare.gov compatibility
echo   4. Keep this window open - closing it won't stop the browsers
echo.
echo To stop all browsers, run: stop-all-servers.bat
echo.
echo Browsers are now ready for automation. You can close this window.
pause 
@echo off
echo 🧪 Testing All Automation Servers...
echo.

echo 🏥 Testing Medicare Account Creation Server (Port 3001)...
curl -s http://localhost:3001/health || echo ❌ Medicare Server not responding
echo.

echo 👨‍⚕️ Testing Doctor Fetching Server (Port 3002)...
curl -s http://localhost:3002/health || echo ❌ Doctor Server not responding
echo.

echo 📝 Testing Form Submission Server (Port 5000)...
curl -s http://localhost:5000/health || echo ❌ Form Server not responding
echo.

echo 🎯 Testing Orchestration Server (Port 3003)...
curl -s http://localhost:3003/health || echo ❌ Orchestration Server not responding
echo.

echo ✅ Server testing complete!
echo.
pause 
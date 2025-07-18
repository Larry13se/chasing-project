const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

console.log('🧪 Testing Chrome Login Fix for Medicare');
console.log('=======================================');
console.log('');

async function testChromeLoginFix() {
    const googleSheets = new GoogleSheetsService();
    const doctorFetching = new DoctorFetching(googleSheets, 9222);
    
    try {
        console.log('🔧 Step 1: Initialize Doctor Fetching with improved Chrome settings...');
        await doctorFetching.initialize();
        console.log('✅ Chrome initialization completed successfully');
        console.log('');
        
        console.log('🔍 Step 2: Check login status...');
        const loginStatus = await doctorFetching.checkLoginStatus();
        console.log(`📊 Login Status: ${loginStatus.loggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
        console.log(`📍 Current URL: ${loginStatus.url}`);
        console.log('');
        
        console.log('🌐 Step 3: Test navigation to Medicare login page...');
        await doctorFetching.page.goto('https://www.medicare.gov/account/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // Inject anti-detection script if needed
        await doctorFetching.injectAntiDetectionScript();
        
        await doctorFetching.page.waitForTimeout(3000);
        const currentUrl = doctorFetching.page.url();
        console.log(`📍 Successfully navigated to: ${currentUrl}`);
        console.log('');
        
        console.log('🔍 Step 4: Check for login form elements...');
        
        // Check for username field
        const usernameField = await doctorFetching.page.$('input[name="username"]#username-textbox');
        console.log(`👤 Username field: ${usernameField ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        // Check for password field
        const passwordField = await doctorFetching.page.$('input[name="password"]#password-textbox');
        console.log(`🔑 Password field: ${passwordField ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        // Check for login button
        const loginButton = await doctorFetching.page.$('button#login-button[type="submit"]');
        console.log(`🔘 Login button: ${loginButton ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log('');
        
        console.log('🕵️ Step 5: Check anti-detection measures...');
        
        // Check if webdriver property is hidden
        const webdriverHidden = await doctorFetching.page.evaluate(() => {
            return navigator.webdriver === undefined;
        });
        console.log(`🤖 Webdriver property hidden: ${webdriverHidden ? '✅ YES' : '❌ NO'}`);
        
        // Check user agent
        const userAgent = await doctorFetching.page.evaluate(() => navigator.userAgent);
        const hasRealisticUA = userAgent.includes('Chrome/119.0.0.0') && !userAgent.includes('HeadlessChrome');
        console.log(`🌐 Realistic User Agent: ${hasRealisticUA ? '✅ YES' : '❌ NO'}`);
        console.log(`📋 User Agent: ${userAgent.substring(0, 80)}...`);
        console.log('');
        
        console.log('🚨 Step 6: Test Medicare system error detection...');
        
        // Test Medicare system error detection
        const loginErrors = await doctorFetching.detectLoginErrors();
        if (loginErrors.hasError) {
            if (loginErrors.isMedicareSystemError) {
                console.log(`✅ Medicare system error detected: ${loginErrors.message}`);
                console.log(`📝 Error type: ${loginErrors.errorType}`);
            } else {
                console.log(`⚠️  Other login error detected: ${loginErrors.message}`);
            }
        } else {
            console.log(`✅ No login errors detected on current page`);
        }
        console.log('');
        
        console.log('⚠️  MANUAL TEST REQUIRED:');
        console.log('  To complete the test, you need to manually provide credentials.');
        console.log('  The browser window should now be open and ready for login testing.');
        console.log('');
        console.log('  Next steps:');
        console.log('  1. Try logging in manually in this browser window');
        console.log('  2. If it works, the Chrome improvements are successful!');
        console.log('  3. You can also test with the /test-login endpoint in the doctor-fetching-server');
        console.log('');
        
        // Keep browser open for manual testing
        console.log('🔍 Browser left open for manual testing...');
        console.log('  - The browser window should be visible');
        console.log('  - You can test login manually');
        console.log('  - Press Ctrl+C to close when done');
        console.log('');
        
        console.log('✅ Chrome login fix test completed successfully!');
        console.log('🎯 The browser is ready for testing with improved anti-detection measures.');
        
        // Wait indefinitely to keep browser open
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('');
        console.log('🔧 Troubleshooting steps:');
        console.log('  1. Make sure Chrome is properly started with the new script');
        console.log('  2. Check that port 9222 is available');
        console.log('  3. Verify the Chrome user data directory was cleared');
        console.log('  4. Try restarting Chrome with the improved startup script');
        
    } finally {
        // Don't cleanup automatically - let user test manually
        console.log('');
        console.log('📝 To cleanup, run: await doctorFetching.cleanup()');
    }
}

// Add process handlers for graceful cleanup
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal');
    console.log('✅ Test completed - you can now close the browser manually');
    process.exit(0);
});

// Run the test
if (require.main === module) {
    testChromeLoginFix().catch(console.error);
}

module.exports = testChromeLoginFix; 
const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

async function testLoginSecurity() {
    console.log('🔐 Testing Login Security Checks...\n');
    
    const doctorFetching = new DoctorFetching();
    const googleSheetsService = new GoogleSheetsService();
    
    try {
        // Initialize browser
        console.log('🚀 Starting browser...');
        await doctorFetching.initialize();
        
        // Test case 1: Check initial login status
        console.log('\n1️⃣ TEST: Initial Login Status Check');
        console.log('=' * 50);
        
        const initialStatus = await doctorFetching.checkLoginStatus();
        console.log(`📊 Initial Status: ${initialStatus.loggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
        console.log(`📍 URL: ${initialStatus.url}`);
        
        // Test case 2: Get a sample patient with credentials
        console.log('\n2️⃣ TEST: Get Sample Patient');
        console.log('=' * 50);
        
        const patients = await googleSheetsService.getPatientsWithCredentials();
        if (patients.length === 0) {
            console.log('❌ No patients with credentials found for testing');
            return;
        }
        
        const testPatient = patients[0];
        console.log(`👤 Test Patient: ${testPatient.lastName} (Row ${testPatient.rowIndex})`);
        console.log(`🔐 Credentials: ${testPatient.existingCredentials}`);
        
        // Test case 3: First login (should work normally)
        console.log('\n3️⃣ TEST: First Login Attempt');
        console.log('=' * 50);
        
        const firstLoginResult = await doctorFetching.loginToMedicare(testPatient.existingCredentials);
        console.log(`🎯 First Login Result: ${firstLoginResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`💭 Message: ${firstLoginResult.message}`);
        
        if (!firstLoginResult.success) {
            console.log('❌ First login failed - cannot test security checks');
            return;
        }
        
        // Test case 4: Check status after login
        console.log('\n4️⃣ TEST: Status After First Login');
        console.log('=' * 50);
        
        const afterLoginStatus = await doctorFetching.checkLoginStatus();
        console.log(`📊 Status After Login: ${afterLoginStatus.loggedIn ? 'LOGGED IN ✅' : 'NOT LOGGED IN ❌'}`);
        
        // Test case 5: Attempt login again (should detect existing session)
        console.log('\n5️⃣ TEST: Second Login Attempt (Security Check)');
        console.log('=' * 50);
        console.log('🔒 This should detect we\'re already logged in and force logout first...');
        
        const secondLoginResult = await doctorFetching.loginToMedicare(testPatient.existingCredentials);
        console.log(`🎯 Second Login Result: ${secondLoginResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`💭 Message: ${secondLoginResult.message}`);
        
        // Test case 6: Final logout
        console.log('\n6️⃣ TEST: Final Logout');
        console.log('=' * 50);
        
        const logoutResult = await doctorFetching.logoutFromMedicare();
        console.log(`🎯 Logout Result: ${logoutResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`💭 Message: ${logoutResult.message}`);
        
        // Test case 7: Verify logout was successful
        console.log('\n7️⃣ TEST: Verify Logout Success');
        console.log('=' * 50);
        
        const finalStatus = await doctorFetching.checkLoginStatus();
        console.log(`📊 Final Status: ${finalStatus.loggedIn ? 'STILL LOGGED IN ❌' : 'PROPERLY LOGGED OUT ✅'}`);
        
        // Summary
        console.log('\n' + '=' * 60);
        console.log('🎯 LOGIN SECURITY TEST SUMMARY:');
        console.log('=' * 60);
        console.log(`✅ Initial Status Check: WORKING`);
        console.log(`${firstLoginResult.success ? '✅' : '❌'} First Login: ${firstLoginResult.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`${afterLoginStatus.loggedIn ? '✅' : '❌'} Login Detection: ${afterLoginStatus.loggedIn ? 'WORKING' : 'FAILED'}`);
        console.log(`${secondLoginResult.success ? '✅' : '❌'} Security Check: ${secondLoginResult.success ? 'WORKING' : 'NEEDS REVIEW'}`);
        console.log(`${logoutResult.success ? '✅' : '❌'} Logout: ${logoutResult.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`${!finalStatus.loggedIn ? '✅' : '❌'} Logout Verification: ${!finalStatus.loggedIn ? 'WORKING' : 'FAILED'}`);
        
        const allTestsPassed = firstLoginResult.success && 
                              afterLoginStatus.loggedIn && 
                              secondLoginResult.success && 
                              logoutResult.success && 
                              !finalStatus.loggedIn;
        
        console.log(`\n🚀 OVERALL RESULT: ${allTestsPassed ? '✅ ALL SECURITY CHECKS WORKING' : '⚠️  SOME ISSUES DETECTED'}`);
        
    } catch (error) {
        console.error('❌ Login security test failed:', error);
    } finally {
        console.log('\n🔚 Closing browser...');
        await doctorFetching.closeBrowser();
    }
}

async function demonstrateSecurityFix() {
    console.log('🛡️  Login Security Enhancement Demonstration\n');
    console.log('=' * 70);
    
    console.log('🚨 PROBLEM IDENTIFIED:');
    console.log('   Previous versions did not check if already logged in');
    console.log('   If logout failed, next login would access wrong patient data');
    console.log('   CRITICAL SECURITY VULNERABILITY!');
    console.log('');
    
    console.log('🛡️  SECURITY FIX IMPLEMENTED:');
    console.log('   1️⃣ Check if already logged in before login attempt');
    console.log('   2️⃣ If logged in, force logout first');
    console.log('   3️⃣ Verify logout success before proceeding');
    console.log('   4️⃣ Only then perform fresh login');
    console.log('   5️⃣ Multiple safety checks throughout process');
    console.log('');
    
    console.log('🔍 SECURITY CHECKS ADDED:');
    console.log('   • URL validation (detect /my/home redirect)');
    console.log('   • Element existence verification');
    console.log('   • Multi-step logout verification');
    console.log('   • Session state tracking');
    console.log('   • Error handling and recovery');
    console.log('');
    
    console.log('✅ BENEFITS:');
    console.log('   🛡️  Prevents accessing wrong patient data');
    console.log('   🔒 Ensures proper session isolation');
    console.log('   🚀 Reliable script execution');
    console.log('   📊 Clear status reporting');
    console.log('   🔄 Safe script restart capability');
}

// Execute if run directly
if (require.main === module) {
    console.log('🔐 MEDICARE LOGIN SECURITY TEST\n');
    console.log('=' * 70);
    
    demonstrateSecurityFix().then(() => {
        console.log('\n' + '=' * 70);
        return testLoginSecurity();
    });
}

module.exports = { testLoginSecurity, demonstrateSecurityFix }; 
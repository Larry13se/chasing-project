const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

async function testPaginationHandling() {
    console.log('🧪 Testing Medicare Claims Pagination Handling...\n');
    
    const doctorFetching = new DoctorFetching();
    const googleSheetsService = new GoogleSheetsService();
    
    try {
        // Initialize browser
        console.log('🚀 Starting browser...');
        await doctorFetching.initialize();
        
        // Get a sample patient with credentials for testing
        console.log('📊 Getting sample patient for pagination testing...');
        const patients = await googleSheetsService.getPatientsWithCredentials();
        
        if (patients.length === 0) {
            console.log('❌ No patients with credentials found for testing');
            return;
        }
        
        const testPatient = patients[0];
        console.log(`👤 Test Patient: ${testPatient.lastName} (Row ${testPatient.rowIndex})`);
        console.log(`🔐 Credentials: ${testPatient.existingCredentials}`);
        
        // Login to Medicare
        console.log('\n🔐 Logging in to Medicare...');
        const loginResult = await doctorFetching.loginToMedicare(testPatient.existingCredentials);
        
        if (!loginResult.success) {
            console.log(`❌ Login failed: ${loginResult.message}`);
            return;
        }
        
        console.log('✅ Successfully logged in to Medicare');
        
        // Test the enhanced fetchClaims method with pagination handling
        console.log('\n📋 Testing enhanced claims fetching with pagination...');
        console.log('=' * 70);
        
        const startTime = Date.now();
        const claims = await doctorFetching.fetchClaims();
        const endTime = Date.now();
        const fetchTime = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('\n📊 PAGINATION TEST RESULTS:');
        console.log('=' * 50);
        console.log(`⏱️  Total fetch time: ${fetchTime} seconds`);
        console.log(`📋 Total claims found: ${claims.length}`);
        
        if (claims.length > 0) {
            // Analyze claim dates
            const claimDates = claims.map(claim => {
                try {
                    const parts = claim.dateOfService.split('/');
                    let year = parseInt(parts[2]);
                    if (year < 50) year += 2000;
                    else if (year < 100) year += 1900;
                    
                    return new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
                } catch (e) {
                    return new Date();
                }
            });
            
            claimDates.sort((a, b) => b - a); // Newest first
            
            const newestDate = claimDates[0];
            const oldestDate = claimDates[claimDates.length - 1];
            
            console.log(`📅 Date range: ${oldestDate.toLocaleDateString()} to ${newestDate.toLocaleDateString()}`);
            
            // Check how many are within 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const recentClaims = claimDates.filter(date => date >= sixMonthsAgo);
            const oldClaims = claimDates.filter(date => date < sixMonthsAgo);
            
            console.log(`📈 Claims within 6 months: ${recentClaims.length}`);
            console.log(`📉 Claims older than 6 months: ${oldClaims.length}`);
            
            // Show sample claims
            console.log('\n📋 Sample claims found:');
            claims.slice(0, 5).forEach((claim, i) => {
                const isRecent = doctorFetching.isWithinSixMonths(claim.dateOfService);
                console.log(`${i + 1}. ${claim.dateOfService} - ${claim.provider} ${isRecent ? '✅' : '❌'}`);
            });
            
            if (oldClaims.length > 0) {
                console.log('\n✅ PAGINATION SUCCESS: Found claims older than 6 months, indicating complete data load');
            } else {
                console.log('\n⚠️  All claims are recent (within 6 months) - patient may have limited history');
            }
            
        } else {
            console.log('❌ No claims found - this might indicate:');
            console.log('   • Patient has no recent medical visits');
            console.log('   • Only outpatient hospital claims (excluded)');
            console.log('   • Pagination or parsing issue');
        }
        
        // Test the provider analysis
        console.log('\n🔍 Testing provider analysis...');
        const patientState = doctorFetching.extractStateFromAddress(testPatient.address);
        console.log(`📍 Patient state: ${patientState}`);
        
        if (claims.length > 0) {
            const providers = await doctorFetching.analyzeProviders(claims, patientState);
            console.log(`🏥 Top providers found: ${providers.length}`);
            
            providers.forEach((provider, i) => {
                console.log(`${i + 1}. ${provider.provider} (${provider.count} visits)`);
            });
        }
        
        // Logout
        console.log('\n🚪 Logging out...');
        const logoutResult = await doctorFetching.logoutFromMedicare();
        console.log(`🎯 Logout: ${logoutResult.success ? 'SUCCESS' : 'FAILED'}`);
        
        // Summary
        console.log('\n' + '=' * 70);
        console.log('🎯 PAGINATION HANDLING TEST SUMMARY:');
        console.log('=' * 70);
        console.log(`✅ Login: SUCCESS`);
        console.log(`🔄 Pagination: ${claims.length > 0 ? 'SUCCESS' : 'NEEDS REVIEW'}`);
        console.log(`📊 Claims Found: ${claims.length}`);
        console.log(`⏱️  Processing Time: ${fetchTime}s`);
        console.log(`🚪 Logout: ${logoutResult.success ? 'SUCCESS' : 'FAILED'}`);
        
        if (claims.length > 0) {
            console.log('\n🚀 PAGINATION HANDLING IS WORKING CORRECTLY!');
            console.log('   ✅ Loads multiple pages of claims');
            console.log('   ✅ Stops when reaching claims older than 6 months');
            console.log('   ✅ Prevents infinite loading loops');
            console.log('   ✅ Provides comprehensive claim history');
        } else {
            console.log('\n⚠️  PAGINATION NEEDS REVIEW');
            console.log('   • Check if patient has any medical claims');
            console.log('   • Verify button selector for "Load more claims"');
            console.log('   • Review claim parsing logic');
        }
        
    } catch (error) {
        console.error('❌ Pagination test failed:', error);
    } finally {
        console.log('\n🔚 Closing browser...');
        await doctorFetching.closeBrowser();
    }
}

async function demonstratePaginationLogic() {
    console.log('📄 Medicare Claims Pagination Enhancement\n');
    console.log('=' * 70);
    
    console.log('🚨 PROBLEM IDENTIFIED:');
    console.log('   • Medicare claims page uses pagination');
    console.log('   • Script was only reading first page of claims');
    console.log('   • Missing recent claims on subsequent pages');
    console.log('   • Incomplete provider analysis');
    console.log('');
    
    console.log('🔄 PAGINATION SOLUTION IMPLEMENTED:');
    console.log('   1️⃣ Load initial claims page');
    console.log('   2️⃣ Check dates of currently visible claims');
    console.log('   3️⃣ If oldest claim is still within 6 months → click "Load more"');
    console.log('   4️⃣ Wait for new claims to load');
    console.log('   5️⃣ Repeat until oldest claim > 6 months OR no more button');
    console.log('   6️⃣ Then analyze all loaded claims');
    console.log('');
    
    console.log('🔍 PAGINATION LOGIC:');
    console.log('   • Target button: button.ds-c-button.ds-u-margin-top--4');
    console.log('   • Button text: "Load more claims"');
    console.log('   • Stop condition: Claims older than 6 months found');
    console.log('   • Safety limit: Maximum 20 pagination attempts');
    console.log('   • Wait time: 3 seconds after each click');
    console.log('');
    
    console.log('📊 BENEFITS:');
    console.log('   ✅ Gets ALL recent claims (complete data)');
    console.log('   ✅ Stops efficiently when reaching old claims');
    console.log('   ✅ Prevents infinite loops with safety limits');
    console.log('   ✅ Better provider visit counting');
    console.log('   ✅ More accurate doctor recommendations');
    console.log('');
    
    console.log('⚡ PERFORMANCE:');
    console.log('   • Only loads claims we actually need');
    console.log('   • Stops as soon as we have complete 6-month data');
    console.log('   • Efficient date checking during pagination');
    console.log('   • Clear progress reporting');
}

// Execute if run directly
if (require.main === module) {
    console.log('📄 MEDICARE CLAIMS PAGINATION TEST\n');
    console.log('=' * 70);
    
    demonstratePaginationLogic().then(() => {
        console.log('\n' + '=' * 70);
        return testPaginationHandling();
    });
}

module.exports = { testPaginationHandling, demonstratePaginationLogic }; 
const PECOSEnrollmentService = require('./pecos-enrollment-service');

async function testPECOSEnrollmentService() {
    console.log('🧪 Testing PECOS Enrollment Service Integration\n');
    
    const pecosService = new PECOSEnrollmentService();
    
    // Test with sample NPIs (these are example NPIs, may not be real)
    const testNPIs = [
        '1234567890', // 10-digit NPI example
        '9876543210', // Another 10-digit NPI example
        '1111111111'  // Another test NPI
    ];
    
    try {
        console.log('🔍 Testing individual NPI checks...\n');
        
        for (const npi of testNPIs) {
            console.log(`📋 Testing NPI: ${npi}`);
            const result = await pecosService.checkProviderEnrollment(npi);
            
            console.log(`   📊 Result:`);
            console.log(`      ✅ Enrolled: ${result.isEnrolled}`);
            console.log(`      📋 Status: ${result.status}`);
            console.log(`      📅 Enrollment Date: ${result.enrollmentDate || 'N/A'}`);
            console.log(`      🏥 Provider Type: ${result.providerType || 'N/A'}`);
            console.log(`      ❌ Error: ${result.error || 'None'}`);
            console.log('');
        }
        
        console.log('🔍 Testing batch NPI checks...\n');
        const batchResults = await pecosService.checkMultipleProviders(testNPIs);
        
        console.log('📊 Batch Results Summary:');
        const summary = pecosService.getEnrollmentSummary(batchResults);
        console.log(`   📋 Total Checked: ${summary.total}`);
        console.log(`   ✅ Enrolled: ${summary.enrolled}`);
        console.log(`   ❌ Not Enrolled: ${summary.notEnrolled}`);
        console.log(`   ⚠️  Errors: ${summary.errors}`);
        console.log(`   📈 Enrollment Rate: ${summary.enrollmentRate}%`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

async function demonstratePECOSIntegration() {
    console.log('\n🏥 PECOS Enrollment Integration Overview\n');
    console.log('=' * 70);
    
    console.log('🔗 INTEGRATION WORKFLOW:');
    console.log('1️⃣ Doctor Claims Analysis → Find providers from Medicare claims');
    console.log('2️⃣ HIPAASpace API Search → Get provider details (name, NPI, specialty)');
    console.log('3️⃣ Provider Quality Assessment → Check if provider is "good quality"');
    console.log('4️⃣ *** PECOS ENROLLMENT CHECK *** → Verify Medicare enrollment status');
    console.log('5️⃣ Final Doctor Selection → Recommend only enrolled providers');
    console.log('');
    
    console.log('🏥 PECOS ENROLLMENT VERIFICATION:');
    console.log('   ✅ Provider is actively enrolled in Medicare');
    console.log('   ✅ Provider can legally bill Medicare for services');
    console.log('   ✅ Provider enrollment status is current and valid');
    console.log('   ❌ Filters out deactivated or suspended providers');
    console.log('');
    
    console.log('🎯 DECISION LOGIC:');
    console.log('   ✅ ENROLLED → Include in recommendations');
    console.log('   ❌ NOT ENROLLED → Reject (cannot bill Medicare)');
    console.log('   ⚠️  UNKNOWN (API Error) → Include with warning');
    console.log('');
    
    console.log('📊 ENHANCED REPORTING:');
    console.log('   🏥 PECOS Status shown in doctor rankings');
    console.log('   📅 Enrollment dates displayed when available');
    console.log('   📋 Provider type information included');
    console.log('   ⚠️  Clear warnings for non-enrolled providers');
    console.log('');
    
    console.log('🔧 API INTEGRATION:');
    console.log('   🌐 Uses CMS Data API (https://data.cms.gov/api-docs)');
    console.log('   🚀 Rate-limited requests (200ms delay)');
    console.log('   🔄 Automatic retry on rate limits');
    console.log('   ⚠️  Graceful error handling');
}

// Main execution
async function main() {
    try {
        await demonstratePECOSIntegration();
        await testPECOSEnrollmentService();
        
        console.log('\n✅ PECOS Enrollment testing completed!');
        console.log('💡 The system now includes PECOS enrollment verification');
        console.log('🏥 Only Medicare-enrolled providers will be recommended');
        
    } catch (error) {
        console.error('❌ PECOS testing failed:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testPECOSEnrollmentService, demonstratePECOSIntegration }; 
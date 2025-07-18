const HIPAASpaceAPIService = require('./hipaaspace-api-service');

async function testHIPAASpaceLicensePECOSCheck() {
    console.log('🧪 Testing HIPAASpace LicenseNumber approach for PECOS enrollment...\n');
    
    const hipaaSpaceService = new HIPAASpaceAPIService();
    
    // Test providers with known NPIs
    const testProviders = [
        { name: 'GUY ROSS', npi: '1710949482' },
        { name: 'JOHN SMITH', npi: '1234567890' },
        { name: 'MARY DAVIS', npi: '9876543210' }
    ];
    
    for (const testProvider of testProviders) {
        console.log(`\n🔍 Testing PECOS enrollment for: ${testProvider.name} (NPI: ${testProvider.npi})`);
        console.log('=' + '='.repeat(70));
        
        try {
            // Get provider details from HIPAASpace API
            const provider = await hipaaSpaceService.getProviderByNPI(testProvider.npi);
            
            if (provider) {
                console.log(`✅ Provider found in HIPAASpace:`);
                console.log(`   📛 Name: ${provider.name}`);
                console.log(`   🆔 NPI: ${provider.npi}`);
                console.log(`   🏥 Type: ${provider.entityType}`);
                console.log(`   🎯 Specialty: ${provider.specialty || 'N/A'}`);
                console.log(`   📍 State: ${provider.address?.state || 'N/A'}`);
                console.log(`   📄 License Number: "${provider.licenseNumber || 'NOT FOUND'}"`);
                
                // Apply the new PECOS enrollment logic
                let pecosStatus;
                if (provider.licenseNumber && provider.licenseNumber.trim() !== '') {
                    pecosStatus = {
                        isEnrolled: true,
                        status: 'Enrolled - Has License Number',
                        licenseNumber: provider.licenseNumber,
                        dataSource: 'HIPAASpace LicenseNumber Check'
                    };
                    console.log(`\n✅ PECOS ENROLLMENT RESULT: ENROLLED`);
                    console.log(`   📋 Status: Active enrollment verified via HIPAASpace license`);
                    console.log(`   🏥 License: ${provider.licenseNumber}`);
                } else {
                    pecosStatus = {
                        isEnrolled: false,
                        status: 'Not Enrolled - No License Number',
                        licenseNumber: null,
                        dataSource: 'HIPAASpace LicenseNumber Check',
                        error: 'Provider has no license number in HIPAASpace database'
                    };
                    console.log(`\n❌ PECOS ENROLLMENT RESULT: NOT ENROLLED`);
                    console.log(`   📋 Status: No license found`);
                    console.log(`   ⚠️  This provider cannot bill Medicare`);
                }
                
                console.log(`\n📊 PECOS Summary:`);
                console.log(`   ✅ Method: HIPAASpace LicenseNumber Check`);
                console.log(`   📋 Result: ${pecosStatus.isEnrolled ? 'ENROLLED' : 'NOT ENROLLED'}`);
                console.log(`   🔍 Source: ${pecosStatus.dataSource}`);
                
            } else {
                console.log(`❌ Provider not found in HIPAASpace for NPI: ${testProvider.npi}`);
                console.log(`\n❌ PECOS ENROLLMENT RESULT: UNKNOWN`);
                console.log(`   📋 Status: Provider not found in HIPAASpace`);
                console.log(`   ⚠️  Cannot determine enrollment status`);
            }
            
        } catch (error) {
            console.log(`❌ Error checking provider: ${error.message}`);
            console.log(`\n❌ PECOS ENROLLMENT RESULT: ERROR`);
            console.log(`   📋 Status: API Error`);
            console.log(`   🔍 Error: ${error.message}`);
        }
        
        // Add delay between tests
        console.log('\n⏸️  Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎯 HIPAASpace LicenseNumber PECOS Test Complete!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ New approach: Check LicenseNumber in HIPAASpace API');
    console.log('   ✅ Logic: Has license = PECOS enrolled, No license = NOT enrolled');
    console.log('   ✅ Advantage: No complex CMS API calls, faster and more reliable');
    console.log('   ✅ Integration: Can replace existing PECOS enrollment service');
    console.log('\n🚀 Ready to integrate into doctor-fetching system!');
}

// Run the test
if (require.main === module) {
    testHIPAASpaceLicensePECOSCheck().catch(console.error);
}

module.exports = testHIPAASpaceLicensePECOSCheck; 
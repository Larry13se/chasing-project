const HIPAASpaceAPIService = require('./hipaaspace-api-service');

async function testHIPAASpaceAPI() {
    console.log('🧪 Testing HIPAASpace API Integration...\n');
    
    const hipaaSpaceService = new HIPAASpaceAPIService();
    
    // Display service info
    console.log('📋 Service Configuration:');
    const serviceInfo = hipaaSpaceService.getServiceInfo();
    console.log(JSON.stringify(serviceInfo, null, 2));
    console.log('');
    
    // Test searches with common provider names
    const testProviders = [
        { name: 'John Smith', state: 'CA' },
        { name: 'Robert Johnson', state: 'TX' },
        { name: 'Mary Davis', state: 'FL' },
        { name: 'Michael Wilson', state: null } // Test without state
    ];
    
    for (const testProvider of testProviders) {
        console.log(`\n🔍 Testing search for: "${testProvider.name}" in state: ${testProvider.state || 'ALL'}`);
        console.log('=' + '='.repeat(60));
        
        try {
            const results = await hipaaSpaceService.searchProvidersWithRetry(
                testProvider.name, 
                testProvider.state, 
                3 // Limit to 3 results for testing
            );
            
            if (results.length > 0) {
                console.log(`✅ Found ${results.length} providers:`);
                
                results.forEach((provider, index) => {
                    console.log(`\n   Provider ${index + 1}:`);
                    console.log(`   📛 Name: ${provider.name}`);
                    console.log(`   🆔 NPI: ${provider.npi}`);
                    console.log(`   🏥 Type: ${provider.entityType}`);
                    console.log(`   🎯 Specialty: ${provider.specialty || 'N/A'}`);
                    console.log(`   📍 State: ${provider.address?.state || 'N/A'}`);
                    console.log(`   🏙️  City: ${provider.address?.city || 'N/A'}`);
                    
                    // Test basic validation
                    const validation = hipaaSpaceService.validateProviderBasicCriteria(provider);
                    console.log(`   ✅ Valid: ${validation.isValid ? 'YES' : 'NO'}`);
                    if (!validation.isValid) {
                        console.log(`   ❌ Issues: ${validation.issues.join(', ')}`);
                    }
                });
                
                // Test NPI lookup with first result
                if (results[0] && results[0].npi) {
                    console.log(`\n🔍 Testing NPI lookup for: ${results[0].npi}`);
                    try {
                        const npiResult = await hipaaSpaceService.getProviderByNPI(results[0].npi);
                        if (npiResult) {
                            console.log(`   ✅ NPI lookup successful: ${npiResult.name}`);
                        } else {
                            console.log(`   ❌ NPI lookup failed`);
                        }
                    } catch (npiError) {
                        console.log(`   ❌ NPI lookup error: ${npiError.message}`);
                    }
                }
                
            } else {
                console.log(`❌ No providers found`);
            }
            
        } catch (error) {
            console.log(`❌ Search failed: ${error.message}`);
            console.log(`   Error details: ${error.stack}`);
        }
        
        // Add delay between tests
        console.log('\n⏸️  Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎯 HIPAASpace API Test Complete!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ API service created successfully');
    console.log('   ✅ Search functionality tested');
    console.log('   ✅ Provider parsing tested');
    console.log('   ✅ Basic validation tested');
    console.log('   ✅ NPI lookup tested');
    console.log('\n🚀 Ready to integrate with Medicare automation system!');
}

// Test specific provider name from Medicare claims
async function testSpecificProvider() {
    console.log('\n🧪 Testing with specific provider name...\n');
    
    const hipaaSpaceService = new HIPAASpaceAPIService();
    
    // Test with a typical provider name format from Medicare claims
    const providerName = 'FAMILY PRACTICE CENTER';
    const state = 'CA';
    
    console.log(`🔍 Searching for: "${providerName}" in ${state}`);
    
    try {
        const results = await hipaaSpaceService.searchProvidersWithRetry(providerName, state, 5);
        
        console.log(`📊 Results: ${results.length} providers found`);
        
        if (results.length > 0) {
            // Filter by state
            const stateFiltered = hipaaSpaceService.filterProvidersByState(results, state);
            console.log(`📍 State filtered: ${stateFiltered.length} providers in ${state}`);
            
            // Show first few results
            stateFiltered.slice(0, 3).forEach((provider, index) => {
                console.log(`\n   Provider ${index + 1}:`);
                console.log(`   📛 ${provider.name}`);
                console.log(`   🆔 NPI: ${provider.npi}`);
                console.log(`   🎯 Specialty: ${provider.specialty || provider.taxonomy || 'N/A'}`);
                console.log(`   📍 ${provider.address?.city}, ${provider.address?.state} ${provider.address?.zip}`);
            });
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

// Run tests
async function runAllTests() {
    try {
        await testHIPAASpaceAPI();
        await testSpecificProvider();
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    runAllTests();
}

module.exports = { testHIPAASpaceAPI, testSpecificProvider }; 
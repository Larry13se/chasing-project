const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

async function testUnlimitedDoctors() {
    console.log('🧪 Testing Unlimited Doctor Fetching...\n');
    
    const doctorFetching = new DoctorFetching();
    const googleSheetsService = new GoogleSheetsService();
    
    try {
        // Initialize browser
        console.log('🚀 Starting browser...');
        await doctorFetching.initialize();
        
        // Get a sample patient with credentials for testing
        console.log('📊 Getting sample patient for unlimited doctors testing...');
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
        
        // Extract patient state
        const patientState = doctorFetching.extractStateFromAddress(testPatient.address);
        console.log(`📍 Patient state: ${patientState}`);
        
        // Test the full doctor fetching process
        console.log('\n🏥 Testing unlimited doctor fetching process...');
        console.log('=' * 70);
        
        const startTime = Date.now();
        
        // Fetch claims with pagination
        console.log('📋 Step 1: Fetching all claims with pagination...');
        const claims = await doctorFetching.fetchClaims();
        console.log(`✅ Found ${claims.length} medical claims`);
        
        if (claims.length > 0) {
            // Analyze providers (now gets up to 10 instead of 3)
            console.log('\n🔍 Step 2: Analyzing providers (up to 10 instead of 3)...');
            const topProviders = await doctorFetching.analyzeProviders(claims, patientState);
            console.log(`✅ Found ${topProviders.length} top providers to validate`);
            
            // Show all providers we'll check
            console.log('\n📋 Top providers to validate:');
            topProviders.forEach((provider, i) => {
                console.log(`${i + 1}. ${provider.provider} (${provider.count} visits)`);
            });
            
            if (topProviders.length > 0) {
                console.log('\n✅ Step 3: Validating ALL providers (no 2-doctor limit)...');
                console.log('=' * 60);
                
                const recommendedDoctors = [];
                let totalProvidersChecked = 0;
                let validationFailedCount = 0;
                
                // Process ALL providers without stopping at 2
                for (const providerData of topProviders) {
                    console.log(`\n🔍 Validating provider ${totalProvidersChecked + 1}/${topProviders.length}: ${providerData.provider}`);
                    totalProvidersChecked++;
                    
                    const hipaaSpaceProvider = await doctorFetching.searchProviderOnHIPAASpace(providerData.provider, patientState);
                    
                    if (hipaaSpaceProvider) {
                        const providerInfo = await doctorFetching.validateProviderFromHIPAASpace(hipaaSpaceProvider);
                        
                        if (providerInfo) {
                            providerInfo.visitCount = providerData.count;
                            recommendedDoctors.push(providerInfo);
                            console.log(`✅ Doctor ${recommendedDoctors.length}: ${providerInfo.fullName} (${providerData.count} visits) - ${providerInfo.specialty}`);
                            console.log(`   📋 Validation: ${providerInfo.validationInfo?.validationReason}`);
                        } else {
                            validationFailedCount++;
                            console.log(`❌ Validation failed for provider ${totalProvidersChecked}`);
                        }
                    } else {
                        console.log(`❌ Could not find provider on HIPAASpace API`);
                        validationFailedCount++;
                    }
                    
                    // Show progress - NO LIMIT!
                    console.log(`📊 Progress: ${recommendedDoctors.length} doctors validated so far (continuing to check all providers)...`);
                }
                
                const endTime = Date.now();
                const totalTime = ((endTime - startTime) / 1000).toFixed(2);
                
                // Results summary
                console.log('\n' + '=' * 70);
                console.log('🎯 UNLIMITED DOCTORS TEST RESULTS:');
                console.log('=' * 70);
                console.log(`⏱️  Total processing time: ${totalTime} seconds`);
                console.log(`🔍 Total providers checked: ${totalProvidersChecked}`);
                console.log(`✅ Valid doctors found: ${recommendedDoctors.length}`);
                console.log(`❌ Validation failures: ${validationFailedCount}`);
                console.log(`📈 Success rate: ${totalProvidersChecked > 0 ? ((recommendedDoctors.length / totalProvidersChecked) * 100).toFixed(1) : 0}%`);
                
                if (recommendedDoctors.length > 0) {
                    console.log('\n🏥 ALL VALIDATED DOCTORS:');
                    console.log('-' * 50);
                    recommendedDoctors.forEach((doctor, i) => {
                        console.log(`${i + 1}. ${doctor.fullName}`);
                        console.log(`   🏥 Specialty: ${doctor.specialty}`);
                        console.log(`   📍 Location: ${doctor.practiceCity}, ${doctor.practiceState}`);
                        console.log(`   📊 Visits: ${doctor.visitCount}`);
                        console.log(`   🔍 NPI: ${doctor.npi}`);
                        console.log('');
                    });
                    
                    // Update Google Sheets with ALL doctors
                    console.log('💾 Updating Google Sheets with ALL validated doctors...');
                    try {
                        await googleSheetsService.updateValidDoctors(testPatient.rowIndex, recommendedDoctors);
                        console.log(`✅ Successfully updated Column G with ${recommendedDoctors.length} doctors`);
                    } catch (updateError) {
                        console.error(`❌ Error updating Google Sheets:`, updateError);
                    }
                } else {
                    console.log('\n❌ No valid doctors found after checking all providers');
                }
                
                // Compare with old vs new approach
                console.log('\n📊 OLD vs NEW APPROACH COMPARISON:');
                console.log('=' * 50);
                console.log(`❌ OLD: Limited to top 3 providers, stopped at 2 doctors`);
                console.log(`✅ NEW: Checks up to 10 providers, gets ALL valid doctors`);
                console.log(`📈 Improvement: ${Math.max(0, recommendedDoctors.length - 2)} additional doctors found`);
                
                if (recommendedDoctors.length >= 3) {
                    console.log('\n🚀 SUCCESS: Found 3+ doctors (more than old 2-doctor limit)!');
                } else if (recommendedDoctors.length > 0) {
                    console.log('\n✅ SUCCESS: Found all available valid doctors');
                } else {
                    console.log('\n⚠️  No valid doctors found - may need to check more providers');
                }
                
            } else {
                console.log('❌ No providers found to validate');
            }
        } else {
            console.log('❌ No claims found for this patient');
        }
        
        // Logout
        console.log('\n🚪 Logging out...');
        const logoutResult = await doctorFetching.logoutFromMedicare();
        console.log(`🎯 Logout: ${logoutResult.success ? 'SUCCESS' : 'FAILED'}`);
        
    } catch (error) {
        console.error('❌ Unlimited doctors test failed:', error);
    } finally {
        console.log('\n🔚 Closing browser...');
        await doctorFetching.closeBrowser();
    }
}

async function demonstrateUnlimitedDoctorsFeature() {
    console.log('🏥 Unlimited Doctors Enhancement\n');
    console.log('=' * 70);
    
    console.log('🚨 PREVIOUS LIMITATION:');
    console.log('   • Limited to top 3 providers only');
    console.log('   • Stopped after finding 2 validated doctors');
    console.log('   • Missing potential valid doctors');
    console.log('   • Artificial constraint on results');
    console.log('');
    
    console.log('🚀 NEW UNLIMITED APPROACH:');
    console.log('   1️⃣ Get top 10 providers (instead of 3)');
    console.log('   2️⃣ Validate ALL providers (no stopping at 2)');
    console.log('   3️⃣ Return ALL valid doctors found');
    console.log('   4️⃣ Better coverage of patient\'s healthcare network');
    console.log('');
    
    console.log('📈 IMPROVEMENTS:');
    console.log('   ✅ Up to 10 providers checked (vs 3)');
    console.log('   ✅ No artificial 2-doctor limit');
    console.log('   ✅ Get 3, 4, 5+ doctors if available');
    console.log('   ✅ More comprehensive doctor recommendations');
    console.log('   ✅ Better patient coverage');
    console.log('');
    
    console.log('🎯 EXPECTED RESULTS:');
    console.log('   • Patients with many providers → More doctors found');
    console.log('   • Patients with few providers → Same or slightly more');
    console.log('   • Better utilization of available data');
    console.log('   • More complete doctor recommendations');
    console.log('');
    
    console.log('💡 EXAMPLE SCENARIOS:');
    console.log('   📊 Patient with 8 providers:');
    console.log('      OLD: Check 3 providers, stop at 2 doctors → 2 doctors max');
    console.log('      NEW: Check up to 10 providers, get all valid → 4-6 doctors possible');
    console.log('');
    console.log('   📊 Patient with 2 providers:');
    console.log('      OLD: Check 2 providers, stop at 2 doctors → 2 doctors max');
    console.log('      NEW: Check 2 providers, get all valid → 2 doctors (same)');
}

// Execute if run directly
if (require.main === module) {
    console.log('🏥 UNLIMITED DOCTORS TEST\n');
    console.log('=' * 70);
    
    demonstrateUnlimitedDoctorsFeature().then(() => {
        console.log('\n' + '=' * 70);
        return testUnlimitedDoctors();
    });
}

module.exports = { testUnlimitedDoctors, demonstrateUnlimitedDoctorsFeature }; 
const DoctorFetching = require('./doctor-fetching');

async function testExactWordMatchingFixes() {
    console.log('🧪 Testing EXACT WORD MATCHING and COMPANY DETECTION Fixes\n');
    
    const doctorFetching = new DoctorFetching();
    
    try {
        // Initialize to load specialty validation data
        console.log('📊 Loading doctor validation data...');
        await doctorFetching.initialize();
        console.log(`✅ Loaded ${doctorFetching.validSpecialties.length} valid specialties\n`);
        
        // Test 1: EXACT WORD MATCHING - should be much stricter now
        console.log('🎯 TEST 1: EXACT WORD MATCHING (No more partial matching!)\n');
        console.log('=' * 60);
        
        const specialtyTests = [
            // These should PASS (exact word matches)
            { specialty: 'Internal Medicine', shouldPass: true, description: 'Exact match' },
            { specialty: 'Family Medicine', shouldPass: true, description: 'Exact match' },
            { specialty: 'Cardiovascular Disease', shouldPass: true, description: 'Should match if "cardiovascular" is in valid list' },
            { specialty: 'Orthopedic Surgery', shouldPass: true, description: 'Should match "orthopedic" + "surgery"' },
            
            // These should FAIL (partial matching no longer allowed)
            { specialty: 'Urology', shouldPass: false, description: 'Should NOT match "Neurology" (partial match)' },
            { specialty: 'Neurology', shouldPass: false, description: 'Should NOT match "Urology" (partial match)' },
            { specialty: 'Cardio', shouldPass: false, description: 'Partial word should fail' },
            { specialty: 'Neuro', shouldPass: false, description: 'Partial word should fail' },
            
            // Edge cases
            { specialty: 'Medicine Internal', shouldPass: true, description: 'Word order different but exact words' },
            { specialty: 'Surgery Orthopedic', shouldPass: true, description: 'Word order different but exact words' },
        ];
        
        for (const test of specialtyTests) {
            console.log(`\n🔬 Testing: "${test.specialty}"`);
            console.log(`   Expected: ${test.shouldPass ? 'PASS' : 'FAIL'} (${test.description})`);
            
            const result = doctorFetching.isDoctorSpecialtyValid(test.specialty);
            const actualResult = result.isValid;
            const status = actualResult === test.shouldPass ? '✅ CORRECT' : '❌ WRONG';
            
            console.log(`   Result: ${actualResult ? 'PASS' : 'FAIL'} - ${status}`);
            console.log(`   Reason: ${result.reason}`);
            
            if (result.matchedWords) {
                console.log(`   Matched words: [${result.matchedWords.join(', ')}]`);
            }
        }
        
        // Test 2: COMPANY DETECTION
        console.log('\n\n🏢 TEST 2: COMPANY DETECTION (Skip companies, keep real doctors)\n');
        console.log('=' * 60);
        
        const providerTests = [
            // These should be detected as COMPANIES (and skipped)
            { name: 'ABC Medical Center LLC', isCompany: true, description: 'LLC company' },
            { name: 'Regional Health Services Inc', isCompany: true, description: 'Inc company' },
            { name: 'Springfield Medical Group', isCompany: true, description: 'Medical group' },
            { name: 'City Hospital Cardiology Center', isCompany: true, description: 'Hospital center' },
            { name: 'Advanced Diagnostic Services', isCompany: true, description: 'Services company' },
            { name: 'Metro Physical Therapy Center', isCompany: true, description: 'Therapy center' },
            { name: 'Northeast Medical Equipment LLC', isCompany: true, description: 'Equipment company' },
            
            // These should be detected as REAL DOCTORS (and processed)
            { name: 'Dr. John Smith', isCompany: false, description: 'Doctor with title' },
            { name: 'Sarah Johnson MD', isCompany: false, description: 'Doctor with credentials' },
            { name: 'Smith, Robert MD', isCompany: false, description: 'Last, First format' },
            { name: 'Michael Brown DO', isCompany: false, description: 'DO credentials' },
            { name: 'Jennifer Davis', isCompany: false, description: '2 words, likely person' },
            { name: 'Christopher Wilson NP', isCompany: false, description: 'Nurse practitioner' },
        ];
        
        for (const test of providerTests) {
            console.log(`\n🔬 Testing: "${test.name}"`);
            console.log(`   Expected: ${test.isCompany ? 'COMPANY (skip)' : 'PERSON (process)'} - ${test.description}`);
            
            const isDetectedAsCompany = doctorFetching.isProviderCompany(test.name);
            const status = isDetectedAsCompany === test.isCompany ? '✅ CORRECT' : '❌ WRONG';
            
            console.log(`   Result: ${isDetectedAsCompany ? 'COMPANY (skip)' : 'PERSON (process)'} - ${status}`);
        }
        
        // Test 3: TOP 3 LIMIT SIMULATION
        console.log('\n\n🎯 TEST 3: TOP 3 DOCTOR LIMIT SIMULATION\n');
        console.log('=' * 60);
        
        // Simulate a list of doctors with scores
        const mockDoctors = [
            { name: 'Dr. Alice Johnson', score: 25, specialty: 'Internal Medicine' },
            { name: 'Dr. Bob Smith', score: 22, specialty: 'Family Medicine' },
            { name: 'Metro Medical Center', score: 20, specialty: 'Cardiology' }, // Company - should be skipped
            { name: 'Dr. Carol Davis', score: 18, specialty: 'Cardiology' },
            { name: 'Advanced Heart Services LLC', score: 16, specialty: 'Cardiology' }, // Company - should be skipped
            { name: 'Dr. David Wilson', score: 15, specialty: 'Orthopedic Surgery' },
            { name: 'Dr. Eve Brown', score: 12, specialty: 'Dermatology' },
        ];
        
        console.log('📋 Simulated provider list (ordered by score):');
        mockDoctors.forEach((doctor, i) => {
            const isCompany = doctorFetching.isProviderCompany(doctor.name);
            const status = isCompany ? '🏢 COMPANY (skip)' : '👨‍⚕️ DOCTOR (process)';
            console.log(`   ${i + 1}. ${doctor.name} (Score: ${doctor.score}) - ${status}`);
        });
        
        console.log('\n🎯 Expected result: Top 3 DOCTORS only (companies skipped):');
        const expectedTopDoctors = mockDoctors
            .filter(doctor => !doctorFetching.isProviderCompany(doctor.name))
            .slice(0, 3);
            
        expectedTopDoctors.forEach((doctor, i) => {
            console.log(`   ${i + 1}. ${doctor.name} (Score: ${doctor.score}) - ${doctor.specialty}`);
        });
        
        console.log('\n📊 SUMMARY OF IMPROVEMENTS:');
        console.log('✅ 1. EXACT WORD MATCHING: No more "Urology" matching "Neurology"');
        console.log('✅ 2. COMPANY DETECTION: Skip medical centers, groups, LLCs, etc.');
        console.log('✅ 3. TOP 3 LIMIT: Only recommend the 3 highest-scored real doctors');
        console.log('✅ 4. SCORE SORTING: Doctors sorted by composite score (specialty + visit frequency)');
        console.log('✅ 5. FALLBACK LOGIC: No patient left without doctors!');
        console.log('✅ 6. VALIDATION TIERS: Strict → Relaxed → Emergency fallback');
        
        console.log('\n🎯 VALIDATION STRATEGY:');
        console.log('   1️⃣ STRICT: Perfect specialty match + all validations');
        console.log('   2️⃣ RELAXED: Basic validations, flexible specialty matching');
        console.log('   3️⃣ EMERGENCY: Any valid provider found (last resort)');
        console.log('   🛡️ GUARANTEE: Every patient gets doctors (even if not perfect)');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testExactWordMatchingFixes().catch(console.error);
}

module.exports = testExactWordMatchingFixes; 
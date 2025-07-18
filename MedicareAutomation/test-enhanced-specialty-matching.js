const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

async function testEnhancedSpecialtyMatching() {
    console.log('🧪 Testing Enhanced Specialty Matching...\n');
    
    const doctorFetching = new DoctorFetching();
    const googleSheetsService = new GoogleSheetsService();
    
    try {
        // Initialize to load specialty validation data
        console.log('📊 Loading doctor validation data...');
        const validationData = await googleSheetsService.getDoctorValidationData();
        doctorFetching.validSpecialties = validationData.validSpecialties;
        doctorFetching.validationMap = validationData.validationMap;
        
        console.log(`✅ Loaded ${doctorFetching.validSpecialties.length} valid specialties for testing`);
        console.log(`📋 Sample valid specialties: ${doctorFetching.validSpecialties.slice(0, 5).join(', ')}\n`);
        
        // Test cases that demonstrate the enhanced matching
        const testCases = [
            // Exact matches (should work)
            'Family Medicine',
            'Internal Medicine',
            'Cardiology',
            
            // HIPAASpace taxonomy variations that might not match exactly
            'Family Medicine Physician',
            'Internal Medicine Physician', 
            'Cardiovascular Disease',
            'Dermatologist',
            'Orthopedic Surgery',
            'Emergency Medicine Physician',
            'Obstetrics & Gynecology',
            'Pediatric Medicine',
            'General Surgery',
            'Plastic and Reconstructive Surgery',
            'Anesthesiology',
            'Radiology - Diagnostic',
            'Pathology - Anatomic and Clinical',
            'Psychiatry & Neurology',
            'Physical Medicine & Rehabilitation',
            'Ophthalmology',
            'Otolaryngology (ENT)',
            'Urology',
            'Neurology',
            'Gastroenterology',
            'Pulmonary Disease',
            'Rheumatology',
            'Endocrinology, Diabetes & Metabolism',
            'Infectious Disease',
            'Nephrology',
            'Hematology/Oncology',
            
            // Challenging cases that need enhanced matching
            'Family Practice',
            'General Practice',
            'Primary Care',
            'Heart Specialist',
            'Skin Doctor',
            'Bone Doctor',
            'Brain Doctor',
            'Children Doctor',
            'Surgery',
            'Surgeon',
            'Medicine',
            'Physician',
            
            // Medical abbreviations and short forms
            'FP', // Family Practice
            'IM', // Internal Medicine  
            'ER', // Emergency Room
            'ENT', // Ear Nose Throat
            'OB/GYN', // Obstetrics/Gynecology
            'Psych', // Psychiatry
            'Ortho', // Orthopedics
            'Derm', // Dermatology
            'Cardio', // Cardiology
            'Neuro', // Neurology
            'Peds', // Pediatrics
            
            // Should NOT match (test negative cases)
            'Veterinary Medicine',
            'Dental Surgery',
            'Chiropractic',
            'Completely Random Specialty'
        ];
        
        console.log('🔬 Testing Specialty Matching Capabilities:\n');
        console.log('=' * 80);
        
        let exactMatches = 0;
        let enhancedMatches = 0;
        let noMatches = 0;
        
        for (let i = 0; i < testCases.length; i++) {
            const specialty = testCases[i];
            console.log(`\n${i + 1}. Testing: "${specialty}"`);
            console.log('-' * 50);
            
            const result = doctorFetching.isDoctorSpecialtyValid(specialty);
            
            if (result.isValid) {
                if (result.reason.includes('exact match')) {
                    exactMatches++;
                    console.log(`✅ EXACT MATCH: ${result.reason}`);
                } else {
                    enhancedMatches++;
                    console.log(`🎯 ENHANCED MATCH: ${result.reason}`);
                }
            } else {
                noMatches++;
                console.log(`❌ NO MATCH: ${result.reason}`);
            }
        }
        
        // Summary
        console.log('\n' + '=' * 80);
        console.log('📊 ENHANCED SPECIALTY MATCHING TEST RESULTS:');
        console.log('=' * 80);
        console.log(`📝 Total specialties tested: ${testCases.length}`);
        console.log(`✅ Exact matches: ${exactMatches}`);
        console.log(`🎯 Enhanced matches: ${enhancedMatches}`);
        console.log(`❌ No matches: ${noMatches}`);
        console.log(`📈 Success rate: ${(((exactMatches + enhancedMatches) / testCases.length) * 100).toFixed(1)}%`);
        
        console.log('\n🎯 MATCHING TIERS IMPLEMENTED:');
        console.log('   Tier 1: Exact matching');
        console.log('   Tier 2: Simple contains matching (bidirectional)');
        console.log('   Tier 3: Enhanced word-based matching');
        console.log('   Tier 4: Super aggressive word-by-word matching');
        console.log('   Tier 5: Substring matching (last resort)');
        console.log('   Tier 6: Medical specialty fuzzy mapping');
        console.log('   Tier 7: Aggressive word matching');
        
        const successRate = ((exactMatches + enhancedMatches) / testCases.length) * 100;
        
        if (successRate >= 80) {
            console.log('\n🚀 EXCELLENT: Enhanced matching is working very well!');
        } else if (successRate >= 60) {
            console.log('\n✅ GOOD: Enhanced matching is working well');
        } else {
            console.log('\n⚠️  NEEDS IMPROVEMENT: Enhanced matching needs more work');
        }
        
    } catch (error) {
        console.error('❌ Enhanced specialty matching test failed:', error);
    }
}

async function demonstrateMatchingExamples() {
    console.log('💡 Enhanced Specialty Matching Examples\n');
    console.log('=' * 70);
    
    const examples = [
        {
            hipaaspace: 'Family Medicine Physician',
            googleSheets: 'Family Medicine',
            matchType: 'Word-based matching',
            explanation: 'HIPAASpace adds "Physician" suffix, but "Family Medicine" words match'
        },
        {
            hipaaspace: 'Cardiovascular Disease',
            googleSheets: 'Cardiology', 
            matchType: 'Fuzzy mapping',
            explanation: '"Cardiovascular" maps to "Cardiology" via medical term mappings'
        },
        {
            hipaaspace: 'Internal Medicine Physician',
            googleSheets: 'Internal Medicine',
            matchType: 'Contains matching',
            explanation: 'HIPAASpace taxonomy contains the exact Google Sheets specialty'
        },
        {
            hipaaspace: 'Obstetrics & Gynecology',
            googleSheets: 'Gynecology',
            matchType: 'Word matching',
            explanation: '"Gynecology" word appears in both, despite different format'
        },
        {
            hipaaspace: 'Dermatologist',
            googleSheets: 'Dermatology',
            matchType: 'Substring matching',
            explanation: '"Dermat" substring found in both terms'
        },
        {
            hipaaspace: 'Emergency Medicine Physician',
            googleSheets: 'Emergency Medicine',
            matchType: 'Super aggressive word matching',
            explanation: 'Exact words "Emergency" and "Medicine" match despite "Physician" suffix'
        }
    ];
    
    console.log('🔍 How Enhanced Matching Handles Real-World Cases:\n');
    
    examples.forEach((example, index) => {
        console.log(`${index + 1}. ${example.matchType.toUpperCase()}`);
        console.log(`   🏥 HIPAASpace: "${example.hipaaspace}"`);
        console.log(`   📊 Google Sheets: "${example.googleSheets}"`);
        console.log(`   💡 How it works: ${example.explanation}`);
        console.log('');
    });
    
    console.log('🎯 Benefits of Enhanced Matching:');
    console.log('   ✅ Handles HIPAASpace taxonomy variations');
    console.log('   ✅ Matches despite different formatting');
    console.log('   ✅ Recognizes medical abbreviations');
    console.log('   ✅ Uses fuzzy medical term mappings');
    console.log('   ✅ Falls back to substring matching');
    console.log('   ✅ Comprehensive word-by-word analysis');
}

// Execute if run directly
if (require.main === module) {
    console.log('🧪 ENHANCED SPECIALTY MATCHING TEST\n');
    console.log('=' * 70);
    
    demonstrateMatchingExamples().then(() => {
        console.log('\n' + '=' * 70);
        return testEnhancedSpecialtyMatching();
    });
}

module.exports = { testEnhancedSpecialtyMatching, demonstrateMatchingExamples }; 
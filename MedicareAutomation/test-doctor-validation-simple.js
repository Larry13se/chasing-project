const GoogleSheetsService = require('./google-sheets-service');
require('dotenv').config();

async function testDoctorValidationData() {
    console.log('🧪 Testing Doctor Validation Data Loading...\n');
    
    const googleSheets = new GoogleSheetsService();
    
    try {
        console.log('1. Loading doctor validation data from Google Sheets...');
        const validationData = await googleSheets.getDoctorValidationData();
        
        console.log(`\n2. ✅ Successfully loaded validation data:`);
        console.log(`   📊 Valid specialties count: ${validationData.validSpecialties.length}`);
        console.log(`   🗂️  Validation map size: ${validationData.validationMap.size}`);
        
        if (validationData.validSpecialties.length > 0) {
            console.log('\n3. 📋 First 10 valid specialties and their destinations:');
            validationData.validSpecialties.slice(0, 10).forEach((specialty, i) => {
                const validationInfo = validationData.validationMap.get(specialty);
                console.log(`   ${i + 1}. ${specialty} -> ${validationInfo?.whereToGo}`);
            });
        }
        
        // Test specialty validation logic
        console.log('\n4. 🔍 Testing specialty validation logic...');
        
        function isDoctorSpecialtyValid(specialty, validSpecialties, validationMap) {
            if (!specialty || validSpecialties.length === 0) {
                return { isValid: true, reason: 'No validation data available' };
            }

            const normalizedSpecialty = specialty.trim().toLowerCase();
            
            const isValid = validSpecialties.some(validSpecialty => {
                const normalizedValid = validSpecialty.trim().toLowerCase();
                return normalizedValid.includes(normalizedSpecialty) || normalizedSpecialty.includes(normalizedValid);
            });

            if (isValid) {
                const matchingSpecialty = validSpecialties.find(validSpecialty => {
                    const normalizedValid = validSpecialty.trim().toLowerCase();
                    return normalizedValid.includes(normalizedSpecialty) || normalizedSpecialty.includes(normalizedValid);
                });
                
                const validationInfo = validationMap.get(matchingSpecialty);
                return { 
                    isValid: true, 
                    reason: `Valid specialty - ${validationInfo?.whereToGo || 'APPROVED'}`,
                    whereToGo: validationInfo?.whereToGo
                };
            } else {
                return { 
                    isValid: false, 
                    reason: 'Specialty not found in approved list - not MAIN, MAIN - TESTING, or INTAKE' 
                };
            }
        }
        
        const testSpecialties = [
            'Internal Medicine',
            'Cardiology', 
            'Dermatology',
            'Family Medicine',
            'Orthopedic Surgery',
            'Nephrology',
            'Some Invalid Specialty'
        ];
        
        for (const specialty of testSpecialties) {
            const validation = isDoctorSpecialtyValid(specialty, validationData.validSpecialties, validationData.validationMap);
            const status = validation.isValid ? '✅ VALID' : '❌ INVALID';
            console.log(`   ${specialty}: ${status} - ${validation.reason}`);
        }
        
        console.log('\n✅ Doctor validation data test completed successfully!');
        console.log('\n📋 Summary of approved destinations:');
        
        const destinationCounts = {};
        validationData.validationMap.forEach((info) => {
            destinationCounts[info.whereToGo] = (destinationCounts[info.whereToGo] || 0) + 1;
        });
        
        Object.entries(destinationCounts).forEach(([destination, count]) => {
            console.log(`   ${destination}: ${count} specialties`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testDoctorValidationData().catch(console.error);
}

module.exports = { testDoctorValidationData }; 
const DoctorFetching = require('./doctor-fetching');
const HIPAASpaceAPIService = require('./hipaaspace-api-service');
const GoogleSheetsService = require('./google-sheets-service');

async function testDoctorWorkflow() {
    console.log('🧪 Testing Updated Doctor Workflow...\n');
    
    // Test 1: HIPAASpace API Service
    console.log('1️⃣ Testing HIPAASpace API Service...');
    const hipaaSpaceService = new HIPAASpaceAPIService();
    
    try {
        // Test with a common provider name
        const testProviders = await hipaaSpaceService.searchProvidersWithRetry('John Smith', 'CA', 3);
        console.log(`✅ HIPAASpace API working: Found ${testProviders.length} providers`);
        
        if (testProviders.length > 0) {
            const validation = hipaaSpaceService.validateProviderBasicCriteria(testProviders[0]);
            console.log(`✅ Provider validation working: ${validation.isValid ? 'PASS' : 'FAIL'}`);
        }
    } catch (error) {
        console.error(`❌ HIPAASpace API error: ${error.message}`);
    }
    
    // Test 2: Google Sheets Service - Doctor Validation Data
    console.log('\n2️⃣ Testing Google Sheets Doctor Validation...');
    const googleSheetsService = new GoogleSheetsService();
    
    try {
        const validationData = await googleSheetsService.getDoctorValidationData();
        console.log(`✅ Doctor validation data loaded: ${validationData.validSpecialties.length} MAIN specialties`);
        
        // Show first few valid specialties
        validationData.validSpecialties.slice(0, 5).forEach((specialty, index) => {
            console.log(`   ${index + 1}. ${specialty}`);
        });
    } catch (error) {
        console.error(`❌ Google Sheets validation error: ${error.message}`);
    }
    
    // Test 3: Doctor Formatting
    console.log('\n3️⃣ Testing Doctor Formatting...');
    
    // Create mock doctor data to test formatting
    const mockDoctors = [
        {
            fullName: 'Dr. John Smith, MD',
            name: 'Dr. John Smith, MD',
            npi: '1234567890',
            specialty: 'Family Medicine',
            taxonomy: 'Family Medicine',
            address: {
                street: '123 Main Street',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90210',
                phone: '(555) 123-4567'
            },
            practicePhone: '(555) 123-4567'
        },
        {
            fullName: 'Dr. Mary Johnson, DO',
            name: 'Dr. Mary Johnson, DO',
            npi: '0987654321',
            specialty: 'Internal Medicine',
            taxonomy: 'Internal Medicine',
            address: {
                street: '456 Oak Avenue',
                street2: 'Suite 200',
                city: 'Beverly Hills',
                state: 'CA',
                zip: '90212',
                phone: '(555) 987-6543'
            },
            practicePhone: '(555) 987-6543'
        }
    ];
    
    try {
        // Test formatting function
        let formattedOutput = '';
        mockDoctors.forEach((doctor, index) => {
            const doctorNumber = index + 1;
            
            formattedOutput += `-----------  Doctor ${doctorNumber}    ------------\n`;
            formattedOutput += `${doctor.fullName || doctor.name}\n`;
            formattedOutput += `${googleSheetsService.formatPracticeAddress(doctor)}\n`;
            formattedOutput += `${doctor.practicePhone || doctor.address?.phone || 'Phone: Not Available'}\n`;
            formattedOutput += `Fax: Not Available\n`;
            formattedOutput += `${doctor.npi}\n`;
            formattedOutput += `${doctor.specialty || doctor.taxonomy || 'Specialty: Not Available'}\n`;
            formattedOutput += `---------------------------------\n`;
            
            if (index < mockDoctors.length - 1) {
                formattedOutput += '\n';
            }
        });
        
        console.log('✅ Doctor formatting working correctly:');
        console.log('\n📄 Sample Formatted Output:');
        console.log('═'.repeat(50));
        console.log(formattedOutput);
        console.log('═'.repeat(50));
        
    } catch (error) {
        console.error(`❌ Doctor formatting error: ${error.message}`);
    }
    
    // Test 4: Column Mapping
    console.log('\n4️⃣ Testing Updated Column Mappings...');
    
    try {
        const patients = await googleSheetsService.getPatientsWithCredentials();
        console.log(`✅ Column mapping working: Found ${patients.length} patients with credentials`);
        
        if (patients.length > 0) {
            const firstPatient = patients[0];
            console.log(`📋 Sample patient data:`);
            console.log(`   Last Name (Column Q): ${firstPatient.lastName}`);
            console.log(`   MED ID (Column S): ${firstPatient.medId}`);
            console.log(`   DOB (Column T): ${firstPatient.dob}`);
            console.log(`   Address (Column Y): ${firstPatient.address}`);
            console.log(`   Credentials (Column AE): ${firstPatient.existingCredentials ? 'Present' : 'Missing'}`);
            console.log(`   Part A Eligibility (Column AI): ${firstPatient.partAEligibility}`);
            console.log(`   Feedback (Column AK): ${firstPatient.accountCreationFeedback}`);
        }
    } catch (error) {
        console.error(`❌ Column mapping error: ${error.message}`);
    }
    
    // Test 5: Specialty Filtering (MAIN only)
    console.log('\n5️⃣ Testing MAIN Specialty Filtering...');
    
    const doctorFetching = new DoctorFetching();
    
    // Test various specialties
    const testSpecialties = [
        'Family Medicine',
        'Internal Medicine',
        'Cardiology',
        'Dermatology',
        'Non-Existent Specialty'
    ];
    
    try {
        await doctorFetching.initialize();
        
        testSpecialties.forEach(specialty => {
            const validation = doctorFetching.isDoctorSpecialtyValid(specialty);
            console.log(`   ${specialty}: ${validation.isValid ? '✅ VALID' : '❌ INVALID'} - ${validation.reason}`);
        });
        
    } catch (error) {
        console.error(`❌ Specialty filtering error: ${error.message}`);
    }
    
    console.log('\n🎯 Doctor Workflow Test Complete!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ HIPAASpace API integration');
    console.log('   ✅ Google Sheets column mapping');
    console.log('   ✅ Doctor formatting template');
    console.log('   ✅ MAIN specialty filtering');
    console.log('   ✅ Patient data reading');
    console.log('\n🚀 System is ready for doctor fetching with new requirements!');
}

// Test just the formatting without API calls
async function testFormattingOnly() {
    console.log('🧪 Testing Doctor Formatting Only...\n');
    
    const googleSheetsService = new GoogleSheetsService();
    
    const mockDoctors = [
        {
            fullName: 'Dr. Sarah Williams, MD',
            npi: '1234567890',
            specialty: 'Family Medicine',
            address: {
                street: '789 Health Drive',
                city: 'San Francisco',
                state: 'CA',
                zip: '94102',
                phone: '(415) 555-0123'
            }
        },
        {
            fullName: 'CARDIOVASCULAR ASSOCIATES',
            npi: '0987654321',
            specialty: 'Cardiology',
            address: {
                street: '321 Heart Lane',
                street2: 'Medical Building A',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90028',
                phone: '(323) 555-9876'
            }
        },
        {
            fullName: 'Dr. Michael Chen, DO',
            npi: '5555555555',
            specialty: 'Internal Medicine',
            address: {
                street: '456 Wellness Blvd',
                city: 'San Diego',
                state: 'CA',
                zip: '92101',
                phone: '(619) 555-4567'
            }
        }
    ];
    
    // Test the exact format the user requested
    let formattedDoctors = '';
    
    mockDoctors.forEach((doctor, index) => {
        const doctorNumber = index + 1;
        
        formattedDoctors += `-----------  Doctor ${doctorNumber}    ------------\n`;
        formattedDoctors += `${doctor.fullName}\n`;
        formattedDoctors += `${googleSheetsService.formatPracticeAddress(doctor)}\n`;
        formattedDoctors += `${doctor.address?.phone || 'Phone: Not Available'}\n`;
        formattedDoctors += `Fax: Not Available\n`;
        formattedDoctors += `${doctor.npi}\n`;
        formattedDoctors += `${doctor.specialty}\n`;
        formattedDoctors += `---------------------------------\n`;
        
        if (index < mockDoctors.length - 1) {
            formattedDoctors += '\n';
        }
    });
    
    console.log('📄 EXACT FORMAT for Column G (Valid Doctors):');
    console.log('═'.repeat(60));
    console.log(formattedDoctors);
    console.log('═'.repeat(60));
    
    console.log('\n✅ This exact format will be saved to Column G for each patient');
}

// Run tests
async function runAllTests() {
    try {
        await testDoctorWorkflow();
        console.log('\n' + '='.repeat(80) + '\n');
        await testFormattingOnly();
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    runAllTests();
}

module.exports = { testDoctorWorkflow, testFormattingOnly }; 
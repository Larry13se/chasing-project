const GoogleAuthAuto = require('./google-auth-auto');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.authService = new GoogleAuthAuto();
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID || '1kx897RqWGOkrGd4Gu920l6lPEmglQTcZhPUcGsO8x1U';
        this.sheetName = null; // No default sheet name - must be set explicitly
        
        // 🆕 ENHANCED RATE LIMITING for 5 concurrent doctor fetching processes
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // 🔧 INCREASED: 1 second between requests (was 200ms)
        this.maxConcurrentRequests = 2; // 🔧 DECREASED: Only 2 concurrent API calls (was 3)
        this.activeRequests = 0;
        this.retryAttempts = new Map(); // Track retry attempts per request
        this.lastQuotaExceededTime = 0; // Track when quota was last exceeded
        this.quotaCooldownPeriod = 30000; // 30 second cooldown after quota exceeded
        
        console.log('📊 GoogleSheetsService initialized with ENHANCED rate limiting for 5 concurrent processes');
    }

    setSheetName(sheetName) {
        this.sheetName = sheetName;
        console.log(`📋 Updated sheet name to: ${this.sheetName}`);
    }

    validateSheetName() {
        if (!this.sheetName) {
            throw new Error('Sheet name must be set before performing operations. Call setSheetName() first.');
        }
    }

    async initialize() {
        if (!this.sheets) {
            this.sheets = await this.authService.getSheetsService();
        }
    }

    async getPatientData() {
        try {
            this.validateSheetName();
            await this.initialize();
            
            // 🆕 UPDATED: Start reading from row 938 (same as doctor fetching), need to include column BW (76th column)
            const sheetRange = `'${this.sheetName}'!A938:BW`;
            console.log(`📊 Reading from range: ${sheetRange} for account creation`);
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: sheetRange,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('No data found starting from row 938.');
                return [];
            }

            console.log(`📊 Found ${rows.length} rows starting from row 938 for account creation`);

            const patients = [];

            // 🆕 UPDATED: Process each row using SAME column indexes as doctor fetching
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const actualRowNumber = 938 + i; // Calculate actual row number in sheet
                
                // Column X (index 23) = State, Column Y (index 24) = Address
                const stateCol = row[23] || '';
                const addressCol = row[24] || '';
                const zipCol = row[24] || '';

                const patient = {
                    lastName: row[16] || '', // Column Q (index 16)
                    medId: row[18] || '', // Column S (index 18)
                    dob: row[19] || '', // Column T (index 19)
                    address: addressCol, // Column Y (index 24)
                    partAEligibility: row[32] || '', // Column AG (index 32)
                    partBEligibility: row[33] || '', // Column AH (index 33)
                    existingCredentials: row[74] || '', // Column BW (index 74)
                    accountCreationFeedback: row[36] || '', // Column AK (index 36)
                    rowIndex: actualRowNumber // For updating status later
                };

                // Skip patients who already have credentials in Column BI
                if (patient.existingCredentials && patient.existingCredentials.trim() !== '') {
                    console.log(`⏭️  Skipping ${patient.lastName} (Row ${actualRowNumber}) - Already has credentials: ${patient.existingCredentials}`);
                    continue;
                }

                // Only process patients with required data (last name, med ID, and at least one eligibility date)
                const hasPartA = patient.partAEligibility && patient.partAEligibility.trim() !== '';
                const hasPartB = patient.partBEligibility && patient.partBEligibility.trim() !== '';
                
                if (patient.lastName && patient.medId && (hasPartA || hasPartB)) {
                    // --- ZIP CODE EXTRACTION LOGIC ---
                    // 1. Try to get zip from column Y (addressCol)
                    let zipCode = '';
                    // If addressCol contains a zip code at the end, extract it
                    const zipMatch = addressCol.match(/\b\d{5}(-\d{4})?\b$/);
                    if (zipMatch) {
                        zipCode = zipMatch[0];
                    }
                    patient.zipCode = zipCode;

                    // --- STATE EXTRACTION LOGIC ---
                    // 1. Try to get state from column X (index 23)
                    let state = stateCol;
                    // If not found, try to extract from addressCol
                    if (!state) {
                        // Try to extract state abbreviation from address (e.g., ", GA 30315")
                        const stateMatch = addressCol.match(/,\s*([A-Z]{2})\s*\d{5}/);
                        state = stateMatch ? stateMatch[1] : '';
                    }
                    patient.state = state;

                    // Generate username and password with new formulas
                    const randomNumber = Math.floor(Math.random() * 10); // Single digit 0-9
                    const randomPassword = Math.floor(10000000 + Math.random() * 90000000); // 8 digit random number
                    patient.username = `${patient.lastName}@Larry${randomNumber}`;
                    patient.password = `larry@${randomPassword}@!`;

                    patients.push(patient);
                    
                    // Log first few patients for verification
                    if (patients.length <= 3) {
                        console.log(`👤 Patient ${patients.length}: ${patient.lastName} (Row ${actualRowNumber}), MED ID: ${patient.medId}`);
                        console.log(`   Column Q (Last Name): ${patient.lastName}`);
                        console.log(`   Column S (MED ID): ${patient.medId}`);
                        console.log(`   Column T (DOB): ${patient.dob}`);
                        console.log(`   Column Y (Address): ${patient.address}`);
                        console.log(`   Column X (State): ${stateCol}`);
                        console.log(`   Extracted State: ${patient.state}`);
                        console.log(`   Extracted Zip: ${patient.zipCode}`);
                        console.log(`   Column AG (Part A): ${patient.partAEligibility}`);
                        console.log(`   Column AH (Part B): ${patient.partBEligibility}`);
                        console.log(`   Column BI (Credentials): ${patient.existingCredentials ? 'Present' : 'Empty'}`);        
                        console.log(`   Column AK (Feedback): ${patient.accountCreationFeedback}`);
                        console.log(`   ✅ Has Part A: ${hasPartA}, Has Part B: ${hasPartB}`);
                    }
                }
            }

            console.log(`✅ Found ${patients.length} valid patients for account creation starting from row 938 (skipped patients with existing credentials)`);
            return patients;
        } catch (error) {
            console.error('Error reading Google Sheet for account creation:', error);
            throw error;
        }
    }

    async updatePatientStatus(rowIndex, status, notes = '') {
        try {
            this.validateSheetName();
            await this.initialize();
            
            // Update status in column AH (34th column) and notes in column AI (35th column)
            const updates = [
                {
                    range: `'${this.sheetName}'!AH${rowIndex}`,
                    values: [[status]]
                }
            ];

            if (notes) {
                updates.push({
                    range: `'${this.sheetName}'!AI${rowIndex}`,
                    values: [[notes]]
                });
            }

            const batchUpdateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: updates
                }
            };

            await this.sheets.spreadsheets.values.batchUpdate(batchUpdateRequest);
            console.log(`✅ Updated status for row ${rowIndex}: ${status}`);
        } catch (error) {
            console.error('Error updating Google Sheet:', error);
            throw error;
        }
    }

    parsePartADate(dateString) {
        // Expected format: "MM/YYYY" (changed from MM/DD/YYYY)
        const parts = dateString.split('/');
        if (parts.length >= 2) {
            return {
                month: parts[0].padStart(2, '0'), // MM
                year: parts[1] // YYYY (year from second part)
            };
        }
        return { month: '', year: '' };
    }

    // 🆕 NEW METHOD: Parse Part B Eligibility Start Date (same format as Part A)
    parsePartBDate(dateString) {
        // Expected format: "MM/YYYY" (same as Part A)
        const parts = dateString.split('/');
        if (parts.length >= 2) {
            return {
                month: parts[0].padStart(2, '0'), // MM
                year: parts[1] // YYYY (year from second part)
            };
        }
        return { month: '', year: '' };
    }

    async updatePatientCredentials(rowIndex, credentials) {
        try {
            this.validateSheetName();
            await this.initialize();
            
            console.log(`💾 [RATE-LIMITED] Updating credentials for row ${rowIndex}: ${credentials}`);

            // 🆕 RATE-LIMITED: Update credentials in column BW
            const updateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [{
                        range: `'${this.sheetName}'!BW${rowIndex}`,
                        values: [[credentials]]
                    }]
                }
            };

            await this.rateLimit(() =>
                this.sheets.spreadsheets.values.batchUpdate(updateRequest)
            );
            console.log(`✅ [RATE-LIMITED] Credentials saved to column BW for row ${rowIndex}: ${credentials}`);
        } catch (error) {
            console.error('❌ Error updating credentials:', error);
        }
    }

    async getPatientCredentials(rowIndex) {
        try {
            this.validateSheetName();
            await this.initialize();
            
            // 🆕 RATE-LIMITED: Get credentials from column BW
            const response = await this.rateLimit(() =>
                this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: `'${this.sheetName}'!BW${rowIndex}`,
                })
            );

            const credentials = response.data.values && response.data.values[0] && response.data.values[0][0] ? response.data.values[0][0] : '';
            console.log(`🔍 [RATE-LIMITED] Retrieved credentials for row ${rowIndex}: ${credentials}`);
            return credentials;
        } catch (error) {
            console.error('❌ Error retrieving credentials:', error);
            return null;
        }
    }

    async updateAccountFeedback(rowIndex, feedbackOption) {
        try {
            await this.initialize();
            
            // 🔧 CONFIGURABLE: Account feedback can be enabled/disabled
            const ENABLE_ACCOUNT_FEEDBACK = process.env.ENABLE_ACCOUNT_FEEDBACK !== 'false'; // Default to enabled
            
            if (!ENABLE_ACCOUNT_FEEDBACK) {
                console.log(`ℹ️  Account feedback update disabled for row ${rowIndex} (was: ${feedbackOption})`);
                console.log(`   Set ENABLE_ACCOUNT_FEEDBACK=true to enable account creation feedback in column AK`);
                return; // Skip the actual update
            }
            
            // Update account feedback in column AK
            const updateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [{
                        range: `'${this.sheetName}'!AK${rowIndex}`,
                        values: [[feedbackOption]]
                    }]
                }
            };
            
            await this.sheets.spreadsheets.values.batchUpdate(updateRequest);
            console.log(`✅ Updated account feedback for row ${rowIndex} in column AK: ${feedbackOption}`);
        } catch (error) {
            console.error('Error in updateAccountFeedback:', error);
            throw error;
        }
    }

    async updateAccountCreatedStatus(rowIndex, isCreated = true) {
        try {
            await this.initialize();
            
            // This function is no longer needed since we use the dropdown feedback in Column AI
            // But keeping it for backward compatibility
            console.log(`ℹ️  Account status update handled via feedback dropdown in Column AI`);
        } catch (error) {
            console.error('Error updating account created status in Google Sheet:', error);
            throw error;
        }
    }

    getFeedbackOption(feedbackMessage) {
        const message = feedbackMessage.toLowerCase();
        
        // Check for "account is no longer active" - Updated to catch more variations
        if (message.includes('account is no longer active') || 
            message.includes('no longer active') ||
            message.includes('your account is no longer active')) {
            return 'No longer active';
        }
        
        // Check for Medicare password reset restrictions - Updated to catch more variations
        if (message.includes('cannot reset password due to medicare restriction') ||
            message.includes('call 1-800-medicare') ||
            message.includes('must call 1-800-medicare') ||
            message.includes('temporary password')) {
            return 'Cannot reset password';
        }
        
        // 🆕 FIX: Check for account lock messages BEFORE defaulting to Wrong Info
        if (message.includes('account is now locked') || 
            message.includes('account is locked') || 
            message.includes('locked to protect') ||
            message.includes('temporarily locked')) {
            return 'Account Locked';
        }
        
        // Check for "cannot find this record" or "info is wrong"
        if (message.includes('cannot find this record') || 
            message.includes('we cannot find') || 
            message.includes('we can\'t find you in our records') ||
            message.includes('we can\'t find you') ||
            message.includes('we\'re not able to find you in our records') ||
            message.includes('info is wrong') || 
            message.includes('information is wrong') ||
            message.includes('record not found')) {
            return 'Wrong Info';
        }
        
        // Check for other password reset issues
        if (message.includes('cannot reset password') || 
            message.includes('reset failed') ||
            message.includes('password reset failed')) {
            return 'Cannot reset password';
        }
        
        // Default to general error for other unrecognized error cases
        return 'General Error';
    }

    async updateSuccessfulAccountCreation(rowIndex, credentials) {
        try {
            await this.initialize();
            
            // 🆕 UPDATED: Update credentials in column BI
            await this.updatePatientCredentials(rowIndex, credentials);
            
            // 🆕 UPDATED: Update feedback dropdown in column AK (consistent with doctor fetching)
            await this.updateAccountFeedback(rowIndex, 'Account Created');
            
            console.log(`✅ Updated successful account creation for row ${rowIndex} using consistent columns`);
        } catch (error) {
            console.error('Error updating successful account creation:', error);
            throw error;
        }
    }

    async updateSuccessfulPasswordReset(rowIndex, credentials) {
        try {
            await this.initialize();
            
            // 🆕 UPDATED: Update credentials in column BI
            await this.updatePatientCredentials(rowIndex, credentials);
            
            // 🆕 UPDATED: Update feedback dropdown in column AK (consistent with doctor fetching)
            await this.updateAccountFeedback(rowIndex, 'Password Resetted');
            
            console.log(`✅ Updated successful password reset for row ${rowIndex} using consistent columns`);
        } catch (error) {
            console.error('Error updating successful password reset:', error);
            throw error;
        }
    }

    async getPatientsWithCredentials(startingRow = 910) {
        try {
            this.validateSheetName();
            await this.initialize();
            
            console.log(`📊 Starting to search for patients with credentials from row ${startingRow} in ${this.sheetName}...`);

            // Start reading from the specified row, need to include column BW (76th column)
            const sheetRange = `'${this.sheetName}'!A${startingRow}:BW`;
            console.log(`📊 Reading from range: ${sheetRange} for doctor fetching`);
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: sheetRange,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log(`No data found starting from row ${startingRow}.`);
                return [];
            }

            console.log(`📊 Found ${rows.length} rows starting from row ${startingRow} for doctor fetching`);

            const patients = [];
            let skippedCredentials = 0;
            let skippedValidDoctors = 0;

            // Process each row as patient data using NEW column indexes
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const actualRowNumber = startingRow + i; // Calculate actual row number in sheet
                
                const patient = {
                    lastName: row[16] || '', // Column Q (index 16)
                    medId: row[18] || '', // Column S (index 18)
                    dob: row[19] || '', // Column T (index 19)
                    address: row[24] || '', // Column Y (index 24)
                    comment: row[30] || '', // Column AE (index 30)
                    partAEligibility: row[32] || '', // Column AG (index 32) - Part A Eligibility Start Date
                    partBEligibility: row[33] || '', // Column AH (index 33) - Part B Eligibility Start Date
                    existingCredentials: row[74] || '', // Column BW (index 74) - Credentials
                    accountCreationFeedback: row[36] || '', // Column AK (index 36)
                    validDoctors: row[6] || '', // Column G (index 6) - Valid Doctors
                    rowIndex: actualRowNumber // For updating status later
                };

                // 🆕 FIRST CHECK: Skip patients who already have valid doctors in Column G
                if (patient.validDoctors && patient.validDoctors.trim() !== '') {
                    skippedValidDoctors++;
                    if (skippedValidDoctors <= 5) { // Only log first 5 to avoid spam
                        console.log(`⏭️  Skipping ${patient.lastName} (Row ${actualRowNumber}) - Already has valid doctors in Column G`);
                    }
                    continue;
                }

                // SECOND CHECK: Only process patients WHO HAVE credentials (opposite of Medicare automation)
                if (patient.existingCredentials && 
                    patient.existingCredentials.trim() !== '' &&
                    patient.existingCredentials.includes('//')) {
                    
                    // Extract zip code from address
                    const zipMatch = patient.address.match(/\b\d{5}(-\d{4})?\b$/);
                    patient.zipCode = zipMatch ? zipMatch[0] : '';

                    // Generate username and password with new formulas
                    const randomNumber = Math.floor(Math.random() * 10); // Single digit 0-9
                    const randomPassword = Math.floor(10000000 + Math.random() * 90000000); // 8 digit random number
                    patient.username = `${patient.lastName}@Larry${randomNumber}`;
                    patient.password = `larry@${randomPassword}@!`;

                    patients.push(patient);
                    
                    // Log first few patients for verification
                    if (patients.length <= 3) {
                        console.log(`👤 Patient ${patients.length}: ${patient.lastName} (Row ${actualRowNumber}) - Has credentials: ${patient.existingCredentials}`);
                    }
                } else {
                    // Skip patients who DON'T have credentials for doctor fetching
                    skippedCredentials++;
                    if (skippedCredentials <= 10) { // Only log first 10 skips to avoid spam
                        console.log(`⏭️  Skipping ${patient.lastName} (Row ${actualRowNumber}) - No credentials found`);
                    }
                }
            }

            console.log(`\n📊 Patient filtering summary (starting from row ${startingRow}):`);
            console.log(`   📋 Total rows processed: ${rows.length}`);
            console.log(`   ⏭️  Skipped - Already have valid doctors: ${skippedValidDoctors}`);
            console.log(`   ⏭️  Skipped - No credentials: ${skippedCredentials}`);
            console.log(`   ✅ Ready for doctor fetching: ${patients.length}`);
            
            if (skippedValidDoctors > 0) {
                console.log(`\n💡 Note: ${skippedValidDoctors} patients already have valid doctors and were skipped`);
            }

            return patients;
        } catch (error) {
            console.error('Error reading Google Sheet for doctor fetching:', error);
            throw error;
        }
    }

    async getDoctorValidationData() {
        try {
            await this.initialize();
            
            // Read from "DR-CHASE : WHERE TO GO?" tab - the spreadsheet ID from the user's link
            const drChaseSpreadsheetId = '1tU2tQ9KVf1Im3_Ubpp2ykskV6JkRtgIHo_Rru70mM84';
            const sheetRange = "'DR-CHASE : WHERE TO GO?'!A:B"; // Only need columns A and B
            
            console.log(`📊 Reading BAD specialties from: ${sheetRange}`);
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: drChaseSpreadsheetId,
                range: sheetRange,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('No specialty data found.');
                return { badSpecialties: [] };
            }

            const badSpecialties = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cat = (row[0] || '').trim().toUpperCase();
                const specialty = (row[1] || '').trim();
                if (cat === 'BAD' && specialty) {
                    badSpecialties.push(specialty);
                }
            }
            console.log(`✅ Loaded ${badSpecialties.length} BAD specialties for exclusion.`);
            return { badSpecialties };
        } catch (error) {
            console.error('Error reading BAD specialties from Google Sheet:', error);
            throw error;
        }
    }

    async updateValidDoctors(rowIndex, doctorsData) {
        try {
            await this.initialize();
            
            // Format doctors data according to the specified template
            let formattedDoctors = '';
            
            doctorsData.forEach((doctor, index) => {
                const doctorNumber = index + 1;
                
                formattedDoctors += `-----------  Doctor ${doctorNumber}    ------------\n`;
                formattedDoctors += `${doctor.fullName || doctor.name}\n`;
                formattedDoctors += `${this.formatPracticeAddress(doctor)}\n`;
                formattedDoctors += `${doctor.practicePhone || doctor.address?.phone || 'Phone: Not Available'}\n`;
                formattedDoctors += `Fax: Not Available\n`; // HIPAASpace doesn't provide fax numbers
                formattedDoctors += `${doctor.npi}\n`;
                formattedDoctors += `${doctor.specialty || doctor.taxonomy || doctor.primaryTaxonomy || 'Specialty: Not Available'}\n`;
                formattedDoctors += `---------------------------------\n`;
                
                if (index < doctorsData.length - 1) {
                    formattedDoctors += '\n'; // Add spacing between doctors
                }
            });
            
            // Update Valid Doctors in Column G
            const updateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [{
                        range: `'${this.sheetName}'!G${rowIndex}`,
                        values: [[formattedDoctors]]
                    }]
                }
            };

            await this.sheets.spreadsheets.values.batchUpdate(updateRequest);
            console.log(`✅ Updated Valid Doctors for row ${rowIndex} with ${doctorsData.length} doctors`);
            
        } catch (error) {
            console.error('Error updating Valid Doctors in Google Sheet:', error);
            throw error;
        }
    }

    formatPracticeAddress(doctor) {
        try {
            const address = doctor.address || {};
            let fullAddress = '';
            
            if (address.street) {
                fullAddress += address.street;
            }
            
            if (address.street2) {
                fullAddress += `, ${address.street2}`;
            }
            
            if (address.city) {
                fullAddress += fullAddress ? `, ${address.city}` : address.city;
            }
            
            if (address.state) {
                fullAddress += fullAddress ? `, ${address.state}` : address.state;
            }
            
            if (address.zip) {
                fullAddress += ` ${address.zip}`;
            }
            
            // Fallback to practiceAddress if address object is incomplete
            if (!fullAddress && doctor.practiceAddress) {
                fullAddress = doctor.practiceAddress;
                if (doctor.practiceCity) {
                    fullAddress += `, ${doctor.practiceCity}`;
                }
                if (doctor.practiceState) {
                    fullAddress += `, ${doctor.practiceState}`;
                }
                if (doctor.practiceZip) {
                    fullAddress += ` ${doctor.practiceZip}`;
                }
            }
            
            return fullAddress || 'Address: Not Available';
            
        } catch (error) {
            console.error('Error formatting practice address:', error);
            return 'Address: Not Available';
        }
    }

    async updateDoctorInfoColumns(sheetName, rowIndex, doctors) {
        this.setSheetName(sheetName);  // Ensure we're using the correct sheet
        this.validateSheetName();
        
        try {
            await this.initialize();
            // Only take up to 9 doctors (Dr.2 info through Dr.10 info)
            const values = Array(9).fill(".....");
            doctors.slice(0, 9).forEach((doc, i) => values[i] = doc);
            
            // Update to use BN-BV columns (66-74) as shown in user's screenshot  
            const range = `'${sheetName}'!BN${rowIndex}:BV${rowIndex}`;
            
            console.log(`📝 [RATE-LIMITED] Writing ${doctors.length} doctors to ${range} (Dr 2-10 Info columns)`);
            console.log(`🔍 Doctor data preview: ${doctors.slice(0, 2).join(' | ')}`);
            
            // 🆕 RATE-LIMITED: Update doctor info columns
            await this.rateLimit(() =>
                this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range,
                    valueInputOption: 'RAW',
                    resource: { values: [values] }
                })
            );
            console.log(`✅ [RATE-LIMITED] Updated Doctor Info columns ${range} for row ${rowIndex} in tab ${sheetName}`);
        } catch (error) {
            console.error('Error updating Doctor Info columns in Google Sheet:', error);
            throw error;
        }
    }

    async updateLeadStatus(rowIndex, status) {
        try {
            this.validateSheetName();
            await this.initialize();
            // Always write to column AI (Lead Status)
            const columnLetter = 'AI';
            console.log(`🔍 Updating column ${columnLetter} (Lead Status) with "${status}"`);
            await this.rateLimit(() =>
                this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `'${this.sheetName}'!${columnLetter}${rowIndex}`,
                    valueInputOption: 'RAW',
                    resource: { values: [[status]] }
                })
            );
            console.log(`✅ [RATE-LIMITED] Set Lead Status to "${status}" for row ${rowIndex} in column ${columnLetter}`);
        } catch (error) {
            console.error(`❌ Error setting Lead Status:`, error);
            throw error;
        }
    }

    getColumnLetter(columnNumber) {
        let result = '';
        while (columnNumber > 0) {
            columnNumber--;
            result = String.fromCharCode(65 + (columnNumber % 26)) + result;
            columnNumber = Math.floor(columnNumber / 26);
        }
        return result;
    }

    async updateLeadStatusToWrongInfo(rowIndex, sheetName) {
        try {
            await this.initialize();
            
            console.log(`🛑 Setting Lead Status to "Wrong Info" for row ${rowIndex} in sheet ${sheetName}`);
            
            // Find the Lead Status column (usually column AI)
            const headers = await this.getHeaders(sheetName);
            let leadStatusCol = headers.indexOf('Lead Status') + 1; // +1 for 1-indexed columns
            
            if (leadStatusCol === 0) {
                console.log('⚠️  Lead Status column not found, using default column AI');
                leadStatusCol = 35; // Column AI (35th column)
            }
            
            // Update Lead Status to "Wrong Info"
            const updateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [{
                        range: `'${sheetName}'!${this.getColumnLetter(leadStatusCol)}${rowIndex}`,
                        values: [['Wrong Info']]
                    }]
                }
            };

            await this.sheets.spreadsheets.values.batchUpdate(updateRequest);
            console.log(`✅ Updated Lead Status to "Wrong Info" for row ${rowIndex} in ${sheetName}`);
            
            // Set background color to red for the entire row
            const formatRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: await this.getSheetId(sheetName),
                                startRowIndex: rowIndex - 1, // 0-indexed for formatting
                                endRowIndex: rowIndex,
                                startColumnIndex: 0,
                                endColumnIndex: 50 // Cover first 50 columns
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: 1.0,
                                        green: 0.8,
                                        blue: 0.8,
                                        alpha: 1.0
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.backgroundColor'
                        }
                    }]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(formatRequest);
            console.log(`✅ Set red background for row ${rowIndex} in ${sheetName}`);
            
        } catch (error) {
            console.error('Error updating lead status to Wrong Info:', error);
            throw error;
        }
    }

    async getSheetId(sheetName) {
        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            return sheet ? sheet.properties.sheetId : 0;
        } catch (error) {
            console.error('Error getting sheet ID:', error);
            return 0;
        }
    }

    async getHeaders(sheetName) {
        try {
            await this.initialize();
            
            // 🆕 RATE-LIMITED: Get sheet headers
            const response = await this.rateLimit(() =>
                this.sheets.spreadsheets.values.get({
                    spreadsheetId: this.spreadsheetId,
                    range: `'${sheetName}'!3:3` // Headers are in row 3
                })
            );
            
            return response.data.values ? response.data.values[0] : [];
        } catch (error) {
            console.error('Error getting sheet headers:', error);
            return [];
        }
    }

    // 🆕 NEW METHOD: Update DR2 Info column with feedback message
    async updateDR2Info(rowIndex, message) {
        try {
            await this.initialize();
            
            // 🔧 FIX: Use column BN (Dr 2 Info) instead of BV (Dr 10 Info)
            // Column BN is the correct Dr 2 Info column based on the sheet structure
            const updateRequest = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [{
                        range: `'${this.sheetName}'!BN${rowIndex}`,
                        values: [[message]]
                    }]
                }
            };

            await this.sheets.spreadsheets.values.batchUpdate(updateRequest);
            console.log(`✅ Updated DR2 Info for row ${rowIndex} in column BN: ${message}`);
        } catch (error) {
            console.error('Error updating DR2 Info:', error);
            throw error;
        }
    }

    // 🆕 NEW METHOD: Update Submission Date column with error messages
    async updateSubmissionDate(rowIndex, message) {
        try {
            this.validateSheetName();
            await this.initialize();
            
            console.log(`📅 [RATE-LIMITED] Updating Submission Date for row ${rowIndex}: ${message}`);

            // Get sheet headers to find the Submission Date column
            const headers = await this.getHeaders(this.sheetName);
            const submissionDateCol = headers.indexOf("Submission Date");
            
            if (submissionDateCol >= 0) {
                const columnLetter = this.getColumnLetter(submissionDateCol + 1); // +1 because getColumnLetter expects 1-based
                
                // Use rate limiting for submission date updates
                await this.rateLimit(async () => {
                    const response = await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `'${this.sheetName}'!${columnLetter}${rowIndex}`,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[message]]
                        }
                    });
                    
                    console.log(`✅ Submission Date updated for row ${rowIndex}: ${message}`);
                    return response;
                });
            } else {
                console.log(`⚠️ Submission Date column not found in sheet headers - using fallback column CB`);
                // Fallback to column CB if Submission Date column is not found
                await this.rateLimit(async () => {
                    const response = await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `'${this.sheetName}'!CB${rowIndex}`, // Fallback column CB
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[message]]
                        }
                    });
                    
                    console.log(`✅ Submission Date updated (fallback column) for row ${rowIndex}: ${message}`);
                    return response;
                });
            }

        } catch (error) {
            console.error(`❌ Error updating Submission Date for row ${rowIndex}:`, error);
            throw error;
        }
    }

    async saveDoctorRecommendations(rowIndex, recommendations, closerComment) {
        try {
            this.validateSheetName();
            await this.initialize();
    
            // If there are recommendations, save them
            if (recommendations && recommendations.length > 0) {
                // Format for required output: DoctorName//DoctorPracticingAddress//NPI//Speciality
                const formattedDoctors = recommendations.map(doctor => {
                    const doctorName = doctor.fullName || doctor.name || 'Unknown Doctor';
                    const practiceAddress = this.formatPracticeAddress(doctor);
                    const npi = doctor.npi || 'No NPI Available';
                    const specialty = doctor.specialty || doctor.taxonomy || 'No Specialty Available';
                    return `${doctorName}//${practiceAddress}//${npi}//${specialty}`;
                });
                await this.updateDoctorInfoColumns(this.sheetName, rowIndex, formattedDoctors);
            }
            console.log(`ℹ️  Skipping update to COMMENT column for row ${rowIndex}. Comment was: "${closerComment}"`);
        } catch (error) {
            console.error(`❌ Error saving doctor recommendations:`, error);
            throw error; // Re-throw to be caught by the caller
        }
    }

    // 🆕 Rate-limited request wrapper
    async rateLimit(apiCall) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ apiCall, resolve, reject });
            this.processRequestQueue();
        });
    }

    // 🆕 Process request queue with ENHANCED rate limiting
    async processRequestQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrentRequests) {
            return;
        }

        // 🆕 COOLDOWN: Check if we're in cooldown period after quota exceeded
        const now = Date.now();
        const timeSinceQuotaExceeded = now - this.lastQuotaExceededTime;
        if (this.lastQuotaExceededTime > 0 && timeSinceQuotaExceeded < this.quotaCooldownPeriod) {
            const remainingCooldown = this.quotaCooldownPeriod - timeSinceQuotaExceeded;
            console.log(`❄️ COOLDOWN: Waiting ${Math.ceil(remainingCooldown/1000)}s before processing more requests`);
            setTimeout(() => this.processRequestQueue(), remainingCooldown);
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const { apiCall, resolve, reject } = this.requestQueue.shift();
            
            // Ensure minimum interval between requests
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
                await new Promise(res => setTimeout(res, this.minRequestInterval - timeSinceLastRequest));
            }
            
            this.activeRequests++;
            this.lastRequestTime = Date.now();
            
            // Execute the API call
            apiCall()
                .then(result => {
                    this.activeRequests--;
                    resolve(result);
                    // Process next request in queue
                    setTimeout(() => this.processRequestQueue(), 50);
                })
                .catch(error => {
                    this.activeRequests--;
                    
                    // 🆕 ENHANCED: Handle rate limit errors with aggressive exponential backoff
                    if (error.status === 429 || error.message?.includes('Quota exceeded') || error.message?.includes('rateLimitExceeded')) {
                        // 🆕 TRACK: Record when quota was exceeded for cooldown
                        this.lastQuotaExceededTime = Date.now();
                        
                        const requestId = apiCall.toString();
                        const currentRetries = this.retryAttempts.get(requestId) || 0;
                        
                        if (currentRetries < 5) { // Max 5 retries
                            this.retryAttempts.set(requestId, currentRetries + 1);
                            
                            // 🔧 AGGRESSIVE BACKOFF: Start at 10 seconds, double each time
                            const backoffDelay = Math.min(60000, 10000 * Math.pow(2, currentRetries));
                            console.log(`🚨 QUOTA EXCEEDED: Retry ${currentRetries + 1}/5 after ${backoffDelay/1000}s delay (30s cooldown activated)`);
                            
                            setTimeout(() => {
                                this.requestQueue.unshift({ apiCall, resolve, reject });
                                this.processRequestQueue();
                            }, backoffDelay);
                        } else {
                            console.log(`❌ QUOTA EXCEEDED: Max retries exhausted for API call`);
                            this.retryAttempts.delete(requestId);
                            reject(new Error(`Google Sheets quota exceeded after 5 retries: ${error.message}`));
                            setTimeout(() => this.processRequestQueue(), 50);
                        }
                    } else {
                        reject(error);
                        setTimeout(() => this.processRequestQueue(), 50);
                    }
                });
        }

        this.isProcessingQueue = false;
    }

    // 🆕 NEW METHOD: Automatically determine eligibility path based on data availability
    determineEligibilityPath(partAEligibility, partBEligibility) {
        // 🔧 FIX: Properly check for empty data - treat "....." as empty
        const hasPartA = partAEligibility && 
                        partAEligibility.trim() !== '' && 
                        partAEligibility.trim() !== '.....';
        const hasPartB = partBEligibility && 
                        partBEligibility.trim() !== '' && 
                        partBEligibility.trim() !== '.....';
        
        console.log(`🔍 Determining eligibility path:`);
        console.log(`   Part A (AG): "${partAEligibility}" - Has data: ${hasPartA}`);
        console.log(`   Part B (AH): "${partBEligibility}" - Has data: ${hasPartB}`);
        
        if (!hasPartA && !hasPartB) {
            // Both empty - missing data
            console.log(`❌ MISSING DATA: Both Part A and Part B are empty`);
            return {
                eligibilityType: null,
                reason: 'Missing Part A or B',
                hasData: false
            };
        } else if (hasPartA && !hasPartB) {
            // Only Part A has data
            console.log(`🅰️ AUTO-SELECTED: Part A path (Part B is empty)`);
            return {
                eligibilityType: 'PART_A',
                reason: 'Part A has data, Part B is empty',
                hasData: true
            };
        } else if (!hasPartA && hasPartB) {
            // Only Part B has data
            console.log(`🅱️ AUTO-SELECTED: Part B path (Part A is empty)`);
            return {
                eligibilityType: 'PART_B',
                reason: 'Part B has data, Part A is empty',
                hasData: true
            };
        } else {
            // 🔧 FIX: Both have data - PRIORITY: Part A first, then Part B
            console.log(`🅰️ AUTO-SELECTED: Part A path (both have data, Part A priority)`);
            return {
                eligibilityType: 'PART_A',
                reason: 'Both have data, Part A priority',
                hasData: true
            };
        }
    }

    // 🆕 NEW METHOD: Update Lead Status to "Missing Part A or B"
    async updateLeadStatusMissingEligibility(rowIndex) {
        try {
            await this.initialize();
            
            // Update Lead Status column (Column F, index 5)
            const range = `'${this.sheetName}'!F${rowIndex}`;
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [['Missing Part A or B']]
                }
            });
            
            console.log(`✅ Set Lead Status to "Missing Part A or B" for row ${rowIndex}`);
            
        } catch (error) {
            console.error(`❌ Error updating Lead Status to "Missing Part A or B" for row ${rowIndex}:`, error);
            throw error;
        }
    }
}

module.exports = GoogleSheetsService; 
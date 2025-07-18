const GoogleAuthAuto = require('./google-auth-auto');

async function debugSheet() {
    try {
        const authService = new GoogleAuthAuto();
        const sheets = await authService.getSheetsService();
        const spreadsheetId = '1EzSvPWiJO47W9C7-ZJI910CT9NOGsnuZXdnQhNiTHh4';
        
        console.log('📊 Reading from "Dr Checking" sheet...\n');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: "'Dr Checking'!A1:Z10", // First 10 rows, all columns
        });

        const rows = response.data.values;
        
        if (!rows || rows.length === 0) {
            console.log('❌ No data found');
            return;
        }

        console.log('📋 Column Headers (Row 1):');
        console.log(rows[0]);
        console.log('\n🔢 Column Count:', rows[0].length);
        
        console.log('\n📄 First 5 data rows:');
        for (let i = 1; i < Math.min(6, rows.length); i++) {
            console.log(`Row ${i + 1}:`, rows[i]);
        }
        
        console.log('\n🔍 Looking for required columns:');
        const headers = rows[0];
        const requiredColumns = ['LAST NAME', 'MED ID', 'DOB', 'Part A Elibility Start', 'ADDRESS'];
        
        requiredColumns.forEach(col => {
            const index = headers.indexOf(col);
            if (index !== -1) {
                console.log(`✅ "${col}" found at column ${index + 1} (${String.fromCharCode(65 + index)})`);
            } else {
                console.log(`❌ "${col}" NOT FOUND`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// TEST FUNCTION: Write a unique value to AI44 in INCALL_1_RESPONSE
async function testWriteToAI44() {
    try {
        const authService = new GoogleAuthAuto();
        const sheets = await authService.getSheetsService();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1EzSvPWiJO47W9C7-ZJI910CT9NOGsnuZXdnQhNiTHh4';
        const range = "INCALL_1_RESPONSE!AI44";
        const value = `DEBUG_WRITE_${Date.now()}`;
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values: [[value]] }
        });
        console.log(`✅ Wrote '${value}' to ${range}`);
    } catch (error) {
        console.error('❌ Error writing to AI44:', error.message);
    }
}

// Uncomment to run the test
testWriteToAI44();

debugSheet(); 
const { google } = require('googleapis');

console.log('🔧 OAuth Setup Helper for Medicare Automation');
console.log('============================================\n');

console.log('📋 Steps to fix OAuth configuration:\n');

console.log('1. Go to Google Cloud Console:');
console.log('   https://console.cloud.google.com/apis/credentials?project=cobalt-chalice-461823-r2\n');

console.log('2. Click your OAuth 2.0 Client ID or create a new one\n');

console.log('3. Set Application Type: Desktop Application\n');

console.log('4. Add Authorized redirect URI:');
console.log('   urn:ietf:wg:oauth:2.0:oob\n');

console.log('5. Enable Google Sheets API:');
console.log('   https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=cobalt-chalice-461823-r2\n');

console.log('6. Configure OAuth Consent Screen:');
console.log('   https://console.cloud.google.com/apis/credentials/consent?project=cobalt-chalice-461823-r2\n');

console.log('7. Add these scopes in OAuth consent screen:');
console.log('   - https://www.googleapis.com/auth/spreadsheets\n');

console.log('8. If app is in "Testing" mode, add your email as test user\n');

console.log('✅ After completing these steps, run: npm start');

// Test function to verify OAuth setup
async function testOAuthSetup() {
    try {
        const credentials = require('./google-credentials.json');
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        
        console.log('\n🔍 Current OAuth Configuration:');
        console.log('Client ID:', client_id);
        console.log('Redirect URI:', redirect_uris[0]);
        console.log('Project ID:', credentials.installed.project_id);
        
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        console.log('\n🔗 Test Authentication URL:');
        console.log(authUrl);
        console.log('\nIf this URL works in browser, your OAuth is configured correctly!');
        
    } catch (error) {
        console.error('\n❌ Error testing OAuth setup:', error.message);
    }
}

testOAuthSetup(); 
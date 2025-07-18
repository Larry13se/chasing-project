const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

class GoogleAuthService {
    constructor() {
        this.SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
        this.TOKEN_PATH = path.join(__dirname, 'token.json');
        this.CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
    }

    async loadCredentials() {
        try {
            const content = await fs.readFile(this.CREDENTIALS_PATH);
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Error loading credentials file: ${error.message}`);
        }
    }

    async loadSavedTokens() {
        try {
            const token = await fs.readFile(this.TOKEN_PATH);
            return JSON.parse(token);
        } catch (error) {
            return null;
        }
    }

    async saveTokens(tokens) {
        try {
            await fs.writeFile(this.TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('✅ Token stored to', this.TOKEN_PATH);
        } catch (error) {
            console.error('Error saving tokens:', error);
        }
    }

    async getNewToken(oAuth2Client) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
        });

        console.log('\n🔐 Google Sheets Authentication Required');
        console.log('==========================================');
        console.log('1. Open this URL in your browser:');
        console.log('\n' + authUrl + '\n');
        console.log('2. Sign in with your Google account');
        console.log('3. Copy the authorization code from the browser');
        console.log('4. Paste it below and press Enter');
        console.log('==========================================\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            rl.question('Enter the authorization code: ', async (code) => {
                rl.close();
                try {
                    const { tokens } = await oAuth2Client.getToken(code);
                    oAuth2Client.setCredentials(tokens);
                    await this.saveTokens(tokens);
                    console.log('✅ Authentication successful!\n');
                    resolve(oAuth2Client);
                } catch (error) {
                    console.error('❌ Error retrieving access token:', error);
                    reject(error);
                }
            });
        });
    }

    async authorize() {
        try {
            const credentials = await this.loadCredentials();
            const { client_secret, client_id, redirect_uris } = credentials.installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

            // Try to load existing tokens
            const tokens = await this.loadSavedTokens();
            if (tokens) {
                oAuth2Client.setCredentials(tokens);
                
                // Test if the token is still valid
                try {
                    await oAuth2Client.getAccessToken();
                    console.log('✅ Using existing authentication tokens');
                    return oAuth2Client;
                } catch (error) {
                    console.log('🔄 Existing tokens expired, getting new ones...');
                    return await this.getNewToken(oAuth2Client);
                }
            } else {
                console.log('🔑 No existing tokens found, starting authentication...');
                return await this.getNewToken(oAuth2Client);
            }
        } catch (error) {
            throw new Error(`Authorization failed: ${error.message}`);
        }
    }

    async getSheetsService() {
        const auth = await this.authorize();
        return google.sheets({ version: 'v4', auth });
    }
}

module.exports = GoogleAuthService; 
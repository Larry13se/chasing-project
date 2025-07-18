const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');
const open = require('open');
const net = require('net');
const { exec } = require('child_process');

class GoogleAuthAuto {
    constructor() {
        this.SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
        this.TOKEN_PATH = path.join(__dirname, 'token.pickle');
        this.CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
        this.REDIRECT_URI = 'http://localhost:3000/oauth/callback'; // This will be updated dynamically
        this.callbackPort = 3000; // Starting port, will be updated if needed
    }

    async loadCredentials() {
        try {
            const content = await fs.readFile(this.CREDENTIALS_PATH);
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Error loading credentials.json: ${error.message}`);
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
            console.log('✅ Tokens saved to token.pickle');
        } catch (error) {
            console.error('Error saving tokens:', error);
        }
    }

    async findAvailablePort(startPort = 3000) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            
            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => {
                    resolve(port);
                });
            });
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    // Port is in use, try the next one
                    this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
        });
    }

    async killPortProcesses(port) {
        // Kill any existing processes using the port
        const isWindows = process.platform === 'win32';
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`⚠️ Port cleanup timeout for port ${port}`);
                resolve();
            }, 5000); // 5 second timeout
            
            if (isWindows) {
                exec(`netstat -ano | findstr :${port}`, { timeout: 3000 }, (error, stdout) => {
                    clearTimeout(timeout);
                    
                    if (stdout) {
                        const lines = stdout.trim().split('\n');
                        const pids = lines.map(line => {
                            const parts = line.trim().split(/\s+/);
                            return parts[parts.length - 1];
                        }).filter(pid => pid && pid !== '0');
                        
                        if (pids.length > 0) {
                            console.log(`🔧 Killing existing processes on port ${port}: ${pids.join(', ')}`);
                            pids.forEach(pid => {
                                exec(`taskkill /F /PID ${pid}`, () => {});
                            });
                        }
                    }
                    setTimeout(resolve, 1000); // Give time for processes to be killed
                });
            } else {
                exec(`lsof -ti:${port}`, { timeout: 3000 }, (error, stdout) => {
                    clearTimeout(timeout);
                    
                    if (stdout) {
                        const pids = stdout.trim().split('\n').filter(pid => pid);
                        if (pids.length > 0) {
                            console.log(`🔧 Killing existing processes on port ${port}: ${pids.join(', ')}`);
                            exec(`kill -9 ${pids.join(' ')}`, () => {});
                        }
                    }
                    setTimeout(resolve, 1000); // Give time for processes to be killed
                });
            }
        });
    }

    async startCallbackServer(oAuth2Client) {
        // Use the port that was already allocated in authenticateWithBrowser
        const availablePort = this.callbackPort;
        
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const url = new URL(req.url, `http://localhost:${availablePort}`);
                    
                    if (url.pathname === '/oauth/callback') {
                        const code = url.searchParams.get('code');
                        
                        if (code) {
                            // Success page
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                                        <h1 style="color: green;">✅ Authentication Successful!</h1>
                                        <p>You can close this window and return to the terminal.</p>
                                        <p>Medicare automation is now ready to run!</p>
                                        <p style="color: #666; font-size: 12px;">Port: ${availablePort}</p>
                                    </body>
                                </html>
                            `);
                            
                            server.close();
                            
                            // Exchange code for tokens
                            const { tokens } = await oAuth2Client.getToken(code);
                            oAuth2Client.setCredentials(tokens);
                            await this.saveTokens(tokens);
                            
                            resolve(oAuth2Client);
                        } else {
                            throw new Error('No authorization code received');
                        }
                    } else {
                        res.writeHead(404);
                        res.end('Not found');
                    }
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body style="font-family: Arial; text-align: center; padding: 50px;">
                                <h1 style="color: red;">❌ Authentication Failed</h1>
                                <p>Error: ${error.message}</p>
                                <p>Please try again.</p>
                            </body>
                        </html>
                    `);
                    server.close();
                    reject(error);
                }
            });

            server.listen(availablePort, () => {
                console.log(`🌐 Callback server started on http://localhost:${availablePort}`);
            });

            server.on('error', (error) => {
                console.error(`❌ Server error on port ${availablePort}:`, error);
                reject(error);
            });
        });
    }

    async authenticateWithBrowser(oAuth2Client) {
        console.log('\n🔐 Starting automatic browser authentication...');
        
        // First, get the available port and update the redirect URI
        await this.killPortProcesses(3000);
        const availablePort = await this.findAvailablePort(3000);
        this.callbackPort = availablePort;
        this.REDIRECT_URI = `http://localhost:${availablePort}/oauth/callback`;
        
        // Update the OAuth client with the correct redirect URI
        const credentials = await this.loadCredentials();
        const { client_secret, client_id } = credentials.installed || credentials.web;
        const updatedOAuth2Client = new google.auth.OAuth2(client_id, client_secret, this.REDIRECT_URI);
        
        const authUrl = updatedOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
        });

        console.log('🌐 Opening browser for authentication...');
        console.log(`🔧 Using port: ${availablePort}`);
        console.log('📋 If browser doesn\'t open automatically, visit:');
        console.log(authUrl);
        
        // Start callback server with the updated client
        const serverPromise = this.startCallbackServer(updatedOAuth2Client);
        
        // Open browser
        try {
            await open(authUrl);
        } catch (error) {
            console.log('⚠️  Could not open browser automatically. Please open the URL above manually.');
        }
        
        return serverPromise;
    }

    async authorize() {
        try {
            const credentials = await this.loadCredentials();
            const { client_secret, client_id } = credentials.installed || credentials.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, this.REDIRECT_URI);

            // Try to load existing tokens
            const tokens = await this.loadSavedTokens();
            if (tokens) {
                oAuth2Client.setCredentials(tokens);
                
                // Test if the token is still valid
                try {
                    await oAuth2Client.getAccessToken();
                    console.log('✅ Using existing authentication tokens from token.pickle');
                    return oAuth2Client;
                } catch (error) {
                    console.log('🔄 Existing tokens expired, getting new ones...');
                    return await this.authenticateWithBrowser(oAuth2Client);
                }
            } else {
                console.log('🔑 No existing tokens found, starting browser authentication...');
                return await this.authenticateWithBrowser(oAuth2Client);
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

module.exports = GoogleAuthAuto; 
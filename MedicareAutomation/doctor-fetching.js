const { chromium } = require('playwright');
const GoogleSheetsService = require('./google-sheets-service');
const NewDoctorAPIService = require('./new-doctor-api-service');
const PECOSEnrollmentService = require('./pecos-enrollment-service');
require('dotenv').config();

class DoctorFetching {
    constructor(googleSheetsService, chromePort = 9222) {
        this.googleSheets = googleSheetsService;
        this.chromePort = chromePort;
        this.doctorAPI = new NewDoctorAPIService();
        this.pecosEnrollment = new PECOSEnrollmentService();
        this.browser = null;
        this.page = null;
        this.validSpecialties = []; // Store valid doctor specialties
        this.validationMap = new Map(); // Store validation info for each specialty
        this.badSpecialties = []; // Store BAD specialties
    }

    async initialize() {
        console.log('🏥 Initializing Doctor Fetching System...');
        
        // First, load doctor validation data from Google Sheets
        try {
            const validationData = await this.googleSheets.getDoctorValidationData();
            this.badSpecialties = validationData.badSpecialties || [];
        } catch (error) {
            console.error('❌ Failed to load doctor validation data:', error);
        }
        
        try {
            // Clear any existing session data first
            await this.clearChromeUserData();
            
            // Try to connect to existing Chrome browser first
            this.browser = await chromium.connectOverCDP(`http://localhost:${this.chromePort}`);
            
        } catch (error) {
            // Fall back to launching Chromium
            this.browser = await chromium.launch({
                headless: process.env.HEADLESS === 'true',
                //slowMo: parseInt(process.env.SLOW_MO) || 500,
                slowMo:0,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-automation',
                    '--exclude-switches=enable-automation',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-default-apps',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-service-worker-registration',
                    '--disable-background-sync',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                ]
            });
        }
        
        this.page = await this.browser.newPage();
        
        // Set viewport
        await this.page.setViewportSize({ width: 1366, height: 768 });
        
        // Remove webdriver property that can be detected
        try {
            if (this.page.evaluateOnNewDocument) {
                await this.page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    Object.defineProperty(navigator, 'permissions', {
                        get: () => ({
                            query: async () => ({ state: 'granted' }),
                        }),
                    });
                });
            }
        } catch (error) {
            // Continue without document-level script injection
        }
        
        // Set longer timeouts
        this.page.setDefaultTimeout(60000);
        this.page.setDefaultNavigationTimeout(60000);
        
        // Test navigation to ensure browser is working
        try {
            await this.page.goto('https://www.google.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            await this.injectAntiDetectionScript();
        } catch (navigationError) {
            try {
                await this.injectAntiDetectionScript();
            } catch (injectionError) {
                // Continue anyway
            }
        }
        
        console.log('✅ Doctor Fetching System initialized successfully');
    }

    // Clear Chrome user data to prevent session conflicts
    async clearChromeUserData() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const userDataPath = `C:\\temp\\chrome-debug-${this.chromePort}`;
            
            try {
                await fs.access(userDataPath);
                
                const problematicPaths = [
                    path.join(userDataPath, 'Default', 'Cookies'),
                    path.join(userDataPath, 'Default', 'Local Storage'),
                    path.join(userDataPath, 'Default', 'Session Storage'),
                    path.join(userDataPath, 'Default', 'Web Data'),
                    path.join(userDataPath, 'Default', 'Login Data'),
                    path.join(userDataPath, 'Default', 'Preferences')
                ];
                
                for (const problematicPath of problematicPaths) {
                    try {
                        await fs.access(problematicPath);
                        await fs.rm(problematicPath, { recursive: true, force: true });
                    } catch (e) {
                        // File doesn't exist or can't be removed, that's fine
                    }
                }
                
            } catch (error) {
                // Directory doesn't exist, that's fine
            }
            
        } catch (error) {
            // Continue anyway
        }
    }

    // Inject anti-detection script for CDP connections
    async injectAntiDetectionScript() {
        try {
            await this.page.evaluate(() => {
                if (!window._antiDetectionInjected) {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    Object.defineProperty(navigator, 'permissions', {
                        get: () => ({
                            query: async () => ({ state: 'granted' }),
                        }),
                    });
                    
                    window._antiDetectionInjected = true;
                }
            });
        } catch (error) {
            // Continue anyway
        }
    }

    // Fast wait for Medicare pages to load
    async waitForMedicarePageLoad() {
        try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            
            try {
                await this.page.waitForSelector('body', { timeout: 5000 });
            } catch (e) {
                // Body selector not found, that's okay
            }
            
        } catch (error) {
            // Continue anyway
        }
    }

    async humanTypeText(selector, text) {
        //console.log(`🔤 Human typing: "${text}"`);
        // Clear the field first
        await this.page.fill(selector, '');
        await this.page.waitForTimeout(0);
        // Type text character by character with no delay for instant typing
        for (let i = 0; i < text.length; i++) {
            await this.page.type(selector, text[i]);
            await this.page.waitForTimeout(0); // Set to 0ms for instant typing
        }
        await this.page.waitForTimeout(0);
    }

    async checkLoginStatus() {
        try {
            console.log('🔍 Checking current login status...');
            
            const currentUrl = this.page.url();
            console.log(`📍 Current URL: ${currentUrl}`);
            
            // Check if we're on a Medicare authenticated page
            if (currentUrl.includes('/my/home') || currentUrl.includes('/my/')) {
                console.log('✅ Currently logged in to Medicare');
                return { loggedIn: true, url: currentUrl };
            } 
            
            // Check if we're on login page
            if (currentUrl.includes('/account/login')) {
                console.log('✅ Currently on login page (not logged in)');
                return { loggedIn: false, url: currentUrl };
            }
            
            // Navigate to Medicare to check status
            console.log('🔄 Navigating to Medicare to check login status...');
            await this.page.goto('https://www.medicare.gov/my/home', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            // 🆕 INJECT: Anti-detection script after navigation (for CDP connections)
            await this.injectAntiDetectionScript();
            
            // 🆕 ENHANCED: Wait for page to fully load
            await this.waitForMedicarePageLoad();
            let finalUrl = this.page.url();
            
            // If we get an intermediate /my/ URL that's not exactly home or /my/?, wait for page to fully load
            if (finalUrl.includes('/my/') && !finalUrl.includes('/my/home') && !finalUrl.match(/\/my\/\?/)) {
                console.log(`⏳ Got intermediate URL: ${finalUrl}, waiting 6 seconds for page to fully load...`);
                await this.page.waitForTimeout(6000);
                finalUrl = this.page.url();
            }
            
            if (finalUrl.includes('/my/home') || finalUrl.includes('/my/')) {
                console.log('✅ Already logged in to Medicare');
                return { loggedIn: true, url: finalUrl };
            } else if (finalUrl.includes('/account/login')) {
                console.log('✅ Not logged in (redirected to login)');
                return { loggedIn: false, url: finalUrl };
            } else {
                console.log(`⚠️  Unexpected URL during login check: ${finalUrl}`);
                return { loggedIn: false, url: finalUrl, warning: 'Unexpected URL' };
            }
            
        } catch (error) {
            console.error('Error checking login status:', error);
            return { loggedIn: false, error: error.message };
        }
    }

    async loginToMedicare(credentials) {
        try {
            console.log(`🔐 Starting Medicare login process...`);
            console.log(`📋 Credentials format: ${credentials ? 'Present' : 'Missing'}`);
            
            if (!credentials || !credentials.includes('//')) {
                console.log(`❌ Invalid credentials format. Expected: username//password`);
                return { success: false, message: 'Invalid credentials format' };
            }
            
            const [username, password] = credentials.split('//');
            console.log(`👤 Username: ${username}`);
            console.log(`🔑 Password: ${password ? '[PRESENT]' : '[MISSING]'}`);

            // 🆕 CRITICAL SECURITY CHECK: Verify we're logged out before attempting login
            console.log('🔒 Checking if already logged in from previous session...');
            
            // Navigate to Medicare login page
            console.log('🌐 Navigating to Medicare login page...');
            await this.page.goto('https://www.medicare.gov/account/login', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log('✅ Navigation to login page completed');

            // 🆕 INJECT: Anti-detection script after navigation (for CDP connections)
            await this.injectAntiDetectionScript();

            // 🆕 ENHANCED: Wait for page to fully load
            await this.waitForMedicarePageLoad();
            
            let currentUrl = this.page.url();
            console.log(`📍 Initial URL: ${currentUrl}`);
            
            // 🚨 SECURITY CHECK: If redirected to /my/home, we're still logged in!
            if (currentUrl.includes('/my/home') || currentUrl.includes('/my/')) {
                console.log('🚨 SECURITY ALERT: Still logged in from previous session!');
                console.log('🔄 Forcing logout before new login...');
                
                // Force logout from the current session
                const logoutResult = await this.logoutFromMedicare();
                if (!logoutResult.success) {
                    console.log('❌ Failed to logout from previous session');
                    return { success: false, message: 'Failed to logout from previous session' };
                }
                
                // Navigate back to login page after logout
                console.log('🔄 Returning to login page after logout...');
                await this.page.goto('https://www.medicare.gov/account/login', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                
                // 🆕 INJECT: Anti-detection script after navigation (for CDP connections)
                await this.injectAntiDetectionScript();
                
                await this.page.waitForTimeout(3000);
                
                currentUrl = this.page.url();
                console.log(`📍 URL after forced logout: ${currentUrl}`);
                
                // Double-check we're now on login page
                if (currentUrl.includes('/my/')) {
                    console.log('❌ Still logged in after forced logout - critical error');
                    return { success: false, message: 'Cannot logout from previous session' };
                }
            }
            
            // 🆕 SAFETY CHECK: Verify we're on the login page
            if (!currentUrl.includes('/account/login')) {
                console.log(`❌ Not on login page - current URL: ${currentUrl}`);
                return { success: false, message: 'Not redirected to login page' };
            }
            
            console.log('✅ Confirmed on Medicare login page and properly logged out');

            // 🆕 SAFETY CHECK: Wait for and verify username field exists
            console.log('🔍 Checking for username field...');
            try {
                await this.page.waitForSelector('input[name="username"]#username-textbox', { timeout: 10000 });
                console.log('✅ Username field found');
            } catch (error) {
                console.log('❌ Username field not found');
                return { success: false, message: 'Username field not found on page' };
            }

            // 🆕 SAFETY CHECK: Wait for and verify password field exists
            console.log('🔍 Checking for password field...');
            try {
                await this.page.waitForSelector('input[name="password"]#password-textbox', { timeout: 10000 });
                console.log('✅ Password field found');
            } catch (error) {
                console.log('❌ Password field not found');
                return { success: false, message: 'Password field not found on page' };
            }

            // 🆕 SAFETY CHECK: Wait for and verify login button exists
            console.log('🔍 Checking for login button...');
            try {
                await this.page.waitForSelector('button#login-button[type="submit"]', { timeout: 10000 });
                console.log('✅ Login button found');
            } catch (error) {
                console.log('❌ Login button not found');
                return { success: false, message: 'Login button not found on page' };
            }

            console.log('Filling username...');
            await this.humanTypeText('input[name="username"]#username-textbox', username);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));

            console.log('Filling password...');
            await this.humanTypeText('input[name="password"]#password-textbox', password);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));

            // Do NOT check "Save my username" checkbox as requested
            console.log('Clicking Log in button...');
            await this.page.click('button#login-button[type="submit"]');

            // Wait for login to complete
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);

            // 🆕 ERROR DETECTION: Check for login errors before checking URL
            console.log('🔍 Checking for login errors...');
            const loginErrors = await this.detectLoginErrors();
            if (loginErrors.hasError) {
                console.log(`❌ Login error detected: ${loginErrors.message}`);
                
                // 🆕 SPECIAL HANDLING: Account disabled error
                if (loginErrors.isAccountDisabled && loginErrors.errorType === 'ACCOUNT_DISABLED') {
                    console.log(`🛑 CRITICAL: Account is disabled - this will stop the workflow and update DR2 INFO`);
                    return { 
                        success: false, 
                        isAccountDisabled: true,
                        errorType: 'ACCOUNT_DISABLED',
                        message: loginErrors.message 
                    };
                }
                
                // 🆕 SPECIAL HANDLING: Medicare system error
                if (loginErrors.isMedicareSystemError && loginErrors.errorType === 'MEDICARE_SYSTEM_ERROR') {
                    console.log(`🚨 MEDICARE SYSTEM ERROR: Temporary system issue - Doctor fetching should fail`);
                    return { 
                        success: false, 
                        isMedicareSystemError: true,
                        errorType: 'MEDICARE_SYSTEM_ERROR',
                        message: loginErrors.message 
                    };
                }
                
                return { success: false, message: `Login failed: ${loginErrors.message}` };
            }

            // Check if successfully logged in by verifying URL (with retry mechanism)
            let finalUrl = this.page.url();
            let retryCount = 0;
            const maxRetries = 2;
            
            // If we get an unexpected URL, wait a bit more and retry
            while (retryCount < maxRetries && !finalUrl.includes('/my/home') && !finalUrl.match(/\/my\/\?/)) {
                if (finalUrl.includes('/my/')) {
                    console.log(`⏳ Got intermediate/loading URL: ${finalUrl}, waiting 6 seconds for page to fully load...`);
                    await this.page.waitForTimeout(6000);
                    finalUrl = this.page.url();
                    retryCount++;
                    console.log(`🔄 After waiting, new URL: ${finalUrl}`);
                } else {
                    break; // Not a /my/ URL at all, no point retrying
                }
            }
            
            // Check for successful login URLs (including /my/?lang=en-us pattern)
            if (finalUrl.includes('/my/home') || finalUrl.includes('/my/')) {
                console.log(`✅ Successfully logged in to Medicare account for ${username}`);
                console.log(`📍 Final URL: ${finalUrl}`);
                return { success: true, message: 'Login successful' };
            } else {
                console.log(`❌ Login failed - unexpected URL after ${retryCount} retries: ${finalUrl}`);
                return { success: false, message: 'Login failed - not redirected to home page' };
            }

        } catch (error) {
            console.error(`❌ Error during login:`, error);
            return { success: false, message: error.message };
        }
    }

    async logoutFromMedicare() {
        try {
            console.log('🚪 Logging out from Medicare account...');
            
            // First, check if we're currently logged in
            let currentUrl = this.page.url();
            console.log(`📍 Current URL before logout: ${currentUrl}`);
            
            // If already logged out, no need to logout again
            if (!currentUrl.includes('/my/') && (currentUrl.includes('/account/login') || currentUrl.includes('medicare.gov'))) {
                console.log('✅ Already logged out - no action needed');
                return { success: true, message: 'Already logged out' };
            }
            
            // Method 1: Use the proper Medicare SSO logout URL (MAIN METHOD)
            console.log('🔄 Using proper Medicare SSO logout...');
            await this.page.goto('http://medicare.gov/sso/signout?redirect_uri=https://www.medicare.gov/account/logout?lang=en-s', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // 🆕 ENHANCED: Wait for logout page to fully load
            await this.waitForMedicarePageLoad();
            
            currentUrl = this.page.url();
            console.log(`📍 URL after SSO logout: ${currentUrl}`);
            
            // Check if logout was successful
            if (currentUrl.includes('/account/login') || 
                (currentUrl.includes('medicare.gov') && !currentUrl.includes('/my/'))) {
                console.log('✅ Successfully logged out via SSO logout');
                return { success: true, message: 'Logout successful via Medicare SSO' };
            }
            
            // Look for logout success message
            try {
                console.log('🔍 Checking for logout success message...');
                
                const successAlert = await this.page.waitForSelector(
                    'div.ds-c-alert.ds-c-alert--success:has-text("You successfully logged out.")',
                    { timeout: 5000 }
                );
                
                if (successAlert) {
                    console.log('✅ Found logout success message - confirmed successful SSO logout');
                    return { success: true, message: 'SSO logout confirmed with success message' };
                }
                
            } catch (alertError) {
                console.log('⚠️  Success alert not found, but SSO logout likely successful');
            }
            
            // Method 2: Fallback - Clear session if SSO logout didn't work properly
            console.log('🔄 Fallback: Clearing session to ensure complete logout...');
            try {
                // Clear all cookies and storage
                await this.page.context().clearCookies();
                await this.page.evaluate(() => {
                    localStorage.clear();
                    sessionStorage.clear();
                });
                
                // Navigate to login page to verify
                await this.page.goto('https://www.medicare.gov/account/login', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                
                await this.page.waitForTimeout(2000);
                currentUrl = this.page.url();
                
                if (currentUrl.includes('/account/login')) {
                    console.log('✅ Fallback logout successful - cleared session and redirected to login');
                    return { success: true, message: 'Fallback logout successful via session clear' };
                }
            } catch (fallbackError) {
                console.log('⚠️  Fallback logout failed:', fallbackError.message);
            }
            
            // If we reach here, consider it successful anyway since we used the proper SSO logout
            console.log('✅ SSO logout completed - assuming successful');
            return { success: true, message: 'SSO logout completed' };

        } catch (error) {
            console.error(`❌ Error during logout:`, error);
            // Don't fail the entire process if logout fails
            return { success: false, message: error.message };
        }
    }

    async fetchClaims() {
        try {
            console.log('🏥 Navigating to Medicare claims page...');
            // 🆕 UPDATED: Use specific claim types and extended date range (36 months to get enough data)
            await this.page.goto('https://www.medicare.gov/my/claims?dateRange=last36Months&sortBy=claim_from_date&claimTypes=PartB%2COutpatient%2CInpatient', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // Wait for initial claims to load
            console.log('⏳ Waiting for initial claims to load...');
            await this.page.waitForTimeout(8000); // Increased from 5000 to 8000ms

            console.log('🔍 Loading all recent claims (handling pagination)...');

            // 🆕 PAGINATION HANDLING: Keep clicking "Load more claims" until we have all recent claims
            let totalClaimsLoaded = 0;
            let paginationAttempts = 0;
            const maxPaginationAttempts = 20; // Prevent infinite loops
            
            while (paginationAttempts < maxPaginationAttempts) {
                console.log(`📄 Pagination attempt ${paginationAttempts + 1}...`);
                
                // Check current claims on the page to see if we need to load more
                const currentClaims = await this.page.evaluate(() => {
                    const claims = [];
                    
                    // Look for date elements on the page
                    const sections = document.querySelectorAll('section, .ds-l-container, .m-c-card, [class*="claim"]');
                    
                    for (let section of sections) {
                        const sectionText = section.textContent || '';
                        
                        // Skip outpatient hospital claims
                        if (sectionText.includes('Outpatient hospital claim')) {
                            continue;
                        }
                        
                        // Look for date of service patterns
                        const dateMatches = sectionText.match(/(\d{2}\/\d{2}\/\d{2,4})/g);
                        if (dateMatches) {
                            dateMatches.forEach(dateMatch => {
                                claims.push({ dateOfService: dateMatch });
                            });
                        }
                    }
                    
                    // Remove duplicates
                    const uniqueClaims = [];
                    const seenDates = new Set();
                    
                    claims.forEach(claim => {
                        if (!seenDates.has(claim.dateOfService)) {
                            seenDates.add(claim.dateOfService);
                            uniqueClaims.push(claim);
                        }
                    });
                    
                    return uniqueClaims;
                });

                console.log(`📊 Currently visible claims: ${currentClaims.length} (total loaded so far: ${totalClaimsLoaded})`);
                
                if (currentClaims.length > totalClaimsLoaded) {
                    totalClaimsLoaded = currentClaims.length;
                    console.log(`📈 Claims increased to ${totalClaimsLoaded}`);
                }

                // 🆕 ADDITIONAL WAIT: Give extra time on first attempt for page to fully stabilize
                if (paginationAttempts === 0 && currentClaims.length === 0) {
                    console.log('⏳ First attempt found 0 claims - waiting additional time for page to load...');
                    await this.page.waitForTimeout(5000);
                    
                    // Re-evaluate claims after additional wait
                    const retryCurrentClaims = await this.page.evaluate(() => {
                        const claims = [];
                        const sections = document.querySelectorAll('section, .ds-l-container, .m-c-card, [class*="claim"]');
                        
                        for (let section of sections) {
                            const sectionText = section.textContent || '';
                            if (sectionText.includes('Outpatient hospital claim')) {
                                continue;
                            }
                            const dateMatches = sectionText.match(/(\d{2}\/\d{2}\/\d{2,4})/g);
                            if (dateMatches) {
                                dateMatches.forEach(dateMatch => {
                                    claims.push({ dateOfService: dateMatch });
                                });
                            }
                        }
                        
                        const uniqueClaims = [];
                        const seenDates = new Set();
                        claims.forEach(claim => {
                            if (!seenDates.has(claim.dateOfService)) {
                                seenDates.add(claim.dateOfService);
                                uniqueClaims.push(claim);
                            }
                        });
                        
                        return uniqueClaims;
                    });
                    
                    if (retryCurrentClaims.length > 0) {
                        console.log(`✅ After additional wait, found ${retryCurrentClaims.length} claims`);
                        totalClaimsLoaded = retryCurrentClaims.length;
                        // Update currentClaims for the rest of the logic
                        currentClaims.length = 0;
                        currentClaims.push(...retryCurrentClaims);
                    } else {
                        console.log('⚠️  Still no claims found after additional wait');
                    }
                }

                // Check if we have claims older than 9 months
                let hasOldClaims = false;
                let oldestClaimDate = null;
                
                if (currentClaims.length > 0) {
                    // Sort claims by date to find the oldest one currently visible
                    const sortedClaims = currentClaims.sort((a, b) => {
                        const dateA = new Date(a.dateOfService);
                        const dateB = new Date(b.dateOfService);
                        return dateB - dateA; // Newest first
                    });
                    
                    const oldestClaim = sortedClaims[sortedClaims.length - 1];
                    oldestClaimDate = oldestClaim.dateOfService;
                    
                    // Check if the oldest visible claim is older than 9 months
                    if (!this.isWithinNineMonths(oldestClaimDate)) {
                        hasOldClaims = true;
                        console.log(`✅ Found claims older than 9 months (oldest visible: ${oldestClaimDate})`);
                    } else {
                        console.log(`⏰ Oldest visible claim is still recent: ${oldestClaimDate} (within 9 months)`);
                    }
                }

                // Look for "Load more claims" button
                const loadMoreButton = await this.page.$('button.ds-c-button.ds-u-margin-top--4:has-text("Load more claims")');
                
                if (!loadMoreButton) {
                    console.log('🔚 No "Load more claims" button found - reached end of claims');
                    break;
                }

                // If we found old claims (older than 9 months), we can stop loading more
                if (hasOldClaims) {
                    console.log('🎯 Reached claims older than 9 months - stopping pagination');
                    break;
                }

                // Click the "Load more claims" button
                console.log('🔄 Clicking "Load more claims" button...');
                try {
                    await loadMoreButton.click();
                    
                    // 🆕 INCREASED WAIT TIME: Wait longer for new claims to load
                    console.log('⏳ Waiting for new claims to load...');
                    await this.page.waitForTimeout(6000); // Increased from 3000 to 6000ms
                    
                    // Wait for any loading indicators to disappear
                    try {
                        await this.page.waitForSelector('.loading, .spinner, [aria-busy="true"]', { 
                            state: 'hidden', 
                            timeout: 15000  // Increased from 10000 to 15000ms
                        });
                    } catch (e) {
                        // Loading indicator might not exist, continue
                        console.log('⏳ Loading indicator timeout - continuing with additional wait...');
                        // Extra wait in case loading indicators don't exist but content is still loading
                        await this.page.waitForTimeout(3000);
                    }
                    
                    paginationAttempts++;
                    
                } catch (clickError) {
                    console.log('⚠️  Could not click "Load more claims" button:', clickError.message);
                    break;
                }
            }

            if (paginationAttempts >= maxPaginationAttempts) {
                console.log('⚠️  Reached maximum pagination attempts - proceeding with current claims');
            }

            console.log(`✅ Pagination complete. Total loaded: ${totalClaimsLoaded} claims`);
            console.log('🔍 Now analyzing all loaded claims for medical providers...');

            let medicalClaims = [];

            try {
                medicalClaims = await this.page.evaluate(() => {
                    const claims = [];
                    let debugInfo = {
                        sectionsFound: 0,
                        claimsProcessed: 0,
                        hospitalClaimsSkipped: 0,
                        methodsUsed: []
                    };
                    
                    console.log('🔍 Starting comprehensive claims extraction...');
                    
                    // Method 1: Look for the main claims structure based on the actual Medicare page
                    console.log('📋 Method 1: Analyzing section containers...');
                    const claimSections = document.querySelectorAll('section, .ds-l-container, .m-c-card, [class*="claim"], article, .claim-item');
                    debugInfo.sectionsFound = claimSections.length;
                    
                    for (let section of claimSections) {
                        const sectionText = section.textContent || '';
                        debugInfo.claimsProcessed++;
                        
                        // 🚫 EXCLUDE "Outpatient hospital claim" - we only want doctor/provider claims
                        if (sectionText.includes('Outpatient hospital claim') || sectionText.includes('Hospital outpatient')) {
                            debugInfo.hospitalClaimsSkipped++;
                            console.log('⏭️  Skipping outpatient hospital claim');
                            continue;
                        }
                        
                        // Check if this section contains claim data with both date and provider
                        if ((sectionText.includes('Date of service') || sectionText.includes('Service date')) && 
                            (sectionText.includes('Provider') || sectionText.includes('Physician'))) {
                            
                            debugInfo.methodsUsed.push('section-analysis');
                            
                            try {
                                // Extract date of service with multiple patterns
                                let dateOfService = '';
                                
                                // Pattern 1: Look for "Date of service" label
                                const dateHeaders = section.querySelectorAll('*');
                                for (let el of dateHeaders) {
                                    const elText = el.textContent && el.textContent.trim();
                                    if (elText && (elText === 'Date of service' || elText === 'Service date' || elText.includes('Date:'))) {
                                        // Look for the next element that contains the date
                                        let sibling = el.nextElementSibling;
                                        let attempts = 0;
                                        while (sibling && !dateOfService && attempts < 5) {
                                            const siblingText = sibling.textContent && sibling.textContent.trim();
                                            if (siblingText && siblingText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
                                                dateOfService = siblingText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)[0];
                                                break;
                                            }
                                            sibling = sibling.nextElementSibling;
                                            attempts++;
                                        }
                                        if (dateOfService) break;
                                    }
                                }
                                
                                // Pattern 2: Look for date anywhere in the section
                                if (!dateOfService) {
                                    // 🆕 IMPROVED: Better date patterns to catch "01/23/25" format
                                    const datePatterns = [
                                        /(\d{1,2}\/\d{1,2}\/\d{4})/,  // MM/DD/YYYY or M/D/YYYY
                                        /(\d{1,2}\/\d{1,2}\/\d{2})/,  // MM/DD/YY or M/D/YY (like 01/23/25)
                                        /(\d{2}\/\d{2}\/\d{4})/,      // MM/DD/YYYY strict
                                        /(\d{2}\/\d{2}\/\d{2})/       // MM/DD/YY strict (like 01/23/25)
                                    ];
                                    
                                    for (const datePattern of datePatterns) {
                                        const dateMatch = sectionText.match(datePattern);
                                        if (dateMatch) {
                                            dateOfService = dateMatch[1];
                                            break;
                                        }
                                    }
                                }
                            
                                // Extract provider name with multiple approaches
                                let provider = '';
                                
                                // Pattern 1: Look for "Provider" label
                                const providerHeaders = section.querySelectorAll('*');
                                for (let el of providerHeaders) {
                                    const elText = el.textContent && el.textContent.trim();
                                    if (elText && (elText === 'Provider' || elText === 'Physician' || elText.includes('Doctor'))) {
                                        // Look for the next element that contains the provider name
                                        let sibling = el.nextElementSibling;
                                        let attempts = 0;
                                        while (sibling && !provider && attempts < 5) {
                                            const siblingText = sibling.textContent && sibling.textContent.trim();
                                            if (siblingText && 
                                                siblingText.length > 3 && 
                                                !siblingText.includes('$') &&
                                                !siblingText.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) &&
                                                !siblingText.toLowerCase().includes('provider') &&
                                                !siblingText.toLowerCase().includes('date')) {
                                                provider = siblingText;
                                                break;
                                            }
                                            sibling = sibling.nextElementSibling;
                                            attempts++;
                                        }
                                        if (provider) break;
                                    }
                                }
                                
                                // Pattern 2: Look for provider names (usually in caps or title case)
                                if (!provider) {
                                    // Look for text that looks like provider names
                                    const providerPatterns = [
                                        // 🆕 IMPROVED: Capture names like "DEREK IAN SKINNER"  
                                        /([A-Z][A-Z\s]{10,})/g,  // All caps names (increased minimum length)
                                        /([A-Z][A-Z\s&,.-]{8,})/g,  // All caps names with punctuation
                                        /([A-Z][a-z]+ [A-Z][a-z]+[A-Za-z\s,&.-]*(?:MD|DO|DDS|DPM|OD|PharmD|NP|PA|RN)?)/g,  // Title case with credentials
                                        /(Dr\.?\s+[A-Z][a-z]+[A-Za-z\s,.-]*)/g,  // Names starting with Dr.
                                        // 🆕 NEW: Specific pattern for "FIRSTNAME LASTNAME" format
                                        /([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})/g,  // Three uppercase words (DEREK IAN SKINNER)
                                        /([A-Z]{2,}\s+[A-Z]{2,})/g,  // Two uppercase words (fallback)
                                        // 🆕 NEW: Mixed case patterns
                                        /([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})/g,  // Derek Ian Skinner
                                        /([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})/g  // Derek Skinner
                                    ];
                                    
                                    for (const pattern of providerPatterns) {
                                        const matches = sectionText.match(pattern);
                                        if (matches) {
                                            for (const match of matches) {
                                                const candidate = match.trim();
                                                // 🆕 IMPROVED: Better filtering for false positives
                                                if (candidate.length >= 8 && 
                                                    !candidate.includes('Medicare') &&
                                                    !candidate.includes('MEDICARE') &&
                                                    !candidate.includes('Date') &&
                                                    !candidate.includes('DATE') &&
                                                    !candidate.includes('Provider') &&
                                                    !candidate.includes('PROVIDER') &&
                                                    !candidate.includes('Service') &&
                                                    !candidate.includes('SERVICE') &&
                                                    !candidate.includes('Claim') &&
                                                    !candidate.includes('CLAIM') &&
                                                    !candidate.includes('Total') &&
                                                    !candidate.includes('TOTAL') &&
                                                    !candidate.includes('$')) {
                                                    provider = candidate;
                                                    break;
                                                }
                                            }
                                            if (provider) break;
                                        }
                                    }
                                }
                                
                                if (dateOfService && provider) {
                                    claims.push({
                                        dateOfService: dateOfService,
                                        provider: provider,
                                        extractionMethod: 'section-analysis'
                                    });
                                    console.log(`✅ Claim found: ${dateOfService} - ${provider}`);
                                }
                            } catch (err) {
                                console.log('⚠️  Error parsing claim section:', err);
                            }
                        }
                    }
                    
                    // Remove duplicates (final cleanup)
                    const uniqueClaims = claims.filter((claim, index, self) => 
                        index === self.findIndex(c => 
                            c.dateOfService === claim.dateOfService && 
                            c.provider === claim.provider
                        )
                    );
                    
                    // Log extraction summary
                    console.log('📊 Claims Extraction Summary:');
                    console.log(`   🔍 Sections analyzed: ${debugInfo.sectionsFound}`);
                    console.log(`   🏥 Hospital claims skipped: ${debugInfo.hospitalClaimsSkipped}`);
                    console.log(`   🔧 Methods used: ${debugInfo.methodsUsed.join(', ')}`);
                    console.log(`   📋 Total claims found: ${uniqueClaims.length}`);
                    console.log(`   ❌ Duplicates removed: ${claims.length - uniqueClaims.length}`);
                    
                    return uniqueClaims;
                });
            } catch (error) {
                console.log('⚠️  Error extracting claims:', error.message);
            }

            console.log(`📊 Found ${medicalClaims.length} total medical claims after pagination (excluding outpatient hospital claims)`);
            
            // Log first few claims for debugging
            if (medicalClaims.length > 0) {
                console.log('📋 Sample medical claims found (excluding hospitals):');
                medicalClaims.slice(0, 3).forEach((claim, i) => {
                    console.log(`${i + 1}. Date: ${claim.dateOfService}, Provider: ${claim.provider}`);
                });
            } else {
                console.log('⚠️  No medical claims found after pagination. This might indicate:');
                console.log('   - The patient only has outpatient hospital claims (excluded)');
                console.log('   - The patient has no recent medical provider claims');
                console.log('   - There might be a login or access issue');
                
                // Take a screenshot for debugging
                try {
                    await this.page.screenshot({ 
                        path: 'claims-debug-pagination.png', 
                        fullPage: true 
                    });
                    console.log('📸 Debug screenshot saved as claims-debug-pagination.png');
                } catch (e) {
                    console.log('Could not save debug screenshot');
                }
            }
            
            return medicalClaims;

        } catch (error) {
            console.error(`❌ Error fetching claims:`, error);
            return [];
        }
    }

    isWithinSixMonths(dateString) {
        try {
            // Parse date string (expecting MM/DD/YY or MM/DD/YYYY format)
            const dateParts = dateString.split('/');
            if (dateParts.length !== 3) {
                console.log(`⚠️  Invalid date format: ${dateString}`);
                return false;
            }

            const month = parseInt(dateParts[0]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[1]);
            let year = parseInt(dateParts[2]);
            
            // Handle 2-digit years
            if (year < 50) {
                year += 2000;
            } else if (year < 100) {
                year += 1900;
            }

            const serviceDate = new Date(year, month, day);
            const today = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            // Check if the service date is within the last 6 months
            const isWithinSixMonths = serviceDate >= sixMonthsAgo && serviceDate <= today;
            
            // Log the date check for debugging
            if (isWithinSixMonths) {
                console.log(`✅ Date ${dateString} is within last 6 months (${sixMonthsAgo.toLocaleDateString()} to ${today.toLocaleDateString()})`);
            } else {
                const daysDiff = Math.floor((today - serviceDate) / (1000 * 60 * 60 * 24));
                if (serviceDate < sixMonthsAgo) {
                    console.log(`❌ Date ${dateString} is too old (${daysDiff} days ago, more than 6 months)`);
                } else if (serviceDate > today) {
                    console.log(`❌ Date ${dateString} is in the future`);
                }
            }

            return isWithinSixMonths;
        } catch (error) {
            console.log(`⚠️  Could not parse date: ${dateString} - ${error.message}`);
            return false;
        }
    }

    isWithinNineMonths(dateString) {
        try {
            // Parse date string (expecting MM/DD/YY or MM/DD/YYYY format)
            const dateParts = dateString.split('/');
            if (dateParts.length !== 3) {
                console.log(`⚠️  Invalid date format: ${dateString}`);
                return false;
            }

            const month = parseInt(dateParts[0]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[1]);
            let year = parseInt(dateParts[2]);
            
            // Handle 2-digit years
            if (year < 50) {
                year += 2000;
            } else if (year < 100) {
                year += 1900;
            }

            const serviceDate = new Date(year, month, day);
            const today = new Date();
            const nineMonthsAgo = new Date();
            nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

            // Check if the service date is within the last 9 months
            const isWithinNineMonths = serviceDate >= nineMonthsAgo && serviceDate <= today;
            
            // Log the date check for debugging
            if (isWithinNineMonths) {
                console.log(`✅ Date ${dateString} is within last 9 months (${nineMonthsAgo.toLocaleDateString()} to ${today.toLocaleDateString()})`);
            } else {
                const daysDiff = Math.floor((today - serviceDate) / (1000 * 60 * 60 * 24));
                if (serviceDate < nineMonthsAgo) {
                    console.log(`❌ Date ${dateString} is too old (${daysDiff} days ago, more than 9 months)`);
                } else if (serviceDate > today) {
                    console.log(`❌ Date ${dateString} is in the future`);
                }
            }

            return isWithinNineMonths;
        } catch (error) {
            console.log(`⚠️  Could not parse date: ${dateString} - ${error.message}`);
            return false;
        }
    }

    extractStateFromAddress(address) {
        try {
            // Extract state abbreviation from address
            // Format: "2141 Springdale Rd Sw Apt 528 Atlanta, GA 30315-6146"
            const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
            return stateMatch ? stateMatch[1] : null;
        } catch (error) {
            console.log(`⚠️  Could not extract state from address: ${address}`);
            return null;
        }
    }

    isDoctorSpecialtyValid(specialty) {
        if (!specialty || !this.badSpecialties || this.badSpecialties.length === 0) {
            // If no BAD specialties loaded, allow all doctors (backward compatibility)
            return { isValid: true, reason: 'No BAD specialty data available' };
        }

        // List of generic/common words to ignore in fuzzy matching
        const GENERIC_WORDS = new Set([
            'medicine', 'physician','assistant', 'doctor', 'family', 'internal', 'general', 'practice', 'practitioner', 'medical', 'clinic', 'center', 'group', 'care', 'health', 'service', 'services', 'associate', 'associates', 'office', 'specialist','nurse', 'specialty', 'pc', 'llc', 'inc', 'corp', 'corporation', 'partners', 'partnership', 'and', 'of', 'the', 'for', 'with', 'in', 'at', 'to', 'from', 'by', 'on', 'an', 'a'
        ]);

        // Clean and normalize the specialty for comparison
        const normalizedSpecialty = specialty.trim().toLowerCase();
        const specialtyTokens = normalizedSpecialty.split(/[^a-z0-9]+/).filter(token => token && !GENERIC_WORDS.has(token));
        // For each BAD specialty, split into tokens and check for partial word matches
        for (const badSpecialty of this.badSpecialties) {
            const normalizedBad = badSpecialty.trim().toLowerCase();
            const badTokens = normalizedBad.split(/[^a-z0-9]+/).filter(token => token && !GENERIC_WORDS.has(token));
            for (const sToken of specialtyTokens) {
                for (const bToken of badTokens) {
                    // Partial word match: if either token is a prefix of the other (min 4 chars)
                    if (
                        (sToken.length >= 4 && bToken.length >= 4) &&
                        (sToken.startsWith(bToken) || bToken.startsWith(sToken))
                    ) {
                        console.log(`❌ EXCLUDED: Specialty "${specialty}" matches BAD specialty (token fuzzy): "${badSpecialty}" via token "${sToken}" <-> "${bToken}"`);
                        return { isValid: false, reason: `Specialty is BAD (token fuzzy match): ${badSpecialty}` };
                    }
                }
            }
        }
        // If not in BAD list, recommend
        return { isValid: true, reason: 'Specialty is not in BAD list (token fuzzy match, generic words ignored)' };
    }

    async analyzeProviders(claims, patientState) {
        console.log(`🔍 Analyzing providers for patient in ${patientState}...`);
        console.log(`📊 Total claims found: ${claims.length}`);
        
        // First, filter claims to only those within the last 9 months
        const recentClaims = [];
        const oldClaims = [];
        
        claims.forEach(claim => {
            if (this.isWithinNineMonths(claim.dateOfService)) {
                recentClaims.push(claim);
            } else {
                oldClaims.push(claim);
            }
        });

        console.log(`📅 Claims within last 9 months: ${recentClaims.length}`);
        console.log(`📅 Claims older than 9 months: ${oldClaims.length}`);

        // 🆕 ENHANCED FEEDBACK: Return specific feedback object when no recent claims
        if (recentClaims.length === 0) {
            console.log('⏸️  No recent claims found (within last 9 months) - patient not active with any providers');
            
            let feedbackMessage = 'No recent medical activity found within the last 9 months.';
            
            if (oldClaims.length > 0) {
                console.log(`📋 Found ${oldClaims.length} older claims, but these are not used for analysis`);
                console.log('💡 Only claims from the last 9 months are used to determine active providers');
                
                // 🆕 ENHANCED FEEDBACK: Include information about older claims
                const oldestClaim = oldClaims.reduce((oldest, claim) => {
                    const claimDate = new Date(claim.dateOfService);
                    const oldestDate = new Date(oldest.dateOfService);
                    return claimDate < oldestDate ? claim : oldest;
                });
                
                const newestOldClaim = oldClaims.reduce((newest, claim) => {
                    const claimDate = new Date(claim.dateOfService);
                    const newestDate = new Date(newest.dateOfService);
                    return claimDate > newestDate ? claim : newest;
                });
                
                feedbackMessage = `No recent medical activity within the last 9 months. Found ${oldClaims.length} older claims from ${oldestClaim.dateOfService} to ${newestOldClaim.dateOfService}. Patient appears to be inactive with healthcare providers recently.`;
            } else {
                feedbackMessage = 'No medical claims found in Medicare records. Patient may be new to Medicare or has not used Medicare benefits recently.';
            }
            
            // 🆕 RETURN FEEDBACK OBJECT instead of empty array
            return {
                isNoRecentActivity: true,
                feedbackMessage: feedbackMessage,
                recentClaimsCount: recentClaims.length,
                oldClaimsCount: oldClaims.length,
                totalClaimsCount: claims.length
            };
        }

        // Count provider visits from recent claims and collect visit dates
        const providerData = {};
        recentClaims.forEach(claim => {
            if (claim.provider) {
                if (!providerData[claim.provider]) {
                    providerData[claim.provider] = {
                        provider: claim.provider,
                        visits: [],
                        visitCount: 0
                    };
                }
                providerData[claim.provider].visits.push({
                    date: claim.dateOfService,
                    provider: claim.provider
                });
                providerData[claim.provider].visitCount++;
            }
        });

        console.log(`🏥 Found ${Object.keys(providerData).length} unique providers with recent visits`);

        // 🆕 SOPHISTICATED SCORING SYSTEM
        const scoredProviders = Object.values(providerData).map(provider => {
            console.log(`\n🧮 Calculating score for: ${provider.provider}`);
            console.log(`   📊 Total visits: ${provider.visitCount}`);
            
            // Sort visits by date (newest first) for recency scoring
            const sortedVisits = provider.visits.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA; // Newest first
            });
            
            // 🏆 SCORE CALCULATION
            let totalScore = 0;
            let scoreBreakdown = {
                baseVisits: 0,
                recencyBonus: 0,
                oldVisitPenalty: 0,
                qualityBonus: 0
            };
            
            // 1️⃣ BASE VISIT SCORE: 1.5 points per visit
            scoreBreakdown.baseVisits = provider.visitCount * 1.5;
            totalScore += scoreBreakdown.baseVisits;
            console.log(`   🎯 Base visits (${provider.visitCount} × 1.5): +${scoreBreakdown.baseVisits}`);
            
            // 2️⃣ RECENCY SCORING: Latest visits get priority points
            const recencyPoints = [1.5, 1.0, 0.7, 0.5, 0.2]; // Points for 1st, 2nd, 3rd, 4th, 5th visits
            
            for (let i = 0; i < sortedVisits.length; i++) {
                if (i < 5) {
                    // First 5 visits get recency bonus
                    const bonus = recencyPoints[i];
                    scoreBreakdown.recencyBonus += bonus;
                    totalScore += bonus;
                    console.log(`   📅 Visit ${i + 1} (${sortedVisits[i].date}): +${bonus} recency`);
                } else {
                    // 6th and older visits get penalty
                    scoreBreakdown.oldVisitPenalty -= 0.5;
                    totalScore -= 0.5;
                    console.log(`   📅 Visit ${i + 1} (${sortedVisits[i].date}): -0.5 old visit penalty`);
                }
            }
            
            // 3️⃣ PROVIDER QUALITY ASSESSMENT
            const qualityAssessment = this.assessProviderQuality(provider.provider);
            if (qualityAssessment.isGood) {
                scoreBreakdown.qualityBonus = 5.5;
                totalScore += 5.5;
                console.log(`   ⭐ Quality bonus: +5.5 (${qualityAssessment.reason})`);
            } else {
                console.log(`   ❌ No quality bonus (${qualityAssessment.reason})`);
            }
            
            // Final score calculation
            const finalScore = Math.round(totalScore * 100) / 100; // Round to 2 decimal places
            
            console.log(`   📊 SCORE BREAKDOWN:`);
            console.log(`      Base visits: ${scoreBreakdown.baseVisits}`);
            console.log(`      Recency bonus: +${scoreBreakdown.recencyBonus}`);
            console.log(`      Old visit penalty: ${scoreBreakdown.oldVisitPenalty}`);
            console.log(`      Quality bonus: +${scoreBreakdown.qualityBonus}`);
            console.log(`   🎯 FINAL SCORE: ${finalScore}`);
            
            return {
                ...provider,
                totalScore: finalScore,
                scoreBreakdown,
                qualityAssessment,
                latestVisitDate: sortedVisits[0].date,
                oldestVisitDate: sortedVisits[sortedVisits.length - 1].date
            };
        });

        // 🏆 PRIORITIZATION: Quality first, then visit count, then score
        scoredProviders.sort((a, b) => {
            // Priority 1: Provider quality (good providers first)
            if (a.qualityAssessment.isGood !== b.qualityAssessment.isGood) {
                return b.qualityAssessment.isGood - a.qualityAssessment.isGood; // Good providers first
            }
            
            // Priority 2: Most visits (higher visit count first)
            if (a.visitCount !== b.visitCount) {
                return b.visitCount - a.visitCount;
            }
            
            // Priority 3: Total score (higher score first)
            return b.totalScore - a.totalScore;
        });

        // 🆕 GET MORE PROVIDERS: Take top 15 for better coverage, but prioritize quality
        const topProviders = scoredProviders.slice(0, 15);

        console.log(`\n🏆 Top ${topProviders.length} prioritized providers (Quality → Visits → Score):`);
        topProviders.forEach((p, i) => {
            const qualityIndicator = p.qualityAssessment.isGood ? '⭐ GOOD' : '📋 Standard';
            console.log(`${i + 1}. ${p.provider}`);
            console.log(`   🎯 Score: ${p.totalScore} | Visits: ${p.visitCount} | ${qualityIndicator}`);
            console.log(`   📅 Latest: ${p.latestVisitDate} | Oldest: ${p.oldestVisitDate}`);
            console.log(`   💡 Quality: ${p.qualityAssessment.reason}`);
        });

        if (topProviders.length === 0) {
            console.log('❌ No providers found in recent claims');
            
            // 🆕 RETURN FEEDBACK OBJECT for no providers case
            return {
                isNoRecentActivity: true,
                feedbackMessage: `Found ${recentClaims.length} recent claims but no valid providers could be identified. Claims may be for services without individual provider information.`,
                recentClaimsCount: recentClaims.length,
                oldClaimsCount: oldClaims.length,
                totalClaimsCount: claims.length
            };
        }

        return topProviders;
    }

    assessProviderQuality(providerName) {
        try {
            console.log(`🔍 Assessing quality for provider: ${providerName}`);
            
            let qualityReasons = [];
            let isGood = false;
            
            // ❌ IMMEDIATE DISQUALIFICATION: Company providers
            if (this.isProviderCompany(providerName)) {
                return {
                    isGood: false,
                    reason: 'Company/Organization - not an individual doctor'
                };
            }
            
            // ✅ QUALITY INDICATORS
            
            // 1️⃣ Individual Doctor Indicators (positive signals)
            const doctorIndicators = [
                /^dr\.?\s+/i,  // Starts with "Dr."
                /\s+(md|do|np|pa|rn|dds|dpm|od)$/i,  // Ends with medical credentials
                /,\s+(md|do|np|pa|rn|dds|dpm|od)$/i   // Has credentials after comma
            ];
            
            let hasCredentials = false;
            for (const pattern of doctorIndicators) {
                if (pattern.test(providerName)) {
                    hasCredentials = true;
                    qualityReasons.push('Has medical credentials');
                    break;
                }
            }
            
            // 2️⃣ High-Quality Specialty Keywords (in provider name)
            const highQualitySpecialties = [
                'family medicine', 'family practice', 'internal medicine', 'primary care',
                'cardiology', 'cardiologist', 'dermatology', 'dermatologist',
                'orthopedic', 'orthopedics', 'neurology', 'neurologist',
                'gastroenterology', 'endocrinology', 'pulmonology', 'rheumatology',
                'oncology', 'oncologist', 'psychiatry', 'psychiatrist'
            ];
            
            const providerLower = providerName.toLowerCase();
            let hasQualitySpecialty = false;
            
            for (const specialty of highQualitySpecialties) {
                if (providerLower.includes(specialty)) {
                    hasQualitySpecialty = true;
                    qualityReasons.push(`High-quality specialty: ${specialty}`);
                    break;
                }
            }
            
            // 3️⃣ Personal Name Pattern (likely individual doctor)
            const personalNamePatterns = [
                /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,  // FirstName LastName
                /^[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+$/,  // FirstName M. LastName
                /^[A-Z][a-z]+,\s+[A-Z][a-z]+$/,  // LastName, FirstName
                /^[A-Z]+\s+[A-Z]+\s+[A-Z]+$/  // FIRST MIDDLE LAST (all caps)
            ];
            
            let hasPersonalNamePattern = false;
            for (const pattern of personalNamePatterns) {
                if (pattern.test(providerName)) {
                    hasPersonalNamePattern = true;
                    qualityReasons.push('Personal name pattern');
                    break;
                }
            }
            
            // 4️⃣ NEGATIVE QUALITY INDICATORS
            const negativeIndicators = [
                'urgent care', 'walk-in', 'emergency', 'clinic', 'center',
                'laboratory', 'lab', 'imaging', 'radiology', 'diagnostic',
                'pharmacy', 'medical equipment', 'supply', 'hospital'
            ];
            
            let hasNegativeIndicators = false;
            for (const negative of negativeIndicators) {
                if (providerLower.includes(negative)) {
                    hasNegativeIndicators = true;
                    qualityReasons.push(`Negative indicator: ${negative}`);
                    break;
                }
            }
            
            // 🎯 QUALITY DECISION LOGIC
            
            // High confidence "good" providers
            if (hasCredentials && (hasQualitySpecialty || hasPersonalNamePattern) && !hasNegativeIndicators) {
                isGood = true;
                qualityReasons.unshift('HIGH QUALITY: Has credentials + specialty/name pattern + no negative indicators');
            }
            
            // Medium confidence "good" providers  
            else if ((hasCredentials || hasQualitySpecialty) && hasPersonalNamePattern && !hasNegativeIndicators) {
                isGood = true;
                qualityReasons.unshift('GOOD QUALITY: Personal doctor with positive indicators');
            }
            
            // Specialty-based quality (even without obvious credentials)
            else if (hasQualitySpecialty && !hasNegativeIndicators && hasPersonalNamePattern) {
                isGood = true;
                qualityReasons.unshift('SPECIALTY QUALITY: Quality specialty with personal name');
            }
            
            // Default to not good if no clear quality indicators
            else {
                qualityReasons.unshift('STANDARD: No clear quality indicators');
            }
            
            const reasonString = qualityReasons.join(' | ');
            console.log(`   ${isGood ? '⭐' : '📋'} Quality Assessment: ${reasonString}`);
            
            return {
                isGood,
                reason: reasonString,
                indicators: {
                    hasCredentials,
                    hasQualitySpecialty,
                    hasPersonalNamePattern,
                    hasNegativeIndicators
                }
            };
            
        } catch (error) {
            console.log(`⚠️  Error assessing provider quality: ${error.message}`);
            return {
                isGood: false,
                reason: 'Error in quality assessment',
                indicators: {}
            };
        }
    }

    async searchProvider(providerName, patientState) {
        try {
            console.log(`🔍 Searching New Doctor API for provider: ${providerName} in state: ${patientState}`);

            // 🆕 STEP 1: Search for the provider with patient state first
            let providers = await this.doctorAPI.searchProvidersWithRetry(providerName, patientState, 5);
            
            if (providers.length === 0) {
                console.log(`❌ No providers found with state filter (${patientState})`);
                console.log(`🔄 FALLBACK: Trying search without state filter...`);
                
                // 🆕 STEP 2: If no providers in patient state, search without state filter
                providers = await this.doctorAPI.searchProvidersWithRetry(providerName, null, 5);
                
                if (providers.length === 0) {
                    console.log('❌ No providers found even without state filter');
                    return null;
                }
                
                console.log(`✅ Found ${providers.length} providers without state filter`);
                
                // Return the first provider (best match by API scoring)
                console.log(`🔄 Using first available provider (no state match): ${providers[0].name}`);
                return providers[0];
            }

            console.log(`📊 Found ${providers.length} providers with state filter`);

            // Find provider in same state as patient
            const matchingProvider = providers.find(provider => {
                const providerState = provider.address?.state;
                return providerState && providerState.toLowerCase() === patientState.toLowerCase();
            });
            
            if (matchingProvider) {
                console.log(`✅ Found matching provider in ${patientState}: ${matchingProvider.name} (${matchingProvider.npi})`);
                return matchingProvider;
            } else {
                console.log(`❌ No providers found in patient's state (${patientState})`);
                // Log available states for debugging
                const availableStates = providers.map(p => p.address?.state).filter(Boolean);
                if (availableStates.length > 0) {
                    console.log(`📍 Available states: ${availableStates.join(', ')}`);
                }
                
                // Return first provider as fallback
                if (providers.length > 0) {
                    console.log(`🔄 Using first available provider as fallback: ${providers[0].name}`);
                    return providers[0];
                }
                return null;
            }

        } catch (error) {
            console.error(`❌ Error searching New Doctor API:`, error);
            return null;
        }
    }

    async validateProvider(providerData) {
        try {
            console.log(`📄 Validating provider from New Doctor API: ${providerData.name}`);

            // Basic validation using New Doctor API service
            const basicValidation = this.doctorAPI.validateProviderBasicCriteria(providerData);
            if (!basicValidation.isValid) {
                console.log(`❌ Basic validation failed: ${basicValidation.issues.join(', ')}`);
                    return null;
                }

            // Convert format to our expected format
            const providerInfo = {
                npi: providerData.npi,
                fullName: providerData.name,
                firstName: providerData.firstName,
                lastName: providerData.lastName,
                entityType: providerData.entityType,
                practiceState: providerData.address?.state || '',
                practiceCity: providerData.address?.city || '',
                practiceAddress: providerData.address?.street || '',
                practiceZip: providerData.address?.zip || '',
                practicePhone: providerData.address?.phone || '',
                specialty: providerData.specialty || providerData.taxonomy || '',
                taxonomyCode: providerData.taxonomyCode || '',
                primaryTaxonomy: providerData.taxonomy || '',
                isIndividual: providerData.isIndividual,
                gender: providerData.gender || '',
                credential: providerData.credential || ''
            };

            // Additional validation criteria
            const validations = {
                entityType: true, // We accept both individuals and organizations
                practiceState: !!providerInfo.practiceState,
                primaryTaxonomy: !!providerInfo.primaryTaxonomy,
                taxonomyCode: true, // Not strictly required
                npiNumber: !!providerInfo.npi
            };

            // Log validation results
            console.log(`✅ EntityType: ${validations.entityType ? 'PASS' : 'FAIL'} (${providerInfo.entityType})`);
            console.log(`✅ PracticeState: ${validations.practiceState ? 'PASS' : 'FAIL'} (${providerInfo.practiceState})`);
            console.log(`✅ PrimaryTaxonomy: ${validations.primaryTaxonomy ? 'PASS' : 'FAIL'} (${providerInfo.primaryTaxonomy})`);
            console.log(`✅ TaxonomyCode: ${validations.taxonomyCode ? 'PASS' : 'FAIL'} (${providerInfo.taxonomyCode})`);
            console.log(`✅ NPINumber: ${validations.npiNumber ? 'PASS' : 'FAIL'} (${providerInfo.npi})`);

            // Check if all validations pass
            if (validations.entityType && validations.practiceState && 
                validations.primaryTaxonomy && validations.npiNumber) {
                
                console.log(`✅ Provider validation PASSED`);
                
                // Validate doctor specialty against Google Sheets data
                const specialtyValidation = this.isDoctorSpecialtyValid(providerInfo.specialty);
                console.log(`🔍 Specialty validation for "${providerInfo.specialty}": ${specialtyValidation.reason}`);
                
                if (!specialtyValidation.isValid) {
                    console.log(`❌ Doctor specialty validation FAILED: ${specialtyValidation.reason}`);
                    return null;
                }
                
                // Add validation info to provider data
                providerInfo.validationInfo = {
                    whereToGo: specialtyValidation.whereToGo,
                    validationReason: specialtyValidation.reason,
                    dataSource: 'NewDoctorAPI',
                    validatedAt: new Date().toISOString()
                };
                
                console.log(`✅ Doctor specialty validation PASSED: ${specialtyValidation.reason}`);
                return providerInfo;
            } else {
                console.log(`❌ Provider validation FAILED`);
                return null;
            }

        } catch (error) {
            console.error(`❌ Error validating provider from New Doctor API data:`, error);
            return null;
        }
    }

    async validateProviderRelaxed(providerData) {
        try {
            console.log(`🔄 RELAXED validation for: ${providerData.name}`);

            // Basic validation using New Doctor API service (same as strict)
            const basicValidation = this.doctorAPI.validateProviderBasicCriteria(providerData);
            if (!basicValidation.isValid) {
                console.log(`❌ Basic validation failed (even relaxed): ${basicValidation.issues.join(', ')}`);
                return null;
            }

            // Convert format to our expected format
            const providerInfo = {
                npi: providerData.npi,
                fullName: providerData.name,
                firstName: providerData.firstName,
                lastName: providerData.lastName,
                entityType: providerData.entityType,
                practiceState: providerData.address?.state || '',
                practiceCity: providerData.address?.city || '',
                practiceAddress: providerData.address?.street || '',
                practiceZip: providerData.address?.zip || '',
                practicePhone: providerData.address?.phone || '',
                specialty: providerData.specialty || providerData.taxonomy || '',
                taxonomyCode: providerData.taxonomyCode || '',
                primaryTaxonomy: providerData.taxonomy || '',
                isIndividual: providerData.isIndividual,
                gender: providerData.gender || '',
                credential: providerData.credential || ''
            };

            // RELAXED VALIDATION: More lenient criteria
            const validations = {
                entityType: true, // We accept both individuals and organizations
                practiceState: !!providerInfo.practiceState,
                primaryTaxonomy: !!providerInfo.primaryTaxonomy,
                taxonomyCode: true, // Not strictly required
                npiNumber: !!providerInfo.npi
            };

            // Check if basic validations pass
            if (validations.entityType && validations.practiceState && 
                validations.primaryTaxonomy && validations.npiNumber) {
                
                console.log(`✅ RELAXED provider validation PASSED`);
                
                // RELAXED SPECIALTY VALIDATION: Skip the strict word matching
                let specialtyValidation = { 
                    isValid: true, 
                    reason: 'Relaxed validation - specialty requirement bypassed',
                    whereToGo: 'RELAXED'
                };
                
                // TRY STRICT SPECIALTY VALIDATION FIRST
                if (providerInfo.specialty) {
                    const strictSpecialtyValidation = this.isDoctorSpecialtyValid(providerInfo.specialty);
                    if (strictSpecialtyValidation.isValid) {
                        specialtyValidation = strictSpecialtyValidation;
                        console.log(`✅ RELAXED validation with STRICT specialty match: ${specialtyValidation.reason}`);
                    } else {
                        console.log(`⚠️  Strict specialty match failed, but passing with relaxed validation for "${providerInfo.specialty}"`);
                    }
                }
                
                // Add validation info to provider data
                providerInfo.validationInfo = {
                    whereToGo: specialtyValidation.whereToGo,
                    validationReason: specialtyValidation.reason,
                    dataSource: 'NewDoctorAPI (Relaxed)',
                    validatedAt: new Date().toISOString()
                };
                
                return providerInfo;
            } else {
                console.log(`❌ RELAXED provider validation FAILED`);
                return null;
            }

        } catch (error) {
            console.error(`❌ Error in relaxed provider validation:`, error);
            return null;
        }
    }
    
    async processPatientForDoctors(patient) {
        console.log(`\n\n--- Starting Doctor Fetching for Patient: ${patient.lastName} (Row ${patient.rowIndex}) ---`);
        
        // 🆕 CREDENTIAL VALIDATION: Check if patient has valid credentials before starting
        if (!patient.existingCredentials || patient.existingCredentials.trim() === '') {
            const errorMessage = `No credentials found for ${patient.lastName} in Column BW. Cannot proceed with doctor fetching.`;
            console.log(`🚫 ${errorMessage}`);
            
            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: NO CREDENTIALS');
            
            return {
                success: false,
                message: errorMessage,
                feedbackForDR2: `NO CREDENTIALS: Patient does not have Medicare login credentials in Column BW. Cannot fetch doctor information.`,
                hasDoctors: false
            };
        }
        
        // 🆕 CREDENTIAL FORMAT VALIDATION: Check if credentials are in correct format
        if (!patient.existingCredentials.includes('//')) {
            const errorMessage = `Invalid credential format for ${patient.lastName}. Expected format: username//password`;
            console.log(`🚫 ${errorMessage}`);
            
            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: INVALID CREDENTIALS');
            
            return {
                success: false,
                message: errorMessage,
                feedbackForDR2: `INVALID CREDENTIALS: Credentials format should be username//password. Current: ${patient.existingCredentials}`,
                hasDoctors: false
            };
        }
        
        console.log(`🔐 Found credentials for ${patient.lastName}: ${patient.existingCredentials.split('//')[0]}//[PASSWORD]`);
        
        let status = 'DOCTOR FETCH: PENDING';
        let recommendations = [];
        let closerComment = '';

        try {
            const patientState = this.extractStateFromAddress(patient.address);
            if (!patientState) {
                throw new Error(`Could not extract state from address: ${patient.address}`);
            }
            patient.state = patientState;

            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: LOGGING IN');

            const loginResult = await this.loginToMedicare(patient.existingCredentials);
            if (!loginResult.success) {
                // 🆕 SPECIAL HANDLING: Account disabled error 
                if (loginResult.isAccountDisabled && loginResult.errorType === 'ACCOUNT_DISABLED') {
                    console.log(`🛑 ACCOUNT DISABLED: Stopping workflow and updating DR2 INFO for ${patient.lastName}`);
                    
                    // Update DR2 INFO column with the account disabled message
                    await this.googleSheets.updateDoctorInfoColumns(patient.rowIndex, {
                        DR2_INFO: `ACCOUNT DISABLED: ${loginResult.message}`
                    });
                    
                    // Set Lead Status to account disabled
                    await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: ACCOUNT DISABLED');
                    
                    console.log(`🚫 NO DOCTOR FETCHING will be attempted for ${patient.lastName} due to account being disabled`);
                    
                    return {
                        success: false,
                        message: 'Account disabled - doctor fetching stopped',
                        isAccountDisabled: true,
                        preventFormSubmission: true // 🆕 PREVENT FORM SUBMISSION
                    };
                }
                
                // 🆕 SPECIAL HANDLING: Medicare system error
                if (loginResult.isMedicareSystemError && loginResult.errorType === 'MEDICARE_SYSTEM_ERROR') {
                    console.log(`🚨 MEDICARE SYSTEM ERROR: Stopping doctor fetching and logging error for ${patient.lastName}`);
                    
                    // Log the error to Submission Date column as requested
                    await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE ERROR: ${loginResult.message}`);
                    
                    // Set Lead Status to system error
                    await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: MEDICARE SYSTEM ERROR');
                    
                    console.log(`🚫 NO DOCTOR FETCHING attempted for ${patient.lastName} due to Medicare system being temporarily unavailable`);
                    
                    return {
                        success: false,
                        message: 'Medicare system temporarily unavailable - doctor fetching failed',
                        isMedicareSystemError: true,
                        hasDoctors: false,
                        preventFormSubmission: true // 🆕 PREVENT FORM SUBMISSION
                    };
                }
                
                // 🆕 GENERAL LOGIN ERROR HANDLING: Any other login failure
                console.log(`❌ LOGIN ERROR: Stopping doctor fetching and logging error for ${patient.lastName}`);
                
                // Log the error to Submission Date column
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `LOGIN ERROR: ${loginResult.message}`);
                
                // Set Lead Status to login error
                await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: LOGIN ERROR');
                
                console.log(`🚫 NO DOCTOR FETCHING attempted for ${patient.lastName} due to login failure`);
                
                return {
                    success: false,
                    message: `Login failed: ${loginResult.message}`,
                    isLoginError: true,
                    hasDoctors: false,
                    preventFormSubmission: true // 🆕 PREVENT FORM SUBMISSION
                };
            }

            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: FETCHING CLAIMS');
            
            // 🆕 RETRY LOGIC: Add retry mechanism for claims fetching to handle page navigation issues
            let claims = [];
            let claimsAttempts = 0;
            const maxClaimsAttempts = 3;
            
            while (claimsAttempts < maxClaimsAttempts && claims.length === 0) {
                claimsAttempts++;
                console.log(`🔄 Claims fetching attempt ${claimsAttempts}/${maxClaimsAttempts}...`);
                
                try {
                    claims = await this.fetchClaims();
                    if (claims.length > 0) {
                        console.log(`✅ Successfully fetched ${claims.length} claims on attempt ${claimsAttempts}`);
                        break;
                    }
                } catch (claimsError) {
                    console.log(`❌ Claims fetching attempt ${claimsAttempts} failed:`, claimsError.message);
                    
                    if (claimsError.message.includes('Execution context was destroyed')) {
                        console.log(`🔄 Page navigation detected - retrying claims fetch in ${claimsAttempts * 2} seconds...`);
                        await this.page.waitForTimeout(claimsAttempts * 2000); // Increasing delay
                        
                        // Try to navigate back to claims page
                        try {
                            await this.page.goto('https://www.medicare.gov/my/claims?dateRange=last36Months&sortBy=claim_from_date&claimTypes=PartB%2COutpatient%2CInpatient', {
                                waitUntil: 'domcontentloaded',
                                timeout: 60000
                            });
                            await this.page.waitForTimeout(3000);
                        } catch (navError) {
                            console.log(`⚠️  Could not navigate back to claims page:`, navError.message);
                        }
                    }
                    
                    if (claimsAttempts >= maxClaimsAttempts) {
                        throw claimsError; // Re-throw if all attempts failed
                    }
                }
            }

            if (claims.length === 0) {
                closerComment = 'No claims found in Medicare. Could not determine active providers.';
                console.log(`⚠️  ${closerComment}`);
                await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: NO CLAIMS');
                await this.googleSheets.saveDoctorRecommendations(patient.rowIndex, [], closerComment);
                return;
            }
            
            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: ANALYZING PROVIDERS');
            const topProviders = await this.analyzeProviders(claims, patient.state);

            // 🆕 HANDLE FEEDBACK OBJECT: Check if analyzeProviders returned feedback instead of provider list
            if (topProviders.isNoRecentActivity) {
                closerComment = topProviders.feedbackMessage;
                console.log(`⚠️  ${closerComment}`);
                await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: NO RECENT ACTIVITY');
                await this.googleSheets.saveDoctorRecommendations(patient.rowIndex, [], closerComment);
                
                // 🆕 RETURN FEEDBACK TO ORCHESTRATION SERVER
                return {
                    success: false,
                    message: closerComment,
                    feedbackForDR2: closerComment,
                    noRecentActivity: true,
                    hasDoctors: false
                };
            }

            if (topProviders.length === 0) {
                closerComment = 'No recent providers found from claims analysis.';
                console.log(`⚠️  ${closerComment}`);
                await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: NO RECENT PROVIDERS');
                await this.googleSheets.saveDoctorRecommendations(patient.rowIndex, [], closerComment);
                
                // 🆕 RETURN FEEDBACK TO ORCHESTRATION SERVER
                return {
                    success: false,
                    message: closerComment,
                    feedbackForDR2: closerComment,
                    hasDoctors: false
                };
            }

            await this.googleSheets.updateLeadStatus(patient.rowIndex, 'DOCTOR FETCH: PROCESSING PROVIDERS');
            const result = await this.processProviders(topProviders, patient.state, patient);

            if (result.success && result.doctors.length > 0) {
                status = 'DOCTOR FETCH: COMPLETE';
                recommendations = result.doctors;
                closerComment = `Found ${recommendations.length} valid doctor(s). Top recommendation: ${recommendations[0].fullName}`;
                
                // 🆕 RETURN SUCCESS WITH DOCTORS
                return {
                    success: true,
                    message: closerComment,
                    doctors: recommendations,
                    hasDoctors: true
                };
            } else {
                status = 'DOCTOR FETCH: NO VALID DOCTORS';
                closerComment = result.message || 'Found providers in claims, but none could be validated with a valid specialty.';
                
                // 🆕 RETURN FEEDBACK TO ORCHESTRATION SERVER
                return {
                    success: false,
                    message: closerComment,
                    feedbackForDR2: result.feedbackForDR2 || closerComment,
                    hasDoctors: false
                };
            }

            await this.googleSheets.updateLeadStatus(patient.rowIndex, status);
            await this.googleSheets.saveDoctorRecommendations(patient.rowIndex, recommendations, closerComment);

        } catch (error) {
            console.error(`❌ Critical error processing patient ${patient.lastName}:`, error);
            status = 'DOCTOR FETCH: FAILED';
            closerComment = `Error: ${error.message}`;
            await this.googleSheets.updateLeadStatus(patient.rowIndex, status);
            await this.googleSheets.saveDoctorRecommendations(patient.rowIndex, [], closerComment);
            
            // Try to restart browser on critical errors
            await this.restartBrowser();
        } finally {
            // Always logout after processing each patient
            await this.logoutFromMedicare();
            console.log(`--- Finished Doctor Fetching for Patient: ${patient.lastName} ---`);
        }
    }

    async processProviders(topProviders, patientState, patient) {
        const recommendedDoctors = [];
        const fallbackDoctors = []; // Store "decent" doctors as fallback
        let totalProvidersChecked = 0;
        let validationFailedCount = 0;
        let companiesSkipped = 0;

        // Validate each top provider
        for (const providerData of topProviders) {
            console.log(`\n🔍 Validating provider: ${providerData.provider}`);
            totalProvidersChecked++;
            
            // CHECK IF PROVIDER IS A COMPANY (SKIP COMPANIES)
            if (this.isProviderCompany(providerData.provider)) {
                console.log(`🏢 SKIPPING COMPANY: "${providerData.provider}" - not a real doctor`);
                companiesSkipped++;
                continue; // Skip this provider and move to next
            }
            
            const jsonUrl = await this.searchProvider(providerData.provider, patientState);
            if (jsonUrl) {
                // FLEXIBLE VALIDATION: Try strict validation first, then relaxed
                let providerInfo = await this.validateProvider(jsonUrl);
                let validationType = 'STRICT';
                
                // If strict validation fails, try relaxed validation for fallback
                if (!providerInfo) {
                    console.log(`⚡ Trying relaxed validation for fallback...`);
                    providerInfo = await this.validateProviderRelaxed(jsonUrl);
                    validationType = 'RELAXED';
                }
                
                if (providerInfo) {
                    // BAD SPECIALTY EXCLUSION: Skip if specialty is in BAD list
                    const specialtyCheck = this.isDoctorSpecialtyValid(providerInfo.specialty);
                    if (!specialtyCheck.isValid) {
                        console.log(`❌ EXCLUDED BY BAD SPECIALTY: ${providerInfo.specialty}`);
                        validationFailedCount++;
                        continue;
                    }
                    // PECOS ENROLLMENT CHECK: Verify Medicare enrollment before final approval
                    console.log(`\n🏥 PECOS ENROLLMENT VERIFICATION for ${providerInfo.fullName}...`);
                    providerInfo = await this.validateProviderWithPECOSEnrollment(providerInfo);
                    
                    // Add scoring and validation type
                    providerInfo.visitCount = providerData.visitCount;
                    providerInfo.totalScore = providerData.totalScore;
                    providerInfo.validationType = validationType; // Track validation type
                    
                    // ADD LATEST CLAIM/VISIT DATE
                    if (providerData.visits && providerData.visits.length > 0) {
                        // Sort visits by date (newest first) and get the latest one
                        const sortedVisits = providerData.visits.sort((a, b) => {
                            const dateA = new Date(a.date);
                            const dateB = new Date(b.date);
                            return dateB - dateA; // Newest first
                        });
                        providerInfo.latestVisitDate = sortedVisits[0].date;
                        providerInfo.lastVisit = `Last Visit: ${sortedVisits[0].date}`;
                        console.log(`   📅 Latest visit: ${providerInfo.latestVisitDate}`);
                    } else {
                        providerInfo.latestVisitDate = null;
                        providerInfo.lastVisit = 'No Recent Visits';
                    }
                    
                    // DECISION LOGIC: Consider PECOS enrollment in final recommendation
                    const isPECOSEnrolled = providerInfo.pecosEnrollment?.isEnrolled === true;
                    const isPECOSUnknown = providerInfo.pecosEnrollment?.isEnrolled === null; // API error, still allow
                    
                    if (isPECOSEnrolled || isPECOSUnknown) {
                        // Provider is enrolled OR enrollment status is unknown (API issue)
                        if (validationType === 'STRICT') {
                            recommendedDoctors.push(providerInfo);
                            console.log(`✅ STRICT RECOMMENDED: ${providerInfo.fullName} (${providerData.visitCount} visits, Score: ${providerData.totalScore}) - Specialty: ${providerInfo.specialty}`);
                            if (isPECOSEnrolled) {
                                console.log(`   🏥 PECOS Status: ✅ ENROLLED (can bill Medicare)`);
                            } else {
                                console.log(`   🏥 PECOS Status: ⚠️ UNKNOWN (assuming eligible)`);
                            }
                        } else {
                            fallbackDoctors.push(providerInfo);
                            console.log(`⚡ FALLBACK DOCTOR: ${providerInfo.fullName} (${providerData.visitCount} visits, Score: ${providerData.totalScore}) - Specialty: ${providerInfo.specialty}`);
                            if (isPECOSEnrolled) {
                                console.log(`   🏥 PECOS Status: ✅ ENROLLED (can bill Medicare)`);
                            } else {
                                console.log(`   🏥 PECOS Status: ⚠️ UNKNOWN (assuming eligible)`);
                            }
                        }
                    } else {
                        // Provider is NOT enrolled in PECOS - reject them
                        console.log(`❌ REJECTED: ${providerInfo.fullName} - NOT ENROLLED in Medicare PECOS`);
                        console.log(`   🏥 PECOS Status: ❌ NOT ENROLLED (cannot bill Medicare)`);
                        console.log(`   📋 Status: ${providerInfo.pecosEnrollment?.status}`);
                        validationFailedCount++;
                    }
                    
                    console.log(`   📋 Validation: ${providerInfo.validationInfo?.validationReason}`);
                    
                    // SMART STOPPING: Stop only if we have 9 strict doctors (increased from 3)
                    if (recommendedDoctors.length >= 9) {
                        console.log(`🎯 REACHED LIMIT: Found top 9 strict validation doctors, stopping search`);
                        break;
                    }
                } else {
                    validationFailedCount++;
                    console.log(`❌ Both strict and relaxed validation failed`);
                }
            } else {
                console.log(`❌ Could not find provider data on New Doctor API`);
                validationFailedCount++;
            }

            console.log(`📊 Progress: ${recommendedDoctors.length} strict + ${fallbackDoctors.length} fallback doctors found...`);
        }
        
        // Only strict recommendations, no fallback or emergency logic
        let finalDoctors = [...recommendedDoctors];
        // SORT FINAL RECOMMENDATIONS BY COMPOSITE SCORE (highest first)
        if (finalDoctors.length > 1) {
            finalDoctors.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        }
        // Provide summary of validation results
        console.log(`\n📊 Validation Summary for ${patient.lastName}:`);
        console.log(`   🔍 Total providers checked: ${totalProvidersChecked}`);
        console.log(`   🏢 Companies skipped: ${companiesSkipped}`);
        console.log(`   ✅ Strict doctors: ${recommendedDoctors.length}`);
        console.log(`   ⚡ Fallback doctors: ${fallbackDoctors.length}`);
        console.log(`   🎯 Final doctors selected: ${finalDoctors.length}`);
        console.log(`   ❌ Validation completely failed: ${validationFailedCount}`);
        if (this.validSpecialties.length > 0) {
            console.log(`   📋 Using validation data with ${this.validSpecialties.length} approved specialties`);
        } else {
            console.log(`   ⚠️  No validation data loaded - all specialties allowed`);
        }
        if (finalDoctors.length > 0) {
            console.log(`\n🎯 Found ${finalDoctors.length} recommended doctors for ${patient.lastName}`);
            // SHOW DOCTOR BREAKDOWN BY TYPE AND SCORING
            const strictCount = finalDoctors.filter(d => d.validationType === 'STRICT').length;
            const relaxedCount = finalDoctors.filter(d => d.validationType === 'RELAXED').length;
            const emergencyCount = finalDoctors.filter(d => d.validationType === 'EMERGENCY').length;
            if (strictCount > 0) console.log(`   ✅ ${strictCount} strict validation doctors`);
            if (relaxedCount > 0) console.log(`   ⚡ ${relaxedCount} relaxed validation doctors`);
            if (emergencyCount > 0) console.log(`   🚨 ${emergencyCount} emergency fallback doctors`);
            // SHOW DETAILED SCORING FOR TOP DOCTORS
            console.log(`\n🏆 Final Doctor Rankings with Scoring System:`);
            finalDoctors.forEach((doctor, index) => {
                console.log(`\n${index + 1}. ${doctor.fullName}`);
                console.log(`   🎯 Total Score: ${doctor.totalScore || 'N/A'}`);
                console.log(`   👥 Visits: ${doctor.visitCount || 'N/A'}`);
                console.log(`   🎭 Validation: ${doctor.validationType || 'Unknown'}`);
                console.log(`   🏥 Specialty: ${doctor.specialty || 'Not specified'}`);
            });
            console.log(`✅ Doctor recommendations will be saved to AZ-BH columns for ${patient.lastName}`);
            return { 
                success: true, 
                doctors: finalDoctors,
                message: `Found ${finalDoctors.length} recommended doctors (strict only)`
            };
        } else {
            console.log(`❌ No doctors found for ${patient.lastName} - this should not happen with fallback logic!`);
            // 🆕 ENHANCED FEEDBACK: Provide detailed feedback about why no doctors were found
            let feedbackMessage = `No valid doctors found after checking ${totalProvidersChecked} providers. `;
            if (companiesSkipped > 0) {
                feedbackMessage += `Skipped ${companiesSkipped} companies/organizations. `;
            }
            if (validationFailedCount > 0) {
                feedbackMessage += `${validationFailedCount} providers failed validation (no specialty match, missing NPI, or not enrolled in Medicare PECOS). `;
            }
            feedbackMessage += `Patient has recent medical activity but providers could not be validated for Medicare billing or specialty requirements.`;
            console.log(`📋 Detailed feedback: ${feedbackMessage}`);
            return { 
                success: false, 
                message: 'No doctors found despite fallback logic',
                feedbackForDR2: feedbackMessage,
                detailedStats: {
                    totalChecked: totalProvidersChecked,
                    companiesSkipped: companiesSkipped,
                    validationFailed: validationFailedCount,
                    strictDoctors: recommendedDoctors.length,
                    fallbackDoctors: fallbackDoctors.length
                }
            };
        }
    }

    async restartBrowser() {
        try {
            console.log('🔄 Restarting browser for fresh session...');
            
            // Close current browser
            if (this.browser && this.browser.isConnected()) {
                await this.browser.close();
                console.log('✅ Old browser closed');
            }
            
            // Wait a moment before starting new browser
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Reinitialize browser
            await this.initialize();
            console.log('✅ New browser session started');
            
        } catch (error) {
            console.error('❌ Error restarting browser:', error);
            throw error;
        }
    }

    async getPatientsWithCredentials() {
        console.log('📊 Fetching patients with existing credentials starting from row 938...');
        
        // Use the new method specifically for doctor fetching, starting from row 938
        const patientsWithCredentials = await this.googleSheets.getPatientsWithCredentials(938);

        console.log(`✅ Found ${patientsWithCredentials.length} patients with credentials for doctor fetching (starting from row 938)`);
        return patientsWithCredentials;
    }

    async processPatientsForDoctors() {
        console.log('🏥 Starting Doctor Fetching Process...');
        
        const patients = await this.getPatientsWithCredentials();
        console.log(`Found ${patients.length} patients to process for doctors`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < patients.length; i++) {
            const patient = patients[i];
            
            try {
                console.log(`\n🔄 Processing patient ${i + 1}/${patients.length}: ${patient.lastName}`);
                console.log(`📧 Account: ${patient.existingCredentials.split('//')[0]}`);
                
                const result = await this.processPatientForDoctors(patient);
                
                if (result.success) {
                    console.log(`✅ Success: ${patient.lastName} - found ${result.doctors.length} doctors`);
                    successCount++;
                } else {
                    console.log(`❌ Failed: ${patient.lastName}: ${result.message}`);
                    errorCount++;
                }
                
                // Wait between patients to avoid overwhelming the Medicare system
                if (i < patients.length - 1) { // Don't wait after the last patient
                    console.log('⏳ Waiting 3 seconds before next patient...');
                    await this.page.waitForTimeout(3000);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${patient.lastName}:`, error.message);
                errorCount++;
                
                // If there was an error, still wait before next patient
                if (i < patients.length - 1) {
                    console.log('⏳ Waiting 3 seconds after error before next patient...');
                    await this.page.waitForTimeout(3000);
                }
            }
        }
        
        console.log(`\n📊 Doctor Fetching Complete:`);
        console.log(`   ✅ Successful: ${successCount} patients`);
        console.log(`   ❌ Failed: ${errorCount} patients`);
        console.log(`   📊 Total processed: ${patients.length} patients`);
        console.log(`   🎯 Success rate: ${((successCount / patients.length) * 100).toFixed(1)}%`);
    }

    async cleanup() {
        try {
            if (this.browser && this.browser.isConnected()) {
                console.log('🔚 Closing Chrome browser after doctor fetching...');
                await this.browser.close();
                console.log('✅ Chrome browser closed successfully');
                this.browser = null;
                this.page = null;
            }
        } catch (error) {
            console.log('⚠️  Error closing browser:', error.message);
        }
    }

    async closeBrowser() {
        try {
            if (this.browser && this.browser.isConnected()) {
                console.log('🔚 Closing browser...');
                await this.browser.close();
                console.log('✅ Browser closed successfully');
            }
        } catch (error) {
            console.log('⚠️  Error closing browser:', error.message);
        }
    }

    // 🆕 ADD COMPANY DETECTION LOGIC
    isProviderCompany(providerName) {
        if (!providerName) return false;
        
        const name = providerName.toLowerCase().trim();
        
        // Company indicators
        const companyIndicators = [
            // Business entities
            'llc', 'inc', 'corp', 'corporation', 'company', 'co.', 'ltd', 'limited',
            'associates', 'partnership', 'partners', 'group', 'pllc', 'pc', 'professional corp',
            
            // Medical facilities/organizations
            'center', 'clinic', 'hospital', 'medical center', 'health center', 'healthcare',
            'medical group', 'health system', 'health services', 'medical services',
            'ambulatory', 'outpatient', 'surgery center', 'surgical center',
            
            // Generic business terms
            'services', 'solutions', 'systems', 'enterprises', 'ventures', 'holdings',
            'management', 'consulting', 'consultants',
            
            // Medical equipment/supply companies
            'medical equipment', 'medical supplies', 'durable medical', 'equipment rental',
            'supply company', 'equipment company',
            
            // Labs and diagnostic centers
            'laboratory', 'lab services', 'diagnostic services', 'imaging services',
            'radiology services', 'pathology services',
            
            // Therapy and rehabilitation centers
            'physical therapy', 'rehabilitation services', 'therapy center',
            'wellness center', 'fitness center'
        ];
        
        // Check for company indicators
        for (const indicator of companyIndicators) {
            if (name.includes(indicator)) {
                console.log(`🏢 COMPANY DETECTED: "${providerName}" contains "${indicator}"`);
                return true;
            }
        }
        
        // Check for patterns that suggest a person's name (Dr. [First] [Last])
        const personPatterns = [
            /^dr\.?\s+[a-z]+\s+[a-z]+$/i,  // "Dr. John Smith"
            /^[a-z]+\s+[a-z]+,?\s+(md|do|np|pa|rn)$/i,  // "John Smith MD"
            /^[a-z]+,\s+[a-z]+\s+(md|do|np|pa|rn)$/i,   // "Smith, John MD"
        ];
        
        for (const pattern of personPatterns) {
            if (pattern.test(name)) {
                console.log(`👨‍⚕️ PERSON DETECTED: "${providerName}" matches person pattern`);
                return false;
            }
        }
        
        // Additional heuristics: 
        // - If it's 2-3 words and doesn't contain company indicators, likely a person
        // - If it's more than 4 words, likely a company/organization
        const words = name.split(/\s+/).filter(word => word.length > 0);
        
        if (words.length >= 2 && words.length <= 3) {
            // Check if it looks like a person's name (no obvious company words)
            const hasPersonalTitle = /^(dr|doctor|mr|mrs|ms)\.?$/i.test(words[0]);
            const hasCredentials = /^(md|do|np|pa|rn|dds|dpm|od)$/i.test(words[words.length - 1]);
            
            if (hasPersonalTitle || hasCredentials) {
                console.log(`👨‍⚕️ PERSON DETECTED: "${providerName}" has personal title or credentials`);
                return false;
            }
            
            // If 2-3 words with no company indicators, assume it's a person
            console.log(`👨‍⚕️ LIKELY PERSON: "${providerName}" (2-3 words, no company indicators)`);
            return false;
        }
        
        if (words.length >= 5) {
            console.log(`🏢 LIKELY COMPANY: "${providerName}" (5+ words, likely organization)`);
            return true;
        }
        
        // Default: if unclear, treat as person (to avoid false positives)
        console.log(`❓ UNCLEAR: "${providerName}" - treating as person by default`);
        return false;
    }

    async validateProviderWithPECOSEnrollment(providerInfo) {
        try {
            console.log(`🏥 Checking PECOS enrollment for: ${providerInfo.fullName} (NPI: ${providerInfo.npi})`);
            
            if (!providerInfo.npi) {
                console.log(`❌ No NPI available for PECOS check`);
                return {
                    ...providerInfo,
                    pecosEnrollment: {
                        isEnrolled: false,
                        status: 'No NPI',
                        error: 'NPI not available for enrollment verification'
                    }
                };
            }

            // Check PECOS enrollment status
            const enrollmentResult = await this.pecosEnrollment.checkProviderEnrollment(providerInfo.npi);
            
            // Add PECOS enrollment info to provider data
            const updatedProviderInfo = {
                ...providerInfo,
                pecosEnrollment: enrollmentResult
            };

            // Log enrollment status
            if (enrollmentResult.isEnrolled === true) {
                console.log(`✅ PECOS ENROLLED: ${providerInfo.fullName} is actively enrolled in Medicare`);
                console.log(`   📋 Status: ${enrollmentResult.status}`);
                console.log(`   📅 Enrollment Date: ${enrollmentResult.enrollmentDate || 'Not available'}`);
            } else if (enrollmentResult.isEnrolled === false) {
                console.log(`❌ NOT ENROLLED: ${providerInfo.fullName} is not enrolled in Medicare PECOS`);
                console.log(`   📋 Status: ${enrollmentResult.status}`);
                console.log(`   ⚠️  This provider cannot bill Medicare`);
            } else {
                console.log(`⚠️  ENROLLMENT UNKNOWN: Could not verify PECOS enrollment for ${providerInfo.fullName}`);
                console.log(`   📋 Status: ${enrollmentResult.status}`);
                console.log(`   🔍 Error: ${enrollmentResult.error}`);
            }

            return updatedProviderInfo;

        } catch (error) {
            console.error(`❌ Error in PECOS enrollment validation:`, error);
            return {
                ...providerInfo,
                pecosEnrollment: {
                    isEnrolled: null,
                    status: 'Validation Error',
                    error: error.message
                }
            };
        }
    }

    async detectLoginErrors() {
        try {
            console.log('🔍 Detecting login errors...');
            
            // Wait a moment for any error messages to appear
            await this.page.waitForTimeout(2000);
            
            // 🆕 FIRST CHECK: Are we successfully logged in?
            const currentUrl = this.page.url();
            console.log(`📍 Current URL for error detection: ${currentUrl}`);
            
            // If we're on a Medicare authenticated page, we're successfully logged in
            if (currentUrl.includes('/my/home') || currentUrl.includes('/my/')) {
                console.log('✅ Successfully logged in - no login errors detected');
                return { hasError: false, message: 'Successfully logged in' };
            }
            
            // Check for general error alerts
            const errorAlert = await this.page.$('div.ds-c-alert.ds-c-alert--error');
            if (errorAlert) {
                const errorText = await errorAlert.textContent();
                console.log(`🚨 Error alert found: ${errorText}`);
                
                // 🆕 SPECIFIC CHECK: "You can no longer use this account" error
                if (errorText.includes('You can no longer use this account')) {
                    console.log(`🛑 CRITICAL ERROR: Account is no longer usable`);
                    return {
                        hasError: true,
                        isAccountDisabled: true, // Special flag for this error type
                        message: 'You can no longer use this account. If you\'re the estate representative, call 1-800-MEDICARE (1-800-633-4227). TTY users can call 1-877-486-2048.',
                        errorType: 'ACCOUNT_DISABLED'
                    };
                }
                
                // 🆕 SPECIFIC CHECK: "We can't process your request at this time" - Medicare system error
                if (errorText.includes('We can\'t process your request at this time') || 
                    errorText.includes('Try logging into your account later')) {
                    console.log(`🚨 MEDICARE SYSTEM ERROR: Temporary system issue detected`);
                    return {
                        hasError: true,
                        isMedicareSystemError: true, // Special flag for Medicare system errors
                        message: 'Medicare system temporarily unavailable - We can\'t process your request at this time. Try logging into your account later.',
                        errorType: 'MEDICARE_SYSTEM_ERROR'
                    };
                }
                
                return {
                    hasError: true,
                    message: errorText.trim()
                };
            }
            
            // Check for specific login error messages (ONLY if we're still on login page)
            if (currentUrl.includes('/account/login')) {
                console.log('⚠️ Still on login page - checking for specific error messages...');
                
                const loginErrorSelectors = [
                    'div.ds-c-alert--error',
                    '[data-testid="error-message"]',
                    '.error-message',
                    '.ds-c-alert__body',
                    'div:has-text("incorrect username")',
                    'div:has-text("incorrect password")',
                    'div:has-text("invalid username")',
                    'div:has-text("invalid password")',
                    'div:has-text("account is locked")', // More specific than just "locked"
                    'div:has-text("temporarily locked")',
                    'div:has-text("captcha")',
                    'div:has-text("verification required")',
                    'div:has-text("temporarily disabled")'
                ];
                
                for (const selector of loginErrorSelectors) {
                    try {
                        const errorElement = await this.page.$(selector);
                        if (errorElement) {
                            const errorText = await errorElement.textContent();
                            if (errorText && errorText.length > 0) {
                                console.log(`🚨 Login error found with selector ${selector}: ${errorText}`);
                                return {
                                    hasError: true,
                                    message: errorText.trim()
                                };
                            }
                        }
                    } catch (e) {
                        // Continue to next selector if this one fails
                    }
                }
                
                // Check for field validation errors
                const usernameField = await this.page.$('input[name="username"]#username-textbox');
                const passwordField = await this.page.$('input[name="password"]#password-textbox');
                
                if (usernameField && passwordField) {
                    const usernameValue = await usernameField.inputValue();
                    const passwordValue = await passwordField.inputValue();
                    
                    console.log(`🔍 Form values - Username: ${usernameValue}, Password: ${passwordValue ? '[PRESENT]' : '[MISSING]'}`);
                    
                    if (!usernameValue || !passwordValue) {
                        return {
                            hasError: true,
                            message: 'Login fields not properly filled'
                        };
                    }
                }
                
                // Check for captcha
                const captchaElement = await this.page.$('[data-testid="captcha"], iframe[src*="captcha"], img[src*="captcha"], div:has-text("captcha")');
                if (captchaElement) {
                    return {
                        hasError: true,
                        message: 'Captcha verification required'
                    };
                }
                
                // Generic error for staying on login page
                return {
                    hasError: true,
                    message: 'Login failed - credentials may be invalid or account may be locked'
                };
            }
            
            console.log('✅ No login errors detected');
            return { hasError: false, message: '' };
            
        } catch (error) {
            console.log('⚠️ Could not detect login errors:', error.message);
            return { hasError: false, message: 'Could not detect login errors' };
        }
    }
}

// Main execution function
async function main() {
    const doctorFetcher = new DoctorFetching();
    
    try {
        await doctorFetcher.initialize();
        await doctorFetcher.processPatientsForDoctors();
        
    } catch (error) {
        console.error('Doctor fetching failed:', error);
    } finally {
        await doctorFetcher.cleanup();
    }
}

// Run the doctor fetching if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DoctorFetching; 
const { chromium } = require('playwright');
const GoogleSheetsService = require('./google-sheets-service');
require('dotenv').config();

class MedicareAutomation {
    constructor(sheetName = null, chromePort = 9222, eligibilityType = 'PART_B') {
        this.googleSheets = new GoogleSheetsService();
        this.chromePort = chromePort;
        this.eligibilityType = eligibilityType; // 'PART_A' or 'PART_B'
        
        if (sheetName) {
            this.googleSheets.setSheetName(sheetName);
            console.log(`📋 Medicare automation initialized for sheet: ${sheetName}`);
        }
        
        console.log(`🎯 Medicare automation configured for: ${eligibilityType}`);
        this.browser = null;
        this.page = null;
    }

    // Method to set sheet name after construction
    setSheetName(sheetName) {
        this.googleSheets.setSheetName(sheetName);
        console.log(`📋 Sheet name set to: ${sheetName}`);
    }

    // Method to set eligibility type after construction
    setEligibilityType(eligibilityType) {
        this.eligibilityType = eligibilityType;
        console.log(`🎯 Eligibility type set to: ${eligibilityType}`);
    }

    // 🆕 ADDED: Clear Chrome user data directory to prevent session conflicts
    async clearChromeUserData() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const userDataDir = `C:\\temp\\chrome-debug-${this.chromePort}`;
            console.log(`🧹 Attempting to clear Chrome user data: ${userDataDir}`);
            
            try {
                await fs.access(userDataDir);
                // Directory exists, try to remove it
                await fs.rmdir(userDataDir, { recursive: true });
                console.log(`✅ Successfully cleared Chrome user data directory`);
            } catch (accessError) {
                // Directory doesn't exist or couldn't be removed
                console.log(`📁 Chrome user data directory not found or already clean: ${userDataDir}`);
            }
        } catch (error) {
            console.log(`⚠️  Could not clear Chrome user data:`, error.message);
            console.log(`⚠️  Continuing anyway...`);
        }
    }

    // 🆕 ADDED: Inject anti-detection script for CDP connections
    async injectAntiDetectionScript() {
        try {
            await this.page.evaluate(() => {
                // Remove webdriver property that can be detected
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // Override plugins to look more natural
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // Override languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Override permissions
                Object.defineProperty(navigator, 'permissions', {
                    get: () => ({
                        query: async () => ({ state: 'granted' }),
                    }),
                });
                
                // Override chrome property
                if (window.chrome && window.chrome.runtime) {
                    Object.defineProperty(window.chrome, 'runtime', {
                        get: () => ({
                            onConnect: null,
                            onMessage: null,
                        }),
                    });
                }
            });
           // console.log('✅ Anti-detection script injected successfully');
        } catch (error) {
            //console.log('⚠️  Could not inject anti-detection script:', error.message);
        }
    }

    // 🆕 ADDED: Enhanced login error detection (same as doctor-fetching.js)
    async detectLoginErrors() {
        try {
            // Wait for any errors to appear
            await this.page.waitForTimeout(2000);
            
            // Check for Medicare system error
            const systemErrorMessages = [
                "We can't process your request at this time",
                "Try logging into your account later",
                "Medicare.gov is currently unavailable",
                "System temporarily unavailable",
                "Service temporarily unavailable"
            ];
            
            for (const errorMessage of systemErrorMessages) {
                const systemError = await this.page.locator(`text=${errorMessage}`).first();
                if (await systemError.isVisible().catch(() => false)) {
                   // console.log(`🚨 MEDICARE SYSTEM ERROR detected: ${errorMessage}`);
                    return {
                        hasError: true,
                        errorType: 'MEDICARE_SYSTEM_ERROR',
                        message: errorMessage,
                        isMedicareSystemError: true
                    };
                }
            }
            
            // Check for account disabled/locked
            const accountDisabledTexts = [
                'Your account has been disabled',
                'Account has been disabled',
                'Your account is disabled',
                'disabled due to',
                'account has been locked'
            ];
            
            for (const disabledText of accountDisabledTexts) {
                const disabledError = await this.page.locator(`text=${disabledText}`).first();
                if (await disabledError.isVisible().catch(() => false)) {
                   // console.log(`🚨 ACCOUNT DISABLED ERROR detected: ${disabledText}`);
                    return {
                        hasError: true,
                        errorType: 'ACCOUNT_DISABLED',
                        message: disabledText
                    };
                }
            }
            
            // Check for standard error alert
            const errorAlert = await this.page.$('div.ds-c-alert.ds-c-alert--error');
            if (errorAlert) {
                const errorText = await errorAlert.textContent();
                //console.log(`🚨 Standard error detected: ${errorText}`);
                return {
                    hasError: true,
                    errorType: 'LOGIN_ERROR',
                    message: errorText.trim()
                };
            }
            
            // Check for invalid credentials
            const invalidCredentialTexts = [
                'The username and/or password you entered is incorrect',
                'Invalid username or password',
                'incorrect username or password',
                'Login failed'
            ];
            
            for (const invalidText of invalidCredentialTexts) {
                const invalidError = await this.page.locator(`text=${invalidText}`).first();
                if (await invalidError.isVisible().catch(() => false)) {
                    //console.log(`🚨 INVALID CREDENTIALS detected: ${invalidText}`);
                    return {
                        hasError: true,
                        errorType: 'INVALID_CREDENTIALS',
                        message: invalidText
                    };
                }
            }
            
            //console.log('✅ No login errors detected');
            return { hasError: false };
            
        } catch (error) {
            //console.log('⚠️  Error detecting login errors:', error.message);
            return { hasError: false, message: 'Could not detect login errors' };
        }
    }

    async initialize() {
        console.log('🏥 Initializing Medicare Automation (Part B)...');
        // User agent pool for randomization
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
        ];
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        try {
            // 🆕 IMPROVED: Clear any existing session data first
           // console.log('🧹 Clearing any existing session data...');
            await this.clearChromeUserData();
            // Try to connect to existing Chrome browser first
            console.log(`🌐 Attempting to connect to existing Chrome browser on port ${this.chromePort}...`);
            this.browser = await chromium.connectOverCDP(`http://localhost:${this.chromePort}`);
            console.log(`✅ Connected to existing Chrome browser on port ${this.chromePort}`);
        } catch (error) {
           // console.log(`⚠️  Could not connect to existing Chrome on port ${this.chromePort}. Error:`, error.message);
           // console.log('🔄 Falling back to launching Chromium...');
            this.browser = await chromium.launch({
                headless: process.env.HEADLESS === 'true',
                slowMo: 0, // Set to 0 for instant automation
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
                    `--user-agent=${randomUserAgent}`
                ]
            });
           // console.log('✅ Chromium browser launched successfully');
        }
        
        this.page = await this.browser.newPage();
        //console.log('✅ New page created with improved anti-detection');
        
        // Set viewport
        await this.page.setViewportSize({ width: 1366, height: 768 });
        //console.log('✅ Viewport set to 1366x768');
        
        // 🆕 IMPROVED: Remove webdriver property that can be detected (with CDP compatibility)
        try {
            if (this.page.evaluateOnNewDocument) {
                // Method available - using Playwright-launched browser
                await this.page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    
                    // Override the `plugins` property to use a custom getter.
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });
                    
                    // Override the `languages` property to use a custom getter.
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                    
                    // Override the `permissions` property to use a custom getter.
                    Object.defineProperty(navigator, 'permissions', {
                        get: () => ({
                            query: async () => ({ state: 'granted' }),
                        }),
                    });
                });
               // console.log('✅ Anti-detection script injected on new documents');
            } else {
                // Method not available - connected to existing Chrome via CDP
              //  console.log('⚠️  evaluateOnNewDocument not available (CDP connection) - will inject on navigation');
                // We'll inject the script after each navigation instead
            }
        } catch (error) {
          //  console.log('⚠️  Could not inject anti-detection script:', error.message);
           // console.log('⚠️  Continuing without document-level script injection...');
        }
        
        // 🆕 IMPROVED: Set longer timeouts
        this.page.setDefaultTimeout(60000); // 60 seconds
        this.page.setDefaultNavigationTimeout(60000); // 60 seconds
       // console.log('✅ Timeouts configured');
        
        // Test navigation to ensure browser is working
        //console.log('🧪 Testing basic navigation...');
        try {
            await this.page.goto('https://www.google.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            // 🆕 INJECT: Anti-detection script after navigation (for CDP connections)
            await this.injectAntiDetectionScript();
            
            const testUrl = this.page.url();
           // console.log(`✅ Test navigation successful: ${testUrl}`);
        } catch (navigationError) {
            //console.log(`⚠️ Test navigation failed: ${navigationError.message}`);
            //console.log('⚠️ This might be a network issue, but continuing with initialization...');
            
            // Try to inject anti-detection script anyway
            try {
                await this.injectAntiDetectionScript();
             //   console.log('✅ Anti-detection script injected despite navigation error');
            } catch (injectionError) {
              //  console.log(`⚠️ Could not inject anti-detection script: ${injectionError.message}`);
            }
        }
        
        console.log('✅ Medicare Automation (Part B) initialized successfully with improved anti-detection');
    }

    async detectErrorMessages() {
        try {
            // Wait a moment for any error messages to appear (same as doctor fetching)
            await this.page.waitForTimeout(2000);
            
            // 🆕 IMPROVED: Check for Medicare system error first (highest priority)
            const systemErrorMessages = [
                "We can't process your request at this time",
                "Try logging into your account later",
                "Medicare.gov is currently unavailable",
                "System temporarily unavailable",
                "Service temporarily unavailable"
            ];
            
            for (const errorMessage of systemErrorMessages) {
                const systemError = await this.page.locator(`text=${errorMessage}`).first();
                if (await systemError.isVisible().catch(() => false)) {
                   // console.log(`🚨 MEDICARE SYSTEM ERROR detected: ${errorMessage}`);
                    return {
                        hasError: true,
                        errorType: 'MEDICARE_SYSTEM_ERROR',
                        message: errorMessage,
                        isMedicareSystemError: true
                    };
                }
            }
            
            // Look for error alert div
            const errorAlert = await this.page.$('div.ds-c-alert.ds-c-alert--error');
            
            if (errorAlert) {
                // Extract the error message text
                const errorHeading = await errorAlert.$('h2.ds-c-alert__heading');
                const errorBody = await errorAlert.$('div.ds-c-alert__body');
                
                let errorMessage = '';
                
                if (errorHeading) {
                    errorMessage = await errorHeading.textContent();
                }
                
                // Get full alert text if heading not found
                if (!errorMessage && errorBody) {
                    errorMessage = await errorBody.textContent();
                }
                
               // console.log(`🚨 Error detected: ${errorMessage}`);
                return {
                    hasError: true,
                    errorType: 'GENERAL_ERROR',
                    message: errorMessage.trim()
                };
            }
            
            // 🆕 IMPROVED: Check for account disabled/locked errors
            const accountDisabledTexts = [
                'Your account has been disabled',
                'Account has been disabled',
                'Your account is disabled',
                'disabled due to',
                'account has been locked'
            ];
            
            for (const disabledText of accountDisabledTexts) {
                const disabledError = await this.page.locator(`text=${disabledText}`).first();
                if (await disabledError.isVisible().catch(() => false)) {
                  //  console.log(`🚨 ACCOUNT DISABLED ERROR detected: ${disabledText}`);
                    return {
                        hasError: true,
                        errorType: 'ACCOUNT_DISABLED',
                        message: disabledText
                    };
                }
            }
            
            // Check for Medicare temporary password restriction message
            const tempPasswordMessage = await this.page.$('div.ds-u-padding-top--2:has-text("You can call 1-800-MEDICARE")');
            
            if (tempPasswordMessage) {
                const messageText = await tempPasswordMessage.textContent();
                //console.log(`🚨 Medicare restriction detected: Cannot reset password due to Medicare restriction`);
                return {
                    hasError: true,
                    errorType: 'MEDICARE_RESTRICTION',
                    message: 'Cannot reset password due to Medicare restriction - Must call 1-800-MEDICARE for temporary password'
                };
            }
            
            // 🆕 IMPROVED: Check for invalid credentials specifically
            const invalidCredentialTexts = [
                'The username and/or password you entered is incorrect',
                'Invalid username or password',
                'incorrect username or password',
                'Login failed'
            ];
            
            for (const invalidText of invalidCredentialTexts) {
                const invalidError = await this.page.locator(`text=${invalidText}`).first();
                if (await invalidError.isVisible().catch(() => false)) {
                    //log(`🚨 INVALID CREDENTIALS detected: ${invalidText}`);
                    return {
                        hasError: true,
                        errorType: 'INVALID_CREDENTIALS',
                        message: invalidText
                    };
                }
            }
            
            // Look for success indicators or other feedback
            const successIndicators = await this.page.$$('div.ds-c-alert--success, div.ds-c-alert--warn');
            if (successIndicators.length > 0) {
                const successMessage = await successIndicators[0].textContent();
               // console.log(`✅ Success/Info message: ${successMessage}`);
                return {
                    hasError: false,
                    message: successMessage.trim()
                };
            }
            
            //console.log('✅ No error messages detected');
            return { hasError: false, message: '' };
            
        } catch (error) {
            //console.log('⚠️  Could not detect error messages:', error.message);
            return { hasError: false, message: 'Could not detect messages' };
        }
    }

    async humanTypeText(selector, text) {
        //console.log(`🔤 Human typing: "${text}"`);
     
        // Clear the field first
        await this.page.fill(selector, '');
        await this.page.waitForTimeout(0);
        
        // Type each character with no delay for instant typing
        for (let i = 0; i < text.length; i++) {
            await this.page.type(selector, text[i]);
            const delay = 0; // Set to 0ms for instant typing
            await this.page.waitForTimeout(delay);
        }
        
        await this.page.waitForTimeout(0);
    }

    async navigateToMedicareCreateAccount() {
        //console.log('🌐 Navigating to Medicare account creation page...');
        
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
               // console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
                
                // Navigate to the Medicare account creation page and refresh to avoid overwriting/errors
                await this.page.goto('https://www.medicare.gov/account/create-account', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                
                // 🆕 ENHANCED: Wait for page to fully load
                await this.waitForMedicarePageLoad();
                
                // Refresh the page as specified
                await this.page.reload({ 
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                
                // 🆕 ENHANCED: Wait for page to fully load after refresh
                await this.waitForMedicarePageLoad();
                
               // console.log('Successfully navigated to Medicare account creation page');
                return; // Success, exit retry loop
                
            } catch (error) {
               // console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt === maxRetries) {
                    throw error; // Re-throw on final attempt
                }
                
                //console.log('⏳ Waiting 5 seconds before retry...');
                await this.page.waitForTimeout(5000);
            }
        }
    }

    async fillInitialAccountInfo(patient) {
       // console.log(`Processing patient: ${patient.lastName} (Medicare ID: ${patient.medId})`);
       // console.log(`🎯 Using eligibility path: ${this.eligibilityType}`);
    
        try {
            let eligibilityDate;
            let isPartB = this.eligibilityType === 'PART_B';
            
            if (isPartB) {
                // 🅱️ PART B PATH: Use Part B Eligibility Start Date
                eligibilityDate = this.googleSheets.parsePartBDate(patient.partBEligibility);
               // console.log(`📅 Part B Date parsed from "${patient.partBEligibility}" - Month: "${eligibilityDate.month}", Year: "${eligibilityDate.year}"`);
                
                // Debug: Check if parsed values are valid
                if (!eligibilityDate.month || !eligibilityDate.year) {
                    //console.log(`⚠️ WARNING: Part B date parsing failed - Month: "${eligibilityDate.month}", Year: "${eligibilityDate.year}"`);
                    //console.log(`⚠️ Original Part B value: "${patient.partBEligibility}"`);
                }
                
                // 🆕 STEP 1: Click "Get other options" button
                //console.log('🔘 [PART B] Clicking "Get other options" button...');
                await this.page.click('button[type="button"].ds-c-button.ds-c-button--ghost:has-text("Get other options")');
                await this.page.waitForTimeout(1000);
        
                // 🆕 STEP 2: Select "Part B (Medical Insurance)" radio button
                //console.log('🔘 [PART B] Selecting "Part B (Medical Insurance)" radio button...');
                await this.page.click('input[type="radio"][value="partb"]');
                await this.page.waitForTimeout(500);
            } else {
                // 🅰️ PART A PATH: Use Part A Eligibility Date (original method)
                eligibilityDate = this.googleSheets.parsePartADate(patient.partAEligibility);
                //console.log(`📅 Part A Date parsed from "${patient.partAEligibility}" - Month: "${eligibilityDate.month}", Year: "${eligibilityDate.year}"`);
                
                // Debug: Check if parsed values are valid
                if (!eligibilityDate.month || !eligibilityDate.year) {
                   // console.log(`⚠️ WARNING: Part A date parsing failed - Month: "${eligibilityDate.month}", Year: "${eligibilityDate.year}"`);
                    //console.log(`⚠️ Original Part A value: "${patient.partAEligibility}"`);
                }
                
               // console.log('📋 [PART A] Using default Part A eligibility path (no additional clicks needed)');
            }
    
            // 🆕 ENHANCED: Debug page structure to find correct selectors
           // console.log('🔍 Debugging page structure to find correct selectors...');
            
            // Get all input elements on the page
            const inputElements = await this.page.$$eval('input', inputs => 
                inputs.map(input => ({
                    name: input.name,
                    id: input.id,
                    type: input.type,
                    placeholder: input.placeholder,
                    class: input.className
                }))
            );
            
            //console.log('📋 Available input elements on page:');
            inputElements.forEach((input, index) => {
               // console.log(`  ${index + 1}. name="${input.name}" id="${input.id}" type="${input.type}" placeholder="${input.placeholder}" class="${input.class}"`);
            });
            
            // Find Medicare ID field with flexible selector
            let medicareIdSelector = null;
            const medicareIdCandidates = [
                'input[name="medicareNumber"]#medicare-number',
                'input[name="medicareNumber"]',
                'input#medicare-number',
                'input[placeholder*="Medicare"]',
                'input[placeholder*="medicare"]',
                'input[name*="medicare"]',
                'input[id*="medicare"]'
            ];
            
            for (const selector of medicareIdCandidates) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        medicareIdSelector = selector;
                        //console.log(`✅ Found Medicare ID field with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                   // console.log(`❌ Selector failed: ${selector}`);
                }
            }
            
            if (!medicareIdSelector) {
                //console.log('❌ Could not find Medicare ID field with any selector');
                throw new Error('Medicare ID field not found on page');
            }
            
            //console.log(`Filling Medicare ID...`);
            await this.humanTypeText(medicareIdSelector, patient.medId);
            await this.page.waitForTimeout(200 + Math.floor(Math.random() * 200)); // Reduced from 500+500
    
            // Find month field with flexible selector
            let monthSelector = null;
            const monthCandidates = [
                'input[name="month"]#coverage-start-date',
                'input[name="month"]',
                'input#coverage-start-date',
                'input[placeholder*="Month"]',
                'input[placeholder*="month"]',
                'input[name*="month"]',
                'input[id*="month"]',
                'input[type="number"]'
            ];
            
            for (const selector of monthCandidates) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        monthSelector = selector;
                       // console.log(`✅ Found month field with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    //console.log(`❌ Selector failed: ${selector}`);
                }
            }
            
            if (!monthSelector) {
               // console.log('❌ Could not find month field with any selector');
                throw new Error('Month field not found on page');
            }
            
            //console.log(`Filling ${isPartB ? 'Part B' : 'Part A'} eligibility month...`);
            await this.humanTypeText(monthSelector, eligibilityDate.month);
            await this.page.waitForTimeout(200 + Math.floor(Math.random() * 200)); // Reduced from 500+500
    
            // Find year field with flexible selector
            let yearSelector = null;
            const yearCandidates = [
                'input[name="year"]#date-field--2__year',
                'input[name="year"].ds-c-field.ds-c-field--year',
                'input[name="year"]',
                'input#date-field--2__year',
                'input[placeholder*="Year"]',
                'input[placeholder*="year"]',
                'input[name*="year"]',
                'input[id*="year"]',
                'input[type="number"]'
            ];
            
            for (const selector of yearCandidates) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        yearSelector = selector;
                       // console.log(`✅ Found year field with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    //console.log(`❌ Selector failed: ${selector}`);
                }
            }
            
            if (!yearSelector) {
                //console.log('❌ Could not find year field with any selector');
                throw new Error('Year field not found on page');
            }
            
            //console.log(`Filling ${isPartB ? 'Part B' : 'Part A'} eligibility year...`);
            if (isPartB) {
                // Part B year field handling
                await this.page.waitForTimeout(500); // Reduced from 1000
                await this.page.waitForSelector(yearSelector, { timeout: 10000 });
                await this.humanTypeText(yearSelector, eligibilityDate.year);
               // console.log('✅ Part B year field filled successfully');
            } else {
                // Part A year field handling
                await this.humanTypeText(yearSelector, eligibilityDate.year);
               // console.log('✅ Part A year field filled successfully');
            }
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 200)); // Reduced from 1000+500
    
            // Find submit button with flexible selector
            let submitButtonSelector = null;
            const submitButtonCandidates = [
                'button[type="submit"].ds-c-button.ds-c-button--solid',
                'button[type="submit"]',
                'button.ds-c-button.ds-c-button--solid',
                'button:has-text("Next")',
                'button:has-text("Continue")',
                'button:has-text("Submit")',
                'input[type="submit"]',
                'button.ds-c-button'
            ];
            
            for (const selector of submitButtonCandidates) {
                try {
                    const element = await this.page.$(selector);
                    if (element) {
                        submitButtonSelector = selector;
                       // console.log(`✅ Found submit button with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                   // console.log(`❌ Selector failed: ${selector}`);
                }
            }
            
            if (!submitButtonSelector) {
               // console.log('❌ Could not find submit button with any selector');
                throw new Error('Submit button not found on page');
            }
            
           // console.log('Clicking Next button...');
            await this.page.click(submitButtonSelector);
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
    
                        const feedback = await this.detectErrorMessages();

            // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
            if (feedback.hasError && feedback.isMedicareSystemError) {
                //console.log(`🚨 MEDICARE SYSTEM ERROR detected in fillInitialAccountInfo for ${patient.lastName}: ${feedback.message}`);
                
                // Log error to Submission Date column and stop processing
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${feedback.message}`);
                
                return {
                    success: false,
                    stopProcessing: true,
                    message: `Medicare system error: ${feedback.message}`,
                    isMedicareSystemError: true
                };
            }

            if (feedback.hasError) {
               // console.log(`❌ Error for patient ${patient.lastName}: ${feedback.message}`);
    
                if (feedback.message.toLowerCase().includes('already have an account')) {
                   // console.log(`🔄 Patient ${patient.lastName} already has an account - attempting password reset...`);
    
                    const resetResult = await this.handleForgotPassword(patient);
    
                    // 🔑 EXTRACT USERNAME FROM CREDENTIALS for proper return structure
                    let extractedUsername = null;
                    if (resetResult.credentials && resetResult.credentials.includes('//')) {
                        extractedUsername = resetResult.credentials.split('//')[0];
                       // console.log(`🔍 Extracted username from reset result: ${extractedUsername}`);
                    }
    
                    return {
                        success: resetResult.success,
                        type: 'reset',
                        username: extractedUsername, // 🆕 ADD: Include extracted username
                        stopWorkflow: resetResult.stopWorkflow,
                        feedbackType: resetResult.feedbackType,
                        credentials: resetResult.credentials || '',
                        message: resetResult.message,
                        specialFeedback: resetResult.specialFeedback // 🆕 FIX: Pass up specialFeedback field
                    };
                } else {
                    const feedbackOption = this.googleSheets.getFeedbackOption(feedback.message);
                    
                    // 🆕 HANDLE SPECIAL FEEDBACK CASES: Put in DR2 Info and continue with new account creation
                    if (feedbackOption === 'Cannot reset password' || feedbackOption === 'No longer active') {
                        //console.log(`📋 Special feedback detected for ${patient.lastName}: ${feedbackOption}`);
                       // console.log(`📄 Message: ${feedback.message}`);
                       // console.log(`📝 Putting feedback in DR2 Info and proceeding with new account creation...`);
                        
                        // Update DR2 Info column with the feedback message
                        await this.googleSheets.updateDR2Info(patient.rowIndex, `${feedbackOption}: ${feedback.message}`);
                        
                        // Proceed with new account creation
                        const accountCreationResult = await this.handleNewAccountCreation(patient);
                        
                        return {
                            success: accountCreationResult.success,
                            type: 'new',
                            stopWorkflow: accountCreationResult.stopWorkflow,
                            feedbackType: accountCreationResult.feedbackType,
                            username: accountCreationResult.username,
                            password: accountCreationResult.password,
                            credentials: accountCreationResult.credentials || '',
                            message: accountCreationResult.message,
                            specialFeedback: accountCreationResult.specialFeedback
                        };
                    }
                    
                    // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
                    if (feedbackOption === 'Wrong Info') {
                       // console.log(`🛑 WRONG INFO detected for ${patient.lastName} - stopping workflow`);
                       // console.log(`📋 Error message: ${feedback.message}`);
                        
                        // Update feedback in Google Sheets
                        await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);
                        
                        return { 
                            success: false, 
                            stopWorkflow: true, // Flag to indicate workflow should stop
                            feedbackType: 'Wrong Info',
                            message: `Wrong Info: ${feedback.message}` 
                        };
                    }
                    
                    await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);

                    return { success: false, message: feedback.message };
                }
            } else {
                // 🆕 CHECK IF ACCOUNT CREATION IS ALREADY COMPLETE
                if (feedback.message && (
                    feedback.message.toLowerCase().includes('you\'re all set') ||
                    feedback.message.toLowerCase().includes('success') ||
                    feedback.message.toLowerCase().includes('account created') ||
                    this.page.url().includes('/account/login')
                )) {
                    //console.log(`✅ Account creation already completed for ${patient.lastName}!`);
                    //console.log(`🌐 DEBUG: Current URL after fillInitialAccountInfo: ${this.page.url()}`);
                    
                    // Extract credentials from patient data since account is complete
                    const credentialsString = `${patient.username}//${patient.password}`;
                    
                    // Update Google Sheet with successful account creation
                    await this.googleSheets.updateSuccessfulAccountCreation(patient.rowIndex, credentialsString);
                    
                    return {
                        success: true,
                        type: 'new',
                        username: patient.username,
                        password: patient.password,
                        credentials: credentialsString,
                        message: `Account creation completed successfully: ${feedback.message}`,
                        specialFeedback: false
                    };
                } else {
                    //console.log('✅ Successfully completed initial form submission - proceeding to create new account...');
    
                    const accountCreationResult = await this.handleNewAccountCreation(patient);
    
                    return {
                        success: accountCreationResult.success,
                        type: 'new',
                        stopWorkflow: accountCreationResult.stopWorkflow,
                        feedbackType: accountCreationResult.feedbackType,
                        username: accountCreationResult.username,
                        password: accountCreationResult.password,
                        credentials: accountCreationResult.credentials || '',
                        message: accountCreationResult.message,
                        specialFeedback: accountCreationResult.specialFeedback
                    };
                }
            }
    
        } catch (error) {
           // console.error(`Error processing patient ${patient.lastName}:`, error);
    
            const feedbackOption = this.googleSheets.getFeedbackOption(error.message);
            await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);
    
            return { success: false, message: error.message, specialFeedback: false };
        }
    }
    

    async handleForgotPassword(patient) {
        // 🔑 USE THE PASSWORD THAT WAS PASSED FROM THE SERVER - DON'T GENERATE A NEW ONE
        const newPassword = patient.password; // Use the password from the server
        //console.log(`🔑 Using password from server for ${patient.lastName}: ${newPassword} (consistently throughout flow)`);
        
        try {
           // console.log(`🔐 Initiating password reset for ${patient.lastName}...`);
            
            // Navigate to forgot password page
            await this.page.goto('https://www.medicare.gov/account/forgot-username-password', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            // Wait for page to load
            await this.page.waitForTimeout(2000);
            
           // console.log('Filling Medicare ID for password reset...');
            // Fill Medicare ID
            await this.humanTypeText('input[name="medicareNumber"]#medicare-number', patient.medId);
            
            // Short delay between fields
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Last Name for password reset...');
            // Fill Last Name
            await this.humanTypeText('input[name="lastName"]#last-name', patient.lastName);
            
            // Short delay between fields
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Date of Birth for password reset...');
            // Fill Date of Birth (format: MM/DD/YYYY)
            await this.humanTypeText('input[name="DateOfBirth"]#date-of-birth', patient.dob);
            
            // Short delay before clicking Next
            await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
            
           // console.log('Clicking Next button for password reset...');
            // Click Next button
            await this.page.click('button[type="button"].ds-c-button.ds-c-button--solid');
            
            // Wait for page to load
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
            
            // Check if we reached the identity-confirmed page
            if (this.page.url().includes('/account/identity-confirmed')) {
                //console.log('✅ Reached identity-confirmed page - extracting username...');
                
                // Extract username from the page
                let extractedUsername = null;
                try {
                    const usernameElement = await this.page.$('div.ds-u-font-size--lg span.ds-u-font-weight--semibold');
                    if (usernameElement) {
                        extractedUsername = await usernameElement.textContent();
                       // console.log(`🔍 Found username: ${extractedUsername}`);
                    }
                } catch (error) {
                   // console.log('⚠️  Could not extract username from identity-confirmed page');
                }
                
                // Continue with the flow to lock the account
               // console.log('🔒 Intentionally entering wrong secret answers to lock account...');
                
                // Look for secret answer field and enter wrong answers multiple times
                const secretAnswerField = await this.page.$('input[name="secretAnswer"]#secret-answer');
                if (secretAnswerField) {
                    // Enter wrong answers multiple times to trigger account lock
                    for (let attempt = 1; attempt <= 5; attempt++) {
                        //console.log(`Entering wrong secret answer - attempt ${attempt}/5...`);
                        await this.humanTypeText('input[name="secretAnswer"]#secret-answer', `wronganswer${attempt}`);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                        
                        // Click submit or next button
                        try {
                            await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid, button[type="button"].ds-c-button.ds-c-button--solid');
                            await this.page.waitForLoadState('domcontentloaded');
                            await this.page.waitForTimeout(2000);
                            
                            // Check if we're transferred to account-recovery page
                            if (this.page.url().includes('/account/account-recovery')) {
                               // console.log('🔒 Account successfully locked - transferred to account-recovery page');
                                break;
                            }
                        } catch (error) {
                           // console.log(`⚠️  Attempt ${attempt} submission error: ${error.message}`);
                        }
                    }
                }
                
                // Check if we reached the account-recovery page
                if (this.page.url().includes('/account/account-recovery')) {
                   // console.log('🔄 Account is now locked - proceeding to unlock account flow...');
                    
                    // Try to unlock account with the extracted username - PASS THE SAME PASSWORD
                    const unlockResult = await this.handleUnlockAccount(patient, newPassword);
                    
                    // If we extracted a username, use it in the credentials
                    if (unlockResult.success && extractedUsername) {
                        //console.log(`🔑 Using SAME password from start: ${newPassword}`);
                        
                        // Update the result message to include the extracted username and SAME password
                        const credentialsString = `${extractedUsername}//${newPassword}`;
                        await this.googleSheets.updateSuccessfulPasswordReset(patient.rowIndex, credentialsString);
                        //console.log(`✅ Updated credentials for ${patient.lastName}: ${credentialsString}`);
                        
                        return {
                            success: true,
                            credentials: credentialsString,
                            message: `Account unlock completed with extracted username and CONSISTENT password: ${credentialsString}`,
                            unlockAttempted: true,
                            specialFeedback: false
                        };
                    } else {
                        // 🆕 PROPERLY PASS UP "WRONG INFO" PARAMETERS FROM UNLOCK RESULT
                        // Return with unlock attempt indication and preserve Wrong Info parameters
                       // console.log(`🔍 DEBUG handleForgotPassword: unlockResult.specialFeedback = "${unlockResult.specialFeedback}"`);
                        return {
                            success: unlockResult.success,
                            stopWorkflow: unlockResult.stopWorkflow, // Pass up stopWorkflow flag
                            feedbackType: unlockResult.feedbackType, // Pass up feedbackType
                            credentials: unlockResult.credentials, // 🔧 FIX: Pass up credentials field
                            message: unlockResult.message,
                            unlockAttempted: true,
                            specialFeedback: unlockResult.specialFeedback // 🆕 FIX: Pass up specialFeedback field
                        };
                    }
                } else {
                   // console.log('⚠️  Could not trigger account lock - checking for other feedback...');
                }
            }
            
            // Check for any other feedback messages (original logic)
            const resetFeedback = await this.detectErrorMessages();
            
            // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
            if (resetFeedback.hasError && resetFeedback.isMedicareSystemError) {
               // console.log(`🚨 MEDICARE SYSTEM ERROR detected in handleForgotPassword for ${patient.lastName}: ${resetFeedback.message}`);
                
                // Log error to Submission Date column and stop processing
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${resetFeedback.message}`);
                
                return {
                    success: false,
                    stopProcessing: true,
                    message: `Medicare system error: ${resetFeedback.message}`,
                    isMedicareSystemError: true
                };
            }
            
            if (resetFeedback.hasError) {
                // 🆕 FIXED: Check for various account lock message patterns
                if (resetFeedback.message.toLowerCase().includes('account is now locked') ||
                    resetFeedback.message.toLowerCase().includes('account is locked') ||
                    resetFeedback.message.toLowerCase().includes('locked to protect')) {
                    console.log(`🔐 Account is locked for ${patient.lastName} - redirecting to unlock account...`);
                    console.log(`🔍 Lock message detected: "${resetFeedback.message}"`);
                    
                    // Try to unlock account - PASS THE SAME PASSWORD
                    const unlockResult = await this.handleUnlockAccount(patient, newPassword);
                    
                    // 🆕 PROPERLY PASS UP "WRONG INFO" PARAMETERS FROM UNLOCK RESULT
                    // Return with unlock attempt indication and preserve Wrong Info parameters
                    return {
                        success: unlockResult.success,
                        stopWorkflow: unlockResult.stopWorkflow, // Pass up stopWorkflow flag
                        feedbackType: unlockResult.feedbackType, // Pass up feedbackType
                        credentials: unlockResult.credentials, // 🔧 FIX: Pass up credentials field
                        message: unlockResult.message,
                        unlockAttempted: true,
                        specialFeedback: unlockResult.specialFeedback // 🆕 FIX: Pass up specialFeedback field
                    };
                } else {
                   // console.log(`❌ Password reset failed for ${patient.lastName}: ${resetFeedback.message}`);
                    
                    // Get feedback option to determine if this is "Wrong Info"
                    const feedbackOption = this.googleSheets.getFeedbackOption(resetFeedback.message);
                    
                    // 🆕 HANDLE SPECIAL FEEDBACK CASES: Put in DR2 Info and continue workflow
                    if (feedbackOption === 'Cannot reset password' || feedbackOption === 'No longer active') {
                        console.log(`📋 Special feedback detected for ${patient.lastName}: ${feedbackOption}`);
                        console.log(`📄 Message: ${resetFeedback.message}`);
                        console.log(`📝 Putting feedback in DR2 Info and continuing with normal workflow...`);
                        console.log(`🚫 NOT generating or saving credentials for special feedback case`);
                        
                        // Update DR2 Info column with the feedback message
                        await this.googleSheets.updateDR2Info(patient.rowIndex, `${feedbackOption}: ${resetFeedback.message}`);
                        
                        // 🆕 RETURN SUCCESS BUT NO CREDENTIALS - this prevents credentials from being saved
                       // console.log(`🔍 DEBUG RETURN in password reset: feedbackOption = "${feedbackOption}", specialFeedback will be = "${feedbackOption}"`);
                        return { 
                            success: true, 
                            credentials: '', // Empty credentials so nothing gets saved
                            message: `Special feedback handled in unlock step 2: ${feedbackOption}`,
                            specialFeedback: feedbackOption
                        };
                    }
                    
                    // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
                    if (feedbackOption === 'Wrong Info') {
                        //console.log(`🛑 WRONG INFO detected in password reset for ${patient.lastName} - stopping workflow`);
                        //console.log(`📋 Error message: ${resetFeedback.message}`);
                        
                        return { 
                            success: false, 
                            stopWorkflow: true, // Flag to indicate workflow should stop
                            feedbackType: 'Wrong Info',
                            message: `Wrong Info: ${resetFeedback.message}`,
                            unlockAttempted: false
                        };
                    }
                    
                    // For other errors, return failure without stopping workflow
                    return { success: false, message: resetFeedback.message, unlockAttempted: false, specialFeedback: false };
                }
            } else {
               //console.log(`✅ Password reset initiated for ${patient.lastName}`);
               // console.log(`🔑 Using SAME password from start: ${newPassword}`);
                
                // For password reset, we can create credentials from the patient data
                const credentialsString = `${patient.username || patient.medId}//${newPassword}`;
                return { 
                    success: true, 
                    credentials: credentialsString,
                    message: resetFeedback.message || 'Password reset form submitted successfully with CONSISTENT password',
                    unlockAttempted: false,
                    specialFeedback: false
                };
            }
            
        } catch (error) {
            //console.error(`Error during password reset for ${patient.lastName}:`, error);
            return { success: false, message: error.message, unlockAttempted: false, specialFeedback: false };
        }
    }

    async handleUnlockAccount(patient, password = null) {
        try {
            //console.log(`🔐 Initiating account unlock for ${patient.lastName}...`);
            
            // Use the password passed from the forgot password flow, or generate a new one
            if (!password) {
                password = `larry@${Math.floor(Math.random() * 100000000)}!@`;
            }
            //console.log(`🔑 Using password passed from forgot password flow: ${password}`);
            
            // Navigate to the unlock account page
            await this.page.goto('https://www.medicare.gov/account/unlock-account', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            // Wait for page to load
            await this.page.waitForTimeout(3000);
            
            // Check if we're already on the unlock account page or if we need to navigate
            const currentUrl = this.page.url();
            if (!currentUrl.includes('/account/unlock-account')) {
                //console.log('🔄 Redirecting to unlock account page...');
                await this.page.goto('https://www.medicare.gov/account/unlock-account', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await this.page.waitForTimeout(2000);
            }
            
            //console.log(`🔐 Initiating account unlock for ${patient.lastName}...`);
            
            // Parse the eligibility date based on eligibility type
            let eligibilityMonth, eligibilityYear;
            
            if (this.eligibilityType === 'PART_A') {
                //console.log(`📅 Using Part A Date for unlock from "${patient.partAEligibility}"`);
                const partAMatch = patient.partAEligibility.match(/(\d{1,2})\/(\d{4})/);
                if (partAMatch) {
                    eligibilityMonth = partAMatch[1].padStart(2, '0');
                    eligibilityYear = partAMatch[2];
                    //console.log(`📅 Part A Date parsed from "${patient.partAEligibility}" - Month: "${eligibilityMonth}", Year: "${eligibilityYear}"`);
                } else {
                    throw new Error(`Invalid Part A date format: ${patient.partAEligibility}`);
                }
               // console.log(`📋 [PART A] Using default Part A eligibility path for unlock (no additional clicks needed)`);
            } else {
                //console.log(`📅 Using Part B Date for unlock from "${patient.partBEligibility}"`);
                const partBMatch = patient.partBEligibility.match(/(\d{1,2})\/(\d{4})/);
                if (partBMatch) {
                    eligibilityMonth = partBMatch[1].padStart(2, '0');
                    eligibilityYear = partBMatch[2];
                    //console.log(`📅 Part B Date parsed from "${patient.partBEligibility}" - Month: "${eligibilityMonth}", Year: "${eligibilityYear}"`);
                } else {
                    throw new Error(`Invalid Part B date format: ${patient.partBEligibility}`);
                }
               // console.log(`📋 [PART B] Using Part B eligibility path for unlock - clicking "Get other options" first`);
                
                // 🆕 IMPROVED PART B SELECTORS: Use same logic as fillInitialAccountInfo
                //console.log('🔘 [PART B] Clicking "Get other options" button...');
                await this.page.click('button[type="button"].ds-c-button.ds-c-button--ghost:has-text("Get other options")');
                await this.page.waitForTimeout(1000);
        
                // 🆕 IMPROVED: Select "Part B (Medical Insurance)" radio button with correct selector
                //console.log('🔘 [PART B] Selecting "Part B (Medical Insurance)" radio button...');
                await this.page.click('input[type="radio"][value="partb"]');
                await this.page.waitForTimeout(1000);
            }
            
            //console.log('Filling Medicare ID for account unlock...');
            await this.humanTypeText('input[name="medicareNumber"]#medicare-number', patient.medId);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log(`Filling ${this.eligibilityType} eligibility month for account unlock...`);
            // 🆕 IMPROVED: Use consistent selectors with fillInitialAccountInfo
            await this.humanTypeText('input[name="month"]#coverage-start-date', eligibilityMonth);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
            //console.log(`Filling ${this.eligibilityType} eligibility year for account unlock...`);
            // 🆕 IMPROVED: Use consistent Part B logic with fillInitialAccountInfo
            if (this.eligibilityType === 'PART_B') {
                // Part B year field handling - same as in fillInitialAccountInfo
                await this.page.waitForTimeout(1000);
                await this.page.waitForSelector('input[name="year"]', { timeout: 10000 });
                await this.humanTypeText('input[name="year"].ds-c-field.ds-c-field--year', eligibilityYear);
                //console.log('✅ Part B unlock year field filled successfully');
            } else {
                // Part A year field handling (original selector)
                await this.humanTypeText('input[name="year"]#date-field--2__year', eligibilityYear);
                //console.log('✅ Part A unlock year field filled successfully');
            }
            
            await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
            
            //console.log('Clicking Next button for account unlock...');
            await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid');
            
            // Wait for the next page to load
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
            
            // Check for error messages after step 1
            const step1Feedback = await this.detectErrorMessages();
            
            // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
            if (step1Feedback.hasError && step1Feedback.isMedicareSystemError) {
                //console.log(`🚨 MEDICARE SYSTEM ERROR detected in handleUnlockAccount for ${patient.lastName}: ${step1Feedback.message}`);
                
                // Log error to Submission Date column and stop processing
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${step1Feedback.message}`);
                
                return {
                    success: false,
                    stopProcessing: true,
                    message: `Medicare system error: ${step1Feedback.message}`,
                    isMedicareSystemError: true
                };
            }
            
            if (step1Feedback.hasError) {
               // console.log(`❌ Account unlock step 1 failed for ${patient.lastName}: ${step1Feedback.message}`);
                
                // Get feedback option to determine if this is "Wrong Info"
                const feedbackOption = this.googleSheets.getFeedbackOption(step1Feedback.message);
                
                // Update feedback in Google Sheets
                await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);
                return { success: false, message: `Step 1 failed: ${step1Feedback.message}`, specialFeedback: false };
            }
            
            //console.log(`✅ Account unlock step 1 completed for ${patient.lastName}`);
            
            // Check if there's a step 2 form (SSN or other verification)
            await this.page.waitForTimeout(2000);
            
            // 🔍 DEBUG: Check current URL and page content to understand what's happening
            const currentUrl2 = this.page.url();
            const pageTitle = await this.page.title();
            //console.log(`🌐 DEBUG: After unlock step 1:`);
            //console.log(`   URL: ${currentUrl2}`);
            //console.log(`   Page Title: ${pageTitle}`);
            
            // Check if we proceeded to step 3 by looking for the correct headings
            await this.page.waitForTimeout(2000);
            
            // Look for the actual step 3 indicators
            const enterInfoHeading = await this.page.$('h2:has-text("Enter your information"), h3:has-text("Enter your information")');
            const agreeStatementHeading = await this.page.$('h2:has-text("Agree to the statement below"), h3:has-text("Agree to the statement below")');
            const passwordUpdateHeading = await this.page.$('h2:has-text("Update password & secret question")');
            
           // console.log(`🔍 DEBUG: Step 3 detection:`);
            //console.log(`   Enter your information: ${enterInfoHeading ? 'YES' : 'NO'}`);
            //console.log(`   Agree to statement: ${agreeStatementHeading ? 'YES' : 'NO'}`);
            //console.log(`   Password update: ${passwordUpdateHeading ? 'YES' : 'NO'}`);
            
            // Step 3 exists if we have either the info form or password update form
            const hasStep3 = enterInfoHeading || agreeStatementHeading || passwordUpdateHeading;
            
            if (hasStep3) {
                //console.log('✅ Unlock account form proceeded to step 3...');
                
                if (passwordUpdateHeading) {
                    //console.log('🔑 Step 3: Password update form detected');
                    //console.log(`🔑 Using CONSISTENT password: ${password}`);
                    
                   // console.log('Filling new password...');
                    await this.humanTypeText('input[name="password"]#new-password', password);
                    await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    
                   // console.log('Confirming new password...');
                    await this.humanTypeText('input[name="confirm password"]#confirm-new-password', password);
                    await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    
                   // console.log('Selecting secret question dropdown...');
                    await this.page.click('button[id="secret-question"]');
                    
                    // Wait for the dropdown menu to appear and be stable
                    await this.page.waitForTimeout(2000);
                    
                   // console.log('Attempting to select "What is your favorite vacation spot?" option...');
                    
                    try {
                        // Wait for the specific dropdown option to be visible
                        await this.page.waitForSelector('#secret-question__item--1', { timeout: 5000 });
                        
                        // Click the specific option by ID
                        await this.page.click('#secret-question__item--1');
                       //console.log('✅ Successfully selected "What is your favorite vacation spot?" option');
                        
                    } catch (error) {
                       // console.log('⚠️  Specific option not found, trying alternative selectors...');
                        
                        // Try alternative selectors for the vacation spot option
                        const alternativeSelectors = [
                            'li[data-key="What is your favorite vacation spot?"]',
                            'li[role="option"]:has-text("What is your favorite vacation spot?")',
                            '[id^="secret-question__item--"]:has-text("vacation")',
                            'li.ds-c-dropdown__menu-item:first-child'
                        ];
                        
                        let optionSelected = false;
                        for (const selector of alternativeSelectors) {
                            try {
                                const option = await this.page.$(selector);
                                if (option) {
                                    await option.click();
                                    console.log(`✅ Selected option using selector: ${selector}`);
                                    optionSelected = true;
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        if (!optionSelected) {
                            // Final fallback: just press Enter
                            await this.page.keyboard.press('Enter');
                           // console.log('✅ Used Enter key as final fallback');
                        }
                    }
                    
                   // console.log('Filling secret answer...');
                    await this.humanTypeText('input[name="secretAnswer"]#secret-answer', 'CA');
                    await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
                } else {
                   // console.log('📝 Step 3: Information form detected - filling personal details');
                    
                    // Parse date of birth for separate fields
                    const dobParts = patient.dob.split('/'); // MM/DD/YYYY format
                    const dobMonth = dobParts[0];
                    const dobDay = dobParts[1];
                    const dobYear = dobParts[2];
                    
                    // Fill personal information form
                    try {
                       // console.log('Filling Last Name...');
                        await this.humanTypeText('input[name="lastName"]#last-name', patient.lastName);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    } catch (e) {
                       // console.log('⚠️ Last name field not found or already filled');
                    }
                    
                    try {
                       // console.log('Filling Date of Birth Month...');
                        await this.humanTypeText('input[name="month"].ds-c-field--month', dobMonth);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                        
                      //  console.log('Filling Date of Birth Day...');
                        await this.humanTypeText('input[name="day"].ds-c-field--day', dobDay);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                        
                       // console.log('Filling Date of Birth Year...');
                        await this.humanTypeText('input[name="year"].ds-c-field--year', dobYear);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    } catch (e) {
                       // console.log('⚠️ DOB fields not found or already filled');
                    }
                    
                    try {
                       // console.log('Filling Zip Code...');
                        // 🔧 FIX: Extract zip code from full address if needed
                        let zipCodeToUse = patient.zipCode;
                        
                        // If zipCode field contains full address, extract just the zip code
                        if (zipCodeToUse && zipCodeToUse.length > 10) {
                            //console.log(`📍 Extracting zip code from: "${zipCodeToUse}"`);
                            const zipMatch = zipCodeToUse.match(/\b\d{5}(-\d{4})?\b/);
                            zipCodeToUse = zipMatch ? zipMatch[0] : zipCodeToUse;
                           // console.log(`📍 Extracted zip code: "${zipCodeToUse}"`);
                        } else {
                           // console.log(`📍 Using zip code: "${zipCodeToUse}"`);
                        }
                        
                        await this.humanTypeText('input[name="zipCode"]#zip-code', zipCodeToUse);
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    } catch (e) {
                       // console.log('⚠️ Zip code field not found or already filled');
                    }
                    
                    // Check "I don't have an email address" checkbox
                    try {
                       // console.log('Checking "I don\'t have an email address" checkbox...');
                        await this.page.check('input[name="noEmailAddressCheckbox"]#no-email-address');
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    } catch (e) {
                       // console.log('⚠️ "I don\'t have an email" checkbox not found or already checked');
                    }
                    
                    // Check agreement checkbox
                    try {
                       // console.log('Checking agreement checkbox...');
                        
                        // 🔧 FIX: Try multiple selectors for agreement checkbox in unlock account form
                        const checkboxSelectors = [
                            'input[name="certificationCheckbox"]#certified',
                            'input[name="certificationCheckbox"]#certfied', // Common typo in forms
                            'input[name="certificationCheckbox"]',
                            'input[type="checkbox"]#certified',
                            'input[type="checkbox"][id*="certif"]',
                            'input[type="checkbox"]:last-of-type'
                        ];
                        
                        let checkboxFound = false;
                        for (const selector of checkboxSelectors) {
                            try {
                                const checkbox = await this.page.$(selector);
                                if (checkbox) {
                                    const isChecked = await checkbox.isChecked();
                                    if (!isChecked) {
                                        await this.page.check(selector);
                                        console.log(`✅ Successfully checked agreement checkbox with selector: ${selector}`);
                                        checkboxFound = true;
                                        break;
                                    } else {
                                        console.log(`✅ Agreement checkbox already checked (selector: ${selector})`);
                                        checkboxFound = true;
                                        break;
                                    }
                                }
                            } catch (selectorError) {
                                continue; // Try next selector
                            }
                        }
                        
                        if (!checkboxFound) {
                           // console.log('⚠️ Could not find agreement checkbox with any selector');
                        }
                        
                        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    } catch (e) {
                       // console.log('⚠️ Agreement checkbox handling failed:', e.message);
                    }
                }
                
                //console.log('Clicking Submit button for information form...');
                await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid');
                
                // Wait for next step to load
                await this.page.waitForLoadState('domcontentloaded');
                await this.page.waitForTimeout(3000);
                
                // 🆕 CHECK FOR PASSWORD UPDATE FORM AFTER INFORMATION FORM
                //console.log('🔍 Checking if password update form appeared after information form...');
                const passwordUpdateAfterInfo = await this.page.$('h2:has-text("Update password & secret question"), h3:has-text("Update password & secret question")');
                
                if (passwordUpdateAfterInfo) {
                    console.log('🔑 PASSWORD UPDATE FORM detected after information form - proceeding with password update...');
                    
                    //console.log('Filling new password...');
                    await this.humanTypeText('input[name="password"]#new-password', password);
                    await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    
                    //console.log('Confirming new password...');
                    await this.humanTypeText('input[name="confirm password"]#confirm-new-password', password);
                    await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
                    
                   // console.log('Selecting secret question dropdown...');
                    await this.page.click('button[id="secret-question"]');
                    await this.page.waitForTimeout(2000);
                    
                   // console.log('Attempting to select "What is your favorite vacation spot?" option...');
                    try {
                        await this.page.waitForSelector('#secret-question__item--1', { timeout: 5000 });
                        await this.page.click('#secret-question__item--1');
                       // console.log('✅ Successfully selected "What is your favorite vacation spot?" option');
                    } catch (error) {
                       // console.log('⚠️ Using alternative selector for secret question...');
                        await this.page.keyboard.press('Enter');
                    }
                    
                    //console.log('Filling secret answer...');
                    await this.humanTypeText('input[name="secretAnswer"]#secret-answer', 'CA');
                    await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
                    
                    //console.log('Clicking FINAL Submit button to complete password update...');
                    await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid');
                    
                    // Wait for final completion
                    await this.page.waitForLoadState('domcontentloaded');
                    await this.page.waitForTimeout(3000);
                } else {
                   // console.log('⚠️ No password update form found after information form - this might be incomplete!');
                }
                
                // Check for final completion messages
                const completionFeedback = await this.detectErrorMessages();
                
                // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
                if (completionFeedback.hasError && completionFeedback.isMedicareSystemError) {
                   // console.log(`🚨 MEDICARE SYSTEM ERROR detected in unlock completion for ${patient.lastName}: ${completionFeedback.message}`);
                    
                    // Log error to Submission Date column and stop processing
                    await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${completionFeedback.message}`);
                    
                    return {
                        success: false,
                        stopProcessing: true,
                        message: `Medicare system error: ${completionFeedback.message}`,
                        isMedicareSystemError: true
                    };
                }
                
                if (completionFeedback.hasError) {
                   // console.log(`❌ Account unlock step 3 failed for ${patient.lastName}: ${completionFeedback.message}`);
                    
                    // Get feedback option to determine if this is "Wrong Info"
                    const feedbackOption = this.googleSheets.getFeedbackOption(completionFeedback.message);
                    
                    // Handle special feedback cases
                    if (feedbackOption === 'Cannot reset password' || feedbackOption === 'No longer active') {
                        //console.log(`📋 Special feedback detected in unlock step 3 for ${patient.lastName}: ${feedbackOption}`);
                        await this.googleSheets.updateDR2Info(patient.rowIndex, `${feedbackOption}: ${completionFeedback.message}`);
                        
                        return { 
                            success: true, 
                            credentials: '',
                            message: `Special feedback handled in unlock step 3: ${feedbackOption}`,
                            specialFeedback: feedbackOption
                        };
                    }
                    
                    // Handle "Wrong Info" feedback
                    if (feedbackOption === 'Wrong Info') {
                        //console.log(`🛑 WRONG INFO detected in account unlock step 3 for ${patient.lastName} - stopping workflow`);
                        await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);
                        
                        return { 
                            success: false, 
                            stopWorkflow: true,
                            feedbackType: 'Wrong Info',
                            message: `Wrong Info: ${completionFeedback.message}` 
                        };
                    }
                    
                    // For other errors, just update feedback and return failure
                    await this.googleSheets.updateAccountFeedback(patient.rowIndex, feedbackOption);
                    return { success: false, message: `Step 3 failed: ${completionFeedback.message}`, specialFeedback: false };
                } else {
                   // console.log(`✅ Account unlock step 3 completed successfully for ${patient.lastName}`);
                   // console.log(`🔄 NOW extracting existing username from forgot password page...`);
                    
                    // Extract existing username after successful unlock
                    const extractedUsername = await this.extractUsernameFromForgotPasswordPage(patient);
                    
                    if (extractedUsername) {
                      //  console.log(`🔍 Successfully extracted existing username: ${extractedUsername}`);
                        const credentialsString = `${extractedUsername}//${password}`;
                        
                        await this.googleSheets.updateSuccessfulPasswordReset(patient.rowIndex, credentialsString);
                        
                        return {
                            success: true,
                            credentials: credentialsString,
                            username: extractedUsername,
                            password: password,
                            message: `Account unlock completed successfully with extracted username: ${credentialsString}`,
                            specialFeedback: false
                        };
                    } else {
                        //console.log(`⚠️ Could not extract username, using fallback`);
                        const credentialsString = `${patient.username || patient.medId}//${password}`;
                        
                        await this.googleSheets.updateSuccessfulPasswordReset(patient.rowIndex, credentialsString);
                        
                        return {
                            success: true,
                            credentials: credentialsString,
                            username: patient.username || patient.medId,
                            password: password,
                            message: `Account unlock completed with fallback credentials: ${credentialsString}`,
                            specialFeedback: false
                        };
                    }
                }
            } else {
               // console.log(`✅ Account unlock step 2 completed successfully for ${patient.lastName}`);
               // console.log(`🔄 NOW extracting existing username from forgot password page...`);
                
                // Extract existing username after successful step 2 unlock
                const extractedUsername = await this.extractUsernameFromForgotPasswordPage(patient);
                
                if (extractedUsername) {
                   // console.log(`🔍 Successfully extracted existing username: ${extractedUsername}`);
                    const credentialsString = `${extractedUsername}//${password}`;
                    
                    await this.googleSheets.updateSuccessfulPasswordReset(patient.rowIndex, credentialsString);
                    
                    return {
                        success: true,
                        credentials: credentialsString,
                        username: extractedUsername,
                        password: password,
                        message: `Account unlock step 2 completed successfully with extracted username: ${credentialsString}`,
                        specialFeedback: false
                    };
                } else {
                    //console.log(`⚠️ Could not extract username, using fallback`);
                    const credentialsString = `${patient.username || patient.medId}//${password}`;
                    
                    await this.googleSheets.updateSuccessfulPasswordReset(patient.rowIndex, credentialsString);
                    
                    return {
                        success: true,
                        credentials: credentialsString,
                        username: patient.username || patient.medId,
                        password: password,
                        message: `Account unlock step 2 completed with fallback credentials: ${credentialsString}`,
                        specialFeedback: false
                    };
                }
            }
            
        } catch (error) {
           // console.error(`Error during account unlock for ${patient.lastName}:`, error);
            return { success: false, message: error.message, specialFeedback: false };
        }
    }

    async extractUsernameFromForgotPasswordPage(patient) {
        try {
            //console.log(`🔐 Extracting username from forgot password page for ${patient.lastName}...`);
            
            // Navigate to forgot password page
            await this.page.goto('https://www.medicare.gov/account/forgot-username-password', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            // Wait for page to load
            await this.page.waitForTimeout(2000);
            
           // console.log('Filling Medicare ID for password reset...');
            // Fill Medicare ID
            await this.humanTypeText('input[name="medicareNumber"]#medicare-number', patient.medId);
            
            // Short delay between fields
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Last Name for password reset...');
            // Fill Last Name
            await this.humanTypeText('input[name="lastName"]#last-name', patient.lastName);
            
            // Short delay between fields
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Date of Birth for password reset...');
            // Fill Date of Birth (format: MM/DD/YYYY)
            await this.humanTypeText('input[name="DateOfBirth"]#date-of-birth', patient.dob);
            
            // Short delay before clicking Next
            await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
            
           // console.log('Clicking Next button for password reset...');
            // Click Next button
            await this.page.click('button[type="button"].ds-c-button.ds-c-button--solid');
            
            // Wait for page to load
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
            
            // Check if we reached the identity-confirmed page
            if (this.page.url().includes('/account/identity-confirmed')) {
               // console.log('✅ Reached identity-confirmed page - extracting username...');
                
                // Extract username from the page
                let extractedUsername = null;
                try {
                    const usernameElement = await this.page.$('div.ds-u-font-size--lg span.ds-u-font-weight--semibold');
                    if (usernameElement) {
                        extractedUsername = await usernameElement.textContent();
                       // console.log(`🔍 Found username: ${extractedUsername}`);
                    }
                } catch (error) {
                    //console.log('⚠️ Could not extract username from identity-confirmed page');
                }
                
                return extractedUsername;
            }
            
            return null;
            
        } catch (error) {
           // console.error(`Error during username extraction for ${patient.lastName}:`, error);
            return null;
        }
    }

    // 🆕 Generate random Gmail address
    generateRandomEmail() {
        const randomNumbers = Math.floor(1000 + Math.random() * 9000); // 4 random digits
        return `larry.rss${randomNumbers}nw@gmail.com`;
    }

    async handleNewAccountCreation(patient) {
        try {
           // console.log(`🆕 Starting new account creation for ${patient.lastName}...`);
            
            // Wait for page to load and check for Security Notice
            await this.page.waitForTimeout(3000);
            
            // Check for Security Notice popup
            const securityNoticeHeading = await this.page.$('h1.ds-text-heading--3xl:has-text("Security Notice")');
            
            if (securityNoticeHeading) {
                //console.log('🛡️ Security Notice detected - clicking OK...');
                
                // Click OK button to dismiss security notice
                await this.page.click('div.ds-l-col--12.ds-l-md-col--auto button.ds-c-button.ds-c-button--solid:has-text("OK")');
                
                // Wait for the form to appear after dismissing notice
                await this.page.waitForTimeout(2000);
                await this.page.waitForLoadState('domcontentloaded');
            }
            
            //console.log('📝 Filling new account creation form...');
            
            // Parse date of birth for separate fields
            const dobParts = patient.dob.split('/'); // MM/DD/YYYY format
            const dobMonth = dobParts[0];
            const dobDay = dobParts[1];
            const dobYear = dobParts[2];
            
            // 🆕 Generate random email address
            const emailAddress = this.generateRandomEmail();
            //console.log(`📧 Generated email address: ${emailAddress}`);
            
            //console.log('Filling Last Name...');
            await this.humanTypeText('input[name="lastName"]#last-name', patient.lastName);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
            ///console.log('Filling Date of Birth Month...');
            await this.humanTypeText('input[name="month"].ds-c-field--month', dobMonth);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Date of Birth Day...');
            await this.humanTypeText('input[name="day"].ds-c-field--day', dobDay);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
//console.log('Filling Date of Birth Year...');
            await this.humanTypeText('input[name="year"].ds-c-field--year', dobYear);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Zip Code...');
            // 🔧 FIX: Extract zip code from full address if needed (same as unlock account)
            let zipCodeToUse = patient.zipCode;
            
            // If zipCode field contains full address, extract just the zip code
            if (zipCodeToUse && zipCodeToUse.length > 10) {
               // console.log(`📍 Extracting zip code from: "${zipCodeToUse}"`);
                const zipMatch = zipCodeToUse.match(/\b\d{5}(-\d{4})?\b/);
                zipCodeToUse = zipMatch ? zipMatch[0] : zipCodeToUse;
                //console.log(`📍 Extracted zip code: "${zipCodeToUse}"`);
            } else {
               // console.log(`📍 Using zip code: "${zipCodeToUse}"`);
            }
            
            await this.humanTypeText('input[name="zipCode"]#zipcode', zipCodeToUse);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Email Address...');
            await this.humanTypeText('input[name="emailAddress"]#email-address', emailAddress);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Confirm Email Address...');
            await this.humanTypeText('input[name="confirmEmailAddress"]#confirm-email', emailAddress);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Checking certification checkbox...');
            
            // 🔧 IMPROVED: Use same robust checkbox checking as unlock account
            const checkboxSelectors = [
                'input[name="certificationCheckbox"]#certified',
                'input[name="certificationCheckbox"]#certfied', // Common typo in forms
                'input[name="certificationCheckbox"]',
                'input[type="checkbox"]#certified',
                'input[type="checkbox"][id*="certif"]',
                'input[type="checkbox"]:last-of-type'
            ];
            
            let checkboxFound = false;
            for (const selector of checkboxSelectors) {
                try {
                    const checkbox = await this.page.$(selector);
                    if (checkbox) {
                        const isChecked = await checkbox.isChecked();
                        if (!isChecked) {
                            await this.page.check(selector);
                            //console.log(`✅ Successfully checked certification checkbox with selector: ${selector}`);
                            checkboxFound = true;
                            break;
                        } else {
                           // console.log(`✅ Certification checkbox already checked (selector: ${selector})`);
                            checkboxFound = true;
                            break;
                        }
                    }
                } catch (selectorError) {
                    continue; // Try next selector
                }
            }
            
            if (!checkboxFound) {
                //console.log('⚠️ Could not find certification checkbox with any selector');
            }
            
            await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
            
           // console.log('Clicking Next button...');
            await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid');
            
            // Wait for username/password form to load
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
            
            // 🔍 DEBUG: Check current URL and page content to understand what's happening
            const currentUrl = this.page.url();
            const pageTitle = await this.page.title();
            //console.log(`🌐 DEBUG: After clicking Next in new account creation:`);
            //console.log(`   URL: ${currentUrl}`);
            //console.log(`   Page Title: ${pageTitle}`);
            
            // Check for feedback messages after form submission
            const formFeedback = await this.detectErrorMessages();
            
            // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
            if (formFeedback.hasError && formFeedback.isMedicareSystemError) {
                //console.log(`🚨 MEDICARE SYSTEM ERROR detected in handleNewAccountCreation for ${patient.lastName}: ${formFeedback.message}`);
                
                // Log error to Submission Date column and stop processing
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${formFeedback.message}`);
                
                return {
                    success: false,
                    stopProcessing: true,
                    message: `Medicare system error: ${formFeedback.message}`,
                    isMedicareSystemError: true
                };
            }
            
            if (formFeedback.hasError) {
               // console.log(`🚨 ERROR in new account creation: ${formFeedback.message}`);
               // console.log(`🌐 DEBUG: Current URL when error occurred: ${currentUrl}`);
                
                // 🆕 HANDLE "We cannot find you in our records" and other feedback
                const feedbackOption = this.googleSheets.getFeedbackOption(formFeedback.message);
                
                // 🆕 HANDLE SPECIAL FEEDBACK CASES: Put in DR2 Info and continue with dummy credentials
                if (feedbackOption === 'Cannot reset password' || feedbackOption === 'No longer active') {
                   // console.log(`📋 Special feedback detected in new account creation for ${patient.lastName}: ${feedbackOption}`);
                    //console.log(`📄 Message: ${formFeedback.message}`);
                   // console.log(`📝 Putting feedback in DR2 Info and NOT saving credentials...`);
                   // console.log(`🚫 NOT generating or saving credentials for special feedback case`);
                    
                    // Update DR2 Info column with the feedback message
                    await this.googleSheets.updateDR2Info(patient.rowIndex, `${feedbackOption}: ${formFeedback.message}`);
                    
                    // 🆕 RETURN SUCCESS BUT NO CREDENTIALS - this prevents credentials from being saved
                    return { 
                        success: true, 
                        username: '',
                        password: '',
                        credentials: '', // Empty credentials so nothing gets saved
                        message: `Special feedback handled in new account creation: ${feedbackOption}`,
                        specialFeedback: feedbackOption
                    };
                }
                
                // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
                if (feedbackOption === 'Wrong Info') {
                   // console.log(`🛑 WRONG INFO detected in new account creation for ${patient.lastName} - stopping workflow`);
                   // console.log(`📋 Error message: ${formFeedback.message}`);
                    
                    return { 
                        success: false, 
                        stopWorkflow: true,
                        feedbackType: 'Wrong Info',
                        message: `Wrong Info: ${formFeedback.message}` 
                    };
                }
                
                // For other errors, return failure
                return { success: false, message: formFeedback.message };
            }
            
           // console.log('📝 Filling username and password form...');
            
            // 🔑 USE CREDENTIALS FROM THE SERVER - DON'T GENERATE NEW ONES
            const username = patient.username; // Use the username from the server
            const password = patient.password; // Use the password from the server
            
           // console.log(`Using credentials from server - username: ${username} and password: ${password}`);
            
           // console.log('Filling Username...');
            await this.humanTypeText('input[name="username"]#new-username', username);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Filling Password...');
            await this.humanTypeText('input[name="password"]#new-password', password);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Confirming Password...');
            await this.humanTypeText('input[name="confirm password"]#confirm-new-password', password);
            await this.page.waitForTimeout(500 + Math.floor(Math.random() * 500));
            
           // console.log('Selecting secret question dropdown...');
            // Click the dropdown button to open the menu
            await this.page.click('button[id="secret-question"]');
            
            // Wait for the dropdown menu to appear
            await this.page.waitForTimeout(2000);
            
            //console.log('Selecting "What is your favorite vacation spot?" option...');
            try {
                // Wait for the specific dropdown option to be visible
                await this.page.waitForSelector('#secret-question__item--1', { timeout: 5000 });
                
                // Click the specific option by ID
                await this.page.click('#secret-question__item--1');
               // console.log('✅ Successfully selected "What is your favorite vacation spot?" option');
                
            } catch (error) {
                //console.log('⚠️ Specific option not found, trying alternative selectors...');
                
                // Try alternative selectors for the vacation spot option
                const alternativeSelectors = [
                    'li[data-key="What is your favorite vacation spot?"]',
                    'li[role="option"]:has-text("What is your favorite vacation spot?")',
                    '[id^="secret-question__item--"]:has-text("vacation")',
                    'li.ds-c-dropdown__menu-item:first-child'
                ];
                
                let optionSelected = false;
                for (const selector of alternativeSelectors) {
                    try {
                        const option = await this.page.$(selector);
                        if (option) {
                            await option.click();
                            //console.log(`✅ Selected option using selector: ${selector}`);
                            optionSelected = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
                
                if (!optionSelected) {
                    // Final fallback: just press Enter
                    await this.page.keyboard.press('Enter');
                   // console.log('✅ Used Enter key as final fallback');
                }
            }
            
           // console.log('Filling secret answer...');
            await this.humanTypeText('input[name="secretAnswer"]#secret-answer', 'CA');
            await this.page.waitForTimeout(1000 + Math.floor(Math.random() * 500));
            
           // console.log('Clicking Create Account button...');
            await this.page.click('button[type="submit"].ds-c-button.ds-c-button--solid:has-text("Create Account")');
            
            // Wait for account creation completion
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForTimeout(3000);
            
            // Check for final feedback messages
            const finalFeedback = await this.detectErrorMessages();
            
            // 🆕 ADDED: Handle Medicare system error (same as doctor-fetching.js)
            if (finalFeedback.hasError && finalFeedback.isMedicareSystemError) {
               // console.log(`🚨 MEDICARE SYSTEM ERROR detected in final account creation for ${patient.lastName}: ${finalFeedback.message}`);
                
                // Log error to Submission Date column and stop processing
                await this.googleSheets.updateSubmissionDate(patient.rowIndex, `MEDICARE_SYSTEM_ERROR: ${finalFeedback.message}`);
                
                return {
                    success: false,
                    stopProcessing: true,
                    message: `Medicare system error: ${finalFeedback.message}`,
                    isMedicareSystemError: true
                };
            }
            
            if (finalFeedback.hasError) {
               // console.log(`❌ Account creation final step failed: ${finalFeedback.message}`);
                
                // 🆕 HANDLE SPECIAL FEEDBACK CASES in final step
                const feedbackOption = this.googleSheets.getFeedbackOption(finalFeedback.message);
                
                // 🆕 HANDLE SPECIAL FEEDBACK CASES: Put in DR2 Info and return success with dummy credentials
                if (feedbackOption === 'Cannot reset password' || feedbackOption === 'No longer active') {
                    //console.log(`📋 Special feedback detected in final account creation for ${patient.lastName}: ${feedbackOption}`);
                    //console.log(`📄 Message: ${finalFeedback.message}`);
                    //console.log(`📝 Putting feedback in DR2 Info and NOT saving credentials...`);
                    //console.log(`🚫 NOT generating or saving credentials for special feedback case`);
                    
                    // Update DR2 Info column with the feedback message
                    await this.googleSheets.updateDR2Info(patient.rowIndex, `${feedbackOption}: ${finalFeedback.message}`);
                    
                    // 🆕 RETURN SUCCESS BUT NO CREDENTIALS - this prevents credentials from being saved
                    return { 
                        success: true, 
                        username: '',
                        password: '',
                        credentials: '', // Empty credentials so nothing gets saved
                        message: `Special feedback handled in final account creation: ${feedbackOption}`,
                        specialFeedback: feedbackOption
                    };
                }
                
                // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
                if (feedbackOption === 'Wrong Info') {
                   // console.log(`🛑 WRONG INFO detected in final account creation for ${patient.lastName} - stopping workflow`);
                   // console.log(`📋 Error message: ${finalFeedback.message}`);
                    
                    return { 
                        success: false, 
                        stopWorkflow: true,
                        feedbackType: 'Wrong Info',
                        message: `Wrong Info: ${finalFeedback.message}` 
                    };
                }
                
                // For other errors, return failure
                return { success: false, message: finalFeedback.message };
            } else {
                //console.log(`✅ Account creation completed successfully for ${patient.lastName}`);
                const credentialsString = `${username}//${password}`;
                
                // 🔧 FIX: Save credentials to Google Sheets!
               // console.log(`💾 Saving credentials to Google Sheets for ${patient.lastName}: ${credentialsString}`);
                await this.googleSheets.updateSuccessfulAccountCreation(patient.rowIndex, credentialsString);
               // console.log(`✅ Credentials saved to Google Sheets for ${patient.lastName}`);
                
                return { 
                    success: true, 
                    username: username,
                    password: password,
                    credentials: credentialsString,
                    message: `Account created successfully with credentials: ${credentialsString}` 
                };
            }
            
        } catch (error) {
           // console.error(`Error during new account creation for ${patient.lastName}:`, error);
            return { success: false, message: error.message };
        }
    }

    // 🆕 ADDED: Fast wait for Medicare pages to load
    async waitForMedicarePageLoad() {
        try {
           // console.log('⏳ Quick page load check...');
            // Fast DOM content check
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            // Quick check for any obvious loading indicators
            try {
                await this.page.waitForSelector('.loading, .spinner, [aria-busy="true"]', { 
                    state: 'hidden', 
                    timeout: 3000 
                });
               // console.log('✅ Loading indicators cleared');
            } catch (error) {
                // No loading indicators found, that's fine
            }
            // Quick check for basic form elements
            const basicSelectors = [
                'input[type="text"]',
                'input[type="number"]',
                'button[type="submit"]',
                'button'
            ];
            let foundElements = 0;
            for (const selector of basicSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    foundElements++;
                } catch (error) {
                    // Element not found, continue
                }
            }
            // Minimal stability wait
            await this.page.waitForTimeout(0);
           // console.log(`✅ Page ready (found ${foundElements} basic elements)`);
        } catch (error) {
           // console.log(`⚠️ Quick page load check failed: ${error.message}`);
            //console.log('⚠️ Continuing with minimal wait...');
            // Minimal fallback
            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            await this.page.waitForTimeout(0);
        }
    }

    // 🆕 ADDED: Validation check for account feedback and Medicare restrictions
    async validateSubmissionEligibility(rowIndex) {
        try {
           //console.log(`🔍 Validating submission eligibility for row ${rowIndex}...`);
            
            // Get account feedback from column AK
            const feedbackResponse = await this.googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: this.googleSheets.spreadsheetId,
                range: `'${this.googleSheets.sheetName}'!AK${rowIndex}`
            });
            
            const accountFeedback = feedbackResponse.data.values && feedbackResponse.data.values[0] && feedbackResponse.data.values[0][0] || '';
           // console.log(`📋 Account Feedback (AK): "${accountFeedback}"`);
            
            // Check if account feedback indicates inactive status
            const inactiveKeywords = [
                'no longer active',
                'account is no longer active',
                'your account is no longer active',
                'account disabled',
                'account locked'
            ];
            
            const isAccountInactive = inactiveKeywords.some(keyword => 
                accountFeedback.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (isAccountInactive) {
               // console.log(`🚫 SUBMISSION BLOCKED: Account feedback indicates inactive status`);
               // console.log(`📋 Feedback: "${accountFeedback}"`);
                return {
                    canSubmit: false,
                    reason: 'Account feedback indicates inactive status',
                    feedback: accountFeedback
                };
            }
            
            // Get Medicare restrictions from column BN (DR2 Info)
            const restrictionsResponse = await this.googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: this.googleSheets.spreadsheetId,
                range: `'${this.googleSheets.sheetName}'!BN${rowIndex}`
            });
            
            const medicareRestrictions = restrictionsResponse.data.values && restrictionsResponse.data.values[0] && restrictionsResponse.data.values[0][0] || '';
           // console.log(`📋 Medicare Restrictions (BN): "${medicareRestrictions}"`);
            
            // Check if Medicare restrictions are present
            const restrictionKeywords = [
                'cannot reset password',
                'medicare restriction',
                'call 1-800-medicare',
                'must call 1-800-medicare',
                'temporary password',
                'restriction'
            ];
            
            const hasMedicareRestrictions = restrictionKeywords.some(keyword => 
                medicareRestrictions.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (hasMedicareRestrictions) {
               // console.log(`🚫 SUBMISSION BLOCKED: Medicare restrictions detected`);
                //console.log(`📋 Restrictions: "${medicareRestrictions}"`);
                return {
                    canSubmit: false,
                    reason: 'Medicare restrictions detected',
                    restrictions: medicareRestrictions
                };
            }
            
            // Get DR1 Info (Closer Comment) from column AE
            const dr1Response = await this.googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: this.googleSheets.spreadsheetId,
                range: `'${this.googleSheets.sheetName}'!AE${rowIndex}`
            });
            
            const dr1Info = dr1Response.data.values && dr1Response.data.values[0] && dr1Response.data.values[0][0] || '';
           // console.log(`📋 DR1 Info (AE): "${dr1Info}"`);
            
            // Check if DR1 Info is empty or contains only dots
            const isEmptyOrDots = !dr1Info || 
                dr1Info.trim() === '' || 
                dr1Info.trim() === '........' ||
                dr1Info.trim() === '...';
            
            if (isEmptyOrDots) {
               // console.log(`🚫 SUBMISSION BLOCKED: DR1 Info is empty`);
               // console.log(`📋 DR1 Info: "${dr1Info}"`);
                return {
                    canSubmit: false,
                    reason: 'DR1 Info is empty',
                    dr1Info: dr1Info
                };
            }
            
            //console.log(`✅ Submission validation passed - all checks cleared`);
            return {
                canSubmit: true,
                reason: 'All validation checks passed'
            };
            
        } catch (error) {
            //console.error(`❌ Error validating submission eligibility: ${error.message}`);
            // If validation fails, allow submission to proceed (fail-safe)
            return {
                canSubmit: true,
                reason: 'Validation failed - proceeding with submission',
                error: error.message
            };
        }
    }
}

module.exports = MedicareAutomation;
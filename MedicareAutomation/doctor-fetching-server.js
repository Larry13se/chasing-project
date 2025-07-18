const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const DoctorFetching = require('./doctor-fetching');
const GoogleSheetsService = require('./google-sheets-service');

const app = express();
const port = process.env.DOCTOR_PORT || 6002; // Doctor Fetching Server on port 6002

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const googleSheets = new GoogleSheetsService();
// Note: doctorFetching instances are now created locally for each request to avoid concurrency conflicts

// Request tracking for concurrent processing
const activeRequests = new Map();
const maxConcurrentRequests = 4; // Increased to 4 concurrent doctor fetching processes

console.log('👨‍⚕️ Doctor Fetching Server Starting...');

// Helper function to convert column index to letter(s) for Google Sheets API
function getColumnLetter(columnIndex) {
    let columnLetter = '';
    while (columnIndex >= 0) {
        columnLetter = String.fromCharCode(65 + (columnIndex % 26)) + columnLetter;
        columnIndex = Math.floor(columnIndex / 26) - 1;
    }
    return columnLetter;
}

// Function to notify orchestration server when doctor fetching is complete
async function notifyOrchestrationServer(data) {
    const orchestrationUrl = 'http://localhost:7000'; // Always local
    
    try {
        const response = await fetch(`${orchestrationUrl}/doctor-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log(`✅ Orchestration notification sent successfully`);
        } else {
            console.log(`❌ Failed to notify orchestration server: ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error notifying orchestration server:', error.message);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'Doctor Fetching Server',
        version: '1.0.0',
        activeRequests: activeRequests.size,
        maxConcurrentRequests: maxConcurrentRequests,
        availableSlots: maxConcurrentRequests - activeRequests.size
    });
});

// Test doctor fetching initialization
app.post('/test-init', async (req, res) => {
    try {
        const testDoctorFetching = new DoctorFetching();
        await testDoctorFetching.initialize();
        
        if (testDoctorFetching.browser && testDoctorFetching.page) {
            await testDoctorFetching.page.goto('https://www.medicare.gov', { waitUntil: 'domcontentloaded', timeout: 10000 });
            const url = testDoctorFetching.page.url();
            
            await testDoctorFetching.cleanup();
            
            res.json({
                success: true,
                message: 'Doctor fetching system initialized successfully',
                testUrl: url
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Browser or page not properly initialized'
            });
        }
        
    } catch (error) {
        console.error('❌ Test initialization failed:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Test login with real credentials
app.post('/test-login', async (req, res) => {
    try {
        const { credentials } = req.body;
        
        if (!credentials) {
            return res.status(400).json({
                success: false,
                message: 'Please provide credentials in format: username//password'
            });
        }
        
        const testDoctorFetching = new DoctorFetching();
        await testDoctorFetching.initialize();
        
        const loginResult = await testDoctorFetching.loginToMedicare(credentials);
        
        res.json({
            success: loginResult.success,
            message: `Login test: ${loginResult.message}`,
            url: testDoctorFetching.page.url()
        });
        
    } catch (error) {
        console.error('❌ Test login failed:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Process doctor fetching for a specific patient
app.post('/fetch-doctors', async (req, res) => {
    try {
        const { 
            lastName, 
            rowIndex,
            sheetName,
            chromePort
        } = req.body;

        console.log(`👨‍⚕️ Processing doctor fetching for ${lastName} (Row ${rowIndex})`);

        // Validate required data (credentials will be read from sheet)
        if (!lastName || !rowIndex) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: lastName or rowIndex'
            });
        }

        // Check if already being processed to prevent duplicates
        const requestId = `doctors_${lastName}_${rowIndex}`;
        if (activeRequests.has(requestId)) {
            console.log(`⚠️ Doctor fetching for ${lastName} (row ${rowIndex}) already being processed, skipping duplicate`);
            return res.json({
                success: true,
                message: 'Doctor fetching already being processed',
                requestId: requestId
            });
        }

        // Check if we're at max concurrent requests
        if (activeRequests.size >= maxConcurrentRequests) {
            console.log(`⚠️ Max concurrent requests (${maxConcurrentRequests}) reached, rejecting doctor request for ${lastName}`);
            return res.status(503).json({
                success: false,
                error: `Server busy - max ${maxConcurrentRequests} concurrent requests allowed`
            });
        }

        // Track active request
        activeRequests.set(requestId, {
            lastName,
            rowIndex,
            sheetName: sheetName || 'INCALL_1_RESPONSE',
            startTime: new Date()
        });

        // Create patient data for immediate processing
        const patientData = {
            lastName,
            rowIndex,
            chromePort: chromePort || 9222
        };

        // Process immediately in parallel
        processDoctorFetchingConcurrent(patientData, rowIndex, sheetName || 'INCALL_1_RESPONSE', requestId);

        res.json({
            success: true,
            message: 'Doctor fetching started',
            requestId: requestId,
            activeRequests: activeRequests.size
        });

    } catch (error) {
        console.error('❌ Error processing doctor fetching request:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get active requests status
app.get('/queue-status', (req, res) => {
    const activeRequestsArray = Array.from(activeRequests.entries()).map(([requestId, info]) => ({
        id: requestId,
        lastName: info.lastName,
        rowIndex: info.rowIndex,
        sheetName: info.sheetName,
        startTime: info.startTime,
        duration: Math.round((new Date() - info.startTime) / 1000) + 's'
    }));

    res.json({
        activeRequests: activeRequests.size,
        maxConcurrentRequests: maxConcurrentRequests,
        availableSlots: maxConcurrentRequests - activeRequests.size,
        requests: activeRequestsArray
    });
});

// Clear active requests endpoint (for debugging)
app.post('/clear-queue', (req, res) => {
    const clearedCount = activeRequests.size;
    activeRequests.clear();
    
    res.json({
        success: true,
        message: `Cleared ${clearedCount} active requests`
    });
});

// Concurrent version of processDoctorFetching with proper cleanup
async function processDoctorFetchingConcurrent(patientData, rowIndex, sheetName, requestId) {
    try {
        // Call the main processing function
        const result = await processDoctorFetching(patientData, rowIndex, sheetName);
        
        // Notify orchestration server that doctor fetching is complete
        await notifyOrchestrationServer({
            success: result.success,
            hasDoctors: result.hasDoctors || false,
            rowIndex: rowIndex,
            sheetName: sheetName,
            lastName: patientData.lastName,
            error: result.error || null,
            isAccountDisabled: result.isAccountDisabled || false,
            errorType: result.errorType || null,
            preventFormSubmission: result.preventFormSubmission || false,
            isLoginError: result.isLoginError || false,
            isMedicareSystemError: result.isMedicareSystemError || false
        });
        
        return result;
        
    } catch (error) {
        console.error(`❌ [CONCURRENT] Error processing doctor fetching for ${patientData.lastName}:`, error);
        
        // Notify orchestration server that doctor fetching failed
        await notifyOrchestrationServer({
            success: false,
            hasDoctors: false,
            rowIndex: rowIndex,
            sheetName: sheetName,
            lastName: patientData.lastName,
            error: error.message || 'Unknown error',
            isAccountDisabled: error.isAccountDisabled || false,
            errorType: error.errorType || null,
            preventFormSubmission: error.preventFormSubmission || false,
            isLoginError: error.isLoginError || false,
            isMedicareSystemError: error.isMedicareSystemError || false
        });
        
        throw error;
        
    } finally {
        // CRITICAL: Clean up active request tracking
        if (activeRequests.has(requestId)) {
            const requestInfo = activeRequests.get(requestId);
            const duration = new Date() - requestInfo.startTime;
            console.log(`🧹 [CONCURRENT] Cleaning up doctor request: ${requestId} (Duration: ${Math.round(duration/1000)}s)`);
            activeRequests.delete(requestId);
            console.log(`📊 [CONCURRENT] Active doctor requests remaining: ${activeRequests.size}/${maxConcurrentRequests}`);
        }
    }
}

async function processDoctorFetching(patientData, rowIndex, sheetName) {
    // Initialize Doctor Fetching with Chrome port (LOCAL instance for concurrency)
    const chromePort = patientData.chromePort || 9222; // Default to 9222 if not provided
    
    // 🆕 Create separate GoogleSheetsService instance for this concurrent request
    const localGoogleSheets = new GoogleSheetsService();
    await localGoogleSheets.initialize();
    localGoogleSheets.setSheetName(sheetName);
    
    const localDoctorFetching = new DoctorFetching(localGoogleSheets, chromePort);

    try {
        // Initialize doctor fetching system
        await localDoctorFetching.initialize();
        
        // Check if browser is properly initialized
        if (!localDoctorFetching.browser || !localDoctorFetching.page) {
            throw new Error('Browser or page not properly initialized');
        }
        
        // Get full patient data from sheet to prepare complete patient object
        // 🔧 RATE-LIMITED: Use Google Sheets API with proper rate limiting
        const headersResponse = await localGoogleSheets.rateLimit(() =>
            localGoogleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: localGoogleSheets.spreadsheetId,
                range: `'${sheetName}'!3:3` // Headers are in row 3
            })
        );
        const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
        
        const dataResponse = await localGoogleSheets.rateLimit(() =>
            localGoogleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: localGoogleSheets.spreadsheetId,
                range: `'${sheetName}'!${rowIndex}:${rowIndex}`
            })
        );
        const data = dataResponse.data.values ? dataResponse.data.values[0] : [];
        
        // Safe getter function
        const get = (columnName) => {
            const i = headers.indexOf(columnName);
            const val = i >= 0 ? data[i] : "";
            return (val === "" || val === undefined) ? "" : String(val).trim();
        };
        
        // Get credentials from the "Credentials" column in the sheet
        const credentialsFromSheet = get("Credentials");
        
        if (!credentialsFromSheet || !credentialsFromSheet.includes('//')) {
            throw new Error(`Invalid or missing credentials in sheet for ${patientData.lastName}. Expected format: username//password, found: "${credentialsFromSheet}"`);
        }
        
        // Prepare patient data for doctor fetching with all required fields
        const doctorPatientData = {
            lastName: patientData.lastName,
            existingCredentials: credentialsFromSheet,  // Get from sheet, not from request
            address: `${get("PT Street Address")}, ${get("PT City")}, ${get("PT State")} ${get("PT Zip Code")}`,
            rowIndex: rowIndex
        };

        // Process doctor fetching
        const doctorsResult = await localDoctorFetching.processPatientForDoctors(doctorPatientData);

        if (doctorsResult && doctorsResult.success && doctorsResult.doctors && doctorsResult.doctors.length > 0) {
            
            // Format doctors with simple // separated format as requested
            const formattedDoctors = doctorsResult.doctors.map((doctor, index) => {
                const doctorName = doctor.fullName || doctor.name || 'Unknown Doctor';
                
                // Build practice address from multiple possible sources
                let practiceAddress = '';
                if (doctor.address && (doctor.address.street || doctor.address.city)) {
                    // HIPAASpace format: address object
                    const parts = [];
                    if (doctor.address.street) parts.push(doctor.address.street);
                    if (doctor.address.city) parts.push(doctor.address.city);
                    if (doctor.address.state) parts.push(doctor.address.state);
                    if (doctor.address.zip) parts.push(doctor.address.zip);
                    practiceAddress = parts.join(', ').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '');
                } else {
                    // Direct field format
                    const parts = [];
                    if (doctor.practiceAddress) parts.push(doctor.practiceAddress);
                    if (doctor.practiceCity) parts.push(doctor.practiceCity);
                    if (doctor.practiceState) parts.push(doctor.practiceState);
                    if (doctor.practiceZip) parts.push(doctor.practiceZip);
                    practiceAddress = parts.join(', ').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '');
                }
                
                if (!practiceAddress || practiceAddress.trim() === '') {
                    practiceAddress = 'No Address Available';
                }
                
                const practicePhone = doctor.practicePhone || doctor.phone || 'No Phone Available';
                const practiceFax = doctor.practiceFax || doctor.fax || 'No Fax Available';
                const npi = doctor.npi || 'No NPI Available';
                const specialty = doctor.specialty || doctor.taxonomy || 'No Specialty Available';
                
                // 🆕 USE ENHANCED LAST VISIT WITH LATEST CLAIM INFORMATION
                const lastVisitInfo = doctor.lastVisit || 'No Recent Visits';
                
                const doctorType = doctor.validationType || 'UNKNOWN';
                
                // Format: DoctorName//PracticingAddress//PracticingPhoneNumber//PracticingFaxNumber//NPI//Specialty//LastVisit: Date//Type
               return `${doctorName}//${practiceAddress}//${npi}//${specialty}`;

            });
            
            // Save doctors to BN-BV columns (columns 66-74)
            const result = await localGoogleSheets.updateDoctorInfoColumns(sheetName, rowIndex, formattedDoctors);
            
            // 🆕 CLOSE CHROME WINDOW AFTER SUCCESSFUL DOCTOR FETCHING
            try {
                if (localDoctorFetching && localDoctorFetching.browser && localDoctorFetching.browser.isConnected()) {
                    await localDoctorFetching.cleanup();
                }
            } catch (closeError) {
                console.log(`⚠️  Could not close Chrome window: ${closeError.message}`);
            }
            
            return { 
                success: true, 
                message: `Successfully saved ${formattedDoctors.length} doctors to sheet`,
                doctorCount: formattedDoctors.length,
                hasDoctors: true
            };
        } else {
            // Check if this was an account disabled error
            if (doctorsResult && doctorsResult.isAccountDisabled) {
                // 🆕 CLOSE CHROME WINDOW AFTER ACCOUNT DISABLED ERROR
                try {
                    if (localDoctorFetching && localDoctorFetching.browser && localDoctorFetching.browser.isConnected()) {
                        await localDoctorFetching.cleanup();
                    }
                } catch (closeError) {
                    console.log(`⚠️  Could not close Chrome window: ${closeError.message}`);
                }
                
                // Return account disabled error details
                return {
                    success: false,
                    hasDoctors: false,
                    message: doctorsResult.message || 'Account disabled - doctor fetching stopped',
                    error: doctorsResult.message || 'Account disabled',
                    isAccountDisabled: true,
                    errorType: 'ACCOUNT_DISABLED',
                    preventFormSubmission: true
                };
            }
            
            // 🆕 CHECK FOR SPECIFIC FEEDBACK: Handle new feedback structure
            if (doctorsResult && doctorsResult.feedbackForDR2) {
                // 🆕 CLOSE CHROME WINDOW AFTER FEEDBACK SCENARIO
                try {
                    if (localDoctorFetching && localDoctorFetching.browser && localDoctorFetching.browser.isConnected()) {
                        await localDoctorFetching.cleanup();
                    }
                } catch (closeError) {
                    console.log(`⚠️  Could not close Chrome window: ${closeError.message}`);
                }
                
                // Return detailed feedback for orchestration server to put in DR2 Info
                return {
                    success: false,
                    hasDoctors: false,
                    message: doctorsResult.message || 'No doctors found with detailed feedback',
                    feedbackForDR2: doctorsResult.feedbackForDR2,
                    noRecentActivity: doctorsResult.noRecentActivity || false,
                    errorType: 'NO_DOCTORS_WITH_FEEDBACK'
                };
            }
            
            // 🆕 CLOSE CHROME WINDOW EVEN WHEN NO DOCTORS FOUND
            try {
                if (localDoctorFetching && localDoctorFetching.browser && localDoctorFetching.browser.isConnected()) {
                    await localDoctorFetching.cleanup();
                }
            } catch (closeError) {
                console.log(`⚠️  Could not close Chrome window: ${closeError.message}`);
            }
            
            return { 
                success: true, 
                message: `No good/relaxed doctors found for ${patientData.lastName}. Will submit form with "..." for doctors 2-10`,
                doctorCount: 0,
                hasDoctors: false
            };
        }

    } catch (error) {
        console.error('❌ Error in doctor fetching:', error);
        
        // 🆕 CLOSE CHROME WINDOW ON ERROR
        try {
            if (localDoctorFetching && localDoctorFetching.browser && localDoctorFetching.browser.isConnected()) {
                await localDoctorFetching.cleanup();
            }
        } catch (closeError) {
            console.log(`⚠️  Could not close Chrome window: ${closeError.message}`);
        }
        
        // Check if this is an account disabled error and propagate the details
        const isAccountDisabled = error.isAccountDisabled || (error.message && error.message.includes('ACCOUNT DISABLED'));
        const isMedicareSystemError = error.isMedicareSystemError || (error.message && error.message.includes('MEDICARE SYSTEM ERROR'));
        const isLoginError = error.isLoginError || (error.message && error.message.includes('LOGIN ERROR'));
        const errorType = error.errorType || (isAccountDisabled ? 'ACCOUNT_DISABLED' : (isMedicareSystemError ? 'MEDICARE_SYSTEM_ERROR' : (isLoginError ? 'LOGIN_ERROR' : null)));
        
        return { 
            success: false, 
            hasDoctors: false, 
            message: error.message,
            error: error.message,
            isAccountDisabled: isAccountDisabled,
            isMedicareSystemError: isMedicareSystemError,
            isLoginError: isLoginError,
            errorType: errorType,
            preventFormSubmission: isAccountDisabled || isMedicareSystemError || isLoginError
        };
    } finally {
        // Final cleanup - make sure browser is closed (LOCAL instance)
        if (localDoctorFetching && localDoctorFetching.browser) {
            try {
                if (localDoctorFetching.browser.isConnected()) {
                    await localDoctorFetching.cleanup();
                }
            } catch (cleanupError) {
                console.error('Error in final cleanup:', cleanupError);
            }
        }
    }
}

// Form submission is now handled by the orchestration server after doctor completion notification

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Doctor Fetching Server...');
    
    // Note: Local instances will cleanup automatically via their finally blocks
    console.log(`📊 Active requests being terminated: ${activeRequests.size}`);
    
    process.exit(0);
});

app.listen(port, () => {
    console.log(`👨‍⚕️ Doctor Fetching Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔗 Fetch Doctors: POST http://localhost:${port}/fetch-doctors`);
    console.log(`📋 Queue Status: GET http://localhost:${port}/queue-status`);
}); 
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const MedicareAutomation = require('./medicare-automation');
const GoogleSheetsService = require('./google-sheets-service');
require('dotenv').config();

const app = express();
const port = process.env.MEDICARE_PORT || 6001;

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize services
const googleSheets = new GoogleSheetsService();
// Note: medicareAutomation instances are now created locally for each request to avoid concurrency conflicts

// Request tracking for concurrent processing
const activeRequests = new Map();
const maxConcurrentRequests = 4; // Set to 4 concurrent Medicare processes to match orchestration

console.log('🏥 Medicare Account Creation Server Starting...');

// Function to generate random password like larry@(8 random numbers)!@
function generateRandomPassword() {
    const randomNumbers = Math.floor(10000000 + Math.random() * 90000000); // 8 digit random number
    return `larry@${randomNumbers}!@`;
}

// Function to generate username like LastName@Larry + single random number
function generateUsername(lastName) {
    const randomNumber = Math.floor(Math.random() * 10); // Single digit 0-9
    return `${lastName}@Larry${randomNumber}`;
}

// Function to notify orchestration server when Medicare is complete
async function notifyOrchestrationServer(data) {
    const orchestrationUrl = 'http://localhost:7000'; // Always local
    
    try {
        console.log(`📡 Notifying orchestration server: ${data.lastName} (Success: ${data.success})`);
        
        const response = await fetch(`${orchestrationUrl}/medicare-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
           // console.log(`✅ Orchestration notification sent successfully`);
        } else {
           // console.log(`❌ Failed to notify orchestration server: ${response.status}`);
        }
        
    } catch (error) {
        //console.error('❌ Error notifying orchestration server:', error.message);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'Medicare Account Creation Server',
        version: '1.0.0'
    });
});

// Process Medicare automation for a specific row
app.post('/process-medicare', async (req, res) => {
    try {
        const { 
            lastName, 
            medId, 
            dob, 
            zipCode, 
            address, 
            partBEligibility, 
            rowIndex,
            sheetName,
            chromePort
        } = req.body;

       // console.log(`🏥 Processing Medicare account creation for ${lastName} (Row ${rowIndex}) - Received Chrome port: ${chromePort || 'NOT PROVIDED'}`);
       // console.log(`🔍 DEBUG - Full request body chromePort: ${JSON.stringify({chromePort, lastName, rowIndex})}`);

        // Allow multiple account creation requests

        // Validate required data
        if (!lastName || !medId || !dob) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: lastName, medId, or dob'
            });
        }

        // Check if already being processed to prevent duplicates
        const requestId = `${lastName}_${rowIndex}`;
        if (activeRequests.has(requestId)) {
            //console.log(`⚠️ Request for ${lastName} (row ${rowIndex}) already being processed, skipping duplicate`);
            return res.json({
                success: true,
                message: 'Request already being processed',
                requestId: requestId
            });
        }

        // Check if we're at max concurrent requests
        if (activeRequests.size >= maxConcurrentRequests) {
           // console.log(`⚠️ Max concurrent requests (${maxConcurrentRequests}) reached, rejecting request for ${lastName}`);
            return res.status(503).json({
                success: false,
                error: `Server busy - max ${maxConcurrentRequests} concurrent requests allowed`
            });
        }

        // Generate random password
        const randomPassword = generateRandomPassword();

        // Create patient data for immediate processing
        const patientData = {
            lastName,
            medId,
            dob,
            zipCode,
            address,
            partBEligibility: partBEligibility,
            username: generateUsername(lastName),
            password: randomPassword,
            rowIndex: rowIndex,
            chromePort: chromePort || 9222
        };

       // console.log(`📋 Starting immediate processing: ${requestId} (Active: ${activeRequests.size + 1}/${maxConcurrentRequests})`);
       // console.log(`🔑 Generated random password: ${randomPassword}`);

        // Track active request
        activeRequests.set(requestId, {
            lastName,
            rowIndex,
            sheetName: sheetName || 'INCALL_1_RESPONSE',
            startTime: new Date()
        });

        // Process immediately in parallel
        processPatientDataConcurrent(patientData, rowIndex, sheetName || 'INCALL_1_RESPONSE', requestId);

        res.json({
            success: true,
            message: 'Medicare account creation started',
            requestId: requestId,
            activeRequests: activeRequests.size
        });

    } catch (error) {
       // console.error('❌ Error processing Medicare request:', error);
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

// Get account creation status
app.get('/account-status', (req, res) => {
    res.json({
        accountCreationComplete: false, // Always false since we process multiple accounts
        credentials: '', // Individual credentials are saved to sheet directly
        message: 'Ready to process account creation requests'
    });
});

// No global flags needed - each request is processed independently in parallel

async function processPatientData(patientData, rowIndex, sheetName) {
   // console.log(`🏥 Processing patient: ${patientData.lastName} (Row ${rowIndex}, Sheet: ${sheetName})`);
   // console.log(`🔑 Using random password: ${patientData.password}`);

    // 🆕 Create separate GoogleSheetsService instance for this concurrent request
   // console.log(`📊 Creating separate GoogleSheetsService instance for ${patientData.lastName}`);
    const localGoogleSheets = new GoogleSheetsService();
    await localGoogleSheets.initialize();
    localGoogleSheets.setSheetName(sheetName);

    // Update status to show processing started
    await localGoogleSheets.updateAccountFeedback(rowIndex, 'Account Creation Processing...');

    // Initialize Medicare automation with sheet name and Chrome port (LOCAL instance for concurrency)
    const chromePort = patientData.chromePort || 9222; // Default to 9222 if not provided
  // console.log(`🔧 Creating LOCAL MedicareAutomation instance for ${patientData.lastName} on Chrome port ${chromePort}`);
    const localMedicareAutomation = new MedicareAutomation(sheetName, chromePort);

    try {
        // Step 1: Account Creation - Use improved fillInitialAccountInfo method
     //   console.log('🔐 Starting account creation...');
        await localMedicareAutomation.initialize();
        
        // Navigate and process account creation using the improved method
        await localMedicareAutomation.navigateToMedicareCreateAccount();
        
        // The fillInitialAccountInfo method now handles all scenarios:
        // - Account creation completion detection
        // - Password reset flows
        // - New account creation
        // - Error handling
        const result = await localMedicareAutomation.fillInitialAccountInfo(patientData);
        
        // 🔍 ENHANCED DEBUG: Log the complete result object
       // console.log(`🔍 DEBUG - Complete result object for ${patientData.lastName}:`, {
       //     success: result.success,
       //     specialFeedback: result.specialFeedback,
       //     message: result.message,
       //     credentials: result.credentials,
       //     type: result.type,
       //     stopWorkflow: result.stopWorkflow,
        //    feedbackType: result.feedbackType
       // });
        
        // 🆕 ENHANCED SPECIAL FEEDBACK DETECTION: Check message content if specialFeedback field is missing/false
        let isSpecialFeedbackCase = false;
        if (result.specialFeedback && (result.specialFeedback === true || 
            result.specialFeedback === 'Cannot reset password' || 
            result.specialFeedback === 'No longer active')) {
            isSpecialFeedbackCase = true;
        } else if (result.message) {
            // Check the message content directly for special feedback patterns
            const messageLower = result.message.toLowerCase();
            if ((messageLower.includes('cannot reset password') && messageLower.includes('medicare restriction')) ||
                messageLower.includes('call 1-800-medicare') ||
                messageLower.includes('must call 1-800-medicare') ||
                messageLower.includes('account is no longer active') ||
                messageLower.includes('your account is no longer active') ||
                messageLower.includes('no longer active')) {
                isSpecialFeedbackCase = true;
                console.log(`🔍 ENHANCED DETECTION: Special feedback detected via message content: "${result.message}"`);
            }
        }
        
        // 🆕 HANDLE SPECIAL FEEDBACK CASES FIRST - regardless of success status
        if (isSpecialFeedbackCase) {
            //console.log(`📋 Special feedback case detected for ${patientData.lastName}: ${result.specialFeedback}`);
            //console.log(`📄 Message: ${result.message}`);
            //console.log(`🚫 Skipping credential save and account feedback update for special feedback case`);
            
            // Notify orchestration server that Medicare is complete with special feedback
            await notifyOrchestrationServer({
                success: true, // Force success for special feedback cases
                credentials: '', // No credentials for special feedback
                rowIndex: rowIndex,
                sheetName: sheetName,
                lastName: patientData.lastName,
                specialFeedback: result.specialFeedback,
                feedbackMessage: result.message || null
            });
            
            //console.log(`✅ Special feedback case handled - continuing workflow for ${patientData.lastName}`);
            return { success: true, credentials: '', specialFeedback: result.specialFeedback };
        }
        
        if (result.success) {
           // console.log(`✅ Account processing completed for ${patientData.lastName}`);
            //console.log(`✅ Credentials: ${result.credentials || 'EMPTY'}`);
            
            // Save credentials for normal successful cases
            if (result.credentials && result.credentials.trim() !== '') {
                ///console.log(`💾 Updating credentials for row ${rowIndex}: ${result.credentials}`);
                await localGoogleSheets.updatePatientCredentials(rowIndex, result.credentials);
                //console.log(`✅ Credentials saved to column BW for row ${rowIndex}: ${result.credentials}`);
            }
            
            // Update account feedback for normal successful cases
            await localGoogleSheets.updateAccountFeedback(rowIndex, 'Account Created Successfully');
            
            // Notify orchestration server that Medicare is complete
            await notifyOrchestrationServer({
                success: true,
                credentials: result.credentials || '',
                rowIndex: rowIndex,
                sheetName: sheetName,
                lastName: patientData.lastName,
                specialFeedback: false,
                feedbackMessage: result.message || null
            });
            
            return { success: true, credentials: result.credentials || '' };
            
        } else {
           // console.log(`❌ Account creation failed for ${patientData.lastName}: ${result.message}`);
            
            // 🆕 DEBUG: Log the complete result object to see what we're getting
            //console.log(`🔍 DEBUG - Complete result object:`, {
            //    success: result.success,
           //     stopWorkflow: result.stopWorkflow,
            //    feedbackType: result.feedbackType,
            //    message: result.message,
            //    type: result.type,
            //    unlockAttempted: result.unlockAttempted
            //});
            
            // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow and update lead status
            if (result.stopWorkflow && result.feedbackType === 'Wrong Info') {
               // console.log(`🛑 WRONG INFO detected for ${patientData.lastName} - stopping entire workflow`);
                
                // Update Lead Status to "Wrong Info" and set red background
                await localGoogleSheets.updateLeadStatusToWrongInfo(rowIndex, sheetName);
                
                // Notify orchestration server to stop workflow
                await notifyOrchestrationServer({
                    success: false,
                    stopWorkflow: true,
                    feedbackType: 'Wrong Info',
                    error: result.message,
                    rowIndex: rowIndex,
                    sheetName: sheetName,
                    lastName: patientData.lastName
                });
                
                return { 
                    success: false, 
                    stopWorkflow: true,
                    feedbackType: 'Wrong Info',
                    credentials: '', 
                    message: result.message 
                };
            }
            
            await localGoogleSheets.updateAccountFeedback(rowIndex, 'Account Creation Failed');
            
            // Notify orchestration server of failure
            await notifyOrchestrationServer({
                success: false,
                error: result.message,
                rowIndex: rowIndex,
                sheetName: sheetName,
                lastName: patientData.lastName
            });
            
            return { success: false, credentials: '', message: result.message };
        }

    } catch (error) {
       // console.error('❌ Error in patient processing:', error);
        
        await localGoogleSheets.updateAccountFeedback(rowIndex, 'Processing Error: ' + error.message);
        
        // Notify orchestration server about error
        await notifyOrchestrationServer({
            success: false,
            error: error.message,
            rowIndex: rowIndex,
            sheetName: sheetName,
            lastName: patientData.lastName
        });
        
        return { success: false, credentials: '', message: error.message };
    } finally {
        // Final cleanup - make sure browser is closed (LOCAL instance)
        if (localMedicareAutomation && localMedicareAutomation.browser) {
            try {
                if (localMedicareAutomation.browser.isConnected()) {
                   // console.log(`🔚 Final cleanup: Closing Chrome window for ${patientData.lastName}...`);
                    await localMedicareAutomation.browser.close();
                }
            } catch (cleanupError) {
               // console.error('Error in final cleanup:', cleanupError);
            }
        }
    }
}

// Concurrent version of processPatientData with proper cleanup
async function processPatientDataConcurrent(patientData, rowIndex, sheetName, requestId) {
  //  console.log(`🏥 [CONCURRENT] Processing patient: ${patientData.lastName} (Row ${rowIndex}, Sheet: ${sheetName}, Port: ${patientData.chromePort})`);
    
    try {
        // Call the main processing function
        const result = await processPatientData(patientData, rowIndex, sheetName);
        
       // console.log(`✅ [CONCURRENT] Completed processing for ${patientData.lastName} - Success: ${result.success}`);
        
        return result;
        
    } catch (error) {
       // console.error(`❌ [CONCURRENT] Error processing ${patientData.lastName}:`, error);
        throw error;
        
    } finally {
        // CRITICAL: Clean up active request tracking
        if (activeRequests.has(requestId)) {
            const requestInfo = activeRequests.get(requestId);
            const duration = new Date() - requestInfo.startTime;
           // console.log(`🧹 [CONCURRENT] Cleaning up request: ${requestId} (Duration: ${Math.round(duration/1000)}s)`);
            activeRequests.delete(requestId);
           // console.log(`📊 [CONCURRENT] Active requests remaining: ${activeRequests.size}/${maxConcurrentRequests}`);
        }
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    //console.log('\n🛑 Shutting down Medicare Account Creation Server...');
    
    // Note: Local instances will cleanup automatically via their finally blocks
   // console.log(`📊 Active requests being terminated: ${activeRequests.size}`);
    
    process.exit(0);
});

app.listen(port, () => {
    console.log(`🏥 Medicare Account Creation Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔗 Process Medicare: POST http://localhost:${port}/process-medicare`);
    console.log(`📋 Queue Status: GET http://localhost:${port}/queue-status`);
    console.log(`🔑 Account Status: GET http://localhost:${port}/account-status`);
});

// 📋 Account creation endpoint
app.post('/create-account', async (req, res) => {
    const startTime = Date.now();
    const { 
        patientData: { 
            lastName, 
            medId, 
            dob, 
            zipCode, 
            partBEligibility, 
            partAEligibility, 
            rowIndex, 
            sheetName 
        }, 
        chromePort,
        eligibilityType // This might be undefined for automatic detection
    } = req.body;
    
   // console.log(`\n🏥 Medicare account creation request for ${lastName}:`);
    //console.log(`   Row: ${rowIndex}, Sheet: ${sheetName}`);
   // console.log(`   MED ID: ${medId}, DOB: ${dob}, Zip: ${zipCode}`);
   // console.log(`   Part A Eligibility (AG): "${partAEligibility}"`);
   // console.log(`   Part B Eligibility (AH): "${partBEligibility}"`);
   // console.log(`   Chrome Port: ${chromePort}`);
   // console.log(`   Pre-selected eligibility type: ${eligibilityType || 'Not specified - will auto-detect'}`);
    
    let finalEligibilityType = eligibilityType;
    let autoDetectionReason = null;
    
    try {
        
        // 🆕 AUTO-DETECT ELIGIBILITY PATH if not provided
        if (!eligibilityType) {
            const GoogleSheetsService = require('./google-sheets-service.js');
            const tempGoogleSheets = new GoogleSheetsService();
            tempGoogleSheets.setSheetName(sheetName);
            
            const pathDetection = tempGoogleSheets.determineEligibilityPath(partAEligibility, partBEligibility);
            
           // console.log(`🎯 Medicare Server Path Detection:`);
           // console.log(`   Eligibility Type: ${pathDetection.eligibilityType}`);
           // console.log(`   Reason: ${pathDetection.reason}`);
           // console.log(`   Has Data: ${pathDetection.hasData}`);
            
            // Handle missing data case
            if (!pathDetection.hasData) {
               // console.log(`❌ MISSING ELIGIBILITY DATA for ${lastName} - Setting Lead Status to "Missing Part A or B"`);
                
                await tempGoogleSheets.updateLeadStatusMissingEligibility(rowIndex);
                
                return res.json({
                    success: false,
                    error: `Missing eligibility data for ${lastName} - both Part A and Part B are empty`,
                    reason: 'Missing Part A or B',
                    skipProcessing: true,
                    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
                });
            }
            
            finalEligibilityType = pathDetection.eligibilityType;
            autoDetectionReason = pathDetection.reason;
        }
        
       // console.log(`🎯 Final Eligibility Type: ${finalEligibilityType}`);
        if (autoDetectionReason) {
           // console.log(`🤖 Auto-detection reason: ${autoDetectionReason}`);
        }
        
        // 🔑 GENERATE USERNAME AND PASSWORD (was missing!)
        const randomNumber = Math.floor(Math.random() * 10); // Single digit 0-9
        const randomPassword = Math.floor(10000000 + Math.random() * 90000000); // 8 digit random number
        const username = `${lastName}@Larry${randomNumber}`;
        const password = `larry@${randomPassword}!@`;
        
        //console.log(`🔑 Generated credentials for ${lastName}: ${username} // ${password}`);
        
        // Create Medicare automation instance with final eligibility type
        const localMedicareAutomation = new MedicareAutomation(sheetName, chromePort, finalEligibilityType);
        
        const patient = {
            lastName,
            medId,
            dob,
            zipCode: zipCode,
            partAEligibility: partAEligibility || '',
            partBEligibility: partBEligibility || '',
            address: zipCode,
            rowIndex,
            username,
            password
        };
        
        //console.log(`🚀 Starting Medicare automation for ${lastName} with ${finalEligibilityType}...`);
        
        await localMedicareAutomation.initialize();
        await localMedicareAutomation.navigateToMedicareCreateAccount();
        
        const result = await localMedicareAutomation.fillInitialAccountInfo(patient);
        
        await localMedicareAutomation.browser.close();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (result.success) {
            //console.log(`✅ Medicare account creation SUCCESS for ${lastName} (${duration}s) using ${finalEligibilityType}`);
            if (autoDetectionReason) {
               // console.log(`   🤖 Auto-detection reason: ${autoDetectionReason}`);
            }
           // console.log(`   Result type: ${result.type}`);
           // console.log(`   Credentials: ${result.credentials}`);
            
            res.json({
                success: true,
                result: result,
                eligibilityType: finalEligibilityType,
                autoDetected: !!autoDetectionReason,
                autoDetectionReason: autoDetectionReason,
                duration: `${duration}s`
            });
        } else {
           // console.log(`❌ Medicare account creation FAILED for ${lastName} (${duration}s): ${result.message}`);
            
            res.json({
                success: false,
                error: result.message,
                eligibilityType: finalEligibilityType,
                autoDetected: !!autoDetectionReason,
                autoDetectionReason: autoDetectionReason,
                stopWorkflow: result.stopWorkflow || false,
                feedbackType: result.feedbackType || '',
                duration: `${duration}s`
            });
        }
        
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
       // console.error(`❌ Medicare automation error for ${lastName} (${duration}s):`, error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            eligibilityType: finalEligibilityType || 'Unknown',
            duration: `${duration}s`
        });
    }
}); 
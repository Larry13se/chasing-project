const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.ORCHESTRATION_PORT || 3003;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle URL-encoded payloads from Google Script

// Local Server URLs (always localhost since they're local)
const MEDICARE_SERVER_URL = 'http://localhost:3001';
const DOCTOR_SERVER_URL = 'http://localhost:3002';
const FORM_SERVER_URL = 'http://localhost:5000';

// Active workflows tracking
const activeWorkflows = new Map();

// =============================================================================
// CONTINUOUS QUEUE SYSTEM - Always listening for leads
// =============================================================================
const leadQueue = [];
const processingStatus = {
    isProcessing: false,
    currentLead: null,
    currentStep: null,
    lastProcessed: null,
    totalProcessed: 0,
    errors: 0
};

// Queue processing: Each lead goes through 3 sequential steps
// Step 1: Medicare Account Creation
// Step 2: Doctor Fetching  
// Step 3: Form Submission

// Storage for Medicare completion results
const medicareCompletionResults = {};

console.log('🎯 Orchestration Gateway Server Starting...');
console.log(`🏥 Medicare Server: ${MEDICARE_SERVER_URL}`);
console.log(`👨‍⚕️ Doctor Server: ${DOCTOR_SERVER_URL}`);
console.log(`📝 Form Server: ${FORM_SERVER_URL}`);
console.log('🔄 Continuous queue system: ENABLED');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'Orchestration Gateway Server',
        version: '2.0.0',
        activeWorkflows: activeWorkflows.size,
        queueSystem: {
            queueLength: leadQueue.length,
            isProcessing: processingStatus.isProcessing,
            currentLead: processingStatus.currentLead,
            currentStep: processingStatus.currentStep,
            totalProcessed: processingStatus.totalProcessed,
            errors: processingStatus.errors
        },
        localServers: {
            medicare: MEDICARE_SERVER_URL,
            doctor: DOCTOR_SERVER_URL,
            form: FORM_SERVER_URL
        }
    });
});

// =============================================================================
// QUEUE MANAGEMENT ENDPOINTS
// =============================================================================

// Add lead to queue (called when OnEdit conditions are met)
app.post('/queue/add-lead', async (req, res) => {
    const { rowIndex, sheetName, lastName, medId, dob, zipCode, partBEligibility } = req.body;
    
    if (!rowIndex || !sheetName || !lastName) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: rowIndex, sheetName, lastName'
        });
    }
    
    // 🆕 CHECK FOR VERIFIED CGM STATUS - BYPASS QUEUE AND SUBMIT DIRECTLY
    try {
        const headers = await getSheetHeaders(sheetName);
        const statusCol = headers.indexOf("Status");
        
        if (statusCol >= 0) {
            const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
            const googleSheets = new GoogleSheetsService();
            await googleSheets.initialize();
            
            const columnLetter = getColumnLetter(statusCol);
            const statusResponse = await googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${sheetName}'!${columnLetter}${rowIndex}`
            });
            
            const statusValue = statusResponse.data.values && statusResponse.data.values[0] && statusResponse.data.values[0][0];
            
            if (statusValue && statusValue.trim().toUpperCase() === "VERIFIED CGM") {
                console.log(`🎯 VERIFIED CGM detected for ${lastName} - BYPASSING QUEUE, submitting directly to CGM form`);
                
                // Set Lead Status to "Processing" immediately
                await setLeadStatus(rowIndex, sheetName, "Processing");
                console.log(`✅ Set Lead Status to "Processing" for VERIFIED CGM: ${lastName} (Row ${rowIndex})`);
                
                // Submit directly to CGM form (bypass all other steps)
                console.log(`📝 Submitting VERIFIED CGM directly to form for ${lastName}...`);
                const formResult = await callFormSubmissionServer(rowIndex, sheetName, false, lastName, true); // true = isCGM
                
                if (formResult.success) {
                    console.log(`🎉 VERIFIED CGM form submission successful for ${lastName}`);
                    await setLeadStatus(rowIndex, sheetName, "Submitted");
                    await addSubmissionDateTime(rowIndex, sheetName);
                    
                    return res.json({
                        success: true,
                        message: `VERIFIED CGM lead ${lastName} submitted directly to CGM form - BYPASSED QUEUE`,
                        type: 'verified_cgm_direct_submit',
                        formResult: formResult
                    });
                } else {
                    console.log(`❌ VERIFIED CGM form submission failed for ${lastName}: ${formResult.error}`);
                    await setLeadStatus(rowIndex, sheetName, "Failed to Submit");
                    
                    return res.json({
                        success: false,
                        message: `VERIFIED CGM lead ${lastName} form submission failed - BYPASSED QUEUE`,
                        type: 'verified_cgm_direct_submit_failed',
                        error: formResult.error
                    });
                }
            }
        }
    } catch (error) {
        console.log(`⚠️ Error checking VERIFIED CGM status for ${lastName}: ${error.message}`);
        // Continue with normal queue processing if status check fails
    }
    
    const lead = {
        id: `${sheetName}_${rowIndex}_${Date.now()}`,
        rowIndex,
        sheetName,
        lastName,
        medId,
        dob,
        zipCode,
        partBEligibility,
        addedAt: new Date().toISOString(),
        status: 'queued',
        currentStep: 'queued'
    };
    
    // Check if lead already exists in queue
    const existingLead = leadQueue.find(l => l.rowIndex === rowIndex && l.sheetName === sheetName);
    if (existingLead) {
        console.log(`⚠️ Lead ${lastName} (Row ${rowIndex}) already in queue, updating...`);
        Object.assign(existingLead, lead);
    } else {
        leadQueue.push(lead);
        console.log(`➕ Added lead to queue: ${lastName} (Row ${rowIndex}) - Queue length: ${leadQueue.length}`);
        
        // Set Lead Status to "In Queue" when added to orchestration queue
        try {
            await setLeadStatus(rowIndex, sheetName, 'In Queue');
            console.log(`✅ Set Lead Status to "In Queue" for ${lastName} (Row ${rowIndex})`);
        } catch (error) {
            console.log(`⚠️ Could not update Lead Status to "In Queue": ${error.message}`);
        }
    }
    
    // Start processing immediately if not already processing
    processQueueImmediately();
    
    res.json({
        success: true,
        message: `Lead ${lastName} added to processing queue`,
        queuePosition: leadQueue.length,
        leadId: lead.id
    });
});

// Queue status endpoint
app.get('/queue/status', (req, res) => {
    res.json({
        queueLength: leadQueue.length,
        isProcessing: processingStatus.isProcessing,
        currentLead: processingStatus.currentLead,
        currentStep: processingStatus.currentStep,
        totalProcessed: processingStatus.totalProcessed,
        errors: processingStatus.errors,
        lastProcessed: processingStatus.lastProcessed,
        upcomingLeads: leadQueue.slice(0, 5).map(lead => ({
            id: lead.id,
            lastName: lead.lastName,
            rowIndex: lead.rowIndex,
            sheetName: lead.sheetName,
            addedAt: lead.addedAt,
            currentStep: lead.currentStep
        }))
    });
});

// =============================================================================
// PROXY ENDPOINTS (for Google Sheets compatibility with existing script)
// =============================================================================

// Medicare proxy endpoint - routes to local Medicare server
app.post('/process-medicare', async (req, res) => {
    console.log(`🏥 Proxying Medicare request to local server...`);
    
    try {
        const response = await fetch(`${MEDICARE_SERVER_URL}/process-medicare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const result = await response.json();
        console.log(`✅ Medicare server responded: ${result.message}`);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Medicare proxy error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: `Medicare server connection error: ${error.message}`
        });
    }
});

// Doctor proxy endpoint - routes to local Doctor server  
app.post('/fetch-doctors', async (req, res) => {
    console.log(`👨‍⚕️ Proxying Doctor request to local server...`);
    
    try {
        const response = await fetch(`${DOCTOR_SERVER_URL}/fetch-doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const result = await response.json();
        console.log(`✅ Doctor server responded: ${result.message}`);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Doctor proxy error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: `Doctor server connection error: ${error.message}`
        });
    }
});

// Form proxy endpoint - routes to local Form server
app.post('/submit-form', async (req, res) => {
    console.log(`📝 Proxying Form request to local server...`);
    
    try {
        const response = await fetch(`${FORM_SERVER_URL}/submit-form`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const result = await response.json();
        console.log(`✅ Form server responded: ${result.message}`);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Form proxy error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: `Form server connection error: ${error.message}`
        });
    }
});

// 🆕 Additional form proxy endpoint with /form-proxy/ prefix
app.post('/form-proxy/submit-form', async (req, res) => {
    console.log(`📝 Proxying Form request via form-proxy to local server...`);
    
    try {
        const response = await fetch(`${FORM_SERVER_URL}/submit-form`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const result = await response.json();
        console.log(`✅ Form server responded: ${result.message}`);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Form proxy error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: `Form server connection error: ${error.message}`
        });
    }
});

// Queue status proxy endpoints
app.get('/queue-status', async (req, res) => {
    try {
        const [medicareRes, doctorRes] = await Promise.all([
            fetch(`${MEDICARE_SERVER_URL}/queue-status`).then(r => r.json()).catch(() => ({ error: 'Medicare server offline' })),
            fetch(`${DOCTOR_SERVER_URL}/queue-status`).then(r => r.json()).catch(() => ({ error: 'Doctor server offline' }))
        ]);
        
        res.json({
            medicare: medicareRes,
            doctor: doctorRes,
            gateway: {
                activeWorkflows: activeWorkflows.size,
                status: 'healthy'
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Account status proxy
app.get('/account-status', async (req, res) => {
    try {
        const response = await fetch(`${MEDICARE_SERVER_URL}/account-status`);
        const result = await response.json();
        res.json(result);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Medicare server connection error: ${error.message}`
        });
    }
});

// =============================================================================
// GOOGLE SHEETS API ENDPOINTS (These are called directly from Google Sheets)
// =============================================================================

// Main endpoint that Google Sheets calls to start the complete automation
app.post('/start-automation', async (req, res) => {
    try {
        const { 
            lastName, 
            medId, 
            dob, 
            zipCode, 
            address, 
            partBEligibility, 
            rowIndex,
            sheetName 
        } = req.body;

        console.log(`🎯 Google Sheets triggered automation for ${lastName} (Row ${rowIndex})`);

        // Validate required data
        if (!lastName || !medId || !dob || !rowIndex) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: lastName, medId, dob, or rowIndex'
            });
        }

        // Check if workflow already exists for this row
        const workflowId = `${sheetName}_${rowIndex}`;
        if (activeWorkflows.has(workflowId)) {
            console.log(`⚠️ Workflow already active for ${workflowId}`);
            return res.json({
                success: true,
                message: 'Workflow already active',
                workflowId,
                status: activeWorkflows.get(workflowId).status
            });
        }

        // Create workflow tracking
        const workflow = {
            id: workflowId,
            rowIndex,
            sheetName,
            lastName,
            status: 'started',
            steps: {
                medicare: { status: 'pending', startTime: null, endTime: null },
                doctors: { status: 'pending', startTime: null, endTime: null },
                form: { status: 'pending', startTime: null, endTime: null }
            },
            startTime: new Date(),
            data: req.body
        };

        activeWorkflows.set(workflowId, workflow);

        // Start the workflow asynchronously
        processWorkflow(workflow);

        res.json({
            success: true,
            message: 'Automation workflow started',
            workflowId,
            status: 'started'
        });

    } catch (error) {
        console.error('❌ Error starting workflow:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint for Google Sheets to check workflow status
app.get('/workflow-status/:workflowId', (req, res) => {
    const { workflowId } = req.params;
    const workflow = activeWorkflows.get(workflowId);
    
    if (!workflow) {
        return res.status(404).json({
            success: false,
            error: 'Workflow not found'
        });
    }

    res.json({
        success: true,
        workflow: {
            id: workflow.id,
            status: workflow.status,
            steps: workflow.steps,
            startTime: workflow.startTime,
            endTime: workflow.endTime || null,
            credentials: workflow.credentials || null,
            hasDoctors: workflow.hasDoctors || false
        }
    });
});

// Endpoint for Google Sheets to get credentials (when Medicare completes)
app.get('/credentials/:workflowId', (req, res) => {
    const { workflowId } = req.params;
    const workflow = activeWorkflows.get(workflowId);
    
    if (!workflow) {
        return res.status(404).json({
            success: false,
            error: 'Workflow not found'
        });
    }

    res.json({
        success: true,
        workflowId,
        credentials: workflow.credentials || null,
        medicareStatus: workflow.steps.medicare.status
    });
});

// Get all active workflows
app.get('/active-workflows', (req, res) => {
    const workflows = Array.from(activeWorkflows.values()).map(w => ({
        id: w.id,
        rowIndex: w.rowIndex,
        sheetName: w.sheetName,
        lastName: w.lastName,
        status: w.status,
        startTime: w.startTime
    }));

    res.json({
        success: true,
        count: workflows.length,
        workflows
    });
});

// =============================================================================
// WORKFLOW PROCESSING (Internal coordination with local servers)
// =============================================================================

// Process the complete workflow
async function processWorkflow(workflow) {
    console.log(`🎯 Processing workflow: ${workflow.id}`);
    
    try {
        // STEP 1: Medicare Account Creation
        console.log(`🏥 Step 1: Starting Medicare Account Creation for ${workflow.lastName}`);
        workflow.steps.medicare.status = 'running';
        workflow.steps.medicare.startTime = new Date();
        
        const medicareResult = await callMedicareServer(workflow.data);
        
        if (medicareResult.success) {
            console.log(`✅ Medicare account creation successful for ${workflow.lastName}`);
            workflow.steps.medicare.status = 'completed';
            workflow.steps.medicare.endTime = new Date();
            workflow.credentials = medicareResult.credentials;
            
            // STEP 2: Doctor Fetching
            console.log(`👨‍⚕️ Step 2: Starting Doctor Fetching for ${workflow.lastName}`);
            workflow.steps.doctors.status = 'running';
            workflow.steps.doctors.startTime = new Date();
            
            const doctorResult = await callDoctorServer(workflow, medicareResult.credentials);
            
            if (doctorResult.success) {
                console.log(`✅ Doctor fetching successful for ${workflow.lastName}`);
                workflow.steps.doctors.status = 'completed';
                workflow.steps.doctors.endTime = new Date();
                workflow.hasDoctors = doctorResult.hasDoctors;
            } else {
                console.log(`⚠️ Doctor fetching failed for ${workflow.lastName}: ${doctorResult.message}`);
                workflow.steps.doctors.status = 'failed';
                workflow.steps.doctors.endTime = new Date();
                workflow.steps.doctors.error = doctorResult.message;
                workflow.hasDoctors = false;
            }
            
        } else {
            console.log(`❌ Medicare account creation failed for ${workflow.lastName}: ${medicareResult.message}`);
            workflow.steps.medicare.status = 'failed';
            workflow.steps.medicare.endTime = new Date();
            workflow.steps.medicare.error = medicareResult.message;
            
            // Skip doctor fetching, but still proceed to form submission
            workflow.steps.doctors.status = 'skipped';
            workflow.hasDoctors = false;
        }
        
        // STEP 3: Form Submission (always happens)
        console.log(`📝 Step 3: Starting Form Submission for ${workflow.lastName}`);
        workflow.steps.form.status = 'running';
        workflow.steps.form.startTime = new Date();
        
        const hasDoctors = workflow.hasDoctors || false;
        const formResult = await callFormServerForWorkflow(workflow, hasDoctors);
        
        if (formResult.success) {
            console.log(`✅ Form submission successful for ${workflow.lastName}`);
            workflow.steps.form.status = 'completed';
            workflow.steps.form.endTime = new Date();
            workflow.status = 'completed';
        } else {
            console.log(`❌ Form submission failed for ${workflow.lastName}: ${formResult.message}`);
            workflow.steps.form.status = 'failed';
            workflow.steps.form.endTime = new Date();
            workflow.steps.form.error = formResult.message;
            workflow.status = 'failed';
        }
        
        workflow.endTime = new Date();
        
        console.log(`🎉 Workflow completed for ${workflow.lastName}: ${workflow.status}`);
        
        // Clean up completed workflow after some time
        setTimeout(() => {
            activeWorkflows.delete(workflow.id);
            console.log(`🧹 Cleaned up workflow: ${workflow.id}`);
        }, 300000); // 5 minutes
        
    } catch (error) {
        console.error(`❌ Error in workflow ${workflow.id}:`, error);
        workflow.status = 'error';
        workflow.error = error.message;
        workflow.endTime = new Date();
    }
}

// =============================================================================
// LOCAL SERVER COMMUNICATION
// =============================================================================

// Call Medicare Account Creation Server (Local)
async function callMedicareServer(data) {
    console.log(`🏥 Calling local Medicare Server for ${data.lastName}...`);
    
    try {
        const response = await fetch(`${MEDICARE_SERVER_URL}/process-medicare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Medicare server responded: ${result.message}`);
            
            // Wait for Medicare completion
            const credentials = await waitForMedicareCompletion(data.rowIndex);
            
            if (credentials) {
                return { success: true, credentials, message: 'Account created successfully' };
            } else {
                return { success: false, message: 'Account creation timed out or failed' };
            }
        } else {
            const error = await response.text();
            return { success: false, message: `Medicare server error: ${error}` };
        }
    } catch (error) {
        return { success: false, message: `Medicare server connection error: ${error.message}` };
    }
}

// Call Doctor Fetching Server (Local)
async function callDoctorServer(workflow, credentials) {
    console.log(`👨‍⚕️ Calling local Doctor Server for ${workflow.lastName}...`);
    
    try {
        const doctorData = {
            lastName: workflow.lastName,
            credentials: credentials,
            rowIndex: workflow.rowIndex,
            sheetName: workflow.sheetName
        };
        
        const response = await fetch(`${DOCTOR_SERVER_URL}/fetch-doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doctorData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Doctor server responded: ${result.message}`);
            
            // Wait for Doctor completion
            const hasDoctors = await waitForDoctorCompletion(workflow.rowIndex);
            
            return { success: true, hasDoctors, message: 'Doctor fetching completed' };
        } else {
            const error = await response.text();
            return { success: false, message: `Doctor server error: ${error}` };
        }
    } catch (error) {
        return { success: false, message: `Doctor server connection error: ${error.message}` };
    }
}

// Call Form Submission Server directly (since Doctor server will handle sheet updates)
async function callFormServerForWorkflow(workflow, hasDoctors) {
    console.log(`📝 Form submission will be handled by Doctor Server for ${workflow.lastName}`);
    
    // Since the doctor server already calls the form server and updates the sheet,
    // we just need to wait for it to complete
    await new Promise(resolve => setTimeout(resolve, 5000)); // Give it time
    
    return { success: true, message: 'Form submission handled by Doctor Server' };
}

// =============================================================================
// WAITING FUNCTIONS
// =============================================================================

// Wait for Medicare account creation completion
async function waitForMedicareCompletion(rowIndex) {
    console.log(`⏳ Waiting for Medicare completion for row ${rowIndex}...`);
    
    const maxAttempts = 30; // 5 minutes (30 * 10 seconds)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        // First check if we have a stored completion result
        if (medicareCompletionResults[rowIndex]) {
            const result = medicareCompletionResults[rowIndex];
            
            console.log(`🔍 Found Medicare completion result for row ${rowIndex}:`, {
                success: result.success,
                stopWorkflow: result.stopWorkflow,
                feedbackType: result.feedbackType,
                error: result.error
            });
            
            // Clean up the stored result
            delete medicareCompletionResults[rowIndex];
            
            // 🆕 HANDLE "WRONG INFO" FEEDBACK: Return special indicator
            if (result.stopWorkflow && result.feedbackType === 'Wrong Info') {
                console.log(`🛑 Wrong Info detected - stopping workflow for row ${rowIndex}`);
                return { 
                    success: false, 
                    stopWorkflow: true, 
                    feedbackType: 'Wrong Info',
                    error: result.error 
                };
            }
            
            if (result.success) {
                // 🆕 FIX: For special feedback cases, return the complete object
                if (result.specialFeedback) {
                    console.log(`✅ Medicare completion with special feedback detected: ${result.feedbackMessage}`);
                    return result; // Return complete object so specialFeedback info is preserved
                } else {
                    console.log(`✅ Medicare completion detected from notification: ${result.credentials}`);
                    return result.credentials; // Normal case - return just credentials
                }
            } else {
                console.log(`❌ Medicare failed: ${result.error}`);
                return null;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
        
        console.log(`🔍 Medicare check ${attempts}/${maxAttempts}...`);
    }
    
    console.log(`⏰ Medicare completion timeout`);
    return null;
}

// Wait for Doctor fetching completion
async function waitForDoctorCompletion(rowIndex) {
    console.log(`⏳ Waiting for Doctor completion for row ${rowIndex}...`);
    
    const maxAttempts = 20; // 5 minutes (20 * 15 seconds)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
        attempts++;
        
        try {
            const response = await fetch(`${DOCTOR_SERVER_URL}/queue-status`);
            if (response.ok) {
                const status = await response.json();
                
                // Check if our row is still being processed
                const isStillInQueue = status.requests.some(r => r.rowIndex === rowIndex);
                
                if (!isStillInQueue && !status.isProcessing) {
                    console.log(`✅ Doctor completion detected`);
                    return true;
                }
            }
        } catch (error) {
            console.log(`⚠️ Error checking Doctor status: ${error.message}`);
        }
        
        console.log(`🔍 Doctor check ${attempts}/${maxAttempts}...`);
    }
    
    console.log(`⏰ Doctor completion timeout`);
    return false;
}

// =============================================================================
// FORM SUBMISSION HELPER FUNCTIONS
// =============================================================================

// Helper function to convert column index to letter(s) for Google Sheets API
function getColumnLetter(columnNumber) {
    let result = '';
    while (columnNumber > 0) {
        columnNumber--;
        result = String.fromCharCode(65 + (columnNumber % 26)) + result;
        columnNumber = Math.floor(columnNumber / 26);
    }
    return result;
}

// Function to call Form Submission Server after doctor fetching completes
async function callFormSubmissionServer(rowIndex, sheetName, hasDoctors, lastName, isCGM = false) {
    console.log(`📝 Preparing form submission for ${lastName} (Row ${rowIndex}, Has doctors: ${hasDoctors}, Force CGM: ${isCGM})`);
    
    try {
        // We need to access Google Sheets to get patient data and prepare form submission
        // Import the Google Sheets service from the doctor server's module
        const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
        const googleSheets = new GoogleSheetsService();
        
        // Initialize Google Sheets service
        await googleSheets.initialize();
        
        // Get sheet data to prepare form submission
        const headersResponse = await googleSheets.sheets.spreadsheets.values.get({
            spreadsheetId: googleSheets.spreadsheetId,
            range: `'${sheetName}'!1:1` // Headers are in row 1 for ICO SUBMISSION ENGINE
        });
        const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
        
        const dataResponse = await googleSheets.sheets.spreadsheets.values.get({
            spreadsheetId: googleSheets.spreadsheetId,
            range: `'${sheetName}'!${rowIndex}:${rowIndex}`
        });
        const data = dataResponse.data.values ? dataResponse.data.values[0] : [];
        
        // Safe getter function - fill blank fields with "..."
        const get = (columnName) => {
            const i = headers.indexOf(columnName);
            const val = i >= 0 ? data[i] : "";
            return (val === "" || val === undefined) ? "..." : String(val).trim();
        };
        
        // 🆕 SMART GETTER FOR DOCTOR INFO - Try multiple column names
        const getDoctorInfo = () => {
            // Try multiple possible column names for doctor info
            const possibleNames = [
                "Doctor Info (Name/Address/Phone/Fax/NPI/Speciality)",
                "CLOSER COMMENT",
                "Doctor Info",
                "Closer Comment"
            ];
            
            for (const name of possibleNames) {
                const value = get(name);
                if (value !== "...") {
                    console.log(`✅ Found doctor info in column: "${name}" - Value: "${value.substring(0, 50)}..."`);
                    return value;
                }
            }
            
            console.log(`⚠️ No doctor info found in any of these columns: ${possibleNames.join(', ')}`);
            console.log(`📋 Available headers (first 20): ${headers.slice(0, 20).join(', ')}`);
            return "........";
        };
        
        // Determine SITE based on sheet name
        const siteValue = sheetName === "INCALL_1_RESPONSE" ? "Site One" : "Site Two";
        
        // Check if this is a CGM device (either forced by VERIFIED CGM or by device type)
        const requestedDevice = get("REQUESTED Device "); // 🔧 REVERTED: Back to simple getter
        const isCGMDevice = isCGM || String(requestedDevice).trim().toUpperCase() === "CGM DEVICE";
        
        let formType, basePayload;

        if (isCGMDevice) {
            // CGM Form data (same regardless of doctors)
            formType = "cgm";
            basePayload = {
                "entry.1152696541": get("SNS RESULT *As It Sent to You In The Group*"),
                "entry.853459889": get("PT First Name"),
                "entry.2055051812": get("PT Last Name"),
                "entry.2144389945": get("PT PHONE NUMBER"),
                "entry.1977666841": get("PT Street Address"),
                "entry.84029256": get("PT City"),
                "entry.472318100": get("PT State"),
                "entry.1039112181": get("PT Zip Code"),
                "entry.1410978985": get("DATE OF BIRTH"),
                "entry.698191178": get("MEDICARE ID"),
                "entry.357870924": get("Height"),
                "entry.1038328218": get("Weight"),
                "entry.531597245": get("Shoe Size"),
                "entry.665078034": get("Gender"),
                "entry.1926140785": getDoctorInfo(),
                "entry.215461184": get("Agent's Name") || "Default Agent",
                "entry.1743984726": get("CLOSER NAME") || "Default Closer", // May be required for CGM too
                "entry.1179142597": siteValue,
                "entry.1273829445": get("Credentials") || "No credentials available" // 🆕 SUBMIT CREDENTIALS IN COMMENT FIELD
            };
        } else {
            // Regular Braces Form data
            formType = "braces";
            
            let doctorEntries;
            
            // 🆕 FIRST DOCTOR: Put in CLOSER COMMENT field in Google Sheets AND DR1 in form
            let firstDoctorInfo = "........";
            
            if (hasDoctors) {
                // Get Doctor Info from columns BN–BV (columns 66–74) for doctors 2-10
                const doctorInfoResponse = await googleSheets.sheets.spreadsheets.values.get({
                    spreadsheetId: googleSheets.spreadsheetId,
                    range: `'${sheetName}'!BN${rowIndex}:BV${rowIndex}`
                });
                const doctorInfoValues = doctorInfoResponse.data.values ? doctorInfoResponse.data.values[0] : [];
                
                // 🔍 DEBUG: Show what's actually in the Dr 2-10 Info columns
                console.log(`🔍 DEBUG - Dr 2-10 Info values read from sheet:`, doctorInfoValues);
                console.log(`🔍 DEBUG - Dr 2 Info (BN column) value: "${doctorInfoValues[0] || 'EMPTY'}"`);
                console.log(`🔍 DEBUG - Range read: BN${rowIndex}:BV${rowIndex}`);
                
                // 🆕 DO NOT UPDATE CLOSER COMMENT - Keep original closer comment intact
                // Only use fetched doctors for DR2+ positions in form
                
                // 🆕 FIXED DOCTOR POSITIONING: DR1 = CLOSER COMMENT (original), DR2+ = Fetched Doctors
                doctorEntries = {
                    "entry.798980565": getDoctorInfo(),
                    "entry.509267999": doctorInfoValues[0] || "........", // Dr 2: First fetched doctor (BN column)
                    "entry.910343639": doctorInfoValues[1] || "........", // Dr 3: Second fetched doctor (BO column)
                    "entry.201070902": doctorInfoValues[2] || "........", // Dr 4: Third fetched doctor (BP column)
                    "entry.1948116165": doctorInfoValues[3] || "........", // Dr 5: Fourth fetched doctor (BQ column)
                    "entry.84736707": doctorInfoValues[4] || "........", // Dr 6: Fifth fetched doctor (BR column)
                    "entry.1390847878": doctorInfoValues[5] || "........", // Dr 7: Sixth fetched doctor (BS column)
                    "entry.2082186628": doctorInfoValues[6] || "........", // Dr 8: Seventh fetched doctor (BT column)
                    "entry.1696174961": doctorInfoValues[7] || "........", // Dr 9: Eighth fetched doctor (BU column)
                    "entry.1784390417": doctorInfoValues[8] || "........" // Dr 10: Ninth fetched doctor (BV column)
                };
                
                // 🔍 DEBUG: Show what's going into the Dr 2 Info form field
                console.log(`🔍 DEBUG - Dr 2 Info form field (entry.509267999) will be: "${doctorEntries["entry.509267999"]}"`);
            } else {
                // No doctors found - but still check Dr 2-10 Info columns for special feedback
                console.log(`⚠️ No doctors found - checking Dr 2-10 Info columns for special feedback...`);
                
                // Get Doctor Info from columns BN–BV (columns 66–74) for doctors 2-10 even if no doctors
                const doctorInfoResponse = await googleSheets.sheets.spreadsheets.values.get({
                    spreadsheetId: googleSheets.spreadsheetId,
                    range: `'${sheetName}'!BN${rowIndex}:BV${rowIndex}`
                });
                const doctorInfoValues = doctorInfoResponse.data.values ? doctorInfoResponse.data.values[0] : [];
                
                // 🔍 DEBUG: Show what's actually in the Dr 2-10 Info columns (even without doctors)
                console.log(`🔍 DEBUG - Dr 2-10 Info values read from sheet (no doctors):`, doctorInfoValues);
                console.log(`🔍 DEBUG - Dr 2 Info (BN column) value: "${doctorInfoValues[0] || 'EMPTY'}"`);
                console.log(`🔍 DEBUG - Range read: BN${rowIndex}:BV${rowIndex}`);
                
                // Use whatever is in the Dr 2-10 Info columns (could be special feedback or dots)
                doctorEntries = {
                    "entry.798980565": getDoctorInfo(),
                    "entry.509267999": doctorInfoValues[0] || "........", // Dr 2: Read from sheet (could be special feedback)
                    "entry.910343639": doctorInfoValues[1] || "........", // Dr 3: Read from sheet
                    "entry.201070902": doctorInfoValues[2] || "........", // Dr 4: Read from sheet
                    "entry.1948116165": doctorInfoValues[3] || "........", // Dr 5: Read from sheet
                    "entry.84736707": doctorInfoValues[4] || "........", // Dr 6: Read from sheet
                    "entry.1390847878": doctorInfoValues[5] || "........", // Dr 7: Read from sheet
                    "entry.2082186628": doctorInfoValues[6] || "........", // Dr 8: Read from sheet
                    "entry.1696174961": doctorInfoValues[7] || "........", // Dr 9: Read from sheet
                    "entry.1784390417": doctorInfoValues[8] || "........" // Dr 10: Read from sheet
                };
                
                // 🔍 DEBUG: Show what's going into the Dr 2 Info form field (no doctors path)
                console.log(`🔍 DEBUG - Dr 2 Info form field (entry.509267999) will be: "${doctorEntries["entry.509267999"]}"`);
            }
            
            basePayload = {
                "entry.534497717": get("SNS RESULT *As It Sent to You In The Group*"),
                // Skip entry.987295788 here - we'll handle multiple braces separately
                "entry.311509461": get("PT First Name"),
                "entry.1954362581": get("PT Last Name"),
                "entry.647663825": get("PT PHONE NUMBER"),
                "entry.1025449182": get("PT Street Address"),
                "entry.1726047969": get("PT City"),
                "entry.1820794877": get("PT State"),
                "entry.438852095": get("PT Zip Code"),
                "entry.404360623": get("DATE OF BIRTH"),
                "entry.309323976": get("MEDICARE ID"),
                "entry.260318019": get("Height"),
                "entry.646279815": get("Weight"),
                "entry.1541531810": get("Waist Size"),
                "entry.1398739596": get("Shoe Size"),
                "entry.1411909225": get("Gender"),
                ...doctorEntries,
                "entry.1328348461": get("Agent's Name") || "Default Agent",
                "entry.1007839295": get("CLOSER NAME") || "Default Closer", // Use existing CLOSER NAME from sheet
                "entry.596336074": siteValue,
                "entry.1418374363": "Main",
                "entry.1700120138": get("Credentials") || "No credentials available" // 🆕 SUBMIT CREDENTIALS IN COMMENT FIELD
            };
        }

        // Add the requested device/braces field back to the payload
        if (requestedDevice && requestedDevice.trim() && requestedDevice !== "...") {
            basePayload["entry.987295788"] = requestedDevice.trim();
        } else {
            basePayload["entry.987295788"] = "...";
        }

        // Prepare form submission data
        const formSubmissionData = {
            form_type: formType,
            payload: basePayload
        };
        
        console.log(`📋 Submitting ${formType} form for ${lastName} with ${Object.keys(basePayload).length} fields`);
        console.log(`🔍 DEBUG - Form type being sent: ${formType}`);
        console.log(`🔍 DEBUG - isCGM flag: ${isCGM}`);
        console.log(`🔍 DEBUG - isCGMDevice: ${isCGMDevice}`);
        console.log(`🔍 DEBUG - Requested device value: "${requestedDevice}"`);
        console.log(`🔍 DEBUG - Device field in payload: "${basePayload['entry.987295788']}"`);
        console.log(`🔍 DEBUG - Doctor info field value: "${basePayload['entry.1926140785'] || basePayload['entry.798980565'] || 'NOT FOUND'}"`);
        console.log(`🔍 DEBUG - Sample payload fields:`, Object.keys(basePayload).slice(0, 5));
        console.log(`🔍 DEBUG - Sheet name: ${sheetName}`);
        console.log(`🔍 DEBUG - Site value: ${siteValue}`);

        // Call Form Submission Server directly
        const response = await fetch(`${FORM_SERVER_URL}/submit-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formSubmissionData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Form submitted for ${lastName}`);
            console.log(`🔍 DEBUG - Form server response:`, result);
            
            return { success: true, result };
        } else {
            const error = await response.text();
            console.log(`❌ Form submission failed for ${lastName}: ${response.status} - ${error}`);
            console.log(`🔍 DEBUG - Form type was: ${formType}`);
            
            return { success: false, error: `HTTP ${response.status}: ${error}` };
        }
        
    } catch (error) {
        console.error(`❌ Error calling Form Submission Server for ${lastName}:`, error);
        return { success: false, error: error.message };
    }
}

// =============================================================================
// WORKFLOW COORDINATION ENDPOINTS
// =============================================================================

// Medicare server calls this when account creation is complete
app.post('/medicare-complete', async (req, res) => {
    const { success, credentials, rowIndex, sheetName, lastName, stopWorkflow, feedbackType, specialFeedback, feedbackMessage } = req.body;
    
    console.log(`🏥 Medicare completion notification: ${lastName} (Row ${rowIndex}) - Success: ${success}`);
    
    // 🆕 HANDLE SPECIAL FEEDBACK CASES
    if (specialFeedback) {
        console.log(`📋 Special feedback detected for ${lastName}: ${feedbackMessage}`);
        console.log(`⏳ Adding delay to ensure Dr 2 Info is written to sheet before form submission...`);
    }
    
    // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
    if (stopWorkflow && feedbackType === 'Wrong Info') {
        console.log(`🛑 WRONG INFO detected for ${lastName} - workflow completely stopped`);
        console.log(`📋 Lead Status already updated to "Wrong Info" with red background`);
        
        // Store the "Wrong Info" result for queue processing
        medicareCompletionResults[rowIndex] = {
            success: false,
            stopWorkflow: true,
            feedbackType: 'Wrong Info',
            error: 'Wrong Info detected - workflow stopped',
            timestamp: Date.now()
        };
        
        console.log(`✅ Wrong Info result stored for row ${rowIndex} - main workflow will detect this`);
        
        // Send response to Medicare server
        res.json({ 
            success: true, 
            message: `Wrong Info detected - workflow stopped for ${lastName}`,
            rowIndex: rowIndex,
            sheetName: sheetName,
            workflowStopped: true
        });
        
        // DO NOT reset processing status here - let the main workflow handle it
        // The main workflow will detect the Wrong Info result and stop properly
        return;
    }
    
    // Store the completion result for the queue system to pick up
    // 🆕 FIXED: Handle special feedback cases (success=true, credentials='', specialFeedback=true)
    if (success && (credentials || specialFeedback)) {
        medicareCompletionResults[rowIndex] = {
            success: true,
            credentials: credentials || '', // Empty for special feedback cases
            timestamp: Date.now(),
            // 🆕 STORE SPECIAL FEEDBACK INFO
            specialFeedback: specialFeedback || false,
            feedbackMessage: feedbackMessage || null
        };
        console.log(`✅ Medicare completion stored for queue processing: ${lastName} - Credentials: ${credentials || 'EMPTY (Special feedback)'}`);
        if (specialFeedback) {
            console.log(`📋 Special feedback info stored: ${feedbackMessage}`);
        }
    } else {
        medicareCompletionResults[rowIndex] = {
            success: false,
            error: 'Medicare creation failed',
            timestamp: Date.now()
        };
        console.log(`❌ Medicare failure stored for queue processing: ${lastName}`);
    }
    
    res.json({ 
        success: true, 
        message: `Medicare completion notification received and stored`,
        rowIndex: rowIndex,
        sheetName: sheetName
    });
});

// Doctor server calls this when doctor fetching is complete
app.post('/doctor-complete', async (req, res) => {
    const { success, hasDoctors, rowIndex, sheetName, lastName } = req.body;
    
    console.log(`👨‍⚕️ Doctor completion notification: ${lastName} (Row ${rowIndex}) - Success: ${success}, Doctors: ${hasDoctors}`);
    
    res.json({ 
        success: true, 
        message: 'Doctor completion notification received' 
    });
    
    // Trigger form submission immediately after doctor completion
    if (success) {
        console.log(`📝 Triggering form submission for ${lastName}...`);
        
        // 🆕 CHECK FOR SPECIAL FEEDBACK CASES AND ADD DELAY
        let hasSpecialFeedback = false;
        if (medicareCompletionResults[rowIndex] && medicareCompletionResults[rowIndex].specialFeedback) {
            hasSpecialFeedback = true;
            console.log(`📋 Special feedback detected for ${lastName}: ${medicareCompletionResults[rowIndex].feedbackMessage}`);
            console.log(`⏳ Adding 5-second delay to ensure Dr 2 Info is fully written to sheet...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
            console.log(`✅ Delay complete - proceeding with form submission`);
        }
        
        try {
            const formSubmissionResult = await callFormSubmissionServer(rowIndex, sheetName, hasDoctors || false, lastName);
            
            if (formSubmissionResult.success) {
                console.log(`🎉 Complete workflow finished for ${lastName} - Doctors: ${hasDoctors ? 'Found' : 'Not Found'}`);
                if (hasSpecialFeedback) {
                    console.log(`📋 Special feedback case completed - Dr 2 Info should be in form submission`);
                }
                // 🆕 UPDATE LEAD STATUS TO "SUBMITTED" AND ADD TIMESTAMP - FINAL STEP
                await setLeadStatus(rowIndex, sheetName, "Submitted");
                await addSubmissionDateTime(rowIndex, sheetName);
            } else {
                console.log(`⚠️ Form submission failed for ${lastName}: ${formSubmissionResult.error}`);
                // 🆕 UPDATE LEAD STATUS TO "FAILED TO SUBMIT" - FINAL STEP
                await setLeadStatus(rowIndex, sheetName, "Failed to Submit");
            }
        } catch (error) {
            console.error(`❌ Error triggering form submission for ${lastName}:`, error);
            // 🆕 UPDATE LEAD STATUS TO "FAILED TO SUBMIT" ON ERROR - FINAL STEP
            await setLeadStatus(rowIndex, sheetName, "Failed to Submit");
        }
    } else {
        console.log(`❌ Doctor fetching failed for ${lastName}, triggering form submission without doctors`);
        
        // 🆕 CHECK FOR SPECIAL FEEDBACK CASES AND ADD DELAY (even without doctors)
        let hasSpecialFeedback = false;
        if (medicareCompletionResults[rowIndex] && medicareCompletionResults[rowIndex].specialFeedback) {
            hasSpecialFeedback = true;
            console.log(`📋 Special feedback detected for ${lastName}: ${medicareCompletionResults[rowIndex].feedbackMessage}`);
            console.log(`⏳ Adding 5-second delay to ensure Dr 2 Info is fully written to sheet...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
            console.log(`✅ Delay complete - proceeding with form submission without doctors`);
        }
        
        try {
            const formSubmissionResult = await callFormSubmissionServer(rowIndex, sheetName, false, lastName);
            console.log(`📝 Form submitted without doctors for ${lastName}: ${formSubmissionResult.success ? 'Success' : 'Failed'}`);
            
            if (formSubmissionResult.success) {
                if (hasSpecialFeedback) {
                    console.log(`📋 Special feedback case completed - Dr 2 Info should be in form submission`);
                }
                // 🆕 UPDATE LEAD STATUS TO "SUBMITTED" AND ADD TIMESTAMP - FINAL STEP
                await setLeadStatus(rowIndex, sheetName, "Submitted");
                await addSubmissionDateTime(rowIndex, sheetName);
            } else {
                // 🆕 UPDATE LEAD STATUS TO "FAILED TO SUBMIT" - FINAL STEP
                await setLeadStatus(rowIndex, sheetName, "Failed to Submit");
            }
        } catch (error) {
            console.error(`❌ Error triggering form submission without doctors for ${lastName}:`, error);
            // 🆕 UPDATE LEAD STATUS TO "FAILED TO SUBMIT" ON ERROR - FINAL STEP
            await setLeadStatus(rowIndex, sheetName, "Failed to Submit");
        }
    }
    
    // 🆕 CRITICAL: Reset processing status and trigger next queued lead
    console.log(`🔄 Workflow complete for ${lastName} - checking for next queued lead...`);
    processingStatus.isProcessing = false;
    processingStatus.currentLead = null;
    processingStatus.currentStep = null;
    
    // 🆕 CLEANUP: Remove Medicare completion result after use
    if (medicareCompletionResults[rowIndex]) {
        delete medicareCompletionResults[rowIndex];
        console.log(`🧹 Cleaned up Medicare completion result for row ${rowIndex}`);
    }
    
    // Process next lead in queue if any
    setTimeout(() => processQueueImmediately(), 2000); // Wait 2 seconds before processing next lead
});

// =============================================================================
// 3-STEP SEQUENTIAL WORKFLOW PROCESSING
// =============================================================================

// Process queue immediately when leads are added
async function processQueueImmediately() {
    if (processingStatus.isProcessing || leadQueue.length === 0) {
        return; // Already processing or no leads to process
    }
    
    processingStatus.isProcessing = true;
    const lead = leadQueue.shift(); // Get next lead from queue
    processingStatus.currentLead = {
        lastName: lead.lastName,
        rowIndex: lead.rowIndex,
        sheetName: lead.sheetName,
        startedAt: new Date().toISOString()
    };
    
    console.log(`\n🎯 Processing lead: ${lead.lastName} (Row ${lead.rowIndex})`);
    console.log(`📊 Queue remaining: ${leadQueue.length} leads`);
    
    try {
        // 🆕 SET LEAD STATUS TO "PROCESSING" AT START
        console.log(`📊 Setting Lead Status to "Processing" for ${lead.lastName}...`);
        await setLeadStatus(lead.rowIndex, lead.sheetName, "Processing");
        
        // 🆕 CHECK FOR BLANK PART A ELIGIBILITY AND SET RED BACKGROUND
        await setRedBackgroundForBlankPartA(lead.rowIndex, lead.sheetName);
        
        // 🆕 VALIDATE PART A ELIGIBILITY - STOP PROCESSING IF MISSING
        const headers = await getSheetHeaders(lead.sheetName);
        const partACol = headers.indexOf("Part A Eligibility Start Date");
        
        if (partACol >= 0) {
            const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
            const googleSheets = new GoogleSheetsService();
            await googleSheets.initialize();
            
            const columnLetter = getColumnLetter(partACol + 1); // +1 because getColumnLetter expects 1-based
            const partAResponse = await googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${lead.sheetName}'!${columnLetter}${lead.rowIndex}`
            });
            
            const partAValue = partAResponse.data.values && partAResponse.data.values[0] && partAResponse.data.values[0][0];
            
            if (!partAValue || partAValue.trim() === '') {
                console.log(`🛑 WORKFLOW STOPPED: Part A Eligibility Start Date is blank for ${lead.lastName} (Row ${lead.rowIndex})`);
                console.log(`🔴 Red background applied - NO SUBMISSION will be attempted`);
                
                // Set Lead Status to indicate the issue
                await setLeadStatus(lead.rowIndex, lead.sheetName, "Missing Part A Date");
                
                // Stop processing this lead
                processingStatus.isProcessing = false;
                processingStatus.currentLead = null;
                processingStatus.currentStep = null;
                
                // Process next lead if any
                setTimeout(() => processQueueImmediately(), 1000);
                return;
            } else {
                console.log(`✅ Part A Eligibility Start Date validated: "${partAValue}" - proceeding with workflow`);
            }
        } else {
            console.log(`⚠️ Part A Eligibility Start Date column not found - proceeding with workflow`);
        }
        
        // 🆕 CHECK FOR VERIFIED CGM STATUS - SKIP TO FORM SUBMISSION
        const statusCol = headers.indexOf("Status");
        
        if (statusCol >= 0) {
            const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
            const googleSheets = new GoogleSheetsService();
            await googleSheets.initialize();
            
            const columnLetter = getColumnLetter(statusCol);
            const statusResponse = await googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${lead.sheetName}'!${columnLetter}${lead.rowIndex}`
            });
            
            const statusValue = statusResponse.data.values && statusResponse.data.values[0] && statusResponse.data.values[0][0];
            
            if (statusValue && statusValue.trim().toUpperCase() === "VERIFIED CGM") {
                console.log(`🎯 VERIFIED CGM detected for ${lead.lastName} - skipping account creation and doctor fetching`);
                console.log(`📝 Going directly to CGM form submission...`);
                
                // Skip to form submission with CGM flag
                processingStatus.currentStep = 'form';
                const formResult = await triggerFormSubmission(lead, false, true); // true = isCGM
                
                console.log(`🏁 VERIFIED CGM workflow complete for ${lead.lastName}: ${formResult.success ? 'SUCCESS' : 'FAILED'}`);
                
                // 🆕 UPDATE LEAD STATUS BASED ON FORM SUBMISSION RESULT - FINAL STEP
                if (formResult.success) {
                    await setLeadStatus(lead.rowIndex, lead.sheetName, "Submitted");
                    await addSubmissionDateTime(lead.rowIndex, lead.sheetName);
                } else {
                    await setLeadStatus(lead.rowIndex, lead.sheetName, "Failed to Submit");
                }
                
                // Continue to next lead
                processingStatus.isProcessing = false;
                processingStatus.currentLead = null;
                processingStatus.currentStep = null;
                
                // Process next lead if any
                setTimeout(() => processQueueImmediately(), 1000);
                return;
            }
        }
        
        // Step 1: Medicare Account Creation
        console.log(`🏥 Step 1: Starting Medicare Account Creation for ${lead.lastName}...`);
        processingStatus.currentStep = 'medicare';
        const medicareResult = await triggerMedicareAccountCreation(lead);
        
        if (!medicareResult.success) {
            // 🆕 HANDLE "WRONG INFO" FEEDBACK: Stop workflow immediately
            if (medicareResult.stopWorkflow && medicareResult.feedbackType === 'Wrong Info') {
                console.log(`🛑 WRONG INFO detected for ${lead.lastName} - workflow completely stopped`);
                console.log(`📋 Lead Status already updated to "Wrong Info" with red background`);
                
                // Stop processing this lead - DO NOT proceed to form submission
                processingStatus.isProcessing = false;
                processingStatus.currentLead = null;
                processingStatus.currentStep = null;
                
                // Process next lead if any
                setTimeout(() => processQueueImmediately(), 1000);
                return;
            }
            
            // 🆕 IF ACCOUNT CREATION FAILS, SKIP DOCTORS AND GO TO FORM SUBMISSION
            console.log(`❌ Medicare account creation failed: ${medicareResult.error}`);
            console.log(`⏭️ Skipping doctor fetching, proceeding to form submission with "..." for doctors 2-10`);
            
            // Step 3: Form Submission without doctors
            console.log(`📝 Step 3: Starting Form Submission WITHOUT DOCTORS for ${lead.lastName}...`);
            processingStatus.currentStep = 'form';
            const formResult = await triggerFormSubmission(lead, false);
            
            console.log(`🏁 Workflow complete for ${lead.lastName}: ${formResult.success ? 'SUCCESS' : 'FAILED'}`);
            
            // 🆕 UPDATE LEAD STATUS BASED ON FORM SUBMISSION RESULT - FINAL STEP
            if (formResult.success) {
                await setLeadStatus(lead.rowIndex, lead.sheetName, "Submitted");
                await addSubmissionDateTime(lead.rowIndex, lead.sheetName);
            } else {
                await setLeadStatus(lead.rowIndex, lead.sheetName, "Failed to Submit");
            }
            
            // Continue to next lead
            processingStatus.isProcessing = false;
            processingStatus.currentLead = null;
            processingStatus.currentStep = null;
            
            // Process next lead if any
            setTimeout(() => processQueueImmediately(), 1000);
            return;
        }
        
        // 🆕 CHECK FOR SPECIAL FEEDBACK CASES - SKIP DOCTOR FETCHING
        if (medicareResult.specialFeedback) {
            console.log(`📋 Special feedback case detected for ${lead.lastName}: ${medicareResult.specialFeedback}`);
            console.log(`⏭️ Skipping doctor fetching - proceeding directly to form submission`);
            console.log(`📝 Dr 2 Info should already contain: ${medicareResult.specialFeedback} feedback`);
            
            // Skip doctor fetching and go directly to form submission
            processingStatus.currentStep = 'form';
            
            try {
                const formResult = await triggerFormSubmission(lead, false); // hasDoctors = false
                
                console.log(`🏁 Special feedback workflow complete for ${lead.lastName}: ${formResult.success ? 'SUCCESS' : 'FAILED'}`);
                
                if (formResult.success) {
                    console.log(`🎉 Special feedback case completed successfully`);
                    console.log(`📋 Form submitted with special feedback in Dr 2 Info`);
                    await setLeadStatus(lead.rowIndex, lead.sheetName, "Submitted");
                    await addSubmissionDateTime(lead.rowIndex, lead.sheetName);
                } else {
                    console.log(`❌ Form submission failed for special feedback case: ${formResult.error}`);
                    await setLeadStatus(lead.rowIndex, lead.sheetName, "Failed to Submit");
                }
            } catch (error) {
                console.error(`❌ Error in form submission for special feedback case ${lead.lastName}:`, error);
                await setLeadStatus(lead.rowIndex, lead.sheetName, "Failed to Submit");
            }
            
            // Continue to next lead
            processingStatus.isProcessing = false;
            processingStatus.currentLead = null;
            processingStatus.currentStep = null;
            
            // Process next lead if any
            setTimeout(() => processQueueImmediately(), 1000);
            return;
        }
        
        // Step 2: Doctor Fetching (only for non-special feedback cases)
        console.log(`👨‍⚕️ Step 2: Starting Doctor Fetching for ${lead.lastName}...`);
        processingStatus.currentStep = 'doctors';
        const doctorResult = await triggerDoctorFetching(lead, medicareResult);
        
        // Step 3: Form Submission
        // This happens in the doctor-complete endpoint
        
    } catch (error) {
        console.error(`❌ Error in workflow for ${lead.lastName}:`, error);
        
        // Set Lead Status to "Failed to Submit" on error
        await setLeadStatus(lead.rowIndex, lead.sheetName, "Failed to Submit");
        
        processingStatus.isProcessing = false;
        processingStatus.currentLead = null;
        processingStatus.currentStep = null;
        
        // Process next lead if any
        setTimeout(() => processQueueImmediately(), 1000);
    }
}

// Step 1: Medicare Account Creation
async function triggerMedicareAccountCreation(lead) {
    console.log(`🏥 Triggering Medicare account creation for ${lead.lastName}...`);
    
    try {
        const medicareData = {
            lastName: lead.lastName,
            medId: lead.medId,
            dob: lead.dob,
            zipCode: lead.zipCode,
            partBEligibility: lead.partBEligibility,
            firstName: lead.firstName || lead.lastName, // Fallback
            phoneNumber: lead.phoneNumber || '',
            address: lead.address || '',
            rowIndex: lead.rowIndex,
            sheetName: lead.sheetName
        };
        
        const response = await fetch(`${MEDICARE_SERVER_URL}/process-medicare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(medicareData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log(`✅ Medicare account creation started for ${lead.lastName}`);
            // Wait for Medicare process to fully complete (check for credentials)
            const credentials = await waitForMedicareCompletion(lead.rowIndex);
            
            // 🆕 HANDLE "WRONG INFO" RESPONSE
            if (credentials && typeof credentials === 'object' && credentials.stopWorkflow) {
                console.log(`🛑 Wrong Info detected for ${lead.lastName} - stopping workflow`);
                return { 
                    success: false, 
                    stopWorkflow: true, 
                    feedbackType: credentials.feedbackType,
                    error: credentials.error 
                };
            }
            
            if (credentials) {
                // 🆕 HANDLE SPECIAL FEEDBACK CASES: Check if credentials is actually a result object
                if (typeof credentials === 'object' && credentials.specialFeedback) {
                    console.log(`✅ Medicare special feedback case completed for ${lead.lastName} - Feedback: ${credentials.feedbackMessage}`);
                    return { success: true, credentials: credentials.credentials || '', specialFeedback: credentials.specialFeedback };
                } else {
                    console.log(`✅ Medicare account creation completed for ${lead.lastName} - Credentials: ${credentials}`);
                    return { success: true, credentials: credentials };
                }
            } else {
                console.log(`❌ Medicare account creation timed out for ${lead.lastName}`);
                return { success: false, error: 'Medicare completion timeout' };
            }
        } else {
            console.log(`❌ Medicare account creation failed for ${lead.lastName}: ${result.error}`);
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.error(`❌ Error in Medicare account creation for ${lead.lastName}:`, error);
        return { success: false, error: error.message };
    }
}

// Step 2: Doctor Fetching  
async function triggerDoctorFetching(lead, medicareResult) {
    console.log(`👨‍⚕️ Triggering doctor fetching for ${lead.lastName}...`);
    
    try {
        // Extract credentials from Medicare result
        const credentials = medicareResult.credentials || '';
        
        // Use credentials from Medicare step - empty credentials are OK for special feedback cases
        console.log(`🔑 Using credentials from Medicare step: ${credentials || 'EMPTY (Special feedback case)'}`);
        
        // 🆕 DIRECT CHECK FOR SPECIAL FEEDBACK CASES
        const isSpecialFeedbackCase = medicareResult.specialFeedback ? true : false;
        if (isSpecialFeedbackCase) {
            console.log(`📋 Special feedback case detected - proceeding with doctor fetching despite empty credentials`);
            console.log(`📋 Special feedback type: ${medicareResult.specialFeedback}`);
        }
        
        if (!credentials && !isSpecialFeedbackCase) {
            throw new Error('No credentials available from Medicare step');
        }
        
        const response = await fetch(`${DOCTOR_SERVER_URL}/fetch-doctors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lastName: lead.lastName,
                credentials: credentials,
                rowIndex: lead.rowIndex,
                sheetName: lead.sheetName
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log(`✅ Doctor fetching completed for ${lead.lastName}`);
            return { success: true, hasDoctors: result.hasDoctors || false };
        } else {
            console.log(`❌ Doctor fetching failed for ${lead.lastName}: ${result.error}`);
            return { success: false, hasDoctors: false, error: result.error };
        }
        
    } catch (error) {
        console.error(`❌ Error in doctor fetching for ${lead.lastName}:`, error);
        return { success: false, hasDoctors: false, error: error.message };
    }
}

// Step 3: Form Submission
async function triggerFormSubmission(lead, hasDoctors, isCGM) {
    console.log(`📝 Triggering form submission for ${lead.lastName}...`);
    
    try {
        const formResult = await callFormSubmissionServer(
            lead.rowIndex, 
            lead.sheetName, 
            hasDoctors, 
            lead.lastName,
            isCGM
        );
        
        if (formResult.success) {
            console.log(`✅ Form submission completed for ${lead.lastName}`);
        } else {
            console.log(`❌ Form submission failed for ${lead.lastName}: ${formResult.error}`);
        }
        
        return formResult;
        
    } catch (error) {
        console.error(`❌ Error in form submission for ${lead.lastName}:`, error);
        return { success: false, error: error.message };
    }
}

// Helper function to get patient credentials from Google Sheets
async function getPatientCredentials(rowIndex) {
    try {
        // This would normally call the Google Sheets API
        // For now, return a placeholder - the actual implementation would read from Column BI
        return "placeholder_credentials"; 
    } catch (error) {
        console.error('Error getting patient credentials:', error);
        return "";
    }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Orchestration Gateway Server...');
    
    // Log active workflows
    if (activeWorkflows.size > 0) {
        console.log(`⚠️ ${activeWorkflows.size} active workflows will be interrupted`);
    }
    
    process.exit(0);
});

app.listen(port, () => {
    console.log(`🎯 Orchestration Gateway Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🏥 Medicare Proxy: http://localhost:${port}/medicare-proxy/*`);
    console.log(`👨‍⚕️ Doctor Proxy: http://localhost:${port}/doctor-proxy/*`);
    console.log(`📝 Form Proxy: http://localhost:${port}/form-proxy/*`);
    console.log(`🔄 Queue Management: http://localhost:${port}/queue/status`);
    console.log(`➕ Add to Queue: POST http://localhost:${port}/queue/add-lead`);
    console.log(`🌐 3-Step Sequential Workflow: Medicare → Doctors → Form`);
    console.log(`📋 Each lead processes all 3 steps before next lead starts`);
});

// Helper function to get sheet headers
async function getSheetHeaders(sheetName) {
    try {
        const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
        const googleSheets = new GoogleSheetsService();
        await googleSheets.initialize();
        
        const headersResponse = await googleSheets.sheets.spreadsheets.values.get({
            spreadsheetId: googleSheets.spreadsheetId,
            range: `'${sheetName}'!1:1` // Headers are in row 1 for ICO SUBMISSION ENGINE
        });
        
        return headersResponse.data.values ? headersResponse.data.values[0] : [];
    } catch (error) {
        console.error(`❌ Error getting sheet headers:`, error);
        return [];
    }
}

// Helper function to set Lead Status in Google Sheet
async function setLeadStatus(rowIndex, sheetName, status) {
    try {
        const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
        const googleSheets = new GoogleSheetsService();
        await googleSheets.initialize();
        
        const headers = await getSheetHeaders(sheetName);
        let leadStatusCol = headers.indexOf("Lead Status");
        
        console.log(`🔍 DEBUG setLeadStatus: Looking for "Lead Status" column`);
        console.log(`🔍 Headers found: ${headers.slice(30, 40).join(', ')}`); // Show columns around AH-AI
        console.log(`🔍 Lead Status found at index: ${leadStatusCol}`);
        
        if (leadStatusCol >= 0) {
            const columnLetter = getColumnLetter(leadStatusCol + 1); // +1 because getColumnLetter expects 1-based
            console.log(`🔍 Updating column ${columnLetter} (index ${leadStatusCol}) with "${status}"`);
            
            await googleSheets.sheets.spreadsheets.values.update({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${sheetName}'!${columnLetter}${rowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [[status]] }
            });
            console.log(`✅ Set Lead Status to "${status}" for row ${rowIndex} in column ${columnLetter}`);
        } else {
            console.log(`⚠️ Lead Status column not found in sheet headers - using default column AI`);
            // Fallback to column AI (35th column, 1-based)
            await googleSheets.sheets.spreadsheets.values.update({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${sheetName}'!AI${rowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [[status]] }
            });
            console.log(`✅ Set Lead Status to "${status}" for row ${rowIndex} in fallback column AI`);
        }
    } catch (error) {
        console.error(`❌ Error setting Lead Status:`, error);
    }
}

// Helper function to add submission date/time
async function addSubmissionDateTime(rowIndex, sheetName) {
    try {
        const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
        const googleSheets = new GoogleSheetsService();
        await googleSheets.initialize();
        
        const headers = await getSheetHeaders(sheetName);
        const submissionDateCol = headers.indexOf("Submission Date"); // Adjust column name as needed
        
        if (submissionDateCol >= 0) {
            const columnLetter = getColumnLetter(submissionDateCol + 1); // +1 because getColumnLetter expects 1-based
            // 🆕 USE CAIRO TIME (UTC+2) - DATE ONLY
            const cairoDate = new Date().toLocaleDateString('en-CA', {
                timeZone: 'Africa/Cairo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            await googleSheets.sheets.spreadsheets.values.update({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${sheetName}'!${columnLetter}${rowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [[cairoDate]] }
            });
            console.log(`✅ Added submission date (Cairo time): ${cairoDate} for row ${rowIndex}`);
        } else {
            console.log(`⚠️ Submission Date column not found in sheet headers`);
        }
    } catch (error) {
        console.error(`❌ Error adding submission date/time:`, error);
    }
}

// 🆕 Helper function to set red background for rows with blank Part A Eligibility
async function setRedBackgroundForBlankPartA(rowIndex, sheetName) {
    try {
        const GoogleSheetsService = require('./MedicareAutomation/google-sheets-service.js');
        const googleSheets = new GoogleSheetsService();
        await googleSheets.initialize();
        
        const headers = await getSheetHeaders(sheetName);
        const partACol = headers.indexOf("Part A Eligibility Start Date");
        
        if (partACol >= 0) {
            // Get the current value of Part A Eligibility Start
            const columnLetter = getColumnLetter(partACol + 1); // +1 because getColumnLetter expects 1-based
            const response = await googleSheets.sheets.spreadsheets.values.get({
                spreadsheetId: googleSheets.spreadsheetId,
                range: `'${sheetName}'!${columnLetter}${rowIndex}`
            });
            
            const partAValue = response.data.values && response.data.values[0] && response.data.values[0][0];
            
            // If Part A Eligibility Start is blank, set red background for entire row
            if (!partAValue || partAValue.trim() === '') {
                console.log(`🛑 WORKFLOW STOPPED: Part A Eligibility Start Date is blank for ${lastName} (Row ${rowIndex})`);
                console.log(`🔴 Red background applied - NO SUBMISSION will be attempted`);
                
                // Set Lead Status to indicate the issue
                await setLeadStatus(rowIndex, sheetName, "Missing Part A Date");
                
                // Stop processing this lead
                processingStatus.isProcessing = false;
                processingStatus.currentLead = null;
                processingStatus.currentStep = null;
                
                // Process next lead if any
                setTimeout(() => processQueueImmediately(), 1000);
                return;
            } else {
                console.log(`✅ Part A Eligibility Start Date validated: "${partAValue}" - proceeding with workflow`);
            }
        } else {
            console.log(`⚠️ Part A Eligibility Start Date column not found - proceeding with workflow`);
        }
    } catch (error) {
        console.error(`❌ Error setting red background for blank Part A Eligibility:`, error);
    }
}

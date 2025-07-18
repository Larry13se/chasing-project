# Three-Server Automation Architecture

This system implements a robust 3-server automation workflow for Medicare account creation, doctor fetching, and form submission.

## Architecture Overview

```
Google Sheets → Medicare Server → Doctor Server → Form Server
                (Account Creation)   (Doctor Fetch)   (Form Submit)
```

## The Correct Workflow

### When Conditions Are Met (Status = Valid + Quality Check = PASSED):

1. **🏥 Medicare Account Creation Server (Port 3001)**
   - Creates Medicare accounts for patients
   - Saves credentials to Google Sheets (Column BI)
   - Stops processing after first successful account creation
   - **Does NOT call other servers**

2. **👨‍⚕️ Doctor Fetching Server (Port 3002)**  
   - Triggered by Google Sheets monitoring when credentials are available
   - Uses credentials from Medicare server to fetch doctors
   - Saves doctor recommendations to columns AZ-BH
   - **Calls Form Submission Server when done**

3. **📝 Form Submission Server (Port 5000)**
   - Called by Doctor Server after doctor fetching completes
   - Submits form with or without doctor recommendations
   - Updates Lead Status to "Submitted" or "Failed to Submit"

## Error Handling Paths

### If Medicare Account Creation Fails:
- Skip doctor fetching
- Google Sheets trigger calls Form Server directly
- Submit form without doctor recommendations

### If Doctor Fetching Fails:
- Doctor Server still calls Form Server
- Submit form without doctor recommendations

### If Doctor Fetching Finds No Doctors:
- Doctor Server calls Form Server with empty doctor fields
- Submit form with CLOSER COMMENT only

## Server Details

### 🏥 Medicare Account Creation Server
- **Port:** 3001
- **Purpose:** Account creation ONLY
- **Endpoints:**
  - `GET /health` - Health check
  - `POST /process-medicare` - Queue account creation
  - `GET /queue-status` - Queue status
  - `GET /account-status` - Global account status

### 👨‍⚕️ Doctor Fetching Server  
- **Port:** 3002
- **Purpose:** Doctor fetching + Form submission trigger
- **Endpoints:**
  - `GET /health` - Health check
  - `POST /fetch-doctors` - Queue doctor fetching
  - `GET /queue-status` - Queue status

### 📝 Form Submission Server
- **Port:** 5000
- **Purpose:** Form submission to Google Forms
- **Endpoints:**
  - `GET /health` - Health check
  - `POST /submit-form` - Submit form (new unified endpoint)
  - `POST /submit` - Legacy braces endpoint
  - `POST /submit-cgm` - Legacy CGM endpoint

## Google Sheets Integration

### Updated Google Script Flow:

1. **Trigger Detection:** Status + Quality Check conditions met
2. **Start Monitoring:** Set up time-based triggers to monitor progress
3. **Medicare Phase:** 
   - Call Medicare Server
   - Monitor for credentials in Column BI
4. **Doctor Phase:**
   - When credentials found, call Doctor Server
   - Monitor for doctors in columns AZ-BH
5. **Form Phase:**
   - Form submission handled automatically by Doctor Server
   - Monitor Lead Status for completion

### Key Improvements:

- **Asynchronous Monitoring:** Uses time-based triggers instead of blocking waits
- **Independent Servers:** Each server has one clear responsibility
- **Proper Error Handling:** Graceful fallbacks at each step
- **No Server-to-Server Dependencies:** Clean separation of concerns

## Starting the System

### Option 1: Use the Startup Script
```bash
start-all-servers.bat
```

### Option 2: Start Servers Manually

1. **Terminal 1 - Medicare Server:**
```bash
cd MedicareAutomation
npm run server
```

2. **Terminal 2 - Doctor Server:**
```bash
cd MedicareAutomation
node doctor-fetching-server.js
```

3. **Terminal 3 - Form Server:**
```bash
cd FormSubmission
python form-server.py
```

4. **Terminal 4 - Orchestration Server (Optional):**
```bash
node orchestration-server.js
```

## Testing the Servers

```bash
# Test all servers
curl http://localhost:3001/health  # Medicare
curl http://localhost:3002/health  # Doctor
curl http://localhost:5000/health  # Form
curl http://localhost:3003/health  # Orchestration (if running)
```

## Environment Configuration

Create `.env` files in each directory:

### MedicareAutomation/.env
```
MEDICARE_PORT=3001
GOOGLE_SHEET_ID=your_sheet_id
HEADLESS=false
SLOW_MO=1000
```

### FormSubmission/.env
```
FORM_SERVER_PORT=5000
```

### Root/.env (for Orchestration Server)
```
ORCHESTRATION_PORT=3003
MEDICARE_SERVER_URL=http://localhost:3001
DOCTOR_SERVER_URL=http://localhost:3002
FORM_SERVER_URL=http://localhost:5000
```

## Benefits of This Architecture

1. **Clear Separation of Concerns:** Each server has one job
2. **Better Error Handling:** Failures in one step don't break the others
3. **Easier Debugging:** Isolated logs for each process
4. **Scalability:** Servers can be scaled independently
5. **Reliability:** If one server fails, others continue working
6. **Maintainability:** Updates can be deployed to individual servers

## Monitoring and Debugging

### Check Server Status:
- Medicare: http://localhost:3001/queue-status
- Doctor: http://localhost:3002/queue-status
- Form: http://localhost:5000/health

### Log Files:
Each server provides detailed console logging with emojis for easy identification:
- 🏥 Medicare operations
- 👨‍⚕️ Doctor fetching operations  
- 📝 Form submission operations
- 🎯 Orchestration operations

## Troubleshooting

### Common Issues:

1. **Servers Not Communicating:**
   - Check server URLs in Google Script
   - Verify all servers are running on correct ports
   - Check firewall/network settings

2. **Google Sheets Not Triggering:**
   - Verify trigger conditions in Google Script
   - Check column names and positions
   - Ensure proper permissions

3. **Account Creation Stuck:**
   - Check Medicare server logs
   - Verify patient data completeness
   - Check browser automation settings

4. **Doctor Fetching Fails:**
   - Verify credentials format
   - Check Google Sheets service configuration
   - Ensure proper sheet access

5. **Form Submission Fails:**
   - Check form URLs in form-server.py
   - Verify payload format
   - Test form endpoints directly

## Data Flow

```
Row Edit (Status + Quality Check = PASSED)
    ↓
Google Sheets Trigger Activates
    ↓
Call Medicare Server (/process-medicare)
    ↓
[Wait for credentials in Column BI]
    ↓
Call Doctor Server (/fetch-doctors) 
    ↓
[Doctor Server processes and calls Form Server]
    ↓
Update Lead Status to "Submitted"
```

This architecture ensures reliable, maintainable, and scalable automation processing. 
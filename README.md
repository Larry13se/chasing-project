# Two-Server Medicare Automation System

This system has been separated into two distinct servers for better organization and reliability:

1. **Medicare Automation Server** - Handles account creation and doctor fetching
2. **Form Submission Server** - Handles form submissions after Medicare automation is complete

## Architecture Overview

```
Google Sheets → Medicare Automation Server → Form Submission Server
```

### Flow:
1. When conditions are met in Google Sheets (Status and Quality Check), Medicare Automation Server is triggered first
2. Medicare Server creates accounts, fetches doctors, and saves results to the sheet
3. After Medicare automation is complete, Form Submission Server is triggered to submit the form
4. Final submission status is updated in the sheet

## Setup Instructions

### 1. Medicare Automation Server

Navigate to the MedicareAutomation directory:
```bash
cd MedicareAutomation
npm install
```

Start the Medicare Automation Server:
```bash
npm run server
# or
node medicare-server.js
```

The server will run on port 3001 by default.

### 2. Form Submission Server

Navigate to the FormSubmission directory:
```bash
cd FormSubmission
pip install -r requirements.txt
```

Start the Form Submission Server:
```bash
python form-server.py
```

The server will run on port 5000 by default.

### 3. Google Sheets Configuration

Update the Google Script with your server URLs:

```javascript
// 🌐 SERVER URLs - UPDATE THESE WITH YOUR ACTUAL SERVER URLs
var medicareServerUrl = "http://localhost:3001"; // Medicare Automation Server
var formServerUrl = "http://localhost:5000";     // Form Submission Server
```

If using ngrok or other tunneling services, update these URLs accordingly.

## Server Details

### Medicare Automation Server (Port 3001)

**Endpoints:**
- `GET /health` - Health check
- `POST /process-medicare` - Process Medicare automation for a patient
- `GET /queue-status` - Get current queue status

**Features:**
- Queue-based processing
- Account creation automation
- Doctor fetching automation
- Direct sheet updates
- Error handling and status reporting

### Form Submission Server (Port 5000)

**Endpoints:**
- `GET /health` - Health check
- `POST /submit-form` - Submit form data (new endpoint)
- `POST /submit` - Legacy braces form endpoint
- `POST /submit-cgm` - Legacy CGM form endpoint

**Features:**
- Supports both braces and CGM forms
- JSON-based form submission
- Backward compatibility with legacy endpoints

## Usage

### Starting Both Servers

1. **Terminal 1 - Medicare Server:**
```bash
cd MedicareAutomation
npm run server
```

2. **Terminal 2 - Form Server:**
```bash
cd FormSubmission
python form-server.py
```

### Testing the System

1. **Test Medicare Server:**
```bash
curl http://localhost:3001/health
```

2. **Test Form Server:**
```bash
curl http://localhost:5000/health
```

### Google Sheets Integration

The system automatically triggers when:
- Status column contains valid values (VERIFIED DR CHASE, etc.)
- Quality Check column contains "PASSED"
- Lead Status is not already "Submitted"

## Environment Variables

### Medicare Automation Server
Create a `.env` file in the MedicareAutomation directory:
```
MEDICARE_PORT=3001
GOOGLE_SHEET_ID=your_sheet_id
HEADLESS=false
SLOW_MO=1000
```

### Form Submission Server
Create a `.env` file in the FormSubmission directory:
```
FORM_SERVER_PORT=5000
```

## Monitoring and Logs

Both servers provide detailed console logging:
- 🏥 Medicare automation progress
- 📋 Queue status updates
- 📝 Form submission results
- ❌ Error messages and debugging info

## Troubleshooting

### Common Issues:

1. **Medicare Server Not Starting:**
   - Check if Chrome is installed
   - Verify Google Sheets credentials
   - Ensure port 3001 is available

2. **Form Server Not Starting:**
   - Verify Python dependencies installed
   - Check if port 5000 is available
   - Ensure Flask is properly installed

3. **Google Sheets Connection Issues:**
   - Verify Google credentials
   - Check sheet permissions
   - Ensure correct sheet ID in environment variables

### Debug Mode:

Enable debug mode by setting environment variables:
```bash
# Medicare Server
HEADLESS=false
SLOW_MO=2000

# Form Server
FLASK_DEBUG=true
```

## Benefits of Separation

1. **Better Resource Management** - Each server handles its specific tasks
2. **Improved Reliability** - If one server fails, the other continues working
3. **Easier Debugging** - Isolated logs and error handling
4. **Scalability** - Servers can be scaled independently
5. **Maintenance** - Updates can be deployed to individual servers

## Testing

### Create Test Files

You can create test files to verify functionality:

```bash
# Test Medicare server
node test-medicare-server.js

# Test Form server
python test-form-server.py
```

**Note:** Test files will be automatically created and removed after testing as requested. 
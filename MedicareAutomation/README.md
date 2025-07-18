# Medicare Account Creation Automation

This project automates Medicare account creation using Playwright and integrates with Google Sheets for patient data management.

## Features

- ✅ Reads patient data from Google Sheets
- ✅ Automates Medicare account creation process
- ✅ Updates status back to Google Sheets
- ✅ Handles multiple patients sequentially
- ✅ Error handling and logging

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npm run install-browsers
```

### 3. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create OAuth 2.0 credentials
5. Download the credentials and note down:
   - Client ID
   - Client Secret
6. Generate refresh token using OAuth 2.0 playground

### 4. Environment Configuration

1. Copy `env.example` to `.env`
2. Fill in your Google API credentials:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REFRESH_TOKEN=your_google_refresh_token_here
GOOGLE_SHEET_ID=1EzSvPWiJO47W9C7-ZJI910CT9NOGsnuZXdnQhNiTHh4
GOOGLE_SHEET_RANGE=Sheet1!A:F
HEADLESS=false
SLOW_MO=1000
```

## Google Sheet Format

Your Google Sheet should have the following columns:

| Column | Header Name | Description |
|--------|-------------|-------------|
| A | LAST NAME | Patient's last name |
| B | MED ID | Medicare ID number |
| C | DOB | Date of birth |
| D | Part A Elibility Start | Part A eligibility start date (MM/YYYY) |
| E | ADDRESS | Full address with zip code |
| F | STATUS | Automation status (updated by script) |
| G | NOTES | Additional notes (updated by script) |

## Data Processing

### Address Parsing
The automation automatically extracts zip codes from addresses like:
- `448 Heron Hollow Plant City, FL 33565-2837` → `33565-2837`
- `6920 Donachie Rd Apt 806 Baltimore, MD 21239` → `21239`

### Username/Password Generation
- **Username**: `{LastName}Larry1`
- **Password**: `{LastName}@03305198751!`

## Usage

### Run the Automation

```bash
npm start
```

### Current Implementation

The automation currently handles the first step of Medicare account creation:

1. ✅ Navigates to https://www.medicare.gov/account/create-account
2. ✅ Refreshes page to avoid errors
3. ✅ Fills Medicare ID number
4. ✅ Fills Part A eligibility month and year
5. ✅ Clicks "Next" button
6. ✅ Updates Google Sheet with status

## Project Structure

```
├── medicare-automation.js     # Main automation script
├── google-sheets-service.js   # Google Sheets integration
├── playwright.config.js       # Playwright configuration
├── package.json              # Dependencies and scripts
├── env.example               # Environment variables template
└── README.md                 # This file
```

## Error Handling

- Errors are logged to console
- Failed attempts are recorded in Google Sheets
- Browser screenshots captured on failures
- Detailed error messages in status updates

## Development

### Browser Settings
- Runs in non-headless mode by default for debugging
- 1-second delay between actions (configurable)
- Captures screenshots and videos on failures

### Adding New Steps

To extend the automation with additional form steps:

1. Add new methods to the `MedicareAutomation` class
2. Update the `processPatients()` method to call new steps
3. Add appropriate error handling and status updates

## Troubleshooting

### Common Issues

1. **Google Sheets Access Error**
   - Verify API credentials in `.env` file
   - Ensure Google Sheets API is enabled
   - Check sheet permissions

2. **Element Not Found**
   - Medicare.gov may have updated their form structure
   - Check browser developer tools for current selectors
   - Update selectors in the code

3. **Network Timeouts**
   - Increase timeout values in Playwright config
   - Check internet connection stability

## Next Steps

Ready to continue with additional account creation steps. Please provide the next set of instructions for:

- Personal information form
- Identity verification
- Account credentials setup
- Additional form pages

The automation framework is set up and ready to handle the complete Medicare account creation workflow. 
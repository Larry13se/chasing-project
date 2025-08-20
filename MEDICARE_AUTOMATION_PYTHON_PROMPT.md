# Medicare Automation System - Python Conversion Prompt

## Project Overview
Convert the existing Node.js Medicare automation system to Python using Selenium with stealth capabilities. The system should process Medicare leads, handle account login with comprehensive error handling, fetch doctor information, validate PECOS enrollment, and return processed results.

## Core Workflow
```
CSV Input → Medicare Login & Error Handling → Doctor Fetching → PECOS Validation → CSV Output
```

## Input/Output Requirements

### Input CSV Format
```csv
lastName,medId,dob,zipCode,address,partAEligibility,partBEligibility,existingCredentials,rowIndex
Smith,1234567890A,01/15/1950,12345,123 Main St City ST 12345,01/2018,03/2019,username//password,1
Johnson,9876543210B,05/22/1955,67890,456 Oak Ave Town ST 67890,02/2020,,user2//pass2,2
```

### Output CSV Format
```csv
lastName,medId,rowIndex,loginStatus,loginMessage,doctorCount,doctorsFound,pecosValidated,processingStatus,errorDetails,credentials
Smith,1234567890A,1,SUCCESS,Login successful,3,Dr. John Doe//123 Main St//1234567890//Family Medicine;Dr. Jane Smith//456 Oak Ave//0987654321//Cardiology,2,COMPLETED,,username//password
Johnson,9876543210B,2,FAILED,Account is no longer active,0,,,FAILED,Account disabled error,user2//pass2
```

## Key Components to Implement

### 1. Medicare Login System (`medicare_automation.py`)

Based on `MedicareAutomation/medicare-automation.js`, implement:

#### Login Flow with Dual Path Support
- **Part A Path**: Default Medicare.gov flow
- **Part B Path**: Click "Get other options" → Select "Part B (Medical Insurance)"
- **Auto-detection**: Determine path based on available eligibility data

#### Comprehensive Error Handling
```python
class MedicareLoginErrors:
    ACCOUNT_DISABLED = "Account is no longer active"
    WRONG_INFO = "Cannot find this record" 
    ACCOUNT_LOCKED = "Account is now locked"
    PASSWORD_RESET_RESTRICTED = "Cannot reset password due to Medicare restriction"
    MEDICARE_SYSTEM_ERROR = "We can't process your request at this time"
    GENERAL_ERROR = "Other login issues"
```

#### Error Detection Logic
- Check for specific error messages on page
- Classify errors into categories
- Determine if processing should continue or stop
- Handle password reset flows when applicable

#### Username/Password Generation
```python
def generate_credentials(last_name):
    random_number = random.randint(0, 9)
    random_password = random.randint(10000000, 99999999)
    username = f"{last_name}@Larry{random_number}"
    password = f"larry@{random_password}!@"
    return username, password
```

### 2. Doctor Fetching System (`doctor_fetching.py`)

Based on `MedicareAutomation/doctor-fetching.js`, implement:

#### Claims Extraction with Pagination
- Navigate to Medicare claims section
- Extract all claims from last 9 months (not 6 months)
- Handle pagination: click "Load more claims" until old claims found
- Parse claim data: date of service, provider name
- Filter out hospital/facility claims

#### Provider Analysis and Scoring
```python
class ProviderScoring:
    def calculate_composite_score(self, provider_data):
        # Base score: visit_count * 1.5
        base_score = provider_data['visit_count'] * 1.5
        
        # Recency bonus (most recent visits get higher points)
        recency_bonus = self.calculate_recency_bonus(provider_data['visits'])
        
        # Quality bonus based on provider type
        quality_bonus = self.get_quality_bonus(provider_data['name'])
        
        # Old visit penalty (6th+ visits get -0.5 each)
        old_visit_penalty = max(0, provider_data['visit_count'] - 5) * -0.5
        
        return base_score + recency_bonus + quality_bonus + old_visit_penalty
```

#### Provider Quality Assessment
- **High Quality Indicators**: Starts with "Dr.", ends with MD/DO/NP/PA, has credentials
- **Quality Specialties**: Family Medicine, Internal Medicine, Cardiology, etc.
- **Company Detection**: Filter out LLCs, Centers, Clinics, Medical Groups
- **Personal Name Patterns**: FirstName LastName, LastName FirstName formats

### 3. NPI Registry Service (`npi_registry_service.py`)

Based on `MedicareAutomation/npi-registry-service.js`, implement:

#### Provider Search via Official NPI API
```python
class NPIRegistryService:
    BASE_URL = "https://npiregistry.cms.hhs.gov/api/"
    
    def search_providers(self, provider_name, state=None, max_results=30):
        # Parse provider name (handle "Last, First" format)
        # Make API request to official CMS NPI Registry
        # Return structured provider data
        
    def get_provider_by_npi(self, npi_number):
        # Direct NPI lookup
        # Return detailed provider information
```

#### Data Parsing and Validation
- Parse API response into standardized format
- Extract: NPI, name, address, specialty, phone, credentials
- Validate provider meets basic criteria
- Filter by state if specified

### 4. PECOS Enrollment Service (`pecos_enrollment_service.py`)

Based on `MedicareAutomation/pecos-enrollment-service.js`, implement:

#### Medicare Enrollment Verification
```python
class PECOSEnrollmentService:
    def check_provider_enrollment(self, npi):
        # Query CMS Data API for PECOS enrollment
        # Validate NPI using Luhn algorithm
        # Return enrollment status: ENROLLED/NOT_ENROLLED/UNKNOWN
        
    def validate_npi_checksum(self, npi):
        # Implement Luhn algorithm for NPI validation
        # Add prefix "80840" for 15-digit validation
```

#### Enrollment Status Logic
- **ENROLLED**: Provider can bill Medicare (include in recommendations)
- **NOT_ENROLLED**: Provider cannot bill Medicare (exclude)
- **UNKNOWN**: API error (include with warning)

### 5. Selenium Stealth Configuration

#### Anti-Detection Setup
```python
from selenium import webdriver
from selenium_stealth import stealth
from selenium.webdriver.chrome.options import Options

def create_stealth_driver():
    options = Options()
    options.add_argument("--disable-automation")
    options.add_argument("--exclude-switches=enable-automation")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=options)
    
    stealth(driver,
        languages=["en-US", "en"],
        vendor="Google Inc.",
        platform="Win32",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
    )
    
    return driver
```

## Implementation Structure

### Main Processing Class
```python
class MedicareAutomationProcessor:
    def __init__(self, input_csv_path, output_csv_path):
        self.input_csv_path = input_csv_path
        self.output_csv_path = output_csv_path
        self.medicare_automation = MedicareAutomation()
        self.doctor_fetching = DoctorFetching()
        self.npi_service = NPIRegistryService()
        self.pecos_service = PECOSEnrollmentService()
        
    def process_leads(self):
        # Read CSV input
        # For each lead:
        #   1. Attempt Medicare login with error handling
        #   2. If successful, fetch doctors and validate PECOS
        #   3. Write results to output CSV
        #   4. Handle all error cases appropriately
```

### Error Handling Strategy

#### Account Status Categories
1. **SUCCESS**: Login successful, proceed to doctor fetching
2. **ACCOUNT_DISABLED**: Account no longer active, stop processing
3. **WRONG_INFO**: Cannot find record, stop processing  
4. **ACCOUNT_LOCKED**: Account locked, stop processing
5. **PASSWORD_RESET_RESTRICTED**: Must call Medicare, stop processing
6. **MEDICARE_SYSTEM_ERROR**: System temporarily down, can retry later
7. **GENERAL_ERROR**: Other issues, log and continue

#### Processing Decision Logic
```python
def should_continue_processing(self, login_result):
    stop_processing_errors = [
        "ACCOUNT_DISABLED",
        "WRONG_INFO", 
        "ACCOUNT_LOCKED",
        "PASSWORD_RESET_RESTRICTED"
    ]
    
    retry_later_errors = [
        "MEDICARE_SYSTEM_ERROR"
    ]
    
    if login_result.error_type in stop_processing_errors:
        return False, "STOP"
    elif login_result.error_type in retry_later_errors:
        return False, "RETRY_LATER"
    else:
        return True, "CONTINUE"
```

### Doctor Validation Workflow

#### Multi-Tier Validation System
1. **STRICT Validation**: Individual entity, same state, valid specialty, PECOS enrolled
2. **RELAXED Validation**: Any entity type, any state, basic criteria
3. **EMERGENCY Validation**: Minimal criteria, last resort

#### Provider Ranking Algorithm
```python
def rank_providers(self, providers, patient_state):
    for provider in providers:
        # Calculate composite score
        provider.score = self.calculate_provider_score(provider)
        
        # Apply quality bonuses
        if self.is_high_quality_provider(provider.name):
            provider.score += 5.5
            
        # Apply geographic bonus
        if provider.state == patient_state:
            provider.score += 2.0
            
    # Sort by: PECOS status > Quality > Score > Visit count
    return sorted(providers, key=lambda p: (
        p.pecos_enrolled,
        p.quality_tier,
        p.score,
        p.visit_count
    ), reverse=True)
```

## Technical Requirements

### Dependencies
```python
# requirements.txt
selenium==4.15.0
selenium-stealth==1.0.6
requests==2.31.0
pandas==2.1.0
python-dotenv==1.0.0
beautifulsoup4==4.12.0
lxml==4.9.0
```

### Configuration
```python
# config.py
MEDICARE_BASE_URL = "https://www.medicare.gov"
CLAIMS_ANALYSIS_MONTHS = 9  # Changed from 6 to 9 months
MAX_PROVIDERS_TO_CHECK = 15  # Up from 10
TARGET_DOCTORS = 9  # Final recommendation count
NPI_API_URL = "https://npiregistry.cms.hhs.gov/api/"
PECOS_API_URL = "https://data.cms.gov/data-api/v1/dataset"
```

### Logging and Debugging
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('medicare_automation.log'),
        logging.StreamHandler()
    ]
)
```

## Key Features to Implement

### 1. Dual Eligibility Path Support
- Auto-detect Part A vs Part B based on available data
- Handle both Medicare enrollment paths
- Proper form navigation for each path type

### 2. Comprehensive Error Classification
- Detect and categorize all Medicare error types
- Implement appropriate responses for each error
- Log detailed error information for debugging

### 3. Advanced Doctor Scoring
- 9-month claims analysis window
- Composite scoring algorithm with recency bonuses
- Quality assessment based on provider characteristics
- Geographic preferences with fallback options

### 4. PECOS Enrollment Integration
- Real-time Medicare enrollment verification
- Multiple validation tiers (Strict → Relaxed → Emergency)
- Enrollment status impact on recommendations

### 5. Robust Provider Validation
- Company detection and filtering
- Specialty validation against approved lists
- Multiple API sources for provider data
- Fallback mechanisms for data gaps

## File Structure
```
medicare_automation_python/
├── main.py                          # Entry point
├── medicare_automation.py           # Medicare login/account handling
├── doctor_fetching.py              # Claims extraction and doctor analysis  
├── npi_registry_service.py         # Official NPI API integration
├── pecos_enrollment_service.py     # Medicare enrollment verification
├── provider_validation.py          # Doctor quality assessment
├── selenium_stealth_config.py      # Anti-detection configuration
├── error_handlers.py               # Medicare error classification
├── data_models.py                  # Data structures and models
├── config.py                       # Configuration settings
├── utils.py                        # Utility functions
├── requirements.txt                # Python dependencies
├── input/                          # CSV input files
├── output/                         # CSV output files
└── logs/                           # Log files
```

## Success Criteria

### Processing Metrics
- **Login Success Rate**: >85% for valid accounts
- **Doctor Discovery Rate**: >90% for patients with recent claims
- **PECOS Validation Rate**: >95% accuracy
- **Error Classification**: 100% of errors properly categorized

### Output Quality
- **Doctor Recommendations**: 3-9 doctors per successful case
- **Geographic Accuracy**: Prioritize same-state providers
- **Specialty Validation**: Only approved medical specialties
- **PECOS Compliance**: Only Medicare-enrolled providers

### Performance Targets
- **Processing Speed**: 2-3 minutes per lead
- **Concurrent Processing**: Support 3-5 parallel instances
- **Error Recovery**: Graceful handling of all error types
- **Data Integrity**: No data loss during processing

## Implementation Notes

### Selenium Stealth Best Practices
- Use realistic user agents and browser fingerprints
- Implement human-like delays and mouse movements
- Rotate user data directories between sessions
- Handle CAPTCHA detection and response
- Implement session isolation between patients

### Medicare.gov Compatibility
- Handle dynamic form elements and AJAX loading
- Implement proper wait strategies for page loads
- Handle Medicare system maintenance windows
- Respect rate limits and implement backoff strategies

### Data Security
- Secure credential handling and storage
- Session isolation between different patients
- Proper cleanup of sensitive data
- Audit logging for compliance

This prompt provides the foundation for rebuilding the Medicare automation system in Python with enhanced capabilities, better error handling, and improved stealth features for reliable operation.
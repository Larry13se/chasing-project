import requests
import urllib.parse
import json

# Test the exact form submission with debugging
BRACES_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/formResponse"
FORM_VIEW_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/viewform"

# Recreate the exact payload that's failing for Granger
granger_payload = {
    "entry.534497717": "SNS RESULT FROM GRANGER ROW",
    "entry.311509461": "DENISE",  # First name
    "entry.1954362581": "GRANGER", # Last name  
    "entry.647663825": "555-123-4567", # Phone
    "entry.1025449182": "123 Test St", # Address
    "entry.1726047969": "Test City", # City
    "entry.1820794877": "NY", # State
    "entry.438852095": "12345", # Zip
    "entry.404360623": "01/01/1960", # DOB
    "entry.309323976": "123456789A", # Medicare ID
    "entry.260318019": "5'6\"", # Height
    "entry.646279815": "150", # Weight
    "entry.1398739596": "8", # Shoe size
    "entry.1541531810": "32", # Waist size
    "entry.1411909225": "Female", # Gender
    
    # Doctor fields - using the exact doctor info from logs
    "entry.798980565": "Dr. John M. Carbone, MD//1366487563//Family Medicine Physician",
    "entry.509267999": "........", # Dr 2
    "entry.910343639": "........", # Dr 3
    "entry.201070902": "........", # Dr 4
    "entry.1948116165": "........", # Dr 5
    "entry.84736707": "........", # Dr 6
    "entry.1390847878": "........", # Dr 7
    "entry.2082186628": "........", # Dr 8
    "entry.1696174961": "........", # Dr 9
    "entry.1784390417": "........", # Dr 10
    
    "entry.1328348461": "Test Agent", # Agent
    "entry.1007839295": "Test Closer", # Closer
    "entry.596336074": "Site Two", # Site (INCALL_2_RESPONSE = Site Two)
    "entry.1418374363": "Main", # Intake
    "entry.1700120138": "GRANGERDENISE@123//test@518663275!@" # Credentials in comment
}

print("🧪 Testing Granger-like payload...")
print(f"📋 Fields count: {len(granger_payload)}")

def test_payload(payload_data, test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")
    
    # Test with minimal payload first
    payload = '&'.join([f"{urllib.parse.quote(str(k))}={urllib.parse.quote(str(v))}" 
                       for k, v in payload_data.items()])
    
    print(f"🔍 Payload length: {len(payload)} chars")
    print(f"🔍 First 300 chars: {payload[:300]}")
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': FORM_VIEW_URL,
        'Origin': 'https://docs.google.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    session = requests.Session()
    
    try:
        # Visit form first
        print("🔍 Step 1: Visiting form...")
        session.get(FORM_VIEW_URL, headers={'User-Agent': headers['User-Agent']})
        
        # Submit form
        print("🔍 Step 2: Submitting form...")
        response = session.post(BRACES_FORM_URL, data=payload, headers=headers, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
        else:
            print(f"❌ FAILED with {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            # Look for specific error indicators in response
            response_text = response.text.lower()
            if 'error' in response_text:
                print("🔍 Response contains 'error'")
            if 'invalid' in response_text:
                print("🔍 Response contains 'invalid'")  
            if 'required' in response_text:
                print("🔍 Response contains 'required'")
                
            print(f"🔍 Response text (first 500 chars): {response.text[:500]}")
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"💥 Error: {e}")
        return False

# Test 1: Minimal required fields only
minimal_payload = {
    "entry.534497717": "TEST SNS",
    "entry.311509461": "DENISE", 
    "entry.1954362581": "GRANGER",
    "entry.647663825": "555-123-4567",
    "entry.1025449182": "123 Test St",
    "entry.1726047969": "Test City",
    "entry.1820794877": "NY",
    "entry.438852095": "12345",
    "entry.404360623": "01/01/1960",
    "entry.309323976": "123456789A",
    "entry.1328348461": "Test Agent",
    "entry.1007839295": "Test Closer",
    "entry.596336074": "Site Two",
    "entry.1418374363": "Main",
    "entry.1700120138": "Test Comment"
}

# Test 2: Add the missing brace field
with_brace_payload = minimal_payload.copy()
with_brace_payload["entry.987295788"] = "BB"

# Test 3: Full payload
test_payload(minimal_payload, "Test 1: Minimal Required Fields")
test_payload(with_brace_payload, "Test 2: With Requested Device")
test_payload(granger_payload, "Test 3: Full Granger Payload")

print(f"\n{'='*60}")
print("🎯 DIAGNOSIS COMPLETE")
print(f"{'='*60}")
print("Check which test passes to identify the problematic field(s)") 
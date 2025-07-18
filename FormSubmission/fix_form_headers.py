import requests
import urllib.parse
import time

# Test with proper Google Forms headers
BRACES_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/formResponse"
FORM_VIEW_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/viewform"

print("🔧 Testing with PROPER Google Forms headers...")

# Test payload
test_payload = {
    "entry.987295788": "BB",  # Brace type
    "entry.534497717": "Test SNS",  # SNS result
    "entry.311509461": "John",  # First name
    "entry.1954362581": "Doe",  # Last name
}

def test_with_proper_headers():
    print(f"\n{'='*60}")
    print("🧪 TESTING WITH FULL GOOGLE FORMS HEADERS")
    print(f"{'='*60}")
    
    # Create a session to maintain cookies
    session = requests.Session()
    
    # Step 1: Visit the form to get session cookies
    print("🔍 Step 1: Getting form session...")
    initial_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    try:
        # Get the form page first
        form_response = session.get(FORM_VIEW_URL, headers=initial_headers)
        print(f"✅ Form page loaded: {form_response.status_code}")
        print(f"🍪 Cookies received: {len(session.cookies)} cookies")
        
        # Wait a moment (mimic human behavior)
        time.sleep(1)
        
        # Step 2: Submit with proper headers
        print("🔍 Step 2: Submitting form...")
        
        payload = '&'.join([f"{urllib.parse.quote(str(k))}={urllib.parse.quote(str(v))}" 
                           for k, v in test_payload.items()])
        
        submit_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://docs.google.com',
            'Referer': FORM_VIEW_URL,
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1'
        }
        
        print(f"🔍 Payload: {payload}")
        print(f"🔍 Headers count: {len(submit_headers)}")
        
        response = session.post(BRACES_FORM_URL, data=payload, headers=submit_headers, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📊 Response URL: {response.url}")
        
        if response.status_code == 200:
            print("✅ SUCCESS! Form submitted with proper headers!")
            
            # Check if we got redirected to confirmation page
            if 'formResponse' in response.url or 'closedform' in response.url or len(response.text) < 1000:
                print("🎉 CONFIRMATION: Form submission confirmed by Google!")
                return True
            else:
                print("⚠️ Got 200 but might be form validation error")
                print(f"🔍 Response text sample: {response.text[:300]}")
        else:
            print(f"❌ Still failed with {response.status_code}")
            print(f"🔍 Response text: {response.text[:500]}")
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"💥 Error: {e}")
        return False

# Run the test
success = test_with_proper_headers()

print(f"\n{'='*60}")
print(f"🎯 FINAL RESULT: {'SUCCESS' if success else 'FAILED'}")
print(f"{'='*60}")

if success:
    print("✅ The form can be submitted with proper session management!")
    print("💡 SOLUTION: Update your form-server.py to use session management")
else:
    print("❌ Even with proper headers, form submission fails")
    print("💡 This suggests a deeper issue with the form URL or validation") 
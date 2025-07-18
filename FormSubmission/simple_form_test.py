import requests
import urllib.parse
import json

# Test minimal form submission
BRACES_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/formResponse"
FORM_VIEW_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/viewform"

print("🧪 Testing form with absolute minimal data...")

# Test 1: Just the brace field (user said this worked for INCALL_1)
minimal_test = {
    "entry.987295788": "BB"  # Just the requested brace
}

def submit_test(payload, test_name):
    print(f"\n{'='*50}")
    print(f"🧪 {test_name}")
    print(f"📊 Fields: {list(payload.keys())}")
    print(f"{'='*50}")
    
    # Convert to form data
    data = "&".join([f"{k}={urllib.parse.quote(str(v))}" for k, v in payload.items()])
    print(f"🔍 Payload: {data}")
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': FORM_VIEW_URL,
        'Origin': 'https://docs.google.com'
    }
    
    try:
        response = requests.post(BRACES_FORM_URL, data=data, headers=headers, timeout=30)
        print(f"📊 Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
            return True
        else:
            print(f"❌ FAILED - {response.status_code}")
            if 'error' in response.text.lower():
                print("🔍 Response contains error text")
            return False
            
    except Exception as e:
        print(f"💥 Exception: {e}")
        return False

# Progressive tests
tests = [
    ({"entry.987295788": "BB"}, "Test 1: Just brace field"),
    ({"entry.534497717": "Test SNS"}, "Test 2: Just SNS field"),
    ({"entry.311509461": "John"}, "Test 3: Just first name"),
    ({"entry.987295788": "BB", "entry.534497717": "Test SNS"}, "Test 4: Brace + SNS"),
    ({"entry.987295788": "BB", "entry.311509461": "John", "entry.1954362581": "Doe"}, "Test 5: Brace + Name"),
]

success_count = 0
for payload, name in tests:
    if submit_test(payload, name):
        success_count += 1
        break  # Stop at first success

print(f"\n{'='*50}")
print(f"🎯 RESULT: {success_count}/{len(tests)} tests passed")
print(f"{'='*50}")

if success_count == 0:
    print("❌ ALL TESTS FAILED - There's a fundamental form issue!")
    print("This suggests:")
    print("  1. Wrong form URL")
    print("  2. Missing security tokens")
    print("  3. Form requires authentication")
    print("  4. Form validation has changed")
else:
    print("✅ Found working minimal payload!") 
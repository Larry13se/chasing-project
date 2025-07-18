import requests
from bs4 import BeautifulSoup
import re

FORM_VIEW_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/viewform"

print("🔍 Inspecting Google Form to find required fields...")

try:
    # Get the form HTML
    response = requests.get(FORM_VIEW_URL)
    
    if response.status_code != 200:
        print(f"❌ Failed to fetch form: {response.status_code}")
        exit(1)
    
    print(f"✅ Form fetched successfully ({len(response.text)} chars)")
    
    # Parse with BeautifulSoup
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Look for form title
    title = soup.find('title')
    if title:
        print(f"📋 Form Title: {title.text}")
    
    # Find all input fields with entry IDs
    entry_pattern = r'entry\.(\d+)'
    entries = re.findall(entry_pattern, response.text)
    
    if entries:
        print(f"\n🔍 Found {len(set(entries))} unique entry fields:")
        for entry in sorted(set(entries)):
            print(f"  entry.{entry}")
    
    # Look for required field indicators
    required_patterns = [
        r'required.*entry\.(\d+)',
        r'entry\.(\d+).*required',
        r'data-required.*entry\.(\d+)',
        r'aria-required.*entry\.(\d+)'
    ]
    
    required_fields = set()
    for pattern in required_patterns:
        matches = re.findall(pattern, response.text, re.IGNORECASE)
        required_fields.update(matches)
    
    if required_fields:
        print(f"\n⚠️ Potentially required fields:")
        for field in sorted(required_fields):
            print(f"  entry.{field} - REQUIRED")
    
    # Look for hidden fields
    hidden_pattern = r'<input[^>]*type=["\']hidden["\'][^>]*name=["\']([^"\']*)["\'][^>]*value=["\']([^"\']*)["\']'
    hidden_fields = re.findall(hidden_pattern, response.text, re.IGNORECASE)
    
    if hidden_fields:
        print(f"\n🔒 Hidden fields found:")
        for name, value in hidden_fields:
            print(f"  {name}: {value}")
    
    # Look for CSRF tokens or other security fields
    security_patterns = [
        r'name=["\']([^"\']*token[^"\']*)["\'][^>]*value=["\']([^"\']*)["\']',
        r'name=["\']([^"\']*csrf[^"\']*)["\'][^>]*value=["\']([^"\']*)["\']',
        r'name=["\']([^"\']*_token[^"\']*)["\'][^>]*value=["\']([^"\']*)["\']'
    ]
    
    security_fields = []
    for pattern in security_patterns:
        matches = re.findall(pattern, response.text, re.IGNORECASE)
        security_fields.extend(matches)
    
    if security_fields:
        print(f"\n🛡️ Security fields found:")
        for name, value in security_fields:
            print(f"  {name}: {value[:50]}...")
    
    # Check if this is the right form by looking for our known entry IDs
    known_entries = ['534497717', '987295788', '311509461', '1954362581']
    found_known = []
    
    for known in known_entries:
        if f'entry.{known}' in response.text:
            found_known.append(known)
    
    print(f"\n🎯 Known entry verification:")
    print(f"  Looking for: {known_entries}")
    print(f"  Found: {found_known}")
    
    if len(found_known) == len(known_entries):
        print("✅ This is the correct form!")
    else:
        print("❌ This might be the wrong form or entries have changed!")
    
    # Look for any obvious error messages in the form
    error_indicators = ['error', 'required', 'invalid', 'missing']
    for indicator in error_indicators:
        if indicator in response.text.lower():
            print(f"⚠️ Form contains '{indicator}' text")

except Exception as e:
    print(f"💥 Error inspecting form: {e}") 
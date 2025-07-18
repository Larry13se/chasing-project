from flask import Flask, request, jsonify
import requests
import logging
from typing import Dict, Any, Tuple
from flask_cors import CORS
import os
from dotenv import load_dotenv
import urllib.parse

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
FORM_URL_MAIN = os.getenv('FORM_URL_MAIN', "https://docs.google.com/forms/d/e/1FAIpQLScpIV538TDt7raNmt85pX8iM3I4pk4WZaQgFkxCSS1a00YVdQ/formResponse")
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', 10))  # seconds

# Current form URLs
BRACES_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/formResponse"
CGM_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfbettG8nbC6-FbVXCP6QiGtmLrp6KBviwMhEujydnxPUDbxw/formResponse"

def validate_form_data(form_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate the incoming form data.
    
    Args:
        form_data: Dictionary containing form data
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not form_data:
        return False, "No form data provided"
    return True, ""

@app.route('/submit', methods=['POST'])
def submit_form():
    """Submit to the braces form"""
    print("🎯 Received braces form submission request")
    
    try:
        # Get raw form data from the request
        raw_data = request.get_data(as_text=True)
        print(f"📦 Raw data received: {raw_data[:200]}...")  # Print first 200 chars
        
        # Use the raw data directly as payload
        payload = raw_data
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        print(f"🌐 Submitting to braces form: {BRACES_FORM_URL}")
        
        response = requests.post(BRACES_FORM_URL, data=payload, headers=headers, timeout=30)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Braces form submission successful!")
            return jsonify({"status": "success", "message": "Form submitted successfully"}), 200
        else:
            print(f"❌ Braces form submission failed with status: {response.status_code}")
            return jsonify({"status": "error", "message": "Form submission failed"}), response.status_code
            
    except Exception as e:
        print(f"💥 Error during braces form submission: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/submit-cgm', methods=['POST'])
def submit_cgm_form():
    """Submit to the CGM form"""
    print("🎯 Received CGM form submission request")
    
    try:
        # Get raw form data from the request
        raw_data = request.get_data(as_text=True)
        print(f"📦 Raw data received: {raw_data[:200]}...")  # Print first 200 chars
        
        # Use the raw data directly as payload
        payload = raw_data
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        print(f"🌐 Submitting to CGM form: {CGM_FORM_URL}")
        
        response = requests.post(CGM_FORM_URL, data=payload, headers=headers, timeout=30)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ CGM form submission successful!")
            return jsonify({"status": "success", "message": "CGM form submitted successfully"}), 200
        else:
            print(f"❌ CGM form submission failed with status: {response.status_code}")
            return jsonify({"status": "error", "message": "CGM form submission failed"}), response.status_code
            
    except Exception as e:
        print(f"💥 Error during CGM form submission: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "forms": ["braces", "cgm"]}), 200

if __name__ == '__main__':
    print("🚀 Starting Flask server...")
    print(f"📋 Braces Form URL: {BRACES_FORM_URL}")
    print(f"🩺 CGM Form URL: {CGM_FORM_URL}")
    app.run(host='0.0.0.0', port=5000, debug=True)

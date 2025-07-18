from flask import Flask, request, jsonify
import requests
import logging
from typing import Dict, Any, Tuple
from flask_cors import CORS
import os
from dotenv import load_dotenv
import urllib.parse
import json
import queue
import threading
import time

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
port = int(os.getenv('FORM_SERVER_PORT', 6003))

# Current form URLs
BRACES_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdpzHs2VAEV_a3ttsPTZvDmKN79qXQPGLItIJCKLhyOc-3ZpA/formResponse"
CGM_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfbettG8nbC6-FbVXCP6QiGtmLrp6KBviwMhEujydnxPUDbxw/formResponse"

# Queue system for handling multiple requests
submission_queue = queue.Queue()
is_processing = False

print("📝 Form Submission Server Starting...")

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

def process_submission_queue():
    """Process queued form submissions"""
    global is_processing
    
    while True:
        try:
            if not submission_queue.empty() and not is_processing:
                is_processing = True
                submission_data = submission_queue.get()
                
                print(f"📋 Processing queued submission: {submission_data.get('lastName', 'Unknown')}")
                
                # Process the submission
                result = submit_form_internal(submission_data)
                
                print(f"✅ Queue submission result: {result.get('status', 'unknown')}")
                
                # Mark task as done
                submission_queue.task_done()
                is_processing = False
                
                # Small delay between submissions
                time.sleep(2)
            else:
                time.sleep(1)  # Wait if queue is empty or processing
                
        except Exception as e:
            print(f"❌ Error in queue processing: {e}")
            is_processing = False
            time.sleep(5)

def submit_form_internal(form_data):
    """Internal function to submit form data"""
    try:
        # Extract form type and data
        form_type = form_data.get('form_type', 'braces')
        payload_data = form_data.get('payload', {})
        
        print(f"🔍 DEBUG - Received form_type: '{form_type}'")
        print(f"🔍 DEBUG - Form data keys: {list(form_data.keys())}")
        print(f"🔍 DEBUG - Payload keys: {list(payload_data.keys())[:10]}...")  # First 10 keys
        
        # Fill blank fields with appropriate defaults if they're empty
        for key, value in payload_data.items():
            if not value or str(value).strip() == "":
                # Use more appropriate defaults for specific fields
                if "entry.1328348461" in key:  # Agent name
                    payload_data[key] = "Default Agent"
                elif "entry.1007839295" in key:  # Closer name  
                    payload_data[key] = "Default Closer"
                elif "entry.1700120138" in key or "entry.1273829445" in key:  # Comments
                    payload_data[key] = "No additional comments"
                elif key.startswith("entry.") and ("INFO" in str(key) or key in ["entry.798980565", "entry.509267999", "entry.910343639", "entry.201070902", "entry.1948116165", "entry.84736707", "entry.1390847878", "entry.2082186628", "entry.1696174961", "entry.1784390417"]):
                    # Doctor fields - use "........" for missing doctors
                    payload_data[key] = "........"
                else:
                    payload_data[key] = "..."
        
        print(f"📋 Form type: {form_type}")
        print(f"📦 Payload fields: {len(payload_data)}")
        
        # Choose appropriate form URL
        if form_type.upper() == 'CGM':
            form_url = CGM_FORM_URL
            print(f"🩺 Submitting to CGM form: {form_url}")
        else:
            form_url = BRACES_FORM_URL
            print(f"🦴 Submitting to Braces form: {form_url}")
        
        # Convert payload to URL-encoded format with special handling for multiple braces
        payload_parts = []
        
        for key, value in payload_data.items():
            if key == "entry.987295788" and value:  # Requested braces field
                # Handle multiple braces separated by commas
                braces = str(value).split(",") if "," in str(value) else [str(value)]
                for brace in braces:
                    brace = brace.strip()
                    if brace and brace != "...":
                        payload_parts.append(f"{urllib.parse.quote(str(key))}={urllib.parse.quote(brace)}")
            else:
                payload_parts.append(f"{urllib.parse.quote(str(key))}={urllib.parse.quote(str(value))}")
        
        payload = '&'.join(payload_parts)
        
        # DEBUG: Print the first 500 characters of the payload
        print(f"🔍 DEBUG - First 500 chars of payload: {payload[:500]}")
        print(f"🔍 DEBUG - Sample entries:")
        for i, (k, v) in enumerate(list(payload_data.items())[:5]):
            print(f"   {k}: {v}")
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        print(f"🌐 Submitting form with {len(payload_data)} fields...")
        
        response = requests.post(form_url, data=payload, headers=headers, timeout=30)
        
        print(f"📊 Response status: {response.status_code}")
        
        # DEBUG: Print response content if it fails
        if response.status_code != 200:
            print(f"🔍 DEBUG - Response content: {response.text[:500]}")
        
        if response.status_code == 200:
            print(f"✅ {form_type.upper()} form submission successful!")
            success_message = f"{form_type.upper()} form submitted successfully"
            print(f"🔍 DEBUG - Success message: '{success_message}'")
            return {
                "status": "success", 
                "message": success_message,
                "form_type": form_type
            }
        else:
            print(f"❌ {form_type.upper()} form submission failed with status: {response.status_code}")
            error_message = f"{form_type.upper()} form submission failed"
            print(f"🔍 DEBUG - Error message: '{error_message}'")
            return {
                "status": "error", 
                "message": error_message,
                "form_type": form_type
            }
            
    except Exception as e:
        print(f"💥 Error during form submission: {str(e)}")
        return {
            "status": "error", 
            "message": str(e)
        }

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy", 
        "service": "Form Submission Server",
        "version": "1.0.0",
        "forms": ["braces", "cgm"]
    }), 200

@app.route('/submit-form', methods=['POST'])
def submit_form():
    """Submit form data after Medicare automation is complete"""
    print("📝 Received form submission request")
    
    try:
        # Get JSON data from request
        form_data = request.get_json()
        
        if not form_data:
            return jsonify({"status": "error", "message": "No data provided"}), 400
        
        # Use internal function for consistent processing
        result = submit_form_internal(form_data)
        
        if result.get("status") == "success":
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        print(f"💥 Error during form submission: {str(e)}")
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500

@app.route('/submit-form-from-sheets', methods=['POST'])
def submit_form_from_sheets():
    """Submit form data from Google Sheets via orchestration server"""
    print("📝 Received form submission request from Google Sheets")
    
    try:
        # Get request data
        request_data = request.get_json()
        
        if not request_data:
            return jsonify({"status": "error", "message": "No data provided"}), 400
        
        row_index = request_data.get('rowIndex')
        sheet_name = request_data.get('sheetName')
        has_doctors = request_data.get('hasDoctors', False)
        last_name = request_data.get('lastName', 'Unknown')
        
        print(f"📋 Queuing form submission for {last_name} (Row {row_index}, Sheet {sheet_name})")
        
        # Create a placeholder submission - the orchestration server should provide the full data
        # For now, we'll return success and let the orchestration server handle the data preparation
        form_submission_data = {
            "form_type": "braces",  # Default
            "payload": {
                "entry.1": "...",  # Placeholder - orchestration should provide real data
            },
            "rowIndex": row_index,
            "sheetName": sheet_name,
            "hasDoctors": has_doctors,
            "lastName": last_name
        }
        
        # Add to queue for processing
        submission_queue.put(form_submission_data)
        
        print(f"✅ Form submission queued for {last_name}")
        return jsonify({
            "status": "success", 
            "message": f"Form submission queued for {last_name}",
            "queueSize": submission_queue.qsize()
        }), 200
            
    except Exception as e:
        print(f"💥 Error queuing form submission: {str(e)}")
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500

@app.route('/queue-status', methods=['GET'])
def queue_status():
    """Get current queue status"""
    return jsonify({
        "queueSize": submission_queue.qsize(),
        "isProcessing": is_processing
    }), 200

@app.route('/submit', methods=['POST'])
def submit_braces_form():
    """Submit to the braces form (legacy endpoint)"""
    print("🦴 Received braces form submission request (legacy endpoint)")
    
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
    """Submit to the CGM form (legacy endpoint)"""
    print("🩺 Received CGM form submission request (legacy endpoint)")
    
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

if __name__ == '__main__':
    print("🚀 Starting Form Submission Server...")
    print(f"📋 Braces Form URL: {BRACES_FORM_URL}")
    print(f"🩺 CGM Form URL: {CGM_FORM_URL}")
    print(f"🔗 Submit Form: POST http://localhost:{port}/submit-form")
    print(f"📝 Submit from Sheets: POST http://localhost:{port}/submit-form-from-sheets")
    print(f"📊 Health check: http://localhost:{port}/health")
    print(f"📋 Queue status: GET http://localhost:{port}/queue-status")
    
    # Start the queue processing thread
    queue_thread = threading.Thread(target=process_submission_queue, daemon=True)
    queue_thread.start()
    print("🔄 Queue processing thread started")
    
    app.run(host='0.0.0.0', port=port, debug=True) 
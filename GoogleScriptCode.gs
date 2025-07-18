
var mainNgrokUrl = "37.114.32.62";

function onEdit(e) {
  console.log("🔥 onEdit triggered!");
  
  if (!e) {
    console.log("❌ No event object received");
    return;
  }
  
  // Prevent duplicate processing by checking if we're already processing this row
  const sheet = e.source.getActiveSheet();
  const editRow = e.range.getRow();
  
  // Use a simple lock mechanism to prevent duplicate processing
  const lockKey = sheet.getName() + "_" + editRow;
  const currentTime = new Date().getTime();
  
  // Check if we processed this row recently (within 5 seconds)
  if (typeof globalThis.processingLocks === 'undefined') {
    globalThis.processingLocks = {};
  }
  
  if (globalThis.processingLocks[lockKey] && (currentTime - globalThis.processingLocks[lockKey]) < 5000) {
    console.log("⏭️ Row " + editRow + " was recently processed, skipping to prevent duplicates");
    return;
  }
  
  // Set lock for this row
  globalThis.processingLocks[lockKey] = currentTime;

  const sheetName = sheet.getName();
  console.log("📄 Sheet name: " + sheetName);
  
  // Headers are in row 3, not row 1
  const headers = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];
  console.log("📋 Headers found: " + headers.join(", "));

  // Check if we're on either of the correct sheets
  if (sheetName !== "INCALL_1_RESPONSE" && sheetName !== "INCALL_2_RESPONSE") {
    console.log("⏭️ Wrong sheet, skipping. Expected: INCALL_1_RESPONSE or INCALL_2_RESPONSE, Got: " + sheetName);
    return;
  }

  const row = e.range.getRow();
  const col = e.range.getColumn();
  console.log("📍 Edit at Row: " + row + ", Col: " + col);
  
  // Skip if editing header row (Row 1 only)
  if (row <= 1) {
    console.log("⏭️ Editing header row, skipping");
    return;
  }
  
  // Get column indices for conditional submission
  const statusCol = headers.indexOf("Status") + 1;
  const qualityCheckCol1 = headers.indexOf("QUALITY CHECK") + 1; // First occurrence
  const qualityCheckCol2 = headers.lastIndexOf("QUALITY CHECK") + 1; // Second occurrence
  const leadStatusCol = headers.indexOf("Lead Status") + 1; // Lead Status column
  const medicareStatusCol = headers.indexOf("Medicare Status") + 1; // Medicare Status column
  
  console.log("🔍 Column indices - Status: " + statusCol + ", Quality Check 1: " + qualityCheckCol1 + ", Quality Check 2: " + qualityCheckCol2 + ", Lead Status: " + leadStatusCol + ", Medicare Status: " + medicareStatusCol);

  // Check if the edited column is Status or either QUALITY CHECK column
  if (col !== statusCol && col !== qualityCheckCol1 && col !== qualityCheckCol2) {
    console.log("⏭️ Wrong column edited. Expected Status(" + statusCol + "), QUALITY CHECK 1(" + qualityCheckCol1 + "), or QUALITY CHECK 2(" + qualityCheckCol2 + "), Got: " + col);
    return;
  }

  // Get current values for conditional columns
  const statusValue = statusCol > 0 ? sheet.getRange(row, statusCol).getValue() : "";
  const qualityCheckValue1 = qualityCheckCol1 > 0 ? sheet.getRange(row, qualityCheckCol1).getValue() : "";
  const qualityCheckValue2 = qualityCheckCol2 > 0 ? sheet.getRange(row, qualityCheckCol2).getValue() : "";
  const leadStatusValue = leadStatusCol > 0 ? sheet.getRange(row, leadStatusCol).getValue() : "";
  const medicareStatusValue = medicareStatusCol > 0 ? sheet.getRange(row, medicareStatusCol).getValue() : "";
  
  console.log("📊 Values - Status: '" + statusValue + "', Quality Check 1: '" + qualityCheckValue1 + "', Quality Check 2: '" + qualityCheckValue2 + "', Lead Status: '" + leadStatusValue + "', Medicare Status: '" + medicareStatusValue + "'");

  // Check if conditions are met for submission
  const validStatusValues = [
    "VERIFIED DR CHASE & CGM",
    "VERIFIED DR CHASE", 
    "VERIFIED CGM",
    "Verified Doc Chase more than 3mo",
    "CB VERIFIED DR CHASE",
    "PPO VERIFIED DR CHASE",
    "Verified Telemed",
    "CB REFILL"
  ];

  const isStatusValid = validStatusValues.some(validValue => 
    String(statusValue).trim().toUpperCase() === validValue.toUpperCase()
  );
  
  // Check if either QUALITY CHECK column has "PASSED"
  const isQualityCheckValid = 
    String(qualityCheckValue1).trim().toUpperCase() === "PASSED" || 
    String(qualityCheckValue2).trim().toUpperCase() === "PASSED";
  
  console.log("✅ Validation - Status Valid: " + isStatusValid + ", Quality Check Valid: " + isQualityCheckValid);

  // Only proceed if BOTH conditions are met (Status + Quality Check)
  if (!isStatusValid || !isQualityCheckValid) {
    console.log("❌ Conditions not met for submission");
    console.log("Status '" + statusValue + "' is valid: " + isStatusValid);
    console.log("Quality Check 1 '" + qualityCheckValue1 + "' is valid: " + (String(qualityCheckValue1).trim().toUpperCase() === "PASSED"));
    console.log("Quality Check 2 '" + qualityCheckValue2 + "' is valid: " + (String(qualityCheckValue2).trim().toUpperCase() === "PASSED"));
    return;
  }

  // Check if already submitted (Lead Status = "Submitted")
  if (String(leadStatusValue).trim().toUpperCase() === "SUBMITTED") {
    console.log("⏭️ Row " + row + " already submitted (Lead Status = Submitted), skipping.");
    return;
  }

  console.log("🚀 All conditions met, proceeding with submission...");

  // ✅ Get display values to preserve number/date formatting (from the data row)
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];

  // Safe getter function
  const get = (columnName) => {
    const i = headers.indexOf(columnName);
    const val = i >= 0 ? data[i] : "";
    return (val === "" || val === undefined) ? "....." : String(val).trim();
  };

  // Special getter for comments that replaces blanks with ".."
  const getComment = () => {
    const commentValue = get("COMMENT");
    return (commentValue === "" || commentValue === ".....") ? ".." : commentValue;
  };

  // 🆕 SMART GETTER FOR DOCTOR INFO - Try multiple column names
  const getDoctorInfo = () => {
    // Try multiple possible column names for doctor info
    const possibleNames = [
      "Doctor Info (Name/Address/Phone/Fax/NPI/Speciality)",
      "CLOSER COMMENT",
      "Doctor Info",
      "Closer Comment"
    ];
    
    for (let i = 0; i < possibleNames.length; i++) {
      const name = possibleNames[i];
      const value = get(name);
      if (value !== ".....") {
        console.log("✅ Found doctor info in column: '" + name + "' - Value: '" + value.substring(0, 50) + "...'");
        return value;
      }
    }
    
    console.log("⚠️ No doctor info found in any of these columns: " + possibleNames.join(', '));
    console.log("📋 Available headers (first 20): " + headers.slice(0, 20).join(', '));
    return ".....";
  };

  // 🔬 NEW MEDICARE INTEGRATION CHECK WITH PART A/B LOGIC
  // Check if we have the required Medicare data
  const lastName = get("PT Last Name");
  const medId = get("MEDICARE ID");
  const dob = get("DATE OF BIRTH");
  const zipCode = get("PT Zip Code");
  const partAEligibility = get("Part A Eligibility Start Date");  // Column AG
  const partBEligibility = get("Part B Eligibility Start Date");  // Column AH
  const closerComment = getDoctorInfo();

  console.log("🔍 Medicare Data Check:");
  console.log("Last Name: " + lastName);
  console.log("Medicare ID: " + medId);
  console.log("DOB: " + dob);
  console.log("Zip Code: " + zipCode);
  console.log("Part A Eligibility (AG): " + partAEligibility);
  console.log("Part B Eligibility (AH): " + partBEligibility);

  // 🆕 PART A/B ELIGIBILITY LOGIC
  const hasPartA = partAEligibility && partAEligibility !== ".....";
  const hasPartB = partBEligibility && partBEligibility !== ".....";
  
  console.log("Has Part A: " + hasPartA);
  console.log("Has Part B: " + hasPartB);

  // Step 1: Check if BOTH Part A and Part B are missing
  if (!hasPartA && !hasPartB) {
    console.log("❌ BOTH Part A and Part B are missing - Setting red background and status");
    
    try {
      // Set red background for entire row
      const range = sheet.getRange(row, 1, 1, sheet.getLastColumn());
      range.setBackground('#FF9999'); // Light red background
      console.log("✅ Red background applied to row " + row);
    } catch (bgError) {
      console.log("⚠️ Could not set red background: " + bgError.message);
    }
    
    // Set Lead Status to "Missing Part A or B"
    const leadStatusCol = headers.indexOf("Lead Status") + 1;
    if (leadStatusCol > 0) {
      sheet.getRange(row, leadStatusCol).setValue("Missing Part A or B");
      console.log("📊 Lead Status set to 'Missing Part A or B' for row " + row);
    }
    
    // Stop processing - do not add to queue or submit form
    console.log("🛑 Stopping all processing for row " + row + " - no eligibility data");
    return;
  }

  // Step 2: Determine which eligibility date to use
  let eligibilityToUse;
  let eligibilityType;
  
  if (hasPartA && !hasPartB) {
    // Only Part A has data
    eligibilityToUse = partAEligibility;
    eligibilityType = "Part A";
    console.log("🅰️ Using Part A eligibility: " + eligibilityToUse);
  } else if (!hasPartA && hasPartB) {
    // Only Part B has data
    eligibilityToUse = partBEligibility;
    eligibilityType = "Part B";
    console.log("🅱️ Using Part B eligibility: " + eligibilityToUse);
  } else {
    // Both have data - prefer Part B as per user requirement
    eligibilityToUse = partBEligibility;
    eligibilityType = "Part B (preferred)";
    console.log("🅱️ Using Part B eligibility (both available): " + eligibilityToUse);
  }

  // Step 3: Check if we have the minimum required Medicare data
  const hasMedicareData = lastName && lastName !== "....." && 
                         medId && medId !== "....." && 
                         dob && dob !== "....." && 
                         zipCode && zipCode !== "....." && 
                         eligibilityToUse && eligibilityToUse !== ".....";

  console.log("✅ Using " + eligibilityType + " eligibility");
  console.log("Has Complete Medicare Data: " + hasMedicareData);

  if (hasMedicareData) {
    console.log("🏥 MEDICARE AUTOMATION TRIGGERED!");
    
    // Update Medicare Status to show processing started
    if (medicareStatusCol > 0) {
      sheet.getRange(row, medicareStatusCol).setValue("Medicare Process Started");
    }
    
    // Prepare lead data for 3-step queue processing
    const leadData = {
      rowIndex: row,
      sheetName: sheetName,
      lastName: lastName,
      medId: medId,
      dob: dob,
      zipCode: zipCode,
      partAEligibility: partAEligibility,  // Send both Part A and Part B
      partBEligibility: partBEligibility,  // Server will auto-detect which to use
      firstName: get("PT First Name"),
      phoneNumber: get("PT PHONE NUMBER"),
      address: get("PT Street Address") + ", " + get("PT City") + ", " + get("PT State") + " " + zipCode,
      closerComment: closerComment
    };
    
    console.log("📤 Adding lead to 3-step workflow queue...");
    
         // Send to queue for 3-step processing: Medicare → Doctors → Form
     console.log("📤 Using ngrok URL: " + mainNgrokUrl);
     
     try {
       const response = UrlFetchApp.fetch(mainNgrokUrl + "/queue/add-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(leadData),
        muteHttpExceptions: true
      });
      
      const responseData = JSON.parse(response.getContentText());
      console.log("📨 Queue response:", responseData);
      
      if (response.getResponseCode() === 200 && responseData.success) {
        console.log("✅ Lead added to 3-step workflow queue successfully");
        console.log("Queue position: " + responseData.queuePosition);
        
        // Update Medicare Status to show queue position
        if (medicareStatusCol > 0) {
          sheet.getRange(row, medicareStatusCol).setValue("In 3-Step Queue (Position: " + responseData.queuePosition + ")");
        }
        
        // Server will process: Medicare → Doctors → Form
        console.log("🎯 Lead queued. Server will process: Medicare → Doctors → Form");
        
      } else {
        console.log("❌ Failed to add lead to queue");
        
        // Update Medicare Status with error
        if (medicareStatusCol > 0) {
          sheet.getRange(row, medicareStatusCol).setValue("Queue Error: " + (responseData.error || "Unknown error"));
        }
        
        // Proceed with normal form submission as fallback
        proceedWithNormalSubmission(headers, data, sheet, row, leadStatusCol);
      }
      
          } catch (error) {
      console.log("❌ Error adding to queue:", error.message);
      
      // Update Medicare Status with error
      if (medicareStatusCol > 0) {
        sheet.getRange(row, medicareStatusCol).setValue("Queue Connection Error");
      }
      
      // Proceed with normal form submission
      proceedWithNormalSubmission(headers, data, sheet, row, leadStatusCol);
    }
    
  } else {
    console.log("⏭️ Insufficient Medicare data, proceeding with normal submission");
    
    // Proceed with normal form submission
    proceedWithNormalSubmission(headers, data, sheet, row, leadStatusCol);
  }
}

// NEW FUNCTION: Monitor the complete 3-step workflow  
function monitorAutomationWorkflow() {
  console.log("🔍 Monitoring automation workflow...");
  
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();
    
    // Only monitor the correct sheets
    if (sheetName !== "ICO SUBMISSION ENGINE" && sheetName !== "OUT-SOURCING SUBMISSION ENGINE") {
      return;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    const headers = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];
    const medicareStatusCol = headers.indexOf("Medicare Status") + 1;
    const leadStatusCol = headers.indexOf("Lead Status") + 1;
    const credentialsCol = headers.indexOf("Credentials") + 1;
    
    // Find rows that are in different workflow stages
    for (let row = 2; row <= lastRow; row++) {
      const medicareStatus = medicareStatusCol > 0 ? sheet.getRange(row, medicareStatusCol).getValue() : "";
      const leadStatus = leadStatusCol > 0 ? sheet.getRange(row, leadStatusCol).getValue() : "";
      const credentials = credentialsCol > 0 ? sheet.getRange(row, credentialsCol).getValue() : "";
      
      // STAGE 1: Medicare account creation complete, trigger doctor fetching
      if (medicareStatus === "Medicare Account Creation In Progress" && credentials && credentials !== "") {
        console.log("🏥 Row " + row + ": Medicare complete, triggering doctor fetching");
        
        // Get row data for doctor fetching
        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
        const lastName = data[headers.indexOf("PT Last Name")] || "";
        
        if (lastName && lastName !== "") {
          // Update status
          sheet.getRange(row, medicareStatusCol).setValue("Doctor Fetching In Progress");
          
          // Trigger doctor fetching
          triggerDoctorFetching(lastName, credentials, row, sheetName);
        }
      }
      
      // STAGE 2: Doctor fetching complete, check if doctors were found
      else if (medicareStatus === "Doctor Fetching In Progress") {
        console.log("👨‍⚕️ Row " + row + ": Checking doctor fetching status");
        
        // Check if doctor info has been populated (columns AZ-BH, which are columns 52-60)
        const doctorRange = sheet.getRange(row, 52, 1, 9);
        const doctorValues = doctorRange.getValues()[0];
        const hasDoctors = doctorValues.some(val => val && val.toString().trim() !== "" && val.toString().trim() !== ".....");
        
        // Also check if lead status changed (doctor server updates this)
        if (leadStatus === "Submitted" || leadStatus === "Failed to Submit") {
          console.log("📝 Row " + row + ": Workflow complete - Lead Status: " + leadStatus);
          
          // Update final Medicare status
          if (hasDoctors) {
            sheet.getRange(row, medicareStatusCol).setValue("Complete with Doctors - Form Submitted");
          } else {
            sheet.getRange(row, medicareStatusCol).setValue("Complete without Doctors - Form Submitted");
          }
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Error in monitorAutomationWorkflow:", error);
  }
}

// NEW FUNCTION: Trigger doctor fetching
function triggerDoctorFetching(lastName, credentials, rowIndex, sheetName) {
  console.log("👨‍⚕️ Triggering doctor fetching for " + lastName + " (Row " + rowIndex + ")");
  
  try {
    const payload = {
      lastName: lastName,
      credentials: credentials,
      rowIndex: rowIndex,
      sheetName: sheetName
    };
    
    const response = UrlFetchApp.fetch(mainNgrokUrl + "/doctor-proxy/fetch-doctors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    console.log("📨 Doctor fetching response:", result);
    
    if (response.getResponseCode() === 200 && result.success) {
      console.log("✅ Doctor fetching request sent successfully");
    } else {
      console.log("❌ Doctor fetching request failed");
      
      // If doctor fetching fails, proceed to form submission without doctors
      const headers = SpreadsheetApp.getActiveSheet().getRange(3, 1, 1, SpreadsheetApp.getActiveSheet().getLastColumn()).getValues()[0];
      const data = SpreadsheetApp.getActiveSheet().getRange(rowIndex, 1, 1, SpreadsheetApp.getActiveSheet().getLastColumn()).getDisplayValues()[0];
      const leadStatusCol = headers.indexOf("Lead Status") + 1;
      
      proceedWithNormalSubmission(headers, data, SpreadsheetApp.getActiveSheet(), rowIndex, leadStatusCol);
    }
    
  } catch (error) {
    console.error("❌ Error triggering doctor fetching:", error);
    
    // If error, proceed to form submission without doctors
    const headers = SpreadsheetApp.getActiveSheet().getRange(3, 1, 1, SpreadsheetApp.getActiveSheet().getLastColumn()).getValues()[0];
    const data = SpreadsheetApp.getActiveSheet().getRange(rowIndex, 1, 1, SpreadsheetApp.getActiveSheet().getLastColumn()).getDisplayValues()[0];
    const leadStatusCol = headers.indexOf("Lead Status") + 1;
    
    proceedWithNormalSubmission(headers, data, SpreadsheetApp.getActiveSheet(), rowIndex, leadStatusCol);
  }
}

// ===============================================================================
// 🕐 TIME TRIGGER SETUP
// ===============================================================================

// Setup monitoring trigger (run this once to enable automatic workflow monitoring)
function setupAutomationMonitoring() {
  console.log("⏰ Setting up automation monitoring trigger...");
  
  try {
    // Delete existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'monitorAutomationWorkflow') {
        ScriptApp.deleteTrigger(trigger);
        console.log("🗑️ Deleted existing trigger");
      }
    });
    
    // Create new trigger every 30 seconds
    ScriptApp.newTrigger('monitorAutomationWorkflow')
      .timeBased()
      .everyMinutes(1) // Minimum is 1 minute for time-based triggers
      .create();
      
    console.log("✅ Monitoring trigger setup complete");
   // SpreadsheetApp.getUi().alert('Setup Complete', 'Automation monitoring trigger has been set up successfully!\n\nThe workflow will now automatically:\n1. Send Medicare requests\n2. Wait for credentials\n3. Trigger doctor fetching\n4. Submit forms when complete', SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    console.error("❌ Error setting up trigger:", error);
    //SpreadsheetApp.getUi().alert('Error', 'Error setting up monitoring: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// NEW FUNCTION: Proceed with normal form submission (fallback)
function proceedWithNormalSubmission(headers, data, sheet, row, leadStatusCol) {
  console.log("📤 Proceeding with normal form submission...");
  
  // Safe getter function
  const get = (columnName) => {
    const i = headers.indexOf(columnName);
    const val = i >= 0 ? data[i] : "";
    return (val === "" || val === undefined) ? "....." : String(val).trim();
  };

  // Special getter for comments that replaces blanks with ".."
  const getComment = () => {
    const commentValue = get("COMMENT");
    return (commentValue === "" || commentValue === ".....") ? ".." : commentValue;
  };

  // 🆕 SMART GETTER FOR DOCTOR INFO - Try multiple column names
  const getDoctorInfo = () => {
    // Try multiple possible column names for doctor info
    const possibleNames = [
      "Doctor Info (Name/Address/Phone/Fax/NPI/Speciality)",
      "CLOSER COMMENT",
      "Doctor Info",
      "Closer Comment"
    ];
    
    for (let i = 0; i < possibleNames.length; i++) {
      const name = possibleNames[i];
      const value = get(name);
      if (value !== ".....") {
        console.log("✅ Found doctor info in column: '" + name + "' - Value: '" + value.substring(0, 50) + "...'");
        return value;
      }
    }
    
    console.log("⚠️ No doctor info found in any of these columns: " + possibleNames.join(', '));
    console.log("📋 Available headers (first 20): " + headers.slice(0, 20).join(', '));
    return ".....";
  };

  // Check if this is VERIFIED CGM status
  const statusValue = get("Status");
  const isVerifiedCGM = String(statusValue).trim().toUpperCase() === "VERIFIED CGM";
  
  console.log("🎯 VERIFIED CGM status check: " + isVerifiedCGM);

  // Determine SITE based on sheet name
  const sheetName = sheet.getName();
  const siteValue = sheetName === "ICO SUBMISSION ENGINE" ? "Site One" : "Site Two";
  console.log("🏢 SITE determined from sheet '" + sheetName + "': " + siteValue);

  let url, basePayload;
  let requestedDevice = ""; // Declare at top level
  let isCGMDevice = false; // Declare at top level

  if (isVerifiedCGM) {
    // CGM Form URL and entry IDs for VERIFIED CGM
    url = mainNgrokUrl + "/form-proxy/submit-form";
    console.log("🌐 VERIFIED CGM detected! Submitting to CGM form via: " + url);
    
    basePayload = {
      "entry.1152696541": get("SNS RESULT *As It Sent to You In The Group*"), // SNS result
      "entry.853459889": get("PT First Name"), // First name
      "entry.2055051812": get("PT Last Name"), // Last name
      "entry.2144389945": get("PT PHONE NUMBER"), // Phone Number
      "entry.1977666841": get("PT Street Address"), // Address
      "entry.84029256": get("PT City"), // City
      "entry.472318100": get("PT State"), // State
      "entry.1039112181": get("PT Zip Code"), // Zip
      "entry.1410978985": get("DATE OF BIRTH"), // DOB
      "entry.698191178": get("MEDICARE ID"), // Med ID
      "entry.357870924": get("Height"), // Height
      "entry.1038328218": get("Weight"), // Weight
      "entry.531597245": get("Shoe Size"), // Shoe size
      "entry.665078034": get("Gender"), // Gender
      "entry.1926140785": getDoctorInfo(), // Doctor Info from sheet
      "entry.215461184": get("Agent's Name"), // Agent name
      "entry.1743984726": get("CLOSER NAME"), // Closer Name
      "entry.1179142597": siteValue, // SITE
      "entry.1273829445": getComment() // COMMENT
    };
  } else {
    // Check device type for regular leads (not VERIFIED CGM)
    requestedDevice = get("REQUESTED Device ");
    isCGMDevice = String(requestedDevice).trim().toUpperCase() === "CGM DEVICE";
    
    console.log("🔍 Requested Device: '" + requestedDevice + "', Is CGM Device: " + isCGMDevice);
    
    if (isCGMDevice) {
      // CGM Form URL and entry IDs (for CGM DEVICE)
      url = mainNgrokUrl + "/form-proxy/submit-form";
      console.log("🌐 CGM Device detected! Submitting to CGM form via: " + url);
      
      basePayload = {
        "entry.1152696541": get("SNS RESULT *As It Sent to You In The Group*"), // SNS result
        "entry.853459889": get("PT First Name"), // First name
        "entry.2055051812": get("PT Last Name"), // Last name
        "entry.2144389945": get("PT PHONE NUMBER"), // Phone Number
        "entry.1977666841": get("PT Street Address"), // Address
        "entry.84029256": get("PT City"), // City
        "entry.472318100": get("PT State"), // State
        "entry.1039112181": get("PT Zip Code"), // Zip
        "entry.1410978985": get("DATE OF BIRTH"), // DOB
        "entry.698191178": get("MEDICARE ID"), // Med ID
        "entry.357870924": get("Height"), // Height
        "entry.1038328218": get("Weight"), // Weight
        "entry.531597245": get("Shoe Size"), // Shoe size
        "entry.665078034": get("Gender"), // Gender
        "entry.1926140785": getDoctorInfo(), // Doctor Info from sheet
        "entry.215461184": get("Agent's Name"), // Agent name
        "entry.1743984726": get("CLOSER NAME"), // Closer Name
        "entry.1179142597": siteValue, // SITE
        "entry.1273829445": getComment() // COMMENT
      };
    } else {
      // Regular Braces Form URL and entry IDs (includes mixed CGM+Braces)
      url = mainNgrokUrl + "/form-proxy/submit-form";
      console.log("🌐 Braces/Mixed device detected! Submitting to braces form via: " + url);
      
      basePayload = {
        "entry.534497717": get("SNS RESULT *As It Sent to You In The Group*"), // SNS result
        "entry.987295788": get("REQUESTED Device "), // Requested braces (note trailing space)
        "entry.311509461": get("PT First Name"), // First name
        "entry.1954362581": get("PT Last Name"), // Last name
        "entry.647663825": get("PT PHONE NUMBER"), // Phone Number
        "entry.1025449182": get("PT Street Address"), // Address
        "entry.1726047969": get("PT City"), // City
        "entry.1820794877": get("PT State"), // State
        "entry.438852095": get("PT Zip Code"), // Zip
        "entry.404360623": get("DATE OF BIRTH"), // DOB
        "entry.309323976": get("MEDICARE ID"), // Med ID
        "entry.260318019": get("Height"), // Height
        "entry.646279815": get("Weight"), // Weight
        "entry.1541531810": get("Waist Size"), // Waist size
        "entry.1398739596": get("Shoe Size"), // Shoe size
        "entry.1411909225": get("Gender"), // Gender
        // Doctor fields - DR1 from sheet, others placeholder
        "entry.798980565": getDoctorInfo(), // Dr 1 INFO from sheet
        "entry.509267999": ".....", // Dr 2 INFO
        "entry.910343639": ".....", // Dr 3 INFO
        "entry.201070902": ".....", // Dr 4 INFO
        "entry.1948116165": ".....", // Dr 5 INFO
        "entry.84736707": ".....", // Dr 6 INFO
        "entry.1390847878": ".....", // Dr 7 INFO
        "entry.2082186628": ".....", // Dr 8 INFO
        "entry.1696174961": ".....", // Dr 9 INFO
        "entry.1784390417": ".....", // Dr 10 INFO
        "entry.1328348461": get("Agent's Name"), // Agent name
        "entry.1007839295": get("CLOSER NAME"), // Closer Name
        "entry.596336074": siteValue, // SITE
        "entry.1418374363": "Main", // MAIN / INTAKE
        "entry.1700120138": getComment() // COMMENT
      };
    }
  }

  console.log("📦 Payload prepared with " + Object.keys(basePayload).length + " fields");

  // 🆕 DETERMINE FORM TYPE FOR JSON SUBMISSION
  let formType;
  if (isVerifiedCGM || isCGMDevice) {
    formType = "cgm";
  } else {
    formType = "braces";
  }
  
  console.log("🔍 Form type determined: " + formType);

  // 🆕 PREPARE JSON PAYLOAD FOR FORM SERVER
  const formSubmissionData = {
    form_type: formType,
    payload: basePayload
  };

  console.log("📤 Sending JSON form request to form-proxy...");

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      payload: JSON.stringify(formSubmissionData),
      muteHttpExceptions: true
    });

    console.log("📨 Response received - Status: " + response.getResponseCode());

    if (response.getResponseCode() === 200) {
      // Mark as submitted successfully
      if (leadStatusCol > 0) {
        sheet.getRange(row, leadStatusCol).setValue("Submitted");
      }
      console.log("✅ Submitted row " + row + " successfully. Lead Status set to 'Submitted'.");
    } else {
      // Mark as failed to submit
      if (leadStatusCol > 0) {
        sheet.getRange(row, leadStatusCol).setValue("Failed to Submit");
      }
      console.log("❌ Submission failed for row " + row + ". Code: " + response.getResponseCode() + ". Lead Status set to 'Failed to Submit'.");
      console.log("Response: " + response.getContentText());
    }
  } catch (err) {
    // Mark as failed to submit on error
    if (leadStatusCol > 0) {
      sheet.getRange(row, leadStatusCol).setValue("Failed to Submit");
    }
    console.log("❌ Error submitting row " + row + ": " + err.message + ". Lead Status set to 'Failed to Submit'.");
  }
}

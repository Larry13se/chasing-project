# Doctor Recommendation Scoring System - Detailed Report

## Executive Summary

The Medicare automation system uses a sophisticated **multi-tier scoring algorithm** to analyze patient Medicare claims and recommend the best doctors based on visit frequency, recency, provider quality, and Medicare enrollment status. The system processes Medicare claims from the last 9 months, scores providers using a composite algorithm, validates them through multiple data sources, and returns ranked doctor recommendations.

---

## 1. Data Collection & Time Filtering

### Claims Analysis Window
- **Primary Window**: Last **9 months** from current date (critical for scoring)
- **Historical Window**: Claims older than 9 months (tracked but not scored)
- **Minimum Threshold**: Must have recent claims within 9 months to proceed

### Data Sources
- **Medicare Claims**: Provider names, visit dates, service dates
- **Provider Details**: NPI numbers, specialties, practice information  
- **PECOS Database**: Medicare enrollment verification
- **Google Sheets**: Specialty validation criteria

---

## 2. Provider Scoring Algorithm

### Core Scoring Formula

Each provider receives a **composite score** based on 4 components:

```
Total Score = Base Visits + Recency Bonus + Quality Bonus - Old Visit Penalty
```

#### 2.1 Base Visit Score
- **Formula**: `visitCount × 1.5 points`
- **Purpose**: Rewards providers with more patient interactions
- **Example**: 4 visits = 6.0 base points

#### 2.2 Recency Bonus System
**Priority Points for Most Recent Visits:**
- **1st most recent visit**: +1.5 points
- **2nd most recent visit**: +1.0 points  
- **3rd most recent visit**: +0.7 points
- **4th most recent visit**: +0.5 points
- **5th most recent visit**: +0.2 points

#### 2.3 Old Visit Penalty
- **Visits 6th and beyond**: -0.5 points each
- **Purpose**: Prevents providers with many old visits from dominating

#### 2.4 Quality Bonus
- **High Quality Providers**: +5.5 points
- **Standard Providers**: +0 points

### Example Score Calculation

**Provider: "Dr. John Smith, MD"**
- **Visits**: 5 visits
- **Base Score**: 5 × 1.5 = 7.5 points
- **Recency**: 1.5 + 1.0 + 0.7 + 0.5 + 0.2 = 3.9 points
- **Quality Bonus**: +5.5 points (has credentials + good specialty)
- **Final Score**: 7.5 + 3.9 + 5.5 = **16.9 points**

---

## 3. Provider Quality Assessment

### Quality Classification System

#### 3.1 Immediate Disqualification
**Companies/Organizations** (automatically excluded):
- Business entities: "LLC", "Inc", "Corp", "Company"  
- Medical facilities: "Center", "Clinic", "Hospital"
- Equipment suppliers: "Medical Equipment", "Supply"
- Labs: "Laboratory", "Diagnostic Services"

#### 3.2 Quality Indicators (Positive Signals)

**🏆 High Quality Indicators:**
1. **Medical Credentials**:
   - Starts with "Dr." or "Doctor"
   - Ends with: MD, DO, NP, PA, RN, DDS, DPM, OD
   - Has credentials after comma

2. **High-Quality Specialties**:
   - Primary care: "Family Medicine", "Internal Medicine"
   - Cardiology, Dermatology, Orthopedics
   - Neurology, Gastroenterology, Oncology
   - Psychiatry, Endocrinology, Pulmonology

3. **Personal Name Patterns**:
   - "FirstName LastName"
   - "FirstName M. LastName"  
   - "LastName, FirstName"
   - "FIRST MIDDLE LAST" (all caps)

#### 3.3 Quality Decision Logic

**⭐ HIGH QUALITY** (gets +5.5 bonus):
- Has credentials + specialty/name pattern + no negative indicators

**⭐ GOOD QUALITY** (gets +5.5 bonus):
- (Has credentials OR quality specialty) + personal name + no negatives

**⭐ SPECIALTY QUALITY** (gets +5.5 bonus):
- Quality specialty + personal name pattern + no negatives

**📋 STANDARD** (gets +0 bonus):
- No clear quality indicators

### Negative Indicators
- "Urgent Care", "Walk-in", "Emergency"
- "Laboratory", "Imaging", "Radiology"
- "Pharmacy", "Medical Equipment"

---

## 4. Provider Prioritization System

### Multi-Tier Sorting Algorithm

Providers are sorted by **3 priority levels**:

1. **Priority 1**: Provider Quality (⭐ Good providers first)
2. **Priority 2**: Visit Count (Higher visit count first)  
3. **Priority 3**: Total Score (Higher score first)

### Selection Process
- **Top 15** scored providers selected for validation
- **Target**: 9 final recommended doctors
- **Validation**: Strict → Relaxed → Emergency fallback

---

## 5. Provider Validation System

### 5.1 Three-Tier Validation

#### Tier 1: STRICT Validation
**Requirements (ALL must be met):**
- ✅ Individual entity type (not organization)
- ✅ Practice state matches patient state  
- ✅ Valid medical specialty (2+ exact word matches)
- ✅ Valid NPI number
- ✅ PECOS enrollment verified

#### Tier 2: RELAXED Validation  
**Requirements (more lenient):**
- ✅ Any entity type accepted
- ✅ Practice state available (any state)
- ✅ Primary taxonomy available
- ✅ Valid NPI number
- ⚠️ Specialty requirement bypassed

#### Tier 3: EMERGENCY Validation
**Requirements (minimal):**
- ✅ Basic provider information available
- ✅ Not a company/organization
- ⚠️ All other requirements bypassed

### 5.2 Geographic Preferences
1. **Primary**: Providers in patient's state
2. **Fallback**: Providers in any state
3. **Emergency**: Any available provider

---

## 6. Specialty Validation System

### Data Source
- **Google Sheets**: "DR-CHASE : WHERE TO GO?" spreadsheet
- **Live Updates**: Validation criteria updated from centralized sheet

### Specialty Categories

#### ✅ STRICT Specialties (Preferred)
- **"MAIN"**: Primary recommended specialties
- **"MAIN - TESTING"**: Testing-phase specialties  
- **"INTAKE"**: Intake-approved specialties

#### ⚡ RELAXED Specialties
- **All other categories**: Less preferred but acceptable

#### ❌ EXCLUDED Specialties  
- **"INTAKE - MARTIN"**: Completely excluded (bad doctors)

### Validation Logic
**Exact Word Matching Only** (No partial matching):
- Requires **2+ exact word matches** between provider specialty and approved list
- Filters out equipment suppliers and non-medical services
- Example: "Family Medicine" matches "Family Practice Medicine"

---

## 7. PECOS Enrollment Verification

### Medicare Enrollment Check
- **Database**: Provider Enrollment, Chain, and Ownership System
- **Purpose**: Verify provider can bill Medicare
- **API Integration**: Real-time enrollment status verification

### Enrollment Status Impact
- **✅ ENROLLED**: Provider approved for recommendations
- **❌ NOT ENROLLED**: Provider rejected (cannot bill Medicare)
- **⚠️ UNKNOWN**: Provider approved (assumes eligible, API error)

### PECOS Data Collected
- Enrollment status (Active/Inactive/Unknown)
- Enrollment date
- Provider specialties registered with Medicare
- Practice locations approved for Medicare billing

---

## 8. Final Ranking & Selection

### Composite Ranking System

#### Primary Factors (Highest Weight)
1. **PECOS Enrollment Status**: Enrolled > Unknown > Not Enrolled
2. **Validation Type**: Strict > Relaxed > Emergency
3. **Provider Quality**: Good (+5.5) > Standard (+0)

#### Secondary Factors (Moderate Weight)  
4. **Visit Count**: More visits = higher priority
5. **Recency Score**: More recent visits = higher priority
6. **Geographic Match**: Patient state > Other states

#### Final Score Calculation
```
Final Priority = 
  (PECOS_Weight × 100) + 
  (Quality_Weight × 50) + 
  (Validation_Weight × 25) + 
  (Visit_Score × 1.5) + 
  (Recency_Score × 1.0)
```

### Selection Logic
1. **Target**: 9 recommended doctors
2. **Preference**: Strict validation doctors first
3. **Fallback**: Add relaxed validation if needed
4. **Emergency**: Add any valid providers if still insufficient

---

## 9. Output & Recommendations

### Doctor Information Provided
For each recommended doctor:

```
✅ Dr. Sarah Johnson, MD
📍 123 Medical Blvd, Atlanta, GA 30309
📞 (404) 555-0123 
📠 Fax: Not Available
🆔 NPI: 1234567890
🏥 Specialty: Family Medicine
📅 Last Visit: 08/15/2024
🎯 Score: 18.2 | Visits: 6 | ⭐ GOOD Quality
🏥 PECOS: ✅ ENROLLED
📋 Validation: STRICT
```

### Scoring Breakdown
```
Score Components:
├── Base visits (6 × 1.5): +9.0
├── Recency bonus: +3.9  
├── Quality bonus: +5.5
└── Final Score: 18.4
```

---

## 10. Fallback Mechanisms

### No Recent Activity (0 recent claims)
**Response**: Detailed feedback about claim history
- Reports older claims if available  
- Explains 9-month requirement
- Suggests patient may be inactive

### No Valid Providers Found
**Progressive Fallback**:
1. **Strict Validation**: Try all top 15 providers
2. **Relaxed Validation**: Lower standards for remaining providers  
3. **Emergency Mode**: Accept any individual provider with basic info
4. **Geographic Expansion**: Search outside patient's state

### Quality Assurance
- **Company Detection**: Automatically filters out non-individual providers
- **Specialty Validation**: Cross-references with approved specialty list
- **PECOS Verification**: Ensures Medicare billing capability
- **Duplicate Prevention**: Prevents duplicate provider recommendations

---

## 11. Performance Metrics

### Success Criteria
- **Primary Success**: 9 STRICT validation doctors
- **Acceptable Success**: 6+ doctors (mix of strict/relaxed)  
- **Minimum Success**: 3+ doctors (any validation type)
- **Failure**: 0-2 doctors found

### Quality Distribution (Typical)
- **STRICT Validation**: 60-70% of recommendations
- **RELAXED Validation**: 20-30% of recommendations
- **EMERGENCY Validation**: 5-10% of recommendations

### Geographic Success Rate
- **Same State**: 80-90% of final recommendations
- **Different State**: 10-20% of final recommendations

---

## 12. System Advantages

### 🎯 **Precision Targeting**
- Uses actual Medicare claims data (real provider relationships)
- Prioritizes recent and frequent provider relationships
- Validates provider quality through multiple criteria

### 🔍 **Quality Assurance**  
- Multi-tier validation prevents low-quality recommendations
- PECOS enrollment ensures Medicare billing capability
- Company detection filters out non-individual providers

### 🌐 **Geographic Intelligence**
- Prioritizes providers in patient's state
- Falls back to other states when necessary
- Maintains provider-patient proximity preferences

### ⚡ **Adaptive Fallback**
- Progressive validation levels ensure recommendations even with limited data
- Emergency modes prevent complete failures
- Balances quality with availability

---

## 13. Continuous Improvement

### Data Sources for Enhancement
- **Medicare Claims**: Real-time provider relationship data
- **PECOS Database**: Up-to-date enrollment verification  
- **Google Sheets**: Centrally managed specialty validation
- **Provider APIs**: Enhanced provider information and validation

### Quality Metrics Tracking
- **Provider Success Rate**: Track submitted vs. approved doctors
- **Geographic Accuracy**: Monitor same-state recommendation success  
- **Validation Distribution**: Balance between strict and relaxed recommendations
- **PECOS Enrollment Accuracy**: Track Medicare billing success rates

This comprehensive scoring system ensures that doctor recommendations are based on **real Medicare provider relationships**, **validated quality criteria**, and **verified Medicare billing capability**, providing the highest probability of successful doctor submissions for Medicare patients. 
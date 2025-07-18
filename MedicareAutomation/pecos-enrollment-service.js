const axios = require('axios');

class PECOSEnrollmentService {
    constructor() {
        this.baseURL = 'https://data.cms.gov/data-api/v1/dataset';
        // Try multiple possible dataset IDs for PECOS/provider enrollment data
        this.possibleDatasetIds = [
            'pecos-providers',
            'provider-enrollment',
            'medicare-provider-enrollment',
            'pecos-enrollment',
            'medicare-providers',
            'provider-data'
        ];
        this.rateLimitDelay = 500; // Increased to 500ms between requests
        this.workingDatasetId = null; // Cache the working dataset ID
    }

    async findWorkingDatasetId() {
        if (this.workingDatasetId) {
            return this.workingDatasetId;
        }

        console.log('🔍 Searching for correct CMS PECOS dataset...');
        
        for (const datasetId of this.possibleDatasetIds) {
            try {
                console.log(`   Testing dataset ID: ${datasetId}`);
                
                const response = await axios.get(`${this.baseURL}/${datasetId}/data`, {
                    params: { limit: 1 },
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Medicare-Automation/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.status === 200) {
                    console.log(`✅ Found working dataset: ${datasetId}`);
                    this.workingDatasetId = datasetId;
                    return datasetId;
                }
                
            } catch (error) {
                console.log(`   ❌ Dataset ${datasetId} not found (${error.response?.status || error.message})`);
                continue;
            }
            
            await this.delay(this.rateLimitDelay);
        }
        
        console.log('❌ No working PECOS dataset found in CMS API');
        return null;
    }

    async checkProviderEnrollment(npi) {
        try {
            console.log(`🔍 Checking PECOS enrollment for NPI: ${npi}`);
            
            if (!npi || npi.length !== 10) {
                console.log(`❌ Invalid NPI format: ${npi}`);
                return {
                    isEnrolled: false,
                    status: 'Invalid NPI',
                    error: 'NPI must be 10 digits'
                };
            }

            // Add delay to respect rate limits
            await this.delay(this.rateLimitDelay);

            // First, try to find a working dataset
            const datasetId = await this.findWorkingDatasetId();
            
            if (!datasetId) {
                console.log(`⚠️  No CMS dataset available - using alternative verification method`);
                return await this.alternativeEnrollmentCheck(npi);
            }

            // Query CMS Data API for PECOS enrollment data
            const response = await axios.get(`${this.baseURL}/${datasetId}/data`, {
                params: {
                    filter: `npi:${npi}`,
                    limit: 1
                },
                timeout: 30000,
                headers: {
                    'User-Agent': 'Medicare-Automation/1.0',
                    'Accept': 'application/json'
                }
            });

            if (response.data && response.data.length > 0) {
                const providerData = response.data[0];
                
                // Check enrollment status
                const enrollmentStatus = this.parseEnrollmentStatus(providerData);
                
                console.log(`✅ PECOS data found for NPI ${npi}:`);
                console.log(`   📋 Status: ${enrollmentStatus.status}`);
                console.log(`   📅 Enrollment Date: ${enrollmentStatus.enrollmentDate || 'Not available'}`);
                console.log(`   🏥 Provider Type: ${enrollmentStatus.providerType || 'Not specified'}`);
                
                return {
                    isEnrolled: enrollmentStatus.isActive,
                    status: enrollmentStatus.status,
                    enrollmentDate: enrollmentStatus.enrollmentDate,
                    providerType: enrollmentStatus.providerType,
                    deactivationDate: enrollmentStatus.deactivationDate,
                    rawData: providerData,
                    dataSource: 'CMS API'
                };
                
            } else {
                console.log(`❌ Provider NPI ${npi} not found in PECOS database - NOT ENROLLED`);
                return {
                    isEnrolled: false,
                    status: 'Not Found in PECOS',
                    error: 'Provider not found in Medicare PECOS enrollment database',
                    dataSource: 'CMS API',
                    enrollmentDate: null,
                    providerType: 'Unknown'
                };
            }

        } catch (error) {
            console.error(`❌ Error checking PECOS enrollment for NPI ${npi}:`, error.message);
            
            // Handle specific error cases
            if (error.response?.status === 404) {
                console.log(`⚠️  Dataset not found - trying alternative verification`);
                return await this.alternativeEnrollmentCheck(npi);
            } else if (error.response?.status === 429) {
                console.log(`⚠️  Rate limited - waiting and retrying...`);
                await this.delay(2000); // Wait 2 seconds on rate limit
                return await this.checkProviderEnrollment(npi); // Retry once
            } else {
                // For other API errors, use alternative check
                console.log(`⚠️  API error - using alternative verification`);
                return await this.alternativeEnrollmentCheck(npi);
            }
        }
    }

    async alternativeEnrollmentCheck(npi) {
        try {
            console.log(`🔄 Using alternative enrollment verification for NPI: ${npi}`);
            console.log(`⚠️  NOTE: This is only used when PECOS API is completely unavailable`);
            
            // Alternative approach: Only use when API is completely unavailable
            // This should NOT be used when dataset exists but provider not found
            
            // Basic NPI validation (Luhn algorithm check)
            const isValidNPI = this.validateNPIChecksum(npi);
            
            if (isValidNPI) {
                console.log(`✅ NPI ${npi} passes validation - UNKNOWN enrollment status (API unavailable)`);
                console.log(`⚠️  WARNING: Cannot verify actual PECOS enrollment - API unavailable`);
                return {
                    isEnrolled: null, // Unknown status - will be treated as "proceed with caution"
                    status: 'Unknown - API Unavailable',
                    error: 'CMS PECOS API completely unavailable - cannot verify enrollment',
                    dataSource: 'NPI Validation Fallback',
                    enrollmentDate: null,
                    providerType: 'Unknown'
                };
            } else {
                console.log(`❌ NPI ${npi} fails validation - Invalid NPI`);
                return {
                    isEnrolled: false,
                    status: 'Invalid NPI',
                    error: 'NPI failed checksum validation',
                    dataSource: 'NPI Validation'
                };
            }
            
        } catch (error) {
            console.log(`⚠️  Alternative verification failed: ${error.message}`);
            return {
                isEnrolled: null, // Unknown - cannot determine enrollment
                status: 'Verification Failed',
                error: 'All enrollment verification methods failed',
                dataSource: 'Error Fallback'
            };
        }
    }

    validateNPIChecksum(npi) {
        try {
            // NPI Luhn algorithm validation
            if (!/^\d{10}$/.test(npi)) {
                return false;
            }
            
            // Add prefix "80840" to make it 15 digits for Luhn check
            const fullNumber = '80840' + npi;
            
            let sum = 0;
            let alternate = false;
            
            // Process digits from right to left
            for (let i = fullNumber.length - 1; i >= 0; i--) {
                let digit = parseInt(fullNumber.charAt(i));
                
                if (alternate) {
                    digit *= 2;
                    if (digit > 9) {
                        digit = (digit % 10) + 1;
                    }
                }
                
                sum += digit;
                alternate = !alternate;
            }
            
            return (sum % 10) === 0;
            
        } catch (error) {
            console.log(`⚠️  NPI validation error: ${error.message}`);
            return false;
        }
    }

    parseEnrollmentStatus(providerData) {
        try {
            // Parse different possible field names from CMS API
            const status = providerData.enrollment_status || 
                          providerData.provider_status || 
                          providerData.status || 
                          'Unknown';
            
            const enrollmentDate = providerData.enrollment_date || 
                                  providerData.effective_date || 
                                  null;
            
            const deactivationDate = providerData.deactivation_date || 
                                    providerData.termination_date || 
                                    null;
            
            const providerType = providerData.provider_type || 
                                providerData.entity_type || 
                                'Unknown';

            // Determine if provider is actively enrolled
            const activeStatuses = ['enrolled', 'active', 'approved', 'valid'];
            const isActive = activeStatuses.some(activeStatus => 
                status.toLowerCase().includes(activeStatus)
            ) && !deactivationDate;

            return {
                status,
                isActive,
                enrollmentDate,
                deactivationDate,
                providerType
            };
            
        } catch (error) {
            console.log(`⚠️  Error parsing enrollment status:`, error.message);
            return {
                status: 'Parse Error',
                isActive: false,
                enrollmentDate: null,
                deactivationDate: null,
                providerType: 'Unknown'
            };
        }
    }

    async checkMultipleProviders(npiList) {
        console.log(`🔍 Checking PECOS enrollment for ${npiList.length} providers...`);
        
        const results = [];
        let enrolledCount = 0;
        let notEnrolledCount = 0;
        let unknownCount = 0;
        let errorCount = 0;

        for (let i = 0; i < npiList.length; i++) {
            const npi = npiList[i];
            console.log(`\n📋 Checking ${i + 1}/${npiList.length}: NPI ${npi}`);
            
            const result = await this.checkProviderEnrollment(npi);
            results.push({
                npi,
                ...result
            });

            // Count results
            if (result.isEnrolled === true) {
                enrolledCount++;
            } else if (result.isEnrolled === false) {
                notEnrolledCount++;
            } else if (result.isEnrolled === null) {
                unknownCount++;
            } else {
                errorCount++;
            }

            // Progress logging
            console.log(`📊 Progress: ${enrolledCount} enrolled, ${notEnrolledCount} not enrolled, ${unknownCount} unknown, ${errorCount} errors`);
        }

        console.log(`\n📊 PECOS Enrollment Check Summary:`);
        console.log(`   ✅ Enrolled: ${enrolledCount}`);
        console.log(`   ❌ Not Enrolled: ${notEnrolledCount}`);
        console.log(`   ⚠️  Unknown: ${unknownCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📋 Total Checked: ${npiList.length}`);

        return results;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility method to get enrollment summary
    getEnrollmentSummary(enrollmentResults) {
        const summary = {
            total: enrollmentResults.length,
            enrolled: enrollmentResults.filter(r => r.isEnrolled === true).length,
            notEnrolled: enrollmentResults.filter(r => r.isEnrolled === false).length,
            unknown: enrollmentResults.filter(r => r.isEnrolled === null).length,
            errors: enrollmentResults.filter(r => r.isEnrolled === undefined).length,
            enrollmentRate: 0
        };

        if (summary.total > 0) {
            // Calculate enrollment rate excluding unknowns
            const knownResults = summary.enrolled + summary.notEnrolled;
            if (knownResults > 0) {
                summary.enrollmentRate = ((summary.enrolled / knownResults) * 100).toFixed(1);
            }
        }

        return summary;
    }
}

module.exports = PECOSEnrollmentService; 
class NPIRegistryService {
    constructor() {
        this.baseUrl = 'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search';
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Search for providers using the NPI Registry API
     * @param {string} providerName - The name of the provider to search for
     * @param {string} state - The state to search in (optional)
     * @param {number} maxResults - Maximum number of results (default: 10)
     * @returns {Promise<Array>} Array of provider objects
     */
    async searchProviders(providerName, state = null, maxResults = 10) {
        try {
            console.log(`🔍 Searching NPI Registry for: "${providerName}"${state ? ` in ${state}` : ''}`);
            
            // Build search terms
            let searchTerms = providerName.trim();
            if (state) {
                searchTerms += ` ${state}`;
            }

            // Build API URL with parameters
            const params = new URLSearchParams({
                terms: searchTerms,
                maxList: maxResults,
                // Request specific fields we need for validation
                ef: 'NPI,name.full,name.first,name.last,name.credential,gender,provider_type,addr_practice.full,addr_practice.city,addr_practice.state,addr_practice.zip,addr_practice.phone,addr_practice.fax,licenses'
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            console.log(`📡 API Request: ${url}`);

            const response = await this.makeRequest(url);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`📊 API Response: Found ${data[0]} total matches, returning ${data[1]?.length || 0} results`);

            return this.parseApiResponse(data, state);

        } catch (error) {
            console.error(`❌ Error searching NPI Registry:`, error);
            return [];
        }
    }

    /**
     * Get detailed provider information by NPI number
     * @param {string} npiNumber - The NPI number to lookup
     * @returns {Promise<Object|null>} Provider object or null
     */
    async getProviderByNPI(npiNumber) {
        try {
            console.log(`🔍 Looking up NPI: ${npiNumber}`);
            
            const params = new URLSearchParams({
                terms: npiNumber,
                maxList: 1,
                ef: 'NPI,name.full,name.first,name.last,name.credential,gender,provider_type,addr_practice.full,addr_practice.city,addr_practice.state,addr_practice.zip,addr_practice.phone,addr_practice.fax,licenses'
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            const response = await this.makeRequest(url);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const providers = this.parseApiResponse(data);
            
            return providers.length > 0 ? providers[0] : null;

        } catch (error) {
            console.error(`❌ Error looking up NPI ${npiNumber}:`, error);
            return null;
        }
    }

    /**
     * Parse the API response into a standardized format
     * @param {Array} apiData - Raw API response data
     * @param {string} targetState - Optional state filter
     * @returns {Array} Parsed provider objects
     */
    parseApiResponse(apiData, targetState = null) {
        try {
            const [totalCount, npiCodes, extraFields, displayFields] = apiData;
            
            if (!npiCodes || npiCodes.length === 0) {
                return [];
            }

            const providers = [];

            for (let i = 0; i < npiCodes.length; i++) {
                const npi = npiCodes[i];
                const display = displayFields[i] || [];
                
                // Extract data from extra fields
                const providerData = {
                    npi: npi,
                    fullName: this.getFieldValue(extraFields, 'name.full', i) || display[1] || '',
                    firstName: this.getFieldValue(extraFields, 'name.first', i) || '',
                    lastName: this.getFieldValue(extraFields, 'name.last', i) || '',
                    credential: this.getFieldValue(extraFields, 'name.credential', i) || '',
                    gender: this.getFieldValue(extraFields, 'gender', i) || '',
                    providerType: this.getFieldValue(extraFields, 'provider_type', i) || display[2] || '',
                    practiceAddress: this.getFieldValue(extraFields, 'addr_practice.full', i) || display[3] || '',
                    practiceCity: this.getFieldValue(extraFields, 'addr_practice.city', i) || '',
                    practiceState: this.getFieldValue(extraFields, 'addr_practice.state', i) || '',
                    practiceZip: this.getFieldValue(extraFields, 'addr_practice.zip', i) || '',
                    practicePhone: this.getFieldValue(extraFields, 'addr_practice.phone', i) || '',
                    practiceFax: this.getFieldValue(extraFields, 'addr_practice.fax', i) || '',
                    licenses: this.getFieldValue(extraFields, 'licenses', i) || []
                };

                // Filter by state if specified
                if (targetState && providerData.practiceState !== targetState) {
                    console.log(`⏭️  Skipping provider ${providerData.fullName} - wrong state (${providerData.practiceState}, need ${targetState})`);
                    continue;
                }

                // Extract primary taxonomy/specialty
                if (providerData.licenses && Array.isArray(providerData.licenses) && providerData.licenses.length > 0) {
                    const primaryLicense = providerData.licenses.find(license => 
                        license.taxonomy && (license.taxonomy.primary === 'Y' || license.taxonomy.primary === true)
                    ) || providerData.licenses[0];
                    
                    if (primaryLicense && primaryLicense.taxonomy) {
                        providerData.primaryTaxonomyCode = primaryLicense.taxonomy.code || '';
                        providerData.primaryTaxonomyName = primaryLicense.taxonomy.classification || primaryLicense.taxonomy.specialization || '';
                        providerData.licenseNumber = primaryLicense.license_number || '';
                        providerData.licenseState = primaryLicense.state || '';
                    }
                }

                providers.push(providerData);
                console.log(`✅ Parsed provider: ${providerData.fullName} (${providerData.npi}) - ${providerData.practiceState}`);
            }

            return providers;

        } catch (error) {
            console.error(`❌ Error parsing API response:`, error);
            return [];
        }
    }

    /**
     * Extract field value from API response extra fields
     * @param {Object} extraFields - Extra fields object from API response
     * @param {string} fieldName - Field name to extract
     * @param {number} index - Index of the record
     * @returns {any} Field value or null
     */
    getFieldValue(extraFields, fieldName, index) {
        try {
            if (!extraFields || !extraFields[fieldName] || !Array.isArray(extraFields[fieldName])) {
                return null;
            }
            return extraFields[fieldName][index] || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} url - URL to request
     * @returns {Promise<Response>} Fetch response
     */
    async makeRequest(url) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`📡 API Request attempt ${attempt}/${this.maxRetries}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Medicare-Doctor-Automation/1.0.0',
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                
                if (response.ok) {
                    return response;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
            } catch (error) {
                lastError = error;
                console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < this.maxRetries) {
                    console.log(`⏳ Waiting ${this.retryDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    this.retryDelay *= 2; // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Validate if a provider meets the basic criteria for processing
     * @param {Object} provider - Provider object from API
     * @returns {Object} Validation result with isValid and reasons
     */
    validateProviderBasicCriteria(provider) {
        const validationResult = {
            isValid: true,
            reasons: [],
            warnings: []
        };

        // Check required fields
        if (!provider.npi) {
            validationResult.isValid = false;
            validationResult.reasons.push('Missing NPI number');
        }

        if (!provider.fullName && !provider.firstName && !provider.lastName) {
            validationResult.isValid = false;
            validationResult.reasons.push('Missing provider name');
        }

        if (!provider.practiceState) {
            validationResult.isValid = false;
            validationResult.reasons.push('Missing practice state');
        }

        // Check if it's an individual provider (not organization)
        if (provider.providerType && provider.providerType.toLowerCase().includes('organization')) {
            validationResult.isValid = false;
            validationResult.reasons.push('Provider is an organization, not individual');
        }

        // Warnings for missing optional data
        if (!provider.practicePhone) {
            validationResult.warnings.push('Missing practice phone number');
        }

        if (!provider.primaryTaxonomyCode) {
            validationResult.warnings.push('Missing taxonomy/specialty information');
        }

        return validationResult;
    }

    /**
     * Convert NPI Registry provider format to the format expected by existing validation logic
     * @param {Object} npiProvider - Provider from NPI Registry API
     * @returns {Object} Provider in expected format
     */
    convertToExpectedFormat(npiProvider) {
        return {
            npi: npiProvider.npi,
            firstName: npiProvider.firstName,
            lastName: npiProvider.lastName,
            fullName: npiProvider.fullName || `${npiProvider.firstName || ''} ${npiProvider.lastName || ''}`.trim(),
            practiceAddress: npiProvider.practiceAddress,
            practiceCity: npiProvider.practiceCity,
            practiceState: npiProvider.practiceState,
            practiceZip: npiProvider.practiceZip,
            phone: npiProvider.practicePhone,
            fax: npiProvider.practiceFax,
            specialty: npiProvider.primaryTaxonomyName || npiProvider.providerType,
            taxonomyCode: npiProvider.primaryTaxonomyCode,
            licenseNumber: npiProvider.licenseNumber,
            licenseState: npiProvider.licenseState,
            gender: npiProvider.gender,
            // Additional fields for validation
            entityType: 'Individual', // NPI API only returns individuals
            primaryTaxonomy: true,
            credential: npiProvider.credential
        };
    }
}

module.exports = NPIRegistryService; 
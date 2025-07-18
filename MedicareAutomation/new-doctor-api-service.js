const { spawn } = require('child_process');
const path = require('path');

class NewDoctorAPIService {
    constructor() {
        this.pythonScriptPath = path.join(__dirname, '..', 'NewDoctorAPI.py');
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Execute Python script with exact match method
     */
    async executeSearch(searchType, searchData) {
        return new Promise((resolve, reject) => {
            console.log(`[NewDoctorAPI] Executing ${searchType} search with data:`, searchData);
            
            // Create Python process
            const pythonProcess = spawn('python', [
                '-c', this.generatePythonScript(searchType, searchData)
            ]);
            
            let output = '';
            let errorOutput = '';
            
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        console.log(`[NewDoctorAPI] Search successful, received ${result.length || 0} results`);
                        resolve(result);
                    } catch (error) {
                        console.error(`[NewDoctorAPI] JSON Parse Error:`, error);
                        reject(new Error(`JSON Parse Error: ${error.message}`));
                    }
                } else {
                    console.error(`[NewDoctorAPI] Python Error:`, errorOutput);
                    reject(new Error(`Python execution failed: ${errorOutput}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error(`[NewDoctorAPI] Process Error:`, error);
                reject(error);
            });
            
            // Set timeout
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Python execution timeout'));
            }, 30000);
        });
    }

    /**
     * Generate Python script for exact match search
     */
    generatePythonScript(searchType, searchData) {
        const script = `
import requests
import json
import sys

# NPI Registry API Configuration
NPI_API_URL = "https://npiregistry.cms.hhs.gov/api/"
API_TIMEOUT = 20
MAX_RETRIES = 3

def make_api_request(url, params):
    """Make API request with retries"""
    import time
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, params=params, timeout=API_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException:
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
                continue
            else:
                raise
    return None

def parse_npi_result(result_obj, search_method=""):
    """Parse NPI API result into standardized format"""
    basic_info = result_obj.get('basic', {})
    npi_number = result_obj.get('number', 'N/A')
    
    address_info = {}
    taxonomy_info = {}
    
    # Get location address
    for addr in result_obj.get('addresses', []):
        if addr.get('address_purpose') == 'LOCATION':
            address_info = addr
            break
    
    # Get primary taxonomy
    for tax in result_obj.get('taxonomies', []):
        if tax.get('primary'):
            taxonomy_info = tax
            break
    
    return {
        'npi': npi_number,
        'status': 'Success',
        'search_method': search_method,
        'first_name': basic_info.get('first_name', 'N/A'),
        'last_name': basic_info.get('last_name', 'N/A'),
        'name': f"{basic_info.get('first_name', '')} {basic_info.get('last_name', '')}".strip() or basic_info.get('organization_name', 'N/A'),
        'city': address_info.get('city', 'N/A'),
        'state': address_info.get('state', 'N/A'),
        'specialty': taxonomy_info.get('desc', 'N/A'),
        'taxonomy_code': taxonomy_info.get('code', 'N/A'),
        'phone_number': address_info.get('telephone_number', 'N/A'),
        'fax_number': address_info.get('fax_number', 'N/A'),
        'address': f"{address_info.get('address_1', '')}, {address_info.get('city', '')}, {address_info.get('state', '')} {address_info.get('postal_code', '')}".strip(', '),
        'entity_type': basic_info.get('enumeration_type', 'N/A'),
        'enumeration_date': basic_info.get('enumeration_date', 'N/A'),
        'gender': basic_info.get('gender', 'N/A'),
        'credential': basic_info.get('credential', 'N/A')
    }

def exact_match_search_by_name(first_name, last_name, state):
    """Perform exact match search by name with state filtering"""
    try:
        # Primary search with state
        params = {
            'version': '2.1',
            'first_name': first_name,
            'last_name': last_name,
            'state': state,
            'limit': 200,
            'enumeration_type': 'NPI-1'
        }
        
        data = make_api_request(NPI_API_URL, params)
        
        exact_matches = []
        if data and data.get('result_count', 0) > 0:
            for res in data['results']:
                api_first = res.get('basic', {}).get('first_name', '').lower()
                api_last = res.get('basic', {}).get('last_name', '').lower()
                
                # Exact match logic
                if api_first == first_name.lower() and api_last == last_name.lower():
                    exact_matches.append(parse_npi_result(res, "Exact Match"))
        
        return exact_matches
        
    except Exception as e:
        return [{'npi': 'N/A', 'status': f'Error: {str(e)}', 'first_name': first_name, 'last_name': last_name}]

def search_by_npi(npi_number):
    """Search provider by NPI number"""
    try:
        params = {
            'version': '2.1',
            'number': npi_number
        }
        
        data = make_api_request(NPI_API_URL, params)
        
        if data and data.get('result_count', 0) > 0:
            return parse_npi_result(data['results'][0], "NPI Lookup")
        else:
            return {'npi': npi_number, 'status': 'NPI Not Found'}
            
    except Exception as e:
        return {'npi': npi_number, 'status': f'Network/API Error: {str(e)}'}

# Main execution based on search type
search_type = "${searchType}"
search_data = ${JSON.stringify(searchData)}

try:
    if search_type == "name":
        results = exact_match_search_by_name(
            search_data.get("first_name", ""),
            search_data.get("last_name", ""),
            search_data.get("state", "")
        )
    elif search_type == "npi":
        results = [search_by_npi(search_data.get("npi", ""))]
    else:
        results = [{"status": "Invalid search type"}]
    
    print(json.dumps(results))
    
except Exception as e:
    error_result = [{"status": f"Script Error: {str(e)}"}]
    print(json.dumps(error_result))
`;
        return script;
    }

    /**
     * Search for providers by name and optional state (exact match)
     */
    async searchProviders(providerName, state = null, maxResults = 30) {
        try {
            console.log(`[NewDoctorAPI] Searching for provider: "${providerName}" in state: ${state || 'ALL'} (Exact Match)`);
            
            // Parse provider name - handle "Last, First Middle" format
            let firstName = '';
            let lastName = '';
            
            if (providerName.includes(',')) {
                // "Last, First Middle" format
                const parts = providerName.split(',');
                lastName = parts[0].trim();
                const firstParts = parts[1].trim().split(' ');
                firstName = firstParts[0].trim(); // Take only the first name, ignore middle names
            } else {
                // "First Last" format (fallback)
                const nameParts = providerName.trim().split(' ');
                if (nameParts.length >= 2) {
                    firstName = nameParts[0];
                    lastName = nameParts[nameParts.length - 1];
                } else if (nameParts.length === 1) {
                    lastName = nameParts[0];
                }
            }
            
            const searchData = {
                first_name: firstName,
                last_name: lastName,
                state: state || ''
            };
            
            const results = await this.executeSearch('name', searchData);
            
            if (!Array.isArray(results)) {
                console.log(`[NewDoctorAPI] No results found for "${providerName}"`);
                return [];
            }
            
            // Convert to our expected format and apply state filtering if needed
            const processedResults = results
                .filter(provider => provider.status === 'Success')
                .map(provider => this.parseProviderData(provider))
                .filter(provider => !state || provider.address?.state?.toLowerCase() === state.toLowerCase())
                .slice(0, maxResults);
            
            console.log(`[NewDoctorAPI] Found ${processedResults.length} exact matches for "${providerName}"`);
            return processedResults;
            
        } catch (error) {
            console.error(`[NewDoctorAPI] Error searching providers:`, error);
            throw error;
        }
    }

    /**
     * Get provider details by NPI number
     */
    async getProviderByNPI(npiNumber) {
        try {
            console.log(`[NewDoctorAPI] Getting provider details for NPI: ${npiNumber}`);
            
            const searchData = {
                npi: npiNumber.toString()
            };
            
            const results = await this.executeSearch('npi', searchData);
            
            if (!Array.isArray(results) || results.length === 0 || results[0].status !== 'Success') {
                console.log(`[NewDoctorAPI] No provider found for NPI: ${npiNumber}`);
                return null;
            }
            
            const provider = this.parseProviderData(results[0]);
            console.log(`[NewDoctorAPI] Found provider: ${provider.name} (${provider.npi})`);
            
            return provider;
            
        } catch (error) {
            console.error(`[NewDoctorAPI] Error getting provider by NPI:`, error);
            throw error;
        }
    }

    /**
     * Parse provider data from NewDoctorAPI response into HIPAASpace-compatible format
     */
    parseProviderData(rawProvider) {
        try {
            // Determine if individual or organization based on entity type
            const isIndividual = rawProvider.entity_type !== 'Organization';
            
            let name, firstName, lastName;
            if (isIndividual) {
                firstName = rawProvider.first_name || '';
                lastName = rawProvider.last_name || '';
                name = rawProvider.name || `${firstName} ${lastName}`.trim();
                if (rawProvider.credential) {
                    name = `${name}, ${rawProvider.credential}`.trim();
                }
            } else {
                name = rawProvider.name || '';
                firstName = '';
                lastName = '';
            }
            
            // Get primary taxonomy/specialty
            const taxonomy = rawProvider.specialty || '';
            const taxonomyCode = rawProvider.taxonomy_code || '';
            
            // Parse address from the address string
            const addressParts = (rawProvider.address || '').split(', ');
            const address = {
                street: addressParts[0] || '',
                street2: '',
                city: rawProvider.city || '',
                state: rawProvider.state || '',
                zip: addressParts[addressParts.length - 1] || '',
                phone: rawProvider.phone_number || ''
            };
            
            const provider = {
                npi: rawProvider.npi,
                name: name,
                firstName: firstName,
                lastName: lastName,
                entityType: isIndividual ? 'Individual' : 'Organization',
                isIndividual: isIndividual,
                taxonomy: taxonomy,
                taxonomyCode: taxonomyCode,
                specialty: taxonomy, // Use taxonomy as specialty
                address: address,
                enumerationDate: rawProvider.enumeration_date || '',
                lastUpdateDate: '',
                gender: rawProvider.gender || '',
                credential: rawProvider.credential || '',
                licenseNumber: '', // Not available in NPI registry
                dataSource: 'NewDoctorAPI (Exact Match)',
                rawData: rawProvider
            };
            
            return provider;
            
        } catch (error) {
            console.error(`[NewDoctorAPI] Error parsing provider data:`, error);
            console.error(`[NewDoctorAPI] Raw provider data:`, JSON.stringify(rawProvider, null, 2));
            
            // Return minimal provider object
            return {
                npi: rawProvider.npi || '',
                name: rawProvider.name || 'Unknown',
                firstName: rawProvider.first_name || '',
                lastName: rawProvider.last_name || '',
                entityType: rawProvider.entity_type || '',
                isIndividual: rawProvider.entity_type !== 'Organization',
                taxonomy: '',
                taxonomyCode: '',
                specialty: '',
                address: {},
                licenseNumber: '',
                dataSource: 'NewDoctorAPI (Exact Match)',
                error: `Parse error: ${error.message}`,
                rawData: rawProvider
            };
        }
    }

    /**
     * Search for providers with retry logic
     */
    async searchProvidersWithRetry(providerName, state = null, maxResults = 30) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[NewDoctorAPI] Search attempt ${attempt}/${this.maxRetries} for: "${providerName}"`);
                
                const results = await this.searchProviders(providerName, state, maxResults);
                return results;
                
            } catch (error) {
                lastError = error;
                console.error(`[NewDoctorAPI] Attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt;
                    console.log(`[NewDoctorAPI] Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        console.error(`[NewDoctorAPI] All ${this.maxRetries} attempts failed for "${providerName}"`);
        throw lastError;
    }

    /**
     * Validate provider data against basic criteria (same as HIPAASpace)
     */
    validateProviderBasicCriteria(provider) {
        const issues = [];
        
        if (!provider.npi) {
            issues.push('Missing NPI number');
        }
        
        if (!provider.name || provider.name.trim().length === 0) {
            issues.push('Missing provider name');
        }
        
        if (!provider.taxonomy && !provider.specialty) {
            issues.push('Missing specialty/taxonomy information');
        }
        
        if (!provider.address || !provider.address.state) {
            issues.push('Missing state information');
        }
        
        const isValid = issues.length === 0;
        
        return {
            isValid,
            issues,
            provider
        };
    }

    /**
     * Filter providers by state (same as HIPAASpace)
     */
    filterProvidersByState(providers, targetState) {
        if (!targetState) {
            return providers;
        }
        
        const filteredProviders = providers.filter(provider => {
            const providerState = provider.address?.state;
            return providerState && providerState.toLowerCase() === targetState.toLowerCase();
        });
        
        console.log(`[NewDoctorAPI] Filtered ${providers.length} providers to ${filteredProviders.length} in state: ${targetState}`);
        
        return filteredProviders;
    }

    /**
     * Get summary of API service
     */
    getServiceInfo() {
        return {
            service: 'NewDoctorAPI (Exact Match)',
            pythonScriptPath: this.pythonScriptPath,
            searchMethod: 'Exact Match',
            maxRetries: this.maxRetries
        };
    }
}

module.exports = NewDoctorAPIService; 
import { 
  CITY_COORDINATES, 
  DISTRICT_COORDINATES, 
  BARANGAY_COORDINATES 
} from '../data/coordinates'

/**
 * Get coordinates from City, District, Barangay
 * Uses your hardcoded coordinate mapping
 * NO API CALLS - instant and free!
 */
export function getCoordinates(city, district, barangay) {
  try {
    // Try barangay-level first (most specific)
    if (BARANGAY_COORDINATES[city]?.[district]?.[barangay]) {
      const coords = BARANGAY_COORDINATES[city][district][barangay]
      return {
        latitude: coords[0],
        longitude: coords[1],
        precision: 'barangay' // Most accurate
      }
    }
    
    // Fall back to district-level
    if (DISTRICT_COORDINATES[city]?.[district]) {
      const coords = DISTRICT_COORDINATES[city][district]
      return {
        latitude: coords[0],
        longitude: coords[1],
        precision: 'district' // Good accuracy
      }
    }
    
    // Fall back to city-level
    if (CITY_COORDINATES[city]) {
      const coords = CITY_COORDINATES[city]
      return {
        latitude: coords[0],
        longitude: coords[1],
        precision: 'city' // Basic accuracy
      }
    }
    
    // No coordinates fo
    


    
    throw new Error(`No coordinates found for ${city}, ${district}, ${barangay}`)
    
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

export function testGeocoding() {
  console.log('Testing geocoding...')
  
  // Test 1: Barangay-level
  const test1 = getCoordinates('Quezon City', 'District 1', 'Alicia')
  console.log('Test 1 (Barangay):', test1)
  
  // Test 2: District-level
  const test2 = getCoordinates('Manila', 'Ermita', '')
  console.log('Test 2 (District):', test2)
  
  // Test 3: City-level
  const test3 = getCoordinates('Makati', '', '')
  console.log('Test 3 (City):', test3)
  
  return test1 && test2 && test3
}
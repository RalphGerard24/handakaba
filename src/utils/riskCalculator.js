import * as turf from '@turf/turf'

/**
 * Load GeoJSON file
 */
async function loadGeoJSON(filepath) {
  try {
    const response = await fetch(filepath)
    if (!response.ok) throw new Error(`Failed to load ${filepath}`)
    return await response.json()
  } catch (error) {
    console.error('Error loading GeoJSON:', error)
    return null
  }
}

/**
 * FLOOD RISK CALCULATION
 * Uses YOUR simplified flood GeoJSON
 */
export async function calculateFloodRisk(latitude, longitude) {
  try {
    // Load your simplified flood data
    const floodData = await loadGeoJSON('/hazard-data/flood_simplified.geojson')
    if (!floodData) return { risk: 'NONE', description: 'Data unavailable' }
    
    const userPoint = turf.point([longitude, latitude])
    
    // Check if point is in any flood zone
    for (const feature of floodData.features) {
      if (turf.booleanPointInPolygon(userPoint, feature)) {
        // Check flood level from properties
        const floodLevel = feature.properties?.FLOOD_LEVEL || 'HIGH'
        
        return {
          risk: floodLevel === 'HIGH' || floodLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          description: `Location is within flood-prone zone (Level: ${floodLevel})`,
          details: feature.properties
        }
      }
    }
    
    return {
      risk: 'LOW',
      description: 'Location is not in identified flood zones'
    }
    
  } catch (error) {
    console.error('Flood risk calculation error:', error)
    return { risk: 'NONE', description: 'Calculation error' }
  }
}

/**
 * EARTHQUAKE RISK CALCULATION
 * Based on distance to nearest fault line
 */
export async function calculateEarthquakeRisk(latitude, longitude) {
  try {
    const faultData = await loadGeoJSON('/hazard-data/gem_active_faults.geojson')
    if (!faultData) return { risk: 'NONE', description: 'Data unavailable' }
    
    const userPoint = turf.point([longitude, latitude])
    let minDistance = Infinity
    let nearestFault = null
    
    // Find nearest fault line
    for (const feature of faultData.features) {
      const distance = turf.pointToLineDistance(userPoint, feature, { units: 'kilometers' })
      
      if (distance < minDistance) {
        minDistance = distance
        nearestFault = feature.properties?.name || 'Unknown fault'
      }
    }
    
    // Risk based on distance
    if (minDistance < 5) {
      return {
        risk: 'HIGH',
        description: `Within 5km of ${nearestFault} (${minDistance.toFixed(1)}km away)`,
        distance: minDistance
      }
    } else if (minDistance < 15) {
      return {
        risk: 'MEDIUM',
        description: `Within 15km of ${nearestFault} (${minDistance.toFixed(1)}km away)`,
        distance: minDistance
      }
    } else {
      return {
        risk: 'LOW',
        description: `Over 15km from nearest fault (${minDistance.toFixed(1)}km away)`,
        distance: minDistance
      }
    }
    
  } catch (error) {
    console.error('Earthquake risk calculation error:', error)
    return { risk: 'NONE', description: 'Calculation error' }
  }
}

/**
 * TYPHOON/STORM SURGE RISK CALCULATION
 * Uses YOUR 4-level SSA files
 */
export async function calculateTyphoonRisk(latitude, longitude) {
  try {
    const userPoint = turf.point([longitude, latitude])
    
    // Check from highest to lowest level
    const levels = [
      { file: '/hazard-data/typhoon/SSA4.geojson', level: 4, risk: 'HIGH' },
      { file: '/hazard-data/typhoon/SSA3.geojson', level: 3, risk: 'HIGH' },
      { file: '/hazard-data/typhoon/SSA2.geojson', level: 2, risk: 'MEDIUM' },
      { file: '/hazard-data/typhoon/SSA1.geojson', level: 1, risk: 'LOW' }
    ]
    
    for (const { file, level, risk } of levels) {
      const data = await loadGeoJSON(file)
      if (!data) continue
      
      for (const feature of data.features) {
        if (turf.booleanPointInPolygon(userPoint, feature)) {
          const descriptions = {
            4: 'Critical storm surge zone - immediate evacuation during typhoons',
            3: 'High storm surge zone - prepare for possible evacuation',
            2: 'Moderate storm surge risk - monitor weather closely',
            1: 'Low storm surge risk - basic preparedness recommended'
          }
          
          return {
            risk,
            level,
            description: descriptions[level]
          }
        }
      }
    }
    
    return {
      risk: 'NONE',
      level: 0,
      description: 'Not in storm surge advisory zone'
    }
    
  } catch (error) {
    console.error('Typhoon risk calculation error:', error)
    return { risk: 'NONE', description: 'Calculation error' }
  }
}

/**
 * LANDSLIDE RISK CALCULATION
 * Uses YOUR landslide GeoJSON + housing type
 */
export async function calculateLandslideRisk(latitude, longitude, housingType) {
  try {
    const landslideData = await loadGeoJSON('/hazard-data/landslide_zones.geojson')
    const userPoint = turf.point([longitude, latitude])
    
    let inLandslideZone = false
    
    if (landslideData) {
      for (const feature of landslideData.features) {
        if (turf.booleanPointInPolygon(userPoint, feature)) {
          inLandslideZone = true
          break
        }
      }
    }
    
    // Combine zone + housing type
    const isHillside = housingType === 'Hillside'
    
    if (inLandslideZone && isHillside) {
      return {
        risk: 'HIGH',
        description: 'Hillside location in known landslide-prone area'
      }
    } else if (inLandslideZone || isHillside) {
      return {
        risk: 'MEDIUM',
        description: inLandslideZone 
          ? 'Location in landslide-prone area' 
          : 'Hillside terrain - moderate risk'
      }
    } else {
      return {
        risk: 'LOW',
        description: 'Flat terrain outside landslide zones'
      }
    }
    
  } catch (error) {
    console.error('Landslide risk calculation error:', error)
    return { risk: 'NONE', description: 'Calculation error' }
  }
}

/**
 * HEAT RISK CALCULATION
 * Uses YOUR heat_vulnerability.geojson
 */
export async function calculateHeatRisk(latitude, longitude, hasElderly, hasPWD) {
  try {
    const heatData = await loadGeoJSON('/hazard-data/heat_vulnerability.geojson')
    if (!heatData) return { risk: 'NONE', description: 'Data unavailable' }
    
    const userPoint = turf.point([longitude, latitude])
    
    // Check if in heat vulnerability zone
    for (const feature of heatData.features) {
      if (turf.booleanPointInPolygon(userPoint, feature)) {
        const heatLevel = feature.properties?.heat_risk || 'MEDIUM'
        
        // Increase risk if vulnerable household members
        const hasVulnerable = hasElderly || hasPWD
        
        if (heatLevel === 'HIGH' || hasVulnerable) {
          return {
            risk: 'HIGH',
            description: hasVulnerable 
              ? 'Urban heat island + vulnerable household members'
              : 'High urban heat island effect',
            details: feature.properties
          }
        } else if (heatLevel === 'MEDIUM') {
          return {
            risk: 'MEDIUM',
            description: 'Moderate urban heat island effect'
          }
        }
      }
    }
    
    return {
      risk: 'LOW',
      description: 'Outside high-heat urban zones'
    }
    
  } catch (error) {
    console.error('Heat risk calculation error:', error)
    return { risk: 'NONE', description: 'Calculation error' }
  }
}

/**
 * CALCULATE ALL 5 RISKS AT ONCE
 * This is the main function you'll call!
 */
export async function calculateAllRisks(userProfile) {
  const { latitude, longitude, housing_type, has_elderly, has_pwd } = userProfile
  
  console.log('Calculating risks for:', { latitude, longitude })
  
  // Calculate all 5 risks in parallel (faster!)
  const [flood, earthquake, typhoon, landslide, heat] = await Promise.all([
    calculateFloodRisk(latitude, longitude),
    calculateEarthquakeRisk(latitude, longitude),
    calculateTyphoonRisk(latitude, longitude),
    calculateLandslideRisk(latitude, longitude, housing_type),
    calculateHeatRisk(latitude, longitude, has_elderly, has_pwd)
  ])
  
  // Calculate overall risk score (0-100)
  const riskScores = {
    HIGH: 20,
    MEDIUM: 10,
    LOW: 5,
    NONE: 0
  }
  
  const overallScore = 
    riskScores[flood.risk] +
    riskScores[earthquake.risk] +
    riskScores[typhoon.risk] +
    riskScores[landslide.risk] +
    riskScores[heat.risk]
  
  return {
    flood,
    earthquake,
    typhoon,
    landslide,
    heat,
    overall_score: overallScore,
    calculated_at: new Date().toISOString()
  }
}
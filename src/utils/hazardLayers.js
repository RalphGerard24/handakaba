/**
 * Load all 5 hazard GeoJSON layers
 */
export async function loadHazardLayers() {
  try {
    const layers = {
      flood: null,
      earthquake: null,
      typhoon: null,
      landslide: null,
      heat: null
    }
    
    // Load Flood layer
    try {
      const floodResponse = await fetch('/hazard-data/flood_simplified.geojson')
      if (floodResponse.ok) {
        layers.flood = await floodResponse.json()
      }
    } catch (error) {
      console.error('Error loading flood layer:', error)
    }
    
    // Load Earthquake layer (fault lines)
    try {
      const earthquakeResponse = await fetch('/hazard-data/gem_active_faults.geojson')
      if (earthquakeResponse.ok) {
        layers.earthquake = await earthquakeResponse.json()
      }
    } catch (error) {
      console.error('Error loading earthquake layer:', error)
    }
    
    // Load Typhoon layers (combine all SSA levels)
    try {
      const typhoonLayers = []
      for (let i = 1; i <= 4; i++) {
        const response = await fetch(`/hazard-data/typhoon/SSA${i}.geojson`)
        if (response.ok) {
          const data = await response.json()
          // Add level property to each feature
          data.features = data.features.map(f => ({
            ...f,
            properties: { ...f.properties, ssa_level: i }
          }))
          typhoonLayers.push(data)
        }
      }
      
      // Combine all typhoon layers
      if (typhoonLayers.length > 0) {
        layers.typhoon = {
          type: 'FeatureCollection',
          features: typhoonLayers.flatMap(layer => layer.features)
        }
      }
    } catch (error) {
      console.error('Error loading typhoon layers:', error)
    }
    
    // Load Landslide layer
    try {
      const landslideResponse = await fetch('/hazard-data/landslide_zones.geojson')
      if (landslideResponse.ok) {
        layers.landslide = await landslideResponse.json()
      }
    } catch (error) {
      console.error('Error loading landslide layer:', error)
    }
    
    // Load Heat layer
    try {
      const heatResponse = await fetch('/hazard-data/heat_vulnerability.geojson')
      if (heatResponse.ok) {
        layers.heat = await heatResponse.json()
      }
    } catch (error) {
      console.error('Error loading heat layer:', error)
    }
    
    return layers
    
  } catch (error) {
    console.error('Error loading hazard layers:', error)
    return null
  }
}

/**
 * Get style for each hazard layer (color + opacity)
 */
export function getLayerStyle(hazardType, feature) {
  const styles = {
    flood: {
      color: '#1e40af',      // Blue
      fillColor: '#3b82f6',
      fillOpacity: 0.3,
      weight: 2
    },
    earthquake: {
      color: '#ea580c',      // Orange
      fillColor: '#f97316',
      fillOpacity: 0.3,
      weight: 2
    },
    typhoon: {
      // Different colors for different SSA levels
      color: feature?.properties?.ssa_level >= 3 ? '#dc2626' : '#475569',
      fillColor: feature?.properties?.ssa_level >= 3 ? '#ef4444' : '#64748b',
      fillOpacity: 0.3,
      weight: 2
    },
    landslide: {
      color: '#78350f',      // Brown
      fillColor: '#a16207',
      fillOpacity: 0.3,
      weight: 2
    },
    heat: {
      color: '#dc2626',      // Red
      fillColor: '#f59e0b',
      fillOpacity: 0.3,
      weight: 2
    }
  }
  
  return styles[hazardType] || styles.flood
}
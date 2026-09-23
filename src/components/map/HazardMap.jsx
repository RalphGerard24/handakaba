import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import { supabase } from '../../lib/supabase'
import { loadHazardLayers, getLayerStyle } from '../../utils/hazardLayers'
import 'leaflet/dist/leaflet.css'
import { Icon } from 'leaflet'

// Fix broken default marker icons in Vite builds
delete Icon.Default.prototype._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const userIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#0038A8" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="8" fill="white"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
})

const MANILA_CENTER = [14.5995, 120.9842]

const LAYERS_CONFIG = [
  { key: 'flood', label: 'Flood Zones', color: '#3b82f6' },
  { key: 'earthquake', label: 'Earthquake Faults', color: '#f97316' },
  { key: 'typhoon', label: 'Storm Surge', color: '#64748b' },
  { key: 'landslide', label: 'Landslide Zones', color: '#a16207' },
  { key: 'heat', label: 'Heat Islands', color: '#f59e0b' },
]

export default function HazardMap() {
  const [userLocation, setUserLocation] = useState(null)
  const [hazardLayers, setHazardLayers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [layerVisibility, setLayerVisibility] = useState({
    flood: true,
    earthquake: true,
    typhoon: true,
    landslide: true,
    heat: true
  })
  const [showLayerPanel, setShowLayerPanel] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('lat, lng, city, district, barangay')
          .eq('user_id', user.id)
          .single()

        if (profile && profile.lat && profile.lng) {
          setUserLocation({
            lat: parseFloat(profile.lat),
            lng: parseFloat(profile.lng),
            city: profile.city || '',
            district: profile.district || '',
            barangay: profile.barangay || ''
          })
        }
      }

      // Hazard layers are non-blocking — map still renders if this fails
      const layers = await loadHazardLayers()
      setHazardLayers(layers)

    } catch (err) {
      console.error('Error loading map data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleLayer(layerName) {
    setLayerVisibility(prev => ({ ...prev, [layerName]: !prev[layerName] }))
  }

  function toggleAllLayers(visible) {
    setLayerVisibility({
      flood: visible,
      earthquake: visible,
      typhoon: visible,
      landslide: visible,
      heat: visible
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '12px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#0038A8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280', margin: 0, fontSize: '15px' }}>Loading hazard map…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', padding: '20px 24px', borderRadius: '0 8px 8px 0', maxWidth: '480px' }}>
          <p style={{ fontWeight: 700, color: '#991b1b', margin: '0 0 6px' }}>Failed to load map</p>
          <p style={{ color: '#b91c1c', margin: 0, fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    )
  }

  const center = userLocation ? [userLocation.lat, userLocation.lng] : MANILA_CENTER
  const locationLabel = userLocation
    ? `${userLocation.barangay ? userLocation.barangay + ', ' : ''}${userLocation.city}`
    : 'Metro Manila (set your location in Profile)'

  const LayerControls = () => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => toggleAllLayers(true)}
          style={{ flex: 1, fontSize: '12px', background: '#dbeafe', color: '#1d4ed8', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Show All
        </button>
        <button
          onClick={() => toggleAllLayers(false)}
          style={{ flex: 1, fontSize: '12px', background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Hide All
        </button>
      </div>

      {LAYERS_CONFIG.map(({ key, label, color }) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px' }}>
          <input
            type="checkbox"
            checked={layerVisibility[key]}
            onChange={() => toggleLayer(key)}
            style={{ width: '18px', height: '18px', accentColor: color, cursor: 'pointer' }}
          />
          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: color, opacity: 0.7, flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{label}</span>
        </label>
      ))}

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
          Click colored zones on the map to see hazard details.
        </p>
      </div>
    </div>
  )

  return (
    <div className="hero-background" style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderBottom: '1px solid #e5e7eb', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
            Disaster Hazard Map
          </h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
            Showing hazard layers for <strong>{locationLabel}</strong>
            {!userLocation && (
              <> — <a href="/profile" style={{ color: '#0038A8' }}>Set your location in Profile</a></>
            )}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
        {/* Mobile Layer Toggle Button */}
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px', padding: '10px 16px',
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, color: '#111827', cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
          }}
          className="lg:hidden"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18M3 8h18M3 12h18" />
          </svg>
          {showLayerPanel ? 'Hide Layers' : 'Show Layers'}
        </button>

        {/* Desktop: grid layout. Mobile: stack */}
        <div style={{ display: 'grid', gap: '16px', alignItems: 'start' }}
          className="grid-cols-1 lg:grid-cols-[260px_1fr]"
        >

          {/* Sidebar — always visible on lg+, toggled on mobile */}
          <div
            className={`${showLayerPanel ? 'block' : 'hidden'} lg:block`}
            style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Hazard Layers</h2>
            <LayerControls />
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <MapContainer
              center={center}
              zoom={userLocation ? 13 : 11}
              style={{ height: '600px', width: '100%' }}
              scrollWheelZoom={true}
              touchZoom={true}
              doubleClickZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {userLocation && (
                <Marker position={center} icon={userIcon}>
                  <Popup>
                    <div style={{ textAlign: 'center', padding: '4px' }}>
                      <p style={{ fontWeight: 700, color: '#1e3a8a', margin: '0 0 4px', fontSize: '15px' }}>Your Location</p>
                      {userLocation.barangay && <p style={{ margin: '2px 0', fontSize: '13px' }}>{userLocation.barangay}</p>}
                      {userLocation.district && <p style={{ margin: '2px 0', fontSize: '13px' }}>{userLocation.district}</p>}
                      {userLocation.city && <p style={{ margin: '2px 0', fontSize: '13px', fontWeight: 600 }}>{userLocation.city}</p>}
                    </div>
                  </Popup>
                </Marker>
              )}

              {hazardLayers?.flood && layerVisibility.flood && (
                <GeoJSON
                  key="flood"
                  data={hazardLayers.flood}
                  style={(feature) => getLayerStyle('flood', feature)}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup('<div style="text-align:center"><b style="color:#1e3a8a">Flood Zone</b><br/><span style="font-size:13px">This area is prone to flooding</span></div>')
                  }}
                />
              )}

              {hazardLayers?.earthquake && layerVisibility.earthquake && (
                <GeoJSON
                  key="earthquake"
                  data={hazardLayers.earthquake}
                  style={(feature) => getLayerStyle('earthquake', feature)}
                  onEachFeature={(feature, layer) => {
                    const name = feature.properties?.name || feature.properties?.NAME || 'Unknown fault'
                    layer.bindPopup(`<div style="text-align:center"><b style="color:#9a3412">Earthquake Fault</b><br/><span style="font-size:13px">${name}</span></div>`)
                  }}
                />
              )}

              {hazardLayers?.typhoon && layerVisibility.typhoon && (
                <GeoJSON
                  key="typhoon"
                  data={hazardLayers.typhoon}
                  style={(feature) => getLayerStyle('typhoon', feature)}
                  onEachFeature={(feature, layer) => {
                    const level = feature.properties?.ssa_level || '?'
                    layer.bindPopup(`<div style="text-align:center"><b style="color:#1e293b">Storm Surge Zone</b><br/><span style="font-size:13px">SSA Level: ${level}</span></div>`)
                  }}
                />
              )}

              {hazardLayers?.landslide && layerVisibility.landslide && (
                <GeoJSON
                  key="landslide"
                  data={hazardLayers.landslide}
                  style={(feature) => getLayerStyle('landslide', feature)}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup('<div style="text-align:center"><b style="color:#78350f">Landslide Zone</b><br/><span style="font-size:13px">High risk during heavy rain</span></div>')
                  }}
                />
              )}

              {hazardLayers?.heat && layerVisibility.heat && (
                <GeoJSON
                  key="heat"
                  data={hazardLayers.heat}
                  style={(feature) => getLayerStyle('heat', feature)}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup('<div style="text-align:center"><b style="color:#991b1b">Heat Island</b><br/><span style="font-size:13px">Urban heat vulnerability zone</span></div>')
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>
        
        {/* Project NOAH ODbL Attribution */}
        <div style={{ marginTop: '24px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0 }}>
            Contains hazard data from <a href="https://noah.up.edu.ph/" target="_blank" rel="noopener noreferrer" style={{ color: '#0038A8', textDecoration: 'underline', fontWeight: '500' }}>Project NOAH</a>, which is made available here under the <a href="https://opendatacommons.org/licenses/odbl/1.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#0038A8', textDecoration: 'underline', fontWeight: '500' }}>Open Database License (ODbL) v1.0</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateAllRisks } from '../../utils/riskCalculator'
import RiskBadge from './RiskBadge'
import SecurityBanner from '../SecurityBanner'

export default function RiskDashboard() {
  const [risks, setRisks] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcError, setRecalcError] = useState(null)
  const [noProfile, setNoProfile] = useState(false)

  useEffect(() => {
    loadRiskScores()
  }, [])

  async function loadRiskScores() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('risk_scores')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading risks:', error)
        return
      }

      if (!data) {
        // Check if profile exists so we can show the right message
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, lat, lng')
          .eq('user_id', user.id)
          .single()
        if (!profile) setNoProfile(true)
        return
      }

      setRisks(data)
    } catch (error) {
      console.error('Error loading risk scores:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecalculate() {
    setRecalculating(true)
    setRecalcError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileErr || !profile) throw new Error('Profile not found. Please complete your profile first.')

      const lat = parseFloat(profile.lat)
      const lng = parseFloat(profile.lng)

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Location coordinates are missing. Please re-save your profile.')
      }

      const riskResults = await calculateAllRisks({
        latitude: lat,
        longitude: lng,
        housing_type: profile.housing_type,
        has_elderly: profile.has_elderly,
        has_pwd: profile.has_pwd
      })

      const { error: upsertError } = await supabase.from('risk_scores').upsert({
        user_id: user.id,
        latitude: lat,
        longitude: lng,
        flood_risk: riskResults.flood.risk,
        earthquake_risk: riskResults.earthquake.risk,
        typhoon_risk: riskResults.typhoon.risk,
        landslide_risk: riskResults.landslide.risk,
        heat_risk: riskResults.heat.risk,
        overall_score: riskResults.overall_score,
        calculated_at: riskResults.calculated_at
      }, { onConflict: 'user_id' })

      if (upsertError) throw upsertError

      const { data: freshData, error: freshErr } = await supabase
        .from('risk_scores')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (freshErr) throw freshErr
      setRisks(freshData)
    } catch (err) {
      console.error('Recalculation error:', err)
      setRecalcError(err.message || 'Calculation failed. Please re-save your profile.')
    } finally {
      setRecalculating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!risks) {
    return (
      <div className="min-h-screen hero-background flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Risk Assessment Missing</h2>
          {noProfile ? (
            <p className="text-gray-600 mb-6">You haven't set up your profile yet. Please complete your profile to generate your risk assessment.</p>
          ) : (
            <p className="text-gray-600 mb-6">Your risk scores aren't in the database yet. Click below to calculate them now from your existing profile.</p>
          )}

          {recalcError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-left">
              <strong>Error:</strong> {recalcError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!noProfile && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {recalculating ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Calculating Risks...
                  </>
                ) : '🔄 Calculate Risk Assessment'}
              </button>
            )}
            <a
              href="/profile"
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {noProfile ? '📝 Complete Profile' : '✏️ Re-save Profile Instead'}
            </a>
          </div>
        </div>
      </div>
    )
  }

  const overallRiskLevel =
    risks.overall_score >= 50 ? 'HIGH' :
      risks.overall_score >= 25 ? 'MEDIUM' : 'LOW'

  const overallColors = {
    HIGH: 'from-red-500 to-red-600',
    MEDIUM: 'from-orange-500 to-orange-600',
    LOW: 'from-green-500 to-green-600'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 py-8 px-4 hero-background">
      <div className="max-w-6xl mx-auto">

        <SecurityBanner />

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-blue-700 tracking-tight mb-3">
            Your Disaster Risk Assessment
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Based on your location and household profile
          </p>
        </div>

        {/* Overall Score Card */}
        <div className={`bg-gradient-to-r ${overallColors[overallRiskLevel]} rounded-2xl shadow-xl p-8 text-white mb-8`}>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Overall Risk Score</h2>
            <div className="text-6xl font-bold mb-2">{risks.overall_score}/100</div>
            <p className="text-lg opacity-90">
              {overallRiskLevel === 'HIGH' && 'High preparedness priority - take action soon'}
              {overallRiskLevel === 'MEDIUM' && 'Moderate risk - prepare gradually'}
              {overallRiskLevel === 'LOW' && 'Low overall risk - maintain basic preparedness'}
            </p>
          </div>
        </div>

        {/* Risk Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          <RiskBadge
            disaster="Flood"
            risk={risks.flood_risk}
            description={getFloodDescription(risks.flood_risk)}
          />

          <RiskBadge
            disaster="Earthquake"
            risk={risks.earthquake_risk}
            description={getEarthquakeDescription(risks.earthquake_risk)}
          />

          <RiskBadge
            disaster="Typhoon/Storm Surge"
            risk={risks.typhoon_risk}
            description={getTyphoonDescription(risks.typhoon_risk)}
          />

          <RiskBadge
            disaster="Landslide"
            risk={risks.landslide_risk}
            description={getLandslideDescription(risks.landslide_risk)}
          />

          <RiskBadge
            disaster="Extreme Heat"
            risk={risks.heat_risk}
            description={getHeatDescription(risks.heat_risk)}
          />
        </div>

        {/* Info Footer */}
        <div className="bg-blue-100 border-l-4 border-blue-600 rounded-r-xl p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Risk Assessment Methodology</p>
              <p className="text-sm text-blue-800">
                Risk scores are calculated using geospatial analysis of your exact location against
                official Philippine hazard data from PAGASA, PHIVOLCS, and MGB. Scores consider your
                housing type, floor level, and household composition. This assessment is for
                preparedness planning - always follow official warnings during actual disasters.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}



// Helper functions for descriptions
function getFloodDescription(risk) {
  const descriptions = {
    HIGH: 'Your location is in a flood-prone zone. Prepare evacuation routes and supplies.',
    MEDIUM: 'Moderate flood risk. Monitor weather and have emergency supplies ready.',
    LOW: 'Low flood risk, but basic preparedness is still recommended.',
    NONE: 'No significant flood risk identified for your area.'
  }
  return descriptions[risk] || descriptions.NONE
}

function getEarthquakeDescription(risk) {
  const descriptions = {
    HIGH: 'Near an active fault line. Secure heavy furniture and have earthquake supplies.',
    MEDIUM: 'Within 15km of a fault line. Practice earthquake drills and secure valuables.',
    LOW: 'Low seismic risk, but basic earthquake preparedness is still wise.',
    NONE: 'No major fault lines nearby.'
  }
  return descriptions[risk] || descriptions.NONE
}

function getTyphoonDescription(risk) {
  const descriptions = {
    HIGH: 'High storm surge risk during typhoons. Prepare evacuation plan immediately.',
    MEDIUM: 'Moderate storm surge risk. Monitor typhoon warnings closely.',
    LOW: 'Low storm surge risk, but prepare for strong winds and rain.',
    NONE: 'Not in storm surge advisory zones.'
  }
  return descriptions[risk] || descriptions.NONE
}

function getLandslideDescription(risk) {
  const descriptions = {
    HIGH: 'Hillside location in landslide-prone area. Monitor heavy rainfall warnings.',
    MEDIUM: 'Moderate landslide risk. Avoid steep slopes during heavy rain.',
    LOW: 'Low landslide risk due to flat terrain.',
    NONE: 'No landslide risk identified.'
  }
  return descriptions[risk] || descriptions.NONE
}

function getHeatDescription(risk) {
  const descriptions = {
    HIGH: 'High urban heat exposure. Vulnerable household members need extra cooling.',
    MEDIUM: 'Moderate heat risk. Stay hydrated and avoid midday sun.',
    LOW: 'Low heat risk, but stay prepared during summer months.',
    NONE: 'No significant heat island effect.'
  }
  return descriptions[risk] || descriptions.NONE
}
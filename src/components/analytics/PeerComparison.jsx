import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function PeerComparison({ userCity, userCompletion }) {
  const [cityStats, setCityStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  
  useEffect(() => {
    loadCityStatistics()
  }, [userCity])
  
  async function loadCityStatistics() {
    if (!userCity) {
      setLoading(false)
      return
    }
    
    setHasError(false)

    try {
      // Refresh aggregated statistics and wait for it to finish
      await supabase.rpc('update_city_statistics')

      const { data, error } = await supabase
        .from('city_statistics')
        .select('*')
        .eq('city', userCity)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setCityStats(data)

    } catch (error) {
      console.error('Error loading city statistics:', error)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="bg-red-50 rounded-xl shadow-lg p-6 border-2 border-red-200">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold text-red-900">Could not load city statistics</h3>
            <p className="text-sm text-red-700 mt-1">
              City comparison is temporarily unavailable. Please try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Not enough users in city yet for privacy-safe aggregation
  if (!cityStats || !cityStats.total_users || cityStats.total_users < 1) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Gathering City Data
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We anonymize and aggregate data across users in {userCity} before showing comparisons.
              City-level analytics will appear here once enough users have completed their profile.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  // Calculate comparison
  const cityAverage = cityStats.avg_completion_percentage
  const difference = userCompletion - cityAverage
  const isAboveAverage = difference >= 0
  const percentageGap = Math.abs(difference)
  
  return (
    <div className={`
      rounded-xl shadow-lg p-6 border-2
      ${isAboveAverage 
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300' 
        : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300'
      }
    `}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          You vs Your City
        </h2>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {/* Main Comparison — stacks on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        
        {/* Your Progress */}
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Your Progress
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-1">
            {userCompletion}%
          </div>
          <div className="text-xs text-gray-500">You</div>
        </div>
        
        {/* City Average */}
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-2">
            {userCity} Average
          </div>
          <div className="text-4xl font-bold text-purple-600 mb-1">
            {cityAverage}%
          </div>
          <div className="text-xs text-gray-500">
            {cityStats.total_users.toLocaleString()} {cityStats.total_users === 1 ? 'user' : 'users'}
          </div>
        </div>
        
      </div>
      
      {/* Comparison Result */}
      <div className={`
        rounded-lg p-4 text-center
        ${isAboveAverage ? 'bg-green-100' : 'bg-orange-100'}
      `}>
        <div className="flex items-center justify-center gap-3 mb-2">
          {isAboveAverage ? (
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <div className={`
            text-3xl font-bold
            ${isAboveAverage ? 'text-green-700' : 'text-orange-700'}
          `}>
            {isAboveAverage ? '+' : '-'}{percentageGap}%
          </div>
        </div>
        
        <p className={`
          text-sm font-semibold
          ${isAboveAverage ? 'text-green-800' : 'text-orange-800'}
        `}>
          {isAboveAverage 
            ? `You're ${percentageGap}% more prepared than your city average!`
            : `You're ${percentageGap}% behind your city average`
          }
        </p>
        
        <p className={`
          text-xs mt-2
          ${isAboveAverage ? 'text-green-700' : 'text-orange-700'}
        `}>
          {isAboveAverage 
            ? "Great job! You're setting a great example for your community."
            : "Don't worry — complete a few more tasks to catch up!"
          }
        </p>
      </div>
      
      {/* Detailed Stats (Collapsible) */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Statistics for {userCity}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Active Users:</span>
              <span className="font-semibold text-gray-900">
                {cityStats.total_users.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average Completion:</span>
              <span className="font-semibold text-gray-900">
                {cityAverage}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="font-semibold text-gray-900">
                {new Date(cityStats.last_updated).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded p-3">
            <strong>Privacy Note:</strong> All statistics are anonymized aggregates.
            No individual user data is shared or identifiable.
          </div>
        </div>
      )}
      
    </div>
  )
}
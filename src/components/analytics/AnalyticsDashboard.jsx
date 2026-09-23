import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ProgressBar } from '../progress/ProgressBar'
import CategoryChart from './CategoryChart'
import PeerComparison from './PeerComparison'

export default function AnalyticsDashboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [userCity, setUserCity] = useState(null)
  
  useEffect(() => {
    loadChecklist()
  }, [])
  
  async function loadChecklist() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Load checklist
      const { data: checklistData, error: checklistError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('rank', { ascending: true })
      
      if (checklistError) throw checklistError
      
      setItems(checklistData || [])
      
      // Load user's city
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('city')
        .eq('user_id', user.id)
        .single()
      
      if (profileError) throw profileError
      
      setUserCity(profileData?.city)
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }
  
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-12 max-w-md text-center">
          <div className="text-6xl mb-4 text-blue-500">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Data Yet
          </h2>
          <p className="text-gray-600">
            Generate your checklist first to see progress analytics!
          </p>
        </div>
      </div>
    )
  }
  
  const totalItems = items.length
  const completedItems = items.filter(i => i.completed).length
  const percentage = Math.round((completedItems / totalItems) * 100)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4 hero-background">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Progress Analytics
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Track your disaster preparedness journey
          </p>
        </div>
        
        {/* Overall Progress Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Overall Progress
          </h2>
          <ProgressBar 
            completed={completedItems} 
            total={totalItems}
            showDetails={true}
          />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
          
          {/* Total Items */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {totalItems}
            </div>
            <div className="text-sm font-medium text-gray-600">
              Total Action Items
            </div>
          </div>
          
          {/* Completed */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-5xl font-bold text-green-600 mb-2">
              {completedItems}
            </div>
            <div className="text-sm font-medium text-gray-600">
              Items Completed
            </div>
          </div>
          
          {/* Remaining */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-5xl font-bold text-orange-600 mb-2">
              {totalItems - completedItems}
            </div>
            <div className="text-sm font-medium text-gray-600">
              Items Remaining
            </div>
          </div>
          
        </div>
        
        {/* Category Breakdown Chart */}
        <CategoryChart items={items} />

        {/* Peer Comparison */}
        <div className="mt-8">
          <PeerComparison 
            userCity={userCity}
            userCompletion={percentage}
          />
        </div>
        
        {/* Readiness Assessment Notice */}
        <div className="mt-8 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl shadow-xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-2">
            {percentage === 100 && "Maximum Readiness Achieved"}
            {percentage >= 70 && percentage < 100 && "High Readiness Level"}
            {percentage >= 30 && percentage < 70 && "Moderate Readiness Level"}
            {percentage < 30 && "Action Required: Low Readiness"}
          </h3>
          <p className="text-blue-100 mt-2 max-w-3xl mx-auto leading-relaxed">
            {percentage === 100 && "All identified disaster preparedness measures have been implemented. Ensure you maintain your supplies and review this plan quarterly."}
            {percentage >= 70 && percentage < 100 && "You have successfully implemented the majority of recommended safety measures. Address the remaining items to ensure comprehensive protection."}
            {percentage >= 30 && percentage < 70 && "Core preparations are underway. Prioritize completion of high-urgency items to significantly reduce your household's vulnerability."}
            {percentage < 30 && "Your household is currently highly vulnerable to anticipated localized hazards. Please execute the tasks marked as CRITICAL immediately to mitigate severe risks."}
          </p>
        </div>
        
      </div>
    </div>
  )
}
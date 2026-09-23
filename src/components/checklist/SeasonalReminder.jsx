import { useState, useEffect } from 'react'

export default function SeasonalReminder({ criticalItems }) {
  const [dismissed, setDismissed] = useState(false)
  const [isTyphoonSeason, setIsTyphoonSeason] = useState(false)
  
  useEffect(() => {
    // Check if dismissed (persists for 7 days)
    const dismissedDate = localStorage.getItem('seasonal-reminder-dismissed')
    if (dismissedDate) {
      const daysSince = (Date.now() - new Date(dismissedDate)) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) {
        setDismissed(true)
        return
      }
    }
    
    // Check if typhoon season (June-November in Philippines)
    const currentMonth = new Date().getMonth() + 1 // 1-12
    const isTyphoonSeason = currentMonth >= 6 && currentMonth <= 11
    setIsTyphoonSeason(isTyphoonSeason)
    
  }, [])
  
  function handleDismiss() {
    localStorage.setItem('seasonal-reminder-dismissed', new Date().toISOString())
    setDismissed(true)
  }
  
  // Get incomplete critical items
  const incompleteCritical = criticalItems.filter(item => !item.completed)
  
  if (dismissed || !isTyphoonSeason || incompleteCritical.length === 0) {
    return null
  }
  
  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl shadow-lg p-6 text-white mb-8">
      <div className="flex items-start gap-4">
        
          {/* Icon */}
          <div className="flex-shrink-0">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">
              Typhoon Season Alert
            </h2>
            <p className="text-white opacity-95 mb-4">
              We're currently in typhoon season (June-November). You have{' '}
              <strong className="font-black text-white bg-white/20 px-1 rounded">{incompleteCritical.length} critical items</strong> that need attention:
            </p>
            
            {/* Incomplete Critical Items */}
            <div className="bg-white rounded-lg p-5 mb-4 shadow-md">
              <ul className="space-y-3">
                {incompleteCritical.slice(0, 3).map(item => (
                  <li key={item.id} className="flex items-start gap-3 text-sm md:text-base font-medium text-red-900">
                    <span className="text-orange-500 mt-1 flex-shrink-0">●</span>
                    <span className="leading-snug">{item.task}</span>
                  </li>
                ))}
                {incompleteCritical.length > 3 && (
                  <li className="text-sm text-red-600 font-bold pt-2 border-t border-red-100 mt-3">
                    + {incompleteCritical.length - 3} more critical items...
                  </li>
                )}
              </ul>
            </div>
            
            <div className="flex gap-3">
              <a
                href="#checklist"
                className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                Complete Now →
              </a>
              <button
                onClick={handleDismiss}
                className="bg-transparent border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                Remind me in 7 days
              </button>
            </div>
          </div>
          
      </div>
    </div>
  )
}

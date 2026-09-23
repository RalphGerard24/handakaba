import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/auth/Auth'
import ProfileForm from './components/profile/ProfileForm'
import RiskDashboard from './components/risk/RiskDashboard'
import { logAuditEvent } from './utils/auditLog'
import ChecklistDisplay from './components/checklist/ChecklistDisplay'
import HazardMap from './components/map/HazardMap'
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile',   label: 'Profile' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'map',       label: 'Hazard Map' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname.substring(1)
    return path || 'profile'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.substring(1)
      setCurrentView(path || 'profile')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleNavigation = (view) => {
    setCurrentView(view)
    setMobileMenuOpen(false)
    window.history.pushState(null, '', '/' + view)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) checkProfile(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])
  
  async function checkProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single()
    
    setHasProfile(!!data)
    
    if (!data) {
      handleNavigation('profile')
    } else {
      const path = window.location.pathname.substring(1)
      if (!path || path === 'login') {
        handleNavigation('dashboard')
      } else {
        handleNavigation(path)
      }
    }
  }

  const handleLogout = async () => {
    await logAuditEvent('LOGOUT', { method: 'manual' })
    await supabase.auth.signOut()
    window.history.pushState(null, '', '/')
    setMobileMenuOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen hero-background bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <span className="text-xl font-bold text-blue-700 tracking-tight select-none">
              HANDAKABA
            </span>
            
            {/* Desktop Nav */}
            {hasProfile && (
              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => handleNavigation(id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentView === id
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}

            {/* Right side: email + logout (desktop) + hamburger (mobile) */}
            <div className="flex items-center gap-2">
              <span className="hidden lg:block text-xs text-gray-500 max-w-[160px] truncate">
                {session.user.email}
              </span>
              <button
                onClick={handleLogout}
                className="hidden md:block text-sm font-medium text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                Logout
              </button>

              {/* Hamburger - mobile only */}
              {hasProfile && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && hasProfile && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 shadow-lg">
            <nav className="flex flex-col gap-1 pt-3">
              {NAV_ITEMS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => handleNavigation(id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentView === id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <p className="text-xs text-gray-400 px-4 pb-2 truncate">{session.user.email}</p>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      
      {/* Main Content */}
      <main>
        {currentView === 'profile' && (
          <ProfileForm
            onSuccess={() => {
              setHasProfile(true)
              handleNavigation('dashboard')
            }}
            userName={session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email}
          />
        )}
        {currentView === 'dashboard' && <RiskDashboard />}
        {currentView === 'checklist' && <ChecklistDisplay />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
        {currentView === 'map' && <HazardMap />}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto py-4 px-4 text-center text-xs text-gray-400">
        <p>
          Contains hazard data from{' '}
          <a
            href="https://noah.up.edu.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Project NOAH
          </a>
          , made available under the{' '}
          <a
            href="https://opendatacommons.org/licenses/odbl/1.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Open Database License (ODbL) v1.0
          </a>
          . © {new Date().getFullYear()} Handakaba. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { generateChecklist } from '../../utils/checklistGenerator'
import { logAuditEvent } from '../../utils/auditLog'
import ChecklistItem from './ChecklistItem'
import { ProgressBar } from '../progress/ProgressBar'
import SeasonalReminder from './SeasonalReminder'
import DownloadPDFButton from './DownloadPDFButton'

export default function ChecklistDisplay() {
  const [items, setItems] = useState([])
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [regenerateCount, setRegenerateCount] = useState(0)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    loadChecklist()
    loadRegenerateCount()
  }, [])

  async function loadChecklist() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('rank', { ascending: true })

      if (error) throw error
      setItems(data || [])

    } catch (error) {
      console.error('Error loading checklist:', error)
      setError('Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }

  // Loads the daily regeneration count and resets it if it's a new day
  async function loadRegenerateCount() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('regenerate_count')
        .select('count, last_reset_date')
        .eq('user_id', user.id)
        .single()

      if (!data) {
        setRegenerateCount(0)
        return
      }

      const today = new Date().toISOString().split('T')[0]

      if (data.last_reset_date !== today) {
        await supabase
          .from('regenerate_count')
          .upsert({ user_id: user.id, count: 0, last_reset_date: today }, { onConflict: 'user_id' })
        setRegenerateCount(0)
      } else {
        setRegenerateCount(data.count)
      }

    } catch (error) {
      console.error('Error loading regenerate count:', error)
    }
  }

  function handleGenerateClick() {
    if (regenerateCount >= 3) {
      setError('You have reached the maximum of 3 checklist generations per day. Try again tomorrow!')
      return
    }

    // If checklist already exists, show inline confirmation first
    if (items.length > 0) {
      setShowConfirm(true)
    } else {
      runGenerate()
    }
  }

  async function runGenerate() {
    setShowConfirm(false)
    setGenerating(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const result = await generateChecklist(user.id)

      if (!result.success) {
        // Gemini failed but we have fallback items — load and show them with a soft warning
        if (result.items && result.items.length > 0) {
          await loadChecklist()
          await loadRegenerateCount()
          setError(`AI generation failed (${result.error}). Showing a generic checklist instead — you can try again later.`)
          return
        }
        throw new Error(result.error || 'Generation failed')
      }

      await incrementRegenerateCount(user.id)

      await logAuditEvent('CHECKLIST_GENERATED', {
        items_count: result.items.length,
        regenerate_count: regenerateCount + 1
      })

      await loadChecklist()
      await loadRegenerateCount()

      setSuccessMessage(`Checklist generated! ${result.items.length} personalized tasks ready.`)
      setTimeout(() => setSuccessMessage(null), 5000)

    } catch (error) {
      console.error('Error generating checklist:', error)
      setError(error.message)
    } finally {
      setGenerating(false)
    }
  }

  async function incrementRegenerateCount(userId) {
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('regenerate_count')
      .upsert({
        user_id: userId,
        count: regenerateCount + 1,
        last_reset_date: today
      }, { onConflict: 'user_id' })
  }

  async function handleToggle(itemId) {
    try {
      const item = items.find(i => i.id === itemId)
      if (!item) return

      const newCompleted = !item.completed

      // Optimistic update before the DB call resolves
      setItems(items.map(i =>
        i.id === itemId
          ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : i
      ))

      const { error } = await supabase
        .from('checklist_items')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq('id', itemId)

      if (error) throw error

      if (newCompleted) {
        await logAuditEvent('CHECKLIST_ITEM_COMPLETED', {
          item_rank: item.rank,
          item_task: item.task
        })
      }

    } catch (error) {
      console.error('Error toggling item:', error)
      loadChecklist() // Revert optimistic update on failure
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your checklist...</p>
        </div>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center max-w-md px-4">
          <div className="mb-6">
            <img
              src="/icons/ai-generate.svg"
              alt="AI generating checklist"
              className="w-20 h-20 mb-4 animate-pulse mx-auto"
            />
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Generating Your Personalized Plan
          </h2>
          <p className="text-gray-600">
            AI is analyzing your location, risks, and household needs to create a customized disaster preparedness checklist...
          </p>
          <p className="text-sm text-gray-500 mt-4">This usually takes 10–15 seconds</p>
        </div>
      </div>
    )
  }

  const critical = items.filter(i => i.urgency === 'CRITICAL')
  const high = items.filter(i => i.urgency === 'HIGH')
  const medium = items.filter(i => i.urgency === 'MEDIUM')

  const totalItems = items.length
  const completedItems = items.filter(i => i.completed).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-orange-100 py-6 px-4 hero-background">
      <div className="max-w-5xl mx-auto">

        {/* Inline Regenerate Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Regenerate Checklist?</h3>
              <p className="text-gray-600 text-sm mb-1">
                This will replace your current checklist with a new AI-generated one.
              </p>
              <p className="text-blue-700 text-sm font-medium mb-6">
                You have {3 - regenerateCount} regeneration{3 - regenerateCount !== 1 ? 's' : ''} remaining today.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={runGenerate}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-blue-700 tracking-tight mb-2">
              Your Disaster Preparedness Checklist
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              {totalItems > 0
                ? 'Personalized for your location and household needs'
                : 'Get started by generating your personalized checklist'
              }
            </p>
          </div>

          {/* Progress Section */}
          {totalItems > 0 && (
            <div className="mb-6">
              <ProgressBar 
                completed={completedItems} 
                total={totalItems}
                showDetails={true}
              />
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-800 text-sm font-medium">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Actions at the bottom of the box */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-5 border-t border-gray-100">
            <p className="text-sm text-gray-500 order-2 sm:order-1 text-center sm:text-left">
              {3 - regenerateCount} regeneration{3 - regenerateCount !== 1 ? 's' : ''} left today
            </p>
            <div className="flex flex-wrap gap-3 order-1 sm:order-2 justify-center sm:justify-end">
              <button
                onClick={handleGenerateClick}
                disabled={regenerateCount >= 3}
                className={`
                  px-5 py-2.5 rounded-lg font-semibold text-white text-sm flex items-center gap-2
                  ${regenerateCount >= 3
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  }
                  transition-colors
                `}
              >
                <img src="/icons/ai-generate.svg" alt="" className="w-4 h-4 invert" />
                {items.length === 0 ? 'Generate Checklist' : 'Regenerate'}
              </button>
              {items.length > 0 && (
                <DownloadPDFButton items={items} />
              )}
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div id="checklist">
            {/* Language Toggle */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${language === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('tl')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${language === 'tl' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
              >
                Filipino
              </button>
            </div>

            <SeasonalReminder criticalItems={critical} />

            {critical.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-red-600 mb-4 flex items-center gap-3">
                  <img src="/icons/urgency/critical.svg" alt="Critical" className="w-6 h-6 md:w-7 md:h-7" />
                  Critical — Do Immediately
                </h2>
                <div className="space-y-4">
                  {critical.map(item => (
                    <ChecklistItem key={item.id} item={item} onToggle={handleToggle} language={language} />
                  ))}
                </div>
              </div>
            )}

            {high.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-orange-600 mb-4 flex items-center gap-3">
                  <img src="/icons/urgency/high.svg" alt="High" className="w-6 h-6 md:w-7 md:h-7" />
                  High Priority — This Week
                </h2>
                <div className="space-y-4">
                  {high.map(item => (
                    <ChecklistItem key={item.id} item={item} onToggle={handleToggle} language={language} />
                  ))}
                </div>
              </div>
            )}

            {medium.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-yellow-600 mb-4 flex items-center gap-3">
                  <img src="/icons/urgency/medium.svg" alt="Medium" className="w-6 h-6 md:w-7 md:h-7" />
                  Medium Priority — This Month
                </h2>
                <div className="space-y-4">
                  {medium.map(item => (
                    <ChecklistItem key={item.id} item={item} onToggle={handleToggle} language={language} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <div className="flex justify-center mb-6">
              <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">No Checklist Yet</h3>
            <p className="text-gray-600 mb-6 text-sm md:text-base">
              Generate your personalized disaster preparedness checklist using AI
            </p>
            <button
              onClick={handleGenerateClick}
              className="bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold text-base md:text-lg hover:bg-blue-700 active:bg-blue-800 transition-colors inline-flex items-center gap-2"
            >
              <img src="/icons/ai-generate.svg" alt="" className="w-5 h-5 invert" />
              Generate My Checklist
            </button>
          </div>
        )}

        {/* About This Checklist Info */}
        <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl p-5 mt-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">About This Checklist</p>
              <p className="text-sm text-blue-800 leading-relaxed">
                This checklist is generated by AI based on your location's disaster risks, housing type, 
                and household composition. Tasks are prioritized by urgency and costs are estimated for 
                the Philippine market. You can regenerate up to 3 times per day to refine the recommendations.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
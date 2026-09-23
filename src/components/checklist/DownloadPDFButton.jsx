import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateChecklistPDF } from '../../utils/checklistPDF'

export default function DownloadPDFButton({ items, disabled = false }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    async function handleDownload() {
        setLoading(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (profileError) throw profileError

            // Get risk scores
            const { data: riskScores, error: riskError } = await supabase
                .from('risk_scores')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (riskError) throw riskError

            // Generate PDF
            const completed = items.filter(i => i.completed).length
            const total = items.length

            await generateChecklistPDF(
                items,
                profile,
                riskScores,
                { completed, total }
            )

            // Log download event
            await supabase
                .from('audit_logs')
                .insert({
                    user_id: user.id,
                    action: 'CHECKLIST_PDF_DOWNLOADED',
                    metadata: {
                        items_count: total,
                        completed_count: completed
                    }
                })
                .then(() => console.log('Download logged'))
                .catch(err => console.error('Error logging download:', err))

        } catch (error) {
            console.error('Download error:', error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <button
                onClick={handleDownload}
                disabled={loading || disabled || items.length === 0}
                className={`
          inline-flex items-center gap-2
          px-6 py-3 rounded-lg font-semibold
          transition-colors
          ${loading || disabled || items.length === 0
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
        `}
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Generating PDF...</span>
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Download as PDF</span>
                    </>
                )}
            </button>

            {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                    {error}
                </div>
            )}
        </div>
    )
}
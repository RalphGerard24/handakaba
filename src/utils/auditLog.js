import { supabase } from '../lib/supabase'

export const logAuditEvent = async (action, details) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    // We only log if a user is authenticated
    if (!session) return

    const { error } = await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: session.user.id,
          action: action,
          details: details,
          ip_address: 'client-side', // In a full backend this would capture real IP
          created_at: new Date().toISOString()
        }
      ])
      
    if (error) {
      console.warn('Audit log warning:', error.message)
    }
  } catch (error) {
    // Fail silently so we don't disrupt the user experience
    console.warn('Could not save audit log:', error.message)
  }
}
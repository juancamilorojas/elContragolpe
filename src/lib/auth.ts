import { getSupabaseClient } from './supabase'

/**
 * Sign in anonymously. Returns the user or null.
 * This is used for players who scan a QR code.
 */
export async function signInAnonymously() {
    const supabase = getSupabaseClient()

    // Check if already signed in
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
        return session.user
    }

    // Sign in anonymously
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
        console.error('Anonymous sign-in error:', error.message)
        return null
    }
    return data.user
}

/**
 * Sign in with email & password (admins only).
 */
export async function signInWithEmail(email: string, password: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
}

/**
 * Sign out current user.
 */
export async function signOut() {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
}

/**
 * Get current session.
 */
export async function getSession() {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

/**
 * Check if current user has admin role.
 */
export function isAdmin(user: { app_metadata?: Record<string, unknown> } | null): boolean {
    if (!user) return false
    const role = user.app_metadata?.role as string | undefined
    return role === 'restaurant_admin' || role === 'super_admin'
}

/**
 * Get the restaurant_id from admin's app_metadata.
 */
export function getAdminRestaurantId(user: { app_metadata?: Record<string, unknown> } | null): string | null {
    if (!user) return null
    return (user.app_metadata?.restaurant_id as string) || null
}

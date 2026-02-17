import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function createSupabaseClient(): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        // During build time, return a dummy client that won't actually be used
        // Client components only execute in the browser
        return createClient('https://placeholder.supabase.co', 'placeholder-key')
    }
    return createClient(supabaseUrl, supabaseAnonKey)
}

// Singleton for client-side usage
let clientInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
    if (typeof window === 'undefined') {
        return createSupabaseClient()
    }
    if (!clientInstance) {
        clientInstance = createSupabaseClient()
    }
    return clientInstance
}

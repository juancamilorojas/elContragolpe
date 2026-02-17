'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Match = Database['public']['Tables']['matches']['Row']

export default function AdminHistoryPage() {
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = getSupabaseClient()

    useEffect(() => {
        async function load() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const restaurantId = getAdminRestaurantId(session.user)
            if (!restaurantId) return

            const { data } = await supabase
                .from('matches')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .or('status.eq.finished,status.eq.archived')
                .order('updated_at', { ascending: false })

            if (data) setMatches(data)
            setLoading(false)
        }
        load()
    }, [supabase])

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
    }

    return (
        <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-xl)' }}>
                📜 Match History
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {matches.map(match => (
                    <Link key={match.id} href={`/admin/matches/${match.id}`} style={{ textDecoration: 'none' }}>
                        <div className="card card--interactive">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 700 }}>{match.home_team}</span>
                                    <span style={{ color: 'var(--color-text-muted)', margin: '0 var(--space-sm)' }}>vs</span>
                                    <span style={{ fontWeight: 700 }}>{match.away_team}</span>
                                    {match.final_score && (
                                        <span style={{ marginLeft: 'var(--space-md)', color: 'var(--color-accent)', fontWeight: 700 }}>
                                            {(match.final_score as any).home} – {(match.final_score as any).away}
                                        </span>
                                    )}
                                </div>
                                <span className="badge badge--finished">
                                    {match.status.toUpperCase()}
                                </span>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                                {new Date(match.updated_at).toLocaleDateString()} · {new Date(match.updated_at).toLocaleTimeString()}
                            </p>
                        </div>
                    </Link>
                ))}
                {matches.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <p>No finished matches yet.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

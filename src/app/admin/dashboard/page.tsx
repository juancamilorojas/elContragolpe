'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'
import Link from 'next/link'

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({ players: 0, tables: 0, activeMatch: null as any })
    const [loading, setLoading] = useState(true)
    const supabase = getSupabaseClient()

    useEffect(() => {
        async function loadStats() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            const restaurantId = getAdminRestaurantId(session.user)
            if (!restaurantId) return

            // Count active tables
            const { count: tableCount } = await supabase
                .from('tables')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true)

            // Count players in active match
            const { data: matchesData } = await supabase
                .from('matches')
                .select('id, home_team, away_team, status')
                .eq('restaurant_id', restaurantId)
                .or('status.eq.open,status.eq.live')
                .limit(1)

            const activeMatch = matchesData?.[0] ?? null

            let playerCount = 0
            if (activeMatch) {
                const { count } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('active_match_id', activeMatch.id)
                playerCount = count || 0
            }

            setStats({
                players: playerCount,
                tables: tableCount || 0,
                activeMatch,
            })
            setLoading(false)
        }
        loadStats()
    }, [supabase])

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner--lg" />
            </div>
        )
    }

    return (
        <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-xl)' }}>
                Dashboard
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                <div className="card">
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Active Players</p>
                    <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent)' }}>
                        {stats.players}
                    </p>
                </div>
                <div className="card">
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Tables</p>
                    <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent-secondary)' }}>
                        {stats.tables}
                    </p>
                </div>
                <div className="card">
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Active Match</p>
                    {stats.activeMatch ? (
                        <div>
                            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                                {stats.activeMatch.home_team} vs {stats.activeMatch.away_team}
                            </p>
                            <span className={`badge badge--${stats.activeMatch.status === 'live' ? 'live' : 'open'}`}>
                                {stats.activeMatch.status.toUpperCase()}
                            </span>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-text-muted)' }}>None</p>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                {stats.activeMatch ? (
                    <Link
                        href={`/admin/matches/${stats.activeMatch.id}`}
                        className="btn btn--primary btn--lg"
                    >
                        ⚽ Manage Active Match
                    </Link>
                ) : (
                    <Link href="/admin/matches" className="btn btn--primary btn--lg">
                        + Create Match
                    </Link>
                )}
                <Link href="/admin/tables" className="btn btn--secondary btn--lg">
                    🪑 Manage Tables
                </Link>
            </div>
        </div>
    )
}

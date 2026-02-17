'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Match = Database['public']['Tables']['matches']['Row']

export default function AdminMatchesPage() {
    const [matches, setMatches] = useState<Match[]>([])
    const [homeTeam, setHomeTeam] = useState('')
    const [awayTeam, setAwayTeam] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')
    const supabase = getSupabaseClient()

    const loadMatches = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const restaurantId = getAdminRestaurantId(session.user)
        if (!restaurantId) return

        const { data } = await supabase
            .from('matches')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })

        if (data) setMatches(data)
        setLoading(false)
    }

    useEffect(() => { loadMatches() }, [])

    const createMatch = async () => {
        if (!homeTeam.trim() || !awayTeam.trim()) return
        setCreating(true)
        setError('')

        const { data: { session } } = await supabase.auth.getSession()
        const restaurantId = getAdminRestaurantId(session?.user || null)
        if (!restaurantId) { setError('No restaurant found'); setCreating(false); return }

        // Check for existing active match
        const active = matches.find(m => ['open', 'live'].includes(m.status))
        if (active) {
            setError('There is already an active match. Finish it before creating a new one.')
            setCreating(false)
            return
        }

        const { error: insertErr } = await supabase
            .from('matches')
            .insert({
                restaurant_id: restaurantId,
                home_team: homeTeam.trim(),
                away_team: awayTeam.trim(),
                status: 'draft',
            })

        if (insertErr) {
            setError(insertErr.message)
        } else {
            setHomeTeam('')
            setAwayTeam('')
            setShowCreate(false)
            await loadMatches()
        }
        setCreating(false)
    }

    const statusColors: Record<string, string> = {
        draft: '',
        open: 'badge--open',
        live: 'badge--live',
        finished: 'badge--finished',
        archived: 'badge--finished',
    }

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>⚽ Matches</h1>
                <button className="btn btn--primary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? 'Cancel' : '+ New Match'}
                </button>
            </div>

            {error && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>
                    <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>⚠️ {error}</p>
                </div>
            )}

            {showCreate && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>Create New Match</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Home Team</label>
                            <input className="form-input" placeholder="e.g. Real Madrid" value={homeTeam} onChange={e => setHomeTeam(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Away Team</label>
                            <input className="form-input" placeholder="e.g. Barcelona" value={awayTeam} onChange={e => setAwayTeam(e.target.value)} />
                        </div>
                    </div>
                    <button className="btn btn--primary" onClick={createMatch} disabled={creating || !homeTeam.trim() || !awayTeam.trim()}>
                        {creating ? 'Creating...' : 'Create Match'}
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {matches.map(match => (
                    <Link key={match.id} href={`/admin/matches/${match.id}`} style={{ textDecoration: 'none' }}>
                        <div className="card card--interactive">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 700 }}>{match.home_team}</span>
                                    <span style={{ color: 'var(--color-text-muted)', margin: '0 var(--space-sm)' }}>vs</span>
                                    <span style={{ fontWeight: 700 }}>{match.away_team}</span>
                                </div>
                                <span className={`badge ${statusColors[match.status] || ''}`}>
                                    {match.status.toUpperCase()}
                                </span>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                                {new Date(match.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </Link>
                ))}
                {matches.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <p>No matches yet. Create your first match!</p>
                    </div>
                )}
            </div>
        </div>
    )
}

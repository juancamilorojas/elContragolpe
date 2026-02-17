'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { signInAnonymously } from '@/lib/auth'
import type { Database } from '@/types/database'

type Table = Database['public']['Tables']['tables']['Row']

interface JoinPageProps {
    restaurantSlug?: string
}

export default function JoinPage() {
    const [step, setStep] = useState<'loading' | 'name' | 'table' | 'consent' | 'done'>('loading')
    const [displayName, setDisplayName] = useState('')
    const [tables, setTables] = useState<Table[]>([])
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
    const [newTableName, setNewTableName] = useState('')
    const [showNewTable, setShowNewTable] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [consentGiven, setConsentGiven] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [restaurantId, setRestaurantId] = useState<string | null>(null)
    const [restaurantName, setRestaurantName] = useState('')

    const supabase = getSupabaseClient()

    const loadTables = useCallback(async (restId: string) => {
        const { data } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restId)
            .eq('is_active', true)
            .order('name')

        setTables(data || [])
    }, [supabase])

    // Initialize: anonymous sign-in + load restaurant
    const init = useCallback(async () => {
        setError('')
        setStep('loading')
        try {
            const user = await signInAnonymously()
            if (!user) {
                setError('No se pudo conectar. Verifica que Anonymous Sign-Ins esté habilitado en Supabase Auth.')
                return
            }

            // Get restaurant from URL params
            const params = new URLSearchParams(window.location.search)
            const slug = params.get('r') || 'demo'

            const { data: restaurant, error: restErr } = await supabase
                .from('restaurants')
                .select('id, name')
                .eq('slug', slug)
                .single()

            if (restErr || !restaurant) {
                setError(`Restaurante no encontrado (slug: "${slug}"). Verifica la base de datos.`)
                return
            }

            setRestaurantId(restaurant.id)
            setRestaurantName(restaurant.name)

            // Check if player already exists for this auth user
            const { data: existingPlayer } = await supabase
                .from('players')
                .select('id, active_match_id')
                .eq('auth_user_id', user.id)
                .eq('restaurant_id', restaurant.id)
                .single()

            if (existingPlayer) {
                // Player already registered, go directly to game
                setStep('done')
                redirectToGame(existingPlayer.active_match_id)
                return
            }

            // Load tables
            await loadTables(restaurant.id)
            setStep('name')
        } catch (err: any) {
            setError(`Error: ${err?.message || 'Something went wrong. Please try again.'}`)
            console.error('Join init error:', err)
        }
    }, [supabase, loadTables])

    useEffect(() => { init() }, [init])

    const redirectToGame = (matchId: string | null) => {
        if (matchId) {
            window.location.href = `/play/${matchId}`
        } else {
            window.location.href = '/play/waiting'
        }
    }

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!displayName.trim()) {
            setError('Please enter your name')
            return
        }
        if (displayName.trim().length > 30) {
            setError('Name must be 30 characters or less')
            return
        }
        setError('')
        setStep('table')
    }

    const handleCreateTable = async () => {
        if (!newTableName.trim() || !restaurantId) return
        setLoading(true)
        setError('')

        try {
            const { data, error: insertErr } = await supabase
                .from('tables')
                .insert({ restaurant_id: restaurantId, name: newTableName.trim() })
                .select()
                .single()

            if (insertErr) {
                if (insertErr.code === '23505') {
                    setError('A table with this name already exists')
                } else {
                    setError('Could not create table. Try again.')
                }
                setLoading(false)
                return
            }

            setSelectedTableId(data.id)
            setShowNewTable(false)
            setNewTableName('')
            await loadTables(restaurantId)
            setStep('consent')
        } catch (err) {
            setError('Could not create table.')
        }
        setLoading(false)
    }

    const handleTableSelect = (tableId: string) => {
        setSelectedTableId(tableId)
        setError('')
        setStep('consent')
    }

    const handleJoin = async () => {
        if (!consentGiven || !selectedTableId || !restaurantId) return
        setLoading(true)
        setError('')

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) {
                setError('Session expired. Please refresh.')
                setLoading(false)
                return
            }

            // Find active match
            const { data: activeMatch } = await supabase
                .from('matches')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .or('status.eq.open,status.eq.live')
                .limit(1)
                .single()

            const { error: insertErr } = await supabase
                .from('players')
                .insert({
                    auth_user_id: session.user.id,
                    restaurant_id: restaurantId,
                    table_id: selectedTableId,
                    display_name: displayName.trim(),
                    active_match_id: activeMatch?.id || null,
                    consent_given: true,
                })

            if (insertErr) {
                setError('Could not join. Please try again.')
                setLoading(false)
                return
            }

            setStep('done')
            redirectToGame(activeMatch?.id || null)
        } catch (err) {
            setError('Something went wrong.')
        }
        setLoading(false)
    }

    const filteredTables = tables.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ── Render ────────────────────────────

    if (step === 'loading') {
        return (
            <div className="page">
                <div className="loading-screen">
                    {!error ? (
                        <>
                            <div className="spinner spinner--lg" />
                            <p>Conectando...</p>
                        </>
                    ) : (
                        <>
                            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', textAlign: 'center', maxWidth: '400px', lineHeight: '1.5' }}>
                                ⚠️ {error}
                            </p>
                            <button
                                className="btn btn--primary"
                                onClick={init}
                                style={{ marginTop: 'var(--space-md)' }}
                            >
                                🔄 Reintentar
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="page">
            <div className="container container--narrow">
                <div className="page__header">
                    <h1 className="page__title">⚽ El Contragolpe</h1>
                    {restaurantName && (
                        <p className="page__subtitle">{restaurantName}</p>
                    )}
                </div>

                {error && (
                    <div className="card" style={{ borderColor: 'var(--color-danger)', marginBottom: 'var(--space-lg)' }}>
                        <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                            ⚠️ {error}
                        </p>
                    </div>
                )}

                {/* Step 1: Name */}
                {step === 'name' && (
                    <form onSubmit={handleNameSubmit}>
                        <div className="card">
                            <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                                👋 What&apos;s your name?
                            </h2>
                            <div className="form-group">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Your name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    autoFocus
                                    maxLength={30}
                                />
                                <span className="form-hint">This will appear on the leaderboard</span>
                            </div>
                            <button type="submit" className="btn btn--primary btn--lg btn--full">
                                Continue →
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 2: Table Selection */}
                {step === 'table' && (
                    <div className="card">
                        <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                            🪑 Select your table
                        </h2>

                        <div className="form-group">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search tables..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            {filteredTables.map((table) => (
                                <button
                                    key={table.id}
                                    className="btn btn--secondary btn--full"
                                    style={{
                                        justifyContent: 'flex-start',
                                        padding: 'var(--space-md)',
                                        border: selectedTableId === table.id ? '2px solid var(--color-accent)' : undefined,
                                    }}
                                    onClick={() => handleTableSelect(table.id)}
                                >
                                    🪑 {table.name}
                                </button>
                            ))}

                            {filteredTables.length === 0 && !showNewTable && (
                                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>
                                    No tables found
                                </p>
                            )}
                        </div>

                        {!showNewTable ? (
                            <button
                                className="btn btn--secondary btn--full"
                                onClick={() => setShowNewTable(true)}
                                style={{ borderStyle: 'dashed' }}
                            >
                                + Create new table
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Table name (e.g., Terraza 3)"
                                    value={newTableName}
                                    onChange={(e) => setNewTableName(e.target.value)}
                                    autoFocus
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn--primary"
                                    onClick={handleCreateTable}
                                    disabled={!newTableName.trim() || loading}
                                >
                                    {loading ? '...' : 'Create'}
                                </button>
                            </div>
                        )}

                        <button
                            className="btn btn--secondary btn--full"
                            onClick={() => setStep('name')}
                            style={{ marginTop: 'var(--space-md)' }}
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 3: Consent */}
                {step === 'consent' && (
                    <div className="card">
                        <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                            📋 Almost there!
                        </h2>

                        <div style={{
                            background: 'var(--color-bg-input)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-md)',
                            marginBottom: 'var(--space-lg)',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: '1.6'
                        }}>
                            <p><strong>Privacy Notice</strong></p>
                            <p style={{ marginTop: 'var(--space-sm)' }}>
                                We only store your display name and table selection for the duration of the game.
                                No email, phone number, or device information is collected.
                                Your data will be anonymized after the match ends.
                            </p>
                        </div>

                        <div className="checkbox-group" style={{ marginBottom: 'var(--space-lg)' }}>
                            <input
                                type="checkbox"
                                id="consent"
                                checked={consentGiven}
                                onChange={(e) => setConsentGiven(e.target.checked)}
                            />
                            <label htmlFor="consent">
                                I accept the privacy terms above and want to join the game
                            </label>
                        </div>

                        <button
                            className="btn btn--primary btn--lg btn--full"
                            onClick={handleJoin}
                            disabled={!consentGiven || loading}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <span className="spinner" /> Joining...
                                </span>
                            ) : (
                                '🎮 Join the Game!'
                            )}
                        </button>

                        <button
                            className="btn btn--secondary btn--full"
                            onClick={() => setStep('table')}
                            style={{ marginTop: 'var(--space-md)' }}
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 4: Done */}
                {step === 'done' && (
                    <div className="loading-screen">
                        <div className="spinner spinner--lg" />
                        <p>Welcome, {displayName}! Redirecting to the game...</p>
                    </div>
                )}
            </div>
        </div>
    )
}

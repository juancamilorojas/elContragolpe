'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { signInAnonymously } from '@/lib/auth'
import type { Database } from '@/types/database'

type Table = Database['public']['Tables']['tables']['Row']

interface Match {
    id: string
    home_team: string
    away_team: string
    status: string
    created_at: string
}

export default function JoinPage() {
    const [step, setStep] = useState<'loading' | 'name' | 'table' | 'consent' | 'matches' | 'done'>('loading')
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
    const [matches, setMatches] = useState<Match[]>([])
    const [isReturningPlayer, setIsReturningPlayer] = useState(false)

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

    const loadMatches = useCallback(async (restId: string) => {
        // Load matches that are open, live, or finished (NOT draft or archived)
        console.log('Loading matches for restaurant:', restId)
        const { data, error: matchErr } = await supabase
            .from('matches')
            .select('id, home_team, away_team, status, created_at')
            .eq('restaurant_id', restId)
            .or('status.eq.open,status.eq.live,status.eq.finished')
            .order('created_at', { ascending: false })

        console.log('Matches result:', { data, error: matchErr })
        if (matchErr) {
            console.error('Error loading matches:', matchErr)
        }
        setMatches(data || [])
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
                .select('id, display_name, active_match_id')
                .eq('auth_user_id', user.id)
                .eq('restaurant_id', restaurant.id)
                .single()

            if (existingPlayer) {
                // Returning player — skip onboarding, go to match selection
                setDisplayName(existingPlayer.display_name)
                setIsReturningPlayer(true)
                await loadMatches(restaurant.id)
                setStep('matches')
                return
            }

            // New player — start onboarding
            await loadTables(restaurant.id)
            setStep('name')
        } catch (err: any) {
            setError(`Error: ${err?.message || 'Algo salió mal. Intenta de nuevo.'}`)
            console.error('Join init error:', err)
        }
    }, [supabase, loadTables, loadMatches])

    useEffect(() => { init() }, [init])

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!displayName.trim()) {
            setError('Por favor ingresa tu nombre')
            return
        }
        if (displayName.trim().length > 30) {
            setError('El nombre debe tener máximo 30 caracteres')
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
                    setError('Ya existe una mesa con ese nombre')
                } else {
                    setError('No se pudo crear la mesa. Intenta de nuevo.')
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
            setError('No se pudo crear la mesa.')
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
                setError('Sesión expirada. Recarga la página.')
                setLoading(false)
                return
            }

            const { error: insertErr } = await supabase
                .from('players')
                .insert({
                    auth_user_id: session.user.id,
                    restaurant_id: restaurantId,
                    table_id: selectedTableId,
                    display_name: displayName.trim(),
                    active_match_id: null,
                    consent_given: true,
                })

            if (insertErr) {
                setError('No se pudo unir. Intenta de nuevo.')
                setLoading(false)
                return
            }

            // After registration, show match list
            await loadMatches(restaurantId)
            setStep('matches')
        } catch (err) {
            setError('Algo salió mal.')
        }
        setLoading(false)
    }

    const selectMatch = (matchId: string) => {
        setStep('done')
        window.location.href = `/play/${matchId}`
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return { label: '🟢 Abierto', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
            case 'live':
                return { label: '🔴 EN VIVO', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
            case 'finished':
                return { label: '🏁 Finalizado', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' }
            default:
                return { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
        }
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
                                👋 ¿Cómo te llamas?
                            </h2>
                            <div className="form-group">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Tu nombre"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    autoFocus
                                    maxLength={30}
                                />
                                <span className="form-hint">Esto aparecerá en el ranking</span>
                            </div>
                            <button type="submit" className="btn btn--primary btn--lg btn--full">
                                Continuar →
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 2: Table Selection */}
                {step === 'table' && (
                    <div className="card">
                        <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                            🪑 Selecciona tu mesa
                        </h2>

                        <div className="form-group">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar mesas..."
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
                                    No se encontraron mesas
                                </p>
                            )}
                        </div>

                        {!showNewTable ? (
                            <button
                                className="btn btn--secondary btn--full"
                                onClick={() => setShowNewTable(true)}
                                style={{ borderStyle: 'dashed' }}
                            >
                                + Crear nueva mesa
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Nombre de la mesa (ej. Terraza 3)"
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
                                    {loading ? '...' : 'Crear'}
                                </button>
                            </div>
                        )}

                        <button
                            className="btn btn--secondary btn--full"
                            onClick={() => setStep('name')}
                            style={{ marginTop: 'var(--space-md)' }}
                        >
                            ← Atrás
                        </button>
                    </div>
                )}

                {/* Step 3: Consent */}
                {step === 'consent' && (
                    <div className="card">
                        <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                            📋 ¡Casi listo!
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
                            <p><strong>Aviso de privacidad</strong></p>
                            <p style={{ marginTop: 'var(--space-sm)' }}>
                                Solo almacenamos tu nombre y selección de mesa durante el juego.
                                No se recopila correo, teléfono ni información del dispositivo.
                                Tus datos se anonimizarán al finalizar el partido.
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
                                Acepto los términos de privacidad y quiero unirme al juego
                            </label>
                        </div>

                        <button
                            className="btn btn--primary btn--lg btn--full"
                            onClick={handleJoin}
                            disabled={!consentGiven || loading}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <span className="spinner" /> Uniéndose...
                                </span>
                            ) : (
                                '🎮 ¡Unirme al juego!'
                            )}
                        </button>

                        <button
                            className="btn btn--secondary btn--full"
                            onClick={() => setStep('table')}
                            style={{ marginTop: 'var(--space-md)' }}
                        >
                            ← Atrás
                        </button>
                    </div>
                )}

                {/* Step 4: Match Selection */}
                {step === 'matches' && (
                    <div>
                        {isReturningPlayer && (
                            <p style={{
                                textAlign: 'center',
                                color: 'var(--color-text-secondary)',
                                marginBottom: 'var(--space-lg)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                👋 ¡Hola de nuevo, <strong>{displayName}</strong>!
                            </p>
                        )}

                        <div className="card">
                            <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>
                                🏟️ Elige un partido
                            </h2>

                            {matches.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                                    <p style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>😴</p>
                                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                                        No hay partidos disponibles en este momento.
                                    </p>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                        Espera a que el administrador abra un partido.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {matches.map((match) => {
                                        const badge = getStatusBadge(match.status)
                                        return (
                                            <button
                                                key={match.id}
                                                onClick={() => selectMatch(match.id)}
                                                style={{
                                                    background: 'var(--color-bg-input)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    padding: 'var(--space-lg)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    textAlign: 'center',
                                                    width: '100%',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--color-accent)'
                                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--color-border)'
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                }}
                                            >
                                                {/* Status badge */}
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    color: badge.color,
                                                    background: badge.bg,
                                                    marginBottom: 'var(--space-sm)',
                                                }}>
                                                    {badge.label}
                                                </span>

                                                {/* Teams */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 'var(--space-md)',
                                                    margin: 'var(--space-sm) 0',
                                                }}>
                                                    <span style={{
                                                        fontSize: 'var(--font-size-lg)',
                                                        fontWeight: 700,
                                                        color: 'var(--color-text-primary)',
                                                    }}>
                                                        {match.home_team}
                                                    </span>
                                                    <span style={{
                                                        fontSize: 'var(--font-size-sm)',
                                                        color: 'var(--color-text-muted)',
                                                        fontWeight: 500,
                                                    }}>
                                                        vs
                                                    </span>
                                                    <span style={{
                                                        fontSize: 'var(--font-size-lg)',
                                                        fontWeight: 700,
                                                        color: 'var(--color-text-primary)',
                                                    }}>
                                                        {match.away_team}
                                                    </span>
                                                </div>

                                                {/* CTA */}
                                                <span style={{
                                                    fontSize: 'var(--font-size-sm)',
                                                    color: 'var(--color-accent)',
                                                    fontWeight: 600,
                                                }}>
                                                    {match.status === 'finished' ? 'Ver resultados →' : 'Entrar al partido →'}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 5: Done */}
                {step === 'done' && (
                    <div className="loading-screen">
                        <div className="spinner spinner--lg" />
                        <p>Redirigiendo al partido...</p>
                    </div>
                )}
            </div>
        </div>
    )
}

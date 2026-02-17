'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

interface LeaderboardEntry {
    player_id: string
    display_name: string
    table_name: string
    total_points: number
}

interface TableScore {
    table_name: string
    total_points: number
    player_count: number
}

export default function PlayMatchPage() {
    const params = useParams()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<any>(null)
    const [predictionTypes, setPredictionTypes] = useState<any[]>([])
    const [myPredictions, setMyPredictions] = useState<any[]>([])
    const [matchResults, setMatchResults] = useState<any[]>([])
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [tableScores, setTableScores] = useState<TableScore[]>([])
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [tableId, setTableId] = useState<string | null>(null)
    const [predictionValues, setPredictionValues] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'predictions' | 'leaderboard'>('predictions')
    const [leaderboardView, setLeaderboardView] = useState<'players' | 'tables'>('players')
    const [bonusUnlocked, setBonusUnlocked] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)

    const supabase = getSupabaseClient()

    // ── Initialize ──────────────────────────

    const loadData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            window.location.href = '/join'
            return
        }

        const { data: player } = await supabase
            .from('players')
            .select('id, table_id')
            .eq('auth_user_id', session.user.id)
            .single()

        if (!player) {
            window.location.href = '/join'
            return
        }

        setPlayerId(player.id)
        setTableId(player.table_id)

        const { data: matchData } = await supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single()

        if (matchData) setMatch(matchData)

        const { data: types } = await supabase
            .from('prediction_types')
            .select('*')
            .eq('match_id', matchId)
            .order('sort_order')

        if (types) setPredictionTypes(types)

        const { data: preds } = await supabase
            .from('predictions')
            .select('*')
            .eq('player_id', player.id)
            .eq('match_id', matchId)

        if (preds) setMyPredictions(preds)

        const { data: results } = await supabase
            .from('match_results')
            .select('*')
            .eq('match_id', matchId)

        if (results) setMatchResults(results)

        if (player.table_id) {
            const { data: bonuses } = await supabase
                .from('table_bonuses')
                .select('menu_item_id')
                .eq('table_id', player.table_id)
                .eq('match_id', matchId)

            if (bonuses) {
                setBonusUnlocked(new Set(bonuses.map(b => b.menu_item_id)))
            }
        }

        await loadLeaderboard()
        setLoading(false)
    }, [matchId, supabase])

    const loadLeaderboard = useCallback(async () => {
        const { data } = await supabase
            .from('predictions')
            .select(`
                player_id,
                points_earned,
                players!inner(display_name, table_id, tables!inner(name))
            `)
            .eq('match_id', matchId)

        if (!data) return

        const playerMap = new Map<string, LeaderboardEntry>()
        const tableMap = new Map<string, TableScore>()

        for (const row of data as any[]) {
            const pid = row.player_id
            const tableName = row.players.tables.name
            const points = row.points_earned || 0

            if (!playerMap.has(pid)) {
                playerMap.set(pid, {
                    player_id: pid,
                    display_name: row.players.display_name,
                    table_name: tableName,
                    total_points: 0,
                })
            }
            playerMap.get(pid)!.total_points += points

            if (!tableMap.has(tableName)) {
                tableMap.set(tableName, { table_name: tableName, total_points: 0, player_count: 0 })
            }
            tableMap.get(tableName)!.total_points += points
        }

        // Count unique players per table
        const tablePlayerSets = new Map<string, Set<string>>()
        for (const [pid, entry] of Array.from(playerMap.entries())) {
            if (!tablePlayerSets.has(entry.table_name)) {
                tablePlayerSets.set(entry.table_name, new Set())
            }
            tablePlayerSets.get(entry.table_name)!.add(pid)
        }
        for (const [tableName, players] of Array.from(tablePlayerSets.entries())) {
            if (tableMap.has(tableName)) {
                tableMap.get(tableName)!.player_count = players.size
            }
        }

        setLeaderboard(Array.from(playerMap.values()).sort((a, b) => b.total_points - a.total_points))
        setTableScores(Array.from(tableMap.values()).sort((a, b) => b.total_points - a.total_points))
    }, [matchId, supabase])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ── Realtime Subscriptions ─────────────

    useEffect(() => {
        if (!matchId) return

        const channel = supabase
            .channel(`match-${matchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'predictions', filter: `match_id=eq.${matchId}` },
                () => {
                    loadLeaderboard()
                    if (playerId) {
                        supabase
                            .from('predictions')
                            .select('*')
                            .eq('player_id', playerId)
                            .eq('match_id', matchId)
                            .then(({ data }) => { if (data) setMyPredictions(data) })
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'match_results', filter: `match_id=eq.${matchId}` },
                () => {
                    supabase
                        .from('match_results')
                        .select('*')
                        .eq('match_id', matchId)
                        .then(({ data }) => { if (data) setMatchResults(data) })
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                (payload) => {
                    const newMatch = (payload as any).new
                    setMatch(newMatch)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [matchId, playerId, supabase, loadLeaderboard])

    // Bonus realtime
    useEffect(() => {
        if (!tableId || !matchId) return

        const channel = supabase
            .channel(`bonus-${tableId}-${matchId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'table_bonuses', filter: `table_id=eq.${tableId}` },
                (payload) => {
                    const bonus = (payload as any).new
                    if (bonus.match_id === matchId) {
                        setBonusUnlocked(prev => new Set([...Array.from(prev), bonus.menu_item_id]))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [tableId, matchId, supabase])

    // ── Submit Prediction ──────────────────

    const submitPrediction = async (typeId: string, value?: string) => {
        const finalValue = value || predictionValues[typeId]
        if (!finalValue?.trim() || !playerId) return
        setSubmitting(typeId)

        const { error } = await supabase
            .from('predictions')
            .upsert({
                player_id: playerId,
                match_id: matchId,
                prediction_type_id: typeId,
                predicted_value: finalValue.trim(),
            }, { onConflict: 'player_id,match_id,prediction_type_id' })

        if (!error) {
            const { data } = await supabase
                .from('predictions')
                .select('*')
                .eq('player_id', playerId)
                .eq('match_id', matchId)

            if (data) setMyPredictions(data)
        }
        setSubmitting(null)
    }

    // ── Helpers ────────────────────────────

    const getMyPrediction = (typeId: string) =>
        myPredictions.find(p => p.prediction_type_id === typeId)

    const getResult = (typeId: string) =>
        matchResults.find(r => r.prediction_type_id === typeId)

    const isTypeResolved = (typeId: string) => !!getResult(typeId)

    const getTypeOptions = (type: any): string[] => {
        if (!type.options || !Array.isArray(type.options)) return []
        return type.options
    }

    const canPredict = (type: any) => {
        if (match?.status !== 'open' && match?.status !== 'live') return false
        if (isTypeResolved(type.id)) return false
        if (type.is_bonus && type.required_menu_item_id && !bonusUnlocked.has(type.required_menu_item_id)) return false
        return true
    }

    const isTypeVisible = (type: any) => {
        if (!type.is_bonus) return true
        if (!type.required_menu_item_id) return true
        return bonusUnlocked.has(type.required_menu_item_id)
    }

    // ── Render Prediction Card ─────────────

    const renderPredictionCard = (type: any, isBonus: boolean) => {
        const myPred = getMyPrediction(type.id)
        const result = getResult(type.id)
        const can = canPredict(type)
        const options = getTypeOptions(type)

        return (
            <div key={type.id} className="card" style={{
                marginBottom: 'var(--space-sm)',
                borderColor: isBonus ? 'var(--color-warning)' : undefined,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <span style={{ fontWeight: 600 }}>{type.label}</span>
                    <span className={isBonus ? 'badge badge--bonus' : 'badge badge--open'}>
                        +{type.points_value} pts{isBonus ? ' BONUS' : ''}
                    </span>
                </div>

                {/* Result display */}
                {result && (
                    <div style={{
                        background: 'var(--color-bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-sm) var(--space-md)',
                        marginBottom: 'var(--space-sm)',
                        fontSize: 'var(--font-size-sm)',
                    }}>
                        Resultado: <strong>{result.actual_value}</strong>
                        {myPred && (
                            <span style={{ marginLeft: 'var(--space-md)', color: myPred.is_correct ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {myPred.is_correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
                            </span>
                        )}
                    </div>
                )}

                {/* Already predicted, waiting for result */}
                {myPred && !result && (
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-sm)',
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'var(--color-bg-input)',
                        borderRadius: 'var(--radius-sm)',
                    }}>
                        Tu predicción: <strong style={{ color: isBonus ? 'var(--color-warning)' : 'var(--color-accent)' }}>{myPred.predicted_value}</strong>
                    </div>
                )}

                {/* Can predict — show options or text input */}
                {can && !myPred && (
                    options.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                            {options.map((opt: string, i: number) => (
                                <button
                                    key={i}
                                    className="btn"
                                    style={{
                                        background: predictionValues[type.id] === opt ? 'var(--color-accent)' : 'var(--color-bg-input)',
                                        color: predictionValues[type.id] === opt ? '#fff' : 'var(--color-text-primary)',
                                        border: predictionValues[type.id] === opt ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                                        fontWeight: 600,
                                        padding: 'var(--space-sm) var(--space-md)',
                                        flex: options.length <= 3 ? '1' : undefined,
                                        minWidth: options.length > 3 ? '45%' : undefined,
                                    }}
                                    disabled={submitting === type.id}
                                    onClick={() => submitPrediction(type.id, opt)}
                                >
                                    {submitting === type.id && predictionValues[type.id] === opt ? '...' : opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Tu predicción..."
                                value={predictionValues[type.id] || ''}
                                onChange={(e) =>
                                    setPredictionValues(prev => ({ ...prev, [type.id]: e.target.value }))
                                }
                                style={{ flex: 1 }}
                            />
                            <button
                                className="btn btn--primary"
                                onClick={() => submitPrediction(type.id)}
                                disabled={!predictionValues[type.id]?.trim() || submitting === type.id}
                            >
                                {submitting === type.id ? '...' : 'Enviar'}
                            </button>
                        </div>
                    )
                )}

                {/* Predictions locked */}
                {!can && !myPred && !result && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Predicciones bloqueadas
                    </p>
                )}
            </div>
        )
    }

    // ── Render ─────────────────────────────

    if (loading) {
        return (
            <div className="page">
                <div className="loading-screen">
                    <div className="spinner spinner--lg" />
                    <p>Cargando partido...</p>
                </div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="page">
                <div className="container container--narrow" style={{ textAlign: 'center' }}>
                    <h2>Partido no encontrado</h2>
                    <a href="/join" className="btn btn--primary" style={{ marginTop: 'var(--space-lg)' }}>Volver</a>
                </div>
            </div>
        )
    }

    const visibleTypes = predictionTypes.filter(isTypeVisible)
    const regularTypes = visibleTypes.filter(t => !t.is_bonus)
    const bonusTypes = visibleTypes.filter(t => t.is_bonus)

    return (
        <div className="page" style={{ paddingTop: 'var(--space-md)' }}>
            <div className="container container--narrow">
                {/* Match Header */}
                <div className="card" style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>
                        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{match.home_team}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>VS</span>
                        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{match.away_team}</span>
                    </div>
                    <span className={`badge badge--${match.status === 'live' ? 'live' : match.status === 'open' ? 'open' : 'finished'}`}>
                        {match.status === 'live' ? '🔴 EN VIVO' : match.status === 'open' ? '🟢 ABIERTO' : match.status.toUpperCase()}
                    </span>
                    {match.final_score && (
                        <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginTop: 'var(--space-sm)', color: 'var(--color-accent)' }}>
                            {(match.final_score as any).home ?? '-'} – {(match.final_score as any).away ?? '-'}
                        </p>
                    )}
                </div>

                {/* Tab Toggle */}
                <div style={{
                    display: 'flex',
                    gap: '2px',
                    marginBottom: 'var(--space-lg)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '2px',
                }}>
                    <button
                        className="btn btn--full"
                        style={{
                            background: activeTab === 'predictions' ? 'var(--color-bg-card)' : 'transparent',
                            color: activeTab === 'predictions' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                        }}
                        onClick={() => setActiveTab('predictions')}
                    >
                        📋 Predicciones
                    </button>
                    <button
                        className="btn btn--full"
                        style={{
                            background: activeTab === 'leaderboard' ? 'var(--color-bg-card)' : 'transparent',
                            color: activeTab === 'leaderboard' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                        }}
                        onClick={() => setActiveTab('leaderboard')}
                    >
                        🏆 Ranking
                    </button>
                </div>

                {/* Predictions Tab */}
                {activeTab === 'predictions' && (
                    <div>
                        {regularTypes.length > 0 && (
                            <>
                                {regularTypes.map((type) => renderPredictionCard(type, false))}
                            </>
                        )}

                        {/* Bonus Predictions */}
                        {bonusTypes.length > 0 && (
                            <>
                                <h3 style={{
                                    fontSize: 'var(--font-size-md)',
                                    fontWeight: 700,
                                    color: 'var(--color-warning)',
                                    marginTop: 'var(--space-lg)',
                                    marginBottom: 'var(--space-sm)',
                                }}>
                                    ⭐ Predicciones Bonus
                                </h3>
                                {bonusTypes.map((type) => renderPredictionCard(type, true))}
                            </>
                        )}

                        {visibleTypes.length === 0 && (
                            <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                <p>No hay predicciones disponibles aún. ¡El admin las agregará pronto!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Leaderboard Tab */}
                {activeTab === 'leaderboard' && (
                    <div className="card">
                        <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>🏆 Ranking</h3>

                        {/* Toggle: Players vs Tables */}
                        <div style={{
                            display: 'flex',
                            gap: '2px',
                            marginBottom: 'var(--space-md)',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            padding: '2px',
                        }}>
                            <button
                                className="btn btn--full"
                                style={{
                                    background: leaderboardView === 'players' ? 'var(--color-bg-card)' : 'transparent',
                                    color: leaderboardView === 'players' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-sm)',
                                }}
                                onClick={() => setLeaderboardView('players')}
                            >
                                👤 Jugadores
                            </button>
                            <button
                                className="btn btn--full"
                                style={{
                                    background: leaderboardView === 'tables' ? 'var(--color-bg-card)' : 'transparent',
                                    color: leaderboardView === 'tables' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-sm)',
                                }}
                                onClick={() => setLeaderboardView('tables')}
                            >
                                🪑 Mesas
                            </button>
                        </div>

                        {leaderboardView === 'players' ? (
                            leaderboard.length === 0 ? (
                                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                    No hay puntajes aún. ¡Haz tus predicciones!
                                </p>
                            ) : (
                                <div className="leaderboard">
                                    {leaderboard.map((entry, idx) => (
                                        <div
                                            key={entry.player_id}
                                            className="leaderboard__row"
                                            style={{
                                                background: entry.player_id === playerId ? 'var(--color-accent-glow)' : undefined,
                                            }}
                                        >
                                            <span className={`leaderboard__rank ${idx === 0 ? 'leaderboard__rank--gold' : idx === 1 ? 'leaderboard__rank--silver' : idx === 2 ? 'leaderboard__rank--bronze' : ''}`}>
                                                {idx + 1}
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                <span className="leaderboard__name">
                                                    {entry.display_name}
                                                    {entry.player_id === playerId && ' (tú)'}
                                                </span>
                                                <span className="leaderboard__table"> · {entry.table_name}</span>
                                            </div>
                                            <span className="leaderboard__points">{entry.total_points}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            tableScores.length === 0 ? (
                                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                    No hay puntajes aún.
                                </p>
                            ) : (
                                <div className="leaderboard">
                                    {tableScores.map((entry, idx) => (
                                        <div key={entry.table_name} className="leaderboard__row">
                                            <span className={`leaderboard__rank ${idx === 0 ? 'leaderboard__rank--gold' : idx === 1 ? 'leaderboard__rank--silver' : idx === 2 ? 'leaderboard__rank--bronze' : ''}`}>
                                                {idx + 1}
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                <span className="leaderboard__name">🪑 {entry.table_name}</span>
                                                <span className="leaderboard__table"> · {entry.player_count} jugadores</span>
                                            </div>
                                            <span className="leaderboard__points">{entry.total_points}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

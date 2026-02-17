'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'

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

export default function AdminMatchControlPage() {
    const params = useParams()
    const matchId = params.matchId as string

    const [match, setMatch] = useState<any>(null)
    const [predictionTypes, setPredictionTypes] = useState<any[]>([])
    const [matchResults, setMatchResults] = useState<any[]>([])
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [tableScores, setTableScores] = useState<TableScore[]>([])
    const [tables, setTables] = useState<any[]>([])
    const [menuItems, setMenuItems] = useState<any[]>([])
    const [playerCount, setPlayerCount] = useState(0)

    // Form state for new prediction type
    const [newLabel, setNewLabel] = useState('')
    const [newCategory, setNewCategory] = useState('general')
    const [newPoints, setNewPoints] = useState(1)
    const [newIsBonus, setNewIsBonus] = useState(false)
    const [newMenuItemId, setNewMenuItemId] = useState('')
    const [newOptions, setNewOptions] = useState<string[]>(['', ''])

    // Bonus activation form
    const [bonusTableId, setBonusTableId] = useState('')
    const [bonusMenuItemId, setBonusMenuItemId] = useState('')

    // Score update form
    const [scoreHome, setScoreHome] = useState('')
    const [scoreAway, setScoreAway] = useState('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeSection, setActiveSection] = useState<'predictions' | 'results' | 'bonuses' | 'leaderboard'>('predictions')
    const [leaderboardView, setLeaderboardView] = useState<'players' | 'tables'>('players')

    const supabase = getSupabaseClient()

    const loadAll = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const restaurantId = getAdminRestaurantId(session.user)
        if (!restaurantId) return

        const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single()
        if (matchData) {
            setMatch(matchData)
            if (matchData.final_score) {
                setScoreHome(String((matchData.final_score as any).home ?? ''))
                setScoreAway(String((matchData.final_score as any).away ?? ''))
            }
        }

        const { data: types } = await supabase.from('prediction_types').select('*').eq('match_id', matchId).order('sort_order')
        if (types) setPredictionTypes(types)

        const { data: results } = await supabase.from('match_results').select('*').eq('match_id', matchId)
        if (results) setMatchResults(results)

        const { data: tablesData } = await supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('name')
        if (tablesData) setTables(tablesData)

        const { data: items } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_active', true)
        if (items) setMenuItems(items)

        const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('active_match_id', matchId)
        setPlayerCount(count || 0)

        await loadLeaderboard()
        setLoading(false)
    }, [matchId, supabase])

    const loadLeaderboard = useCallback(async () => {
        const { data } = await supabase
            .from('predictions')
            .select('player_id, points_earned, players!inner(display_name, table_id, tables!inner(name))')
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
            // We'll calculate player_count separately
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

    useEffect(() => { loadAll() }, [loadAll])

    // ── Match Status Control ──────────────

    const updateMatchStatus = async (newStatus: string) => {
        setError('')
        const { error: err } = await supabase.from('matches').update({ status: newStatus }).eq('id', matchId)
        if (err) { setError(err.message); return }
        await loadAll()
    }

    const updateScore = async () => {
        const { error: err } = await supabase
            .from('matches')
            .update({
                final_score: { home: parseInt(scoreHome) || 0, away: parseInt(scoreAway) || 0 }
            })
            .eq('id', matchId)
        if (err) setError(err.message)
        else await loadAll()
    }

    // ── Prediction Type CRUD ──────────────

    const addPredictionType = async () => {
        if (!newLabel.trim()) return
        setError('')

        const filteredOptions = newOptions.filter(o => o.trim() !== '')

        const { error: err } = await supabase.from('prediction_types').insert({
            match_id: matchId,
            label: newLabel.trim(),
            category: newCategory,
            points_value: newPoints,
            is_bonus: newIsBonus,
            required_menu_item_id: newIsBonus && newMenuItemId ? newMenuItemId : null,
            sort_order: predictionTypes.length,
            options: filteredOptions,
        })
        if (err) { setError(err.message); return }
        setNewLabel('')
        setNewPoints(1)
        setNewIsBonus(false)
        setNewMenuItemId('')
        setNewOptions(['', ''])
        await loadAll()
    }

    const deletePredictionType = async (id: string) => {
        if (!confirm('Delete this prediction type? All related predictions will be lost.')) return
        await supabase.from('prediction_types').delete().eq('id', id)
        await loadAll()
    }

    // ── Options Management ────────────────

    const updateOption = (index: number, value: string) => {
        setNewOptions(prev => {
            const updated = [...prev]
            updated[index] = value
            return updated
        })
    }

    const addOptionField = () => {
        if (newOptions.length < 6) {
            setNewOptions(prev => [...prev, ''])
        }
    }

    const removeOptionField = (index: number) => {
        if (newOptions.length > 2) {
            setNewOptions(prev => prev.filter((_, i) => i !== index))
        }
    }

    // ── Record Result ─────────────────────

    const recordResult = async (typeId: string, value: string) => {
        if (!value?.trim()) return
        setError('')

        const { error: err } = await supabase
            .from('match_results')
            .upsert({
                match_id: matchId,
                prediction_type_id: typeId,
                actual_value: value.trim(),
            }, { onConflict: 'match_id,prediction_type_id' })

        if (err) { setError(err.message); return }
        await loadAll()
    }

    // ── Activate Bonus ────────────────────

    const activateBonus = async () => {
        if (!bonusTableId || !bonusMenuItemId) return
        setError('')

        const { data: { session } } = await supabase.auth.getSession()

        const { error: err } = await supabase.from('table_bonuses').insert({
            table_id: bonusTableId,
            match_id: matchId,
            menu_item_id: bonusMenuItemId,
            activated_by: session?.user?.id || '',
        })

        if (err) {
            if (err.code === '23505') {
                setError('This bonus is already activated for this table')
            } else {
                setError(err.message)
            }
            return
        }
        setBonusTableId('')
        setBonusMenuItemId('')
    }

    // ── Helpers ───────────────────────────

    const getResult = (typeId: string) => matchResults.find(r => r.prediction_type_id === typeId)
    const getTypeOptions = (type: any): string[] => {
        if (!type.options || !Array.isArray(type.options)) return []
        return type.options
    }

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
    }

    if (!match) {
        return <div>Match not found</div>
    }

    const statusActions: Record<string, { label: string; next: string; style: string }[]> = {
        draft: [{ label: '🟢 Open for Predictions', next: 'open', style: 'btn--primary' }],
        open: [{ label: '🔴 Start Match (Go Live)', next: 'live', style: 'btn--danger' }],
        live: [{ label: '🏁 End Match', next: 'finished', style: 'btn--secondary' }],
        finished: [{ label: '📦 Archive', next: 'archived', style: 'btn--secondary' }],
        archived: [],
    }

    return (
        <div>
            {/* Match Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xl)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
                        {match.home_team} vs {match.away_team}
                    </h1>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginTop: 'var(--space-sm)' }}>
                        <span className={`badge badge--${match.status === 'live' ? 'live' : match.status === 'open' ? 'open' : 'finished'}`}>
                            {match.status.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            {playerCount} players
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    {statusActions[match.status]?.map(action => (
                        <button
                            key={action.next}
                            className={`btn ${action.style}`}
                            onClick={() => updateMatchStatus(action.next)}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>
                    <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>⚠️ {error}</p>
                </div>
            )}

            {/* Score Display */}
            {(match.status === 'live' || match.status === 'finished') && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
                    <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Score</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div className="form-group" style={{ margin: 0, alignItems: 'center' }}>
                            <label className="form-label">{match.home_team}</label>
                            <input className="form-input" type="number" min="0" style={{ width: '60px', textAlign: 'center' }} value={scoreHome} onChange={e => setScoreHome(e.target.value)} />
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-muted)' }}>–</span>
                        <div className="form-group" style={{ margin: 0, alignItems: 'center' }}>
                            <label className="form-label">{match.away_team}</label>
                            <input className="form-input" type="number" min="0" style={{ width: '60px', textAlign: 'center' }} value={scoreAway} onChange={e => setScoreAway(e.target.value)} />
                        </div>
                        <button className="btn btn--primary" onClick={updateScore}>Update</button>
                    </div>
                </div>
            )}

            {/* Section Tabs */}
            <div style={{ display: 'flex', gap: '2px', marginBottom: 'var(--space-lg)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                {(['predictions', 'results', 'bonuses', 'leaderboard'] as const).map(tab => (
                    <button
                        key={tab}
                        className="btn btn--full"
                        style={{
                            background: activeSection === tab ? 'var(--color-bg-card)' : 'transparent',
                            color: activeSection === tab ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-sm)',
                        }}
                        onClick={() => setActiveSection(tab)}
                    >
                        {tab === 'predictions' ? '📋 Types' : tab === 'results' ? '✅ Results' : tab === 'bonuses' ? '⭐ Bonuses' : '🏆 Board'}
                    </button>
                ))}
            </div>

            {/* ── Prediction Types ─────────────── */}
            {activeSection === 'predictions' && (
                <div>
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>Add Prediction Type</h3>
                        <div className="form-group">
                            <label className="form-label">Question</label>
                            <input className="form-input" placeholder="e.g. ¿Quién gana?" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                        </div>

                        {/* Answer Options */}
                        <div className="form-group">
                            <label className="form-label">Answer Options (up to 6)</label>
                            {newOptions.map((opt, i) => (
                                <div key={i} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                                    <input
                                        className="form-input"
                                        placeholder={`Option ${i + 1}`}
                                        value={opt}
                                        onChange={e => updateOption(i, e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    {newOptions.length > 2 && (
                                        <button
                                            className="btn btn--danger btn--icon"
                                            onClick={() => removeOptionField(i)}
                                            title="Remove option"
                                            style={{ minWidth: '36px' }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                            {newOptions.length < 6 && (
                                <button className="btn btn--secondary" onClick={addOptionField} style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-sm)' }}>
                                    + Add Option
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                                    <option value="general">General</option>
                                    <option value="goals">Goals</option>
                                    <option value="cards">Cards</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Points</label>
                                <input className="form-input" type="number" min="1" value={newPoints} onChange={e => setNewPoints(parseInt(e.target.value) || 1)} />
                            </div>
                        </div>
                        <div className="checkbox-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <input type="checkbox" id="is-bonus" checked={newIsBonus} onChange={e => setNewIsBonus(e.target.checked)} />
                            <label htmlFor="is-bonus">This is a bonus prediction (requires menu item order)</label>
                        </div>
                        {newIsBonus && menuItems.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Required Menu Item</label>
                                <select className="form-select" value={newMenuItemId} onChange={e => setNewMenuItemId(e.target.value)}>
                                    <option value="">Select item...</option>
                                    {menuItems.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button className="btn btn--primary" onClick={addPredictionType} disabled={!newLabel.trim()}>
                            Add Prediction Type
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {predictionTypes.map((type) => {
                            const options = getTypeOptions(type)
                            return (
                                <div key={type.id} className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontWeight: 600 }}>{type.label}</span>
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)', flexWrap: 'wrap' }}>
                                                <span className="badge" style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-muted)' }}>
                                                    {type.category}
                                                </span>
                                                <span className="badge badge--open">+{type.points_value} pts</span>
                                                {type.is_bonus && <span className="badge badge--bonus">BONUS</span>}
                                            </div>
                                            {options.length > 0 && (
                                                <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                                    {options.map((opt: string, i: number) => (
                                                        <span key={i} style={{
                                                            padding: '2px 8px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            background: 'var(--color-accent-glow)',
                                                            color: 'var(--color-accent)',
                                                            fontSize: 'var(--font-size-xs)',
                                                            fontWeight: 500,
                                                        }}>
                                                            {opt}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button className="btn btn--danger btn--icon" onClick={() => deletePredictionType(type.id)} title="Delete">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Results Recording ────────────── */}
            {activeSection === 'results' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {predictionTypes.map(type => {
                        const result = getResult(type.id)
                        const options = getTypeOptions(type)

                        return (
                            <div key={type.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                    <span style={{ fontWeight: 600 }}>{type.label}</span>
                                    {result && <span className="badge badge--open">✅ {result.actual_value}</span>}
                                </div>

                                {/* Option Buttons for recording result */}
                                {options.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                        {options.map((opt: string, i: number) => (
                                            <button
                                                key={i}
                                                className="btn"
                                                style={{
                                                    background: result?.actual_value === opt ? 'var(--color-success)' : 'var(--color-bg-input)',
                                                    color: result?.actual_value === opt ? '#fff' : 'var(--color-text-primary)',
                                                    border: result?.actual_value === opt ? '2px solid var(--color-success)' : '2px solid var(--color-border)',
                                                    fontWeight: 600,
                                                    padding: 'var(--space-sm) var(--space-md)',
                                                }}
                                                onClick={() => recordResult(type.id, opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                        {/* Nadie ganó button */}
                                        <button
                                            className="btn"
                                            style={{
                                                background: result?.actual_value === 'Nadie ganó' ? 'var(--color-warning)' : 'var(--color-bg-input)',
                                                color: result?.actual_value === 'Nadie ganó' ? '#fff' : 'var(--color-text-muted)',
                                                border: result?.actual_value === 'Nadie ganó' ? '2px solid var(--color-warning)' : '2px solid var(--color-border)',
                                                fontWeight: 600,
                                                padding: 'var(--space-sm) var(--space-md)',
                                                fontStyle: 'italic',
                                            }}
                                            onClick={() => recordResult(type.id, 'Nadie ganó')}
                                        >
                                            Nadie ganó
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <input
                                            className="form-input"
                                            placeholder={result ? `Current: ${result.actual_value}` : 'Enter actual result...'}
                                            id={`result-${type.id}`}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            className="btn btn--primary"
                                            onClick={() => {
                                                const input = document.getElementById(`result-${type.id}`) as HTMLInputElement
                                                if (input?.value) recordResult(type.id, input.value)
                                            }}
                                        >
                                            {result ? 'Update' : 'Record'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {predictionTypes.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            Add prediction types first before recording results.
                        </div>
                    )}
                </div>
            )}

            {/* ── Bonus Activation ─────────────── */}
            {activeSection === 'bonuses' && (
                <div>
                    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>Activate Bonus for Table</h3>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                            When a table orders a menu item, activate the bonus to unlock bonus predictions for all players at that table.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Table</label>
                                <select className="form-select" value={bonusTableId} onChange={e => setBonusTableId(e.target.value)}>
                                    <option value="">Select table...</option>
                                    {tables.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Menu Item Ordered</label>
                                <select className="form-select" value={bonusMenuItemId} onChange={e => setBonusMenuItemId(e.target.value)}>
                                    <option value="">Select item...</option>
                                    {menuItems.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            className="btn btn--primary"
                            onClick={activateBonus}
                            disabled={!bonusTableId || !bonusMenuItemId}
                        >
                            ⭐ Activate Bonus
                        </button>
                    </div>
                </div>
            )}

            {/* ── Leaderboard ──────────────────── */}
            {activeSection === 'leaderboard' && (
                <div className="card">
                    <div className="card__header" style={{ marginBottom: 'var(--space-md)' }}>
                        <h3 className="card__title">🏆 Leaderboard</h3>
                        <button className="btn btn--secondary" onClick={loadLeaderboard}>Refresh</button>
                    </div>

                    {/* Toggle: Players vs Tables */}
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
                                background: leaderboardView === 'players' ? 'var(--color-bg-card)' : 'transparent',
                                color: leaderboardView === 'players' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                            }}
                            onClick={() => setLeaderboardView('players')}
                        >
                            👤 Players
                        </button>
                        <button
                            className="btn btn--full"
                            style={{
                                background: leaderboardView === 'tables' ? 'var(--color-bg-card)' : 'transparent',
                                color: leaderboardView === 'tables' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                            }}
                            onClick={() => setLeaderboardView('tables')}
                        >
                            🪑 Tables
                        </button>
                    </div>

                    {leaderboardView === 'players' ? (
                        leaderboard.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No scores yet</p>
                        ) : (
                            <div className="leaderboard">
                                {leaderboard.map((entry, idx) => (
                                    <div key={entry.player_id} className="leaderboard__row">
                                        <span className={`leaderboard__rank ${idx === 0 ? 'leaderboard__rank--gold' : idx === 1 ? 'leaderboard__rank--silver' : idx === 2 ? 'leaderboard__rank--bronze' : ''}`}>
                                            {idx + 1}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <span className="leaderboard__name">{entry.display_name}</span>
                                            <span className="leaderboard__table"> · {entry.table_name}</span>
                                        </div>
                                        <span className="leaderboard__points">{entry.total_points}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        tableScores.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No scores yet</p>
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
    )
}

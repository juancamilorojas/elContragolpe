'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'
import type { Database } from '@/types/database'

type Table = Database['public']['Tables']['tables']['Row']

export default function AdminTablesPage() {
    const [tables, setTables] = useState<Table[]>([])
    const [newTableName, setNewTableName] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const supabase = getSupabaseClient()

    const loadTables = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const restaurantId = getAdminRestaurantId(session.user)
        if (!restaurantId) return

        const { data } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name')

        if (data) setTables(data)
        setLoading(false)
    }

    useEffect(() => { loadTables() }, [])

    const createTable = async () => {
        if (!newTableName.trim()) return
        setError('')

        const { data: { session } } = await supabase.auth.getSession()
        const restaurantId = getAdminRestaurantId(session?.user || null)
        if (!restaurantId) return

        const { error: insertErr } = await supabase
            .from('tables')
            .insert({ restaurant_id: restaurantId, name: newTableName.trim() })

        if (insertErr) {
            if (insertErr.code === '23505') {
                setError('A table with this name already exists')
            } else {
                setError(insertErr.message)
            }
            return
        }
        setNewTableName('')
        await loadTables()
    }

    const toggleTable = async (id: string, currentActive: boolean) => {
        await supabase
            .from('tables')
            .update({ is_active: !currentActive })
            .eq('id', id)
        await loadTables()
    }

    const deleteTable = async (id: string) => {
        if (!confirm('Delete this table? Players at this table will be affected.')) return
        await supabase.from('tables').delete().eq('id', id)
        await loadTables()
    }

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
    }

    return (
        <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-xl)' }}>
                🪑 Tables
            </h1>

            {/* Create table */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>Add Table</h3>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input
                        className="form-input"
                        placeholder="Table name (e.g., Terraza 3)"
                        value={newTableName}
                        onChange={e => setNewTableName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createTable()}
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn--primary" onClick={createTable} disabled={!newTableName.trim()}>
                        Add
                    </button>
                </div>
                {error && <p className="form-error" style={{ marginTop: 'var(--space-sm)' }}>{error}</p>}
            </div>

            {/* Table list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {tables.map(table => (
                    <div key={table.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontWeight: 600 }}>{table.name}</span>
                            <span className={`badge ${table.is_active ? 'badge--open' : 'badge--finished'}`} style={{ marginLeft: 'var(--space-sm)' }}>
                                {table.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <button
                                className="btn btn--secondary btn--icon"
                                onClick={() => toggleTable(table.id, table.is_active)}
                                title={table.is_active ? 'Deactivate' : 'Activate'}
                            >
                                {table.is_active ? '🔒' : '🔓'}
                            </button>
                            <button
                                className="btn btn--danger btn--icon"
                                onClick={() => deleteTable(table.id)}
                                title="Delete"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
                {tables.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <p>No tables yet. Add your first table or let players create them!</p>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminRestaurantId } from '@/lib/auth'
import type { Database } from '@/types/database'

type MenuItem = Database['public']['Tables']['menu_items']['Row']

export default function AdminMenuPage() {
    const [items, setItems] = useState<MenuItem[]>([])
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const supabase = getSupabaseClient()

    const loadItems = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const restaurantId = getAdminRestaurantId(session.user)
        if (!restaurantId) return

        const { data } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name')

        if (data) setItems(data)
        setLoading(false)
    }

    useEffect(() => { loadItems() }, [])

    const createItem = async () => {
        if (!newName.trim()) return
        setError('')

        const { data: { session } } = await supabase.auth.getSession()
        const restaurantId = getAdminRestaurantId(session?.user || null)
        if (!restaurantId) return

        const { error: insertErr } = await supabase
            .from('menu_items')
            .insert({
                restaurant_id: restaurantId,
                name: newName.trim(),
                description: newDesc.trim() || null,
            })

        if (insertErr) { setError(insertErr.message); return }
        setNewName('')
        setNewDesc('')
        await loadItems()
    }

    const toggleItem = async (id: string, currentActive: boolean) => {
        await supabase.from('menu_items').update({ is_active: !currentActive }).eq('id', id)
        await loadItems()
    }

    const deleteItem = async (id: string) => {
        if (!confirm('Delete this menu item?')) return
        await supabase.from('menu_items').delete().eq('id', id)
        await loadItems()
    }

    if (loading) {
        return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
    }

    return (
        <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-xl)' }}>
                🍽️ Menu Items
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                Menu items are used to trigger bonus predictions. When a table orders one of these items, you can unlock bonus predictions for that table.
            </p>

            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className="card__title" style={{ marginBottom: 'var(--space-md)' }}>Add Menu Item</h3>
                <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" placeholder="e.g. Nachos Especiales" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Description (optional)</label>
                    <input className="form-input" placeholder="e.g. With guacamole and jalapeños" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>
                <button className="btn btn--primary" onClick={createItem} disabled={!newName.trim()}>Add Item</button>
                {error && <p className="form-error" style={{ marginTop: 'var(--space-sm)' }}>{error}</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {items.map(item => (
                    <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            {item.description && (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                                    {item.description}
                                </p>
                            )}
                            <span className={`badge ${item.is_active ? 'badge--open' : 'badge--finished'}`} style={{ marginTop: 'var(--space-xs)' }}>
                                {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <button className="btn btn--secondary btn--icon" onClick={() => toggleItem(item.id, item.is_active)}>
                                {item.is_active ? '🔒' : '🔓'}
                            </button>
                            <button className="btn btn--danger btn--icon" onClick={() => deleteItem(item.id)}>
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <p>No menu items yet. Add items that can trigger bonus predictions!</p>
                    </div>
                )}
            </div>
        </div>
    )
}

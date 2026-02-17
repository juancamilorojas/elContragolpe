'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { isAdmin, getAdminRestaurantId } from '@/lib/auth'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = getSupabaseClient()

    // Don't wrap the login page with sidebar
    const isLoginPage = pathname === '/admin'

    if (isLoginPage) {
        return <>{children}</>
    }

    return <AdminShell>{children}</AdminShell>
}

function AdminShell({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [restaurantName, setRestaurantName] = useState('')
    const pathname = usePathname()
    const router = useRouter()
    const supabase = getSupabaseClient()

    useEffect(() => {
        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user || !isAdmin(session.user)) {
                router.push('/admin')
                return
            }

            const restId = getAdminRestaurantId(session.user)
            if (restId) {
                const { data } = await supabase
                    .from('restaurants')
                    .select('name')
                    .eq('id', restId)
                    .single()
                if (data) setRestaurantName(data.name)
            }

            setLoading(false)
        }
        checkAuth()
    }, [supabase, router])

    if (loading) {
        return (
            <div className="page">
                <div className="loading-screen">
                    <div className="spinner spinner--lg" />
                </div>
            </div>
        )
    }

    const navLinks = [
        { href: '/admin/dashboard', label: '📊 Overview' },
        { href: '/admin/matches', label: '⚽ Matches' },
        { href: '/admin/tables', label: '🪑 Tables' },
        { href: '/admin/menu', label: '🍽️ Menu Items' },
        { href: '/admin/history', label: '📜 History' },
    ]

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/admin')
    }

    const isActive = (href: string) => {
        if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
        return pathname.startsWith(href)
    }

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-sidebar__logo">⚽ El Contragolpe</div>
                {restaurantName && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: '0 var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        {restaurantName}
                    </p>
                )}
                <nav>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`admin-sidebar__link ${isActive(link.href) ? 'admin-sidebar__link--active' : ''}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)' }}>
                    <button className="btn btn--secondary btn--full" onClick={handleSignOut}>
                        Sign Out
                    </button>
                </div>
            </aside>
            <main className="admin-content">
                {children}
            </main>
        </div>
    )
}

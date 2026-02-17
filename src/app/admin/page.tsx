'use client'

import { useState } from 'react'
import { signInWithEmail } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { user } = await signInWithEmail(email, password)
            const role = user?.app_metadata?.role as string | undefined
            if (role !== 'restaurant_admin' && role !== 'super_admin') {
                setError('You do not have admin access.')
                setLoading(false)
                return
            }
            router.push('/admin/dashboard')
        } catch (err: any) {
            setError(err.message || 'Invalid credentials')
        }
        setLoading(false)
    }

    return (
        <div className="page">
            <div className="container container--narrow">
                <div className="page__header">
                    <h1 className="page__title">⚽ Admin</h1>
                    <p className="page__subtitle">El Contragolpe Dashboard</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="card">
                        <h2 className="card__title" style={{ marginBottom: 'var(--space-lg)' }}>Sign In</h2>

                        {error && (
                            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                                ⚠️ {error}
                            </p>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                placeholder="admin@restaurant.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn--primary btn--lg btn--full"
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

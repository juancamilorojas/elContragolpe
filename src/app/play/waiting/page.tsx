'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export default function WaitingPage() {
    const [restaurantName, setRestaurantName] = useState('')
    const supabase = getSupabaseClient()

    useEffect(() => {
        async function checkForMatch() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = '/join'
                return
            }

            // Get player's restaurant
            const { data: player } = await supabase
                .from('players')
                .select('restaurant_id, restaurants(name)')
                .eq('auth_user_id', session.user.id)
                .single()

            if (!player) {
                window.location.href = '/join'
                return
            }

            setRestaurantName((player as any).restaurants?.name || '')

            // Check for active match
            const { data: match } = await supabase
                .from('matches')
                .select('id')
                .eq('restaurant_id', player.restaurant_id)
                .or('status.eq.open,status.eq.live')
                .limit(1)
                .single()

            if (match) {
                // Update player's active match
                await supabase
                    .from('players')
                    .update({ active_match_id: match.id })
                    .eq('auth_user_id', session.user.id)

                window.location.href = `/play/${match.id}`
                return
            }
        }

        checkForMatch()

        // Poll for new matches every 5 seconds
        const interval = setInterval(checkForMatch, 5000)
        return () => clearInterval(interval)
    }, [supabase])

    return (
        <div className="page">
            <div className="container container--narrow">
                <div className="loading-screen">
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>⚽</div>
                    <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                        Waiting for a match...
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                        {restaurantName && `at ${restaurantName}`}
                        <br />
                        The admin will start a match soon. Hang tight!
                    </p>
                    <div className="spinner spinner--lg" style={{ marginTop: 'var(--space-lg)' }} />
                </div>
            </div>
        </div>
    )
}

export type Database = {
    public: {
        Tables: {
            restaurants: {
                Row: {
                    id: string
                    name: string
                    slug: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    slug: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string
                    created_at?: string
                }
            }
            tables: {
                Row: {
                    id: string
                    restaurant_id: string
                    name: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    name: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    name?: string
                    is_active?: boolean
                    created_at?: string
                }
            }
            players: {
                Row: {
                    id: string
                    auth_user_id: string
                    restaurant_id: string
                    table_id: string
                    display_name: string
                    active_match_id: string | null
                    consent_given: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    auth_user_id: string
                    restaurant_id: string
                    table_id: string
                    display_name: string
                    active_match_id?: string | null
                    consent_given?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    auth_user_id?: string
                    restaurant_id?: string
                    table_id?: string
                    display_name?: string
                    active_match_id?: string | null
                    consent_given?: boolean
                    created_at?: string
                }
            }
            matches: {
                Row: {
                    id: string
                    restaurant_id: string
                    home_team: string
                    away_team: string
                    status: 'draft' | 'open' | 'live' | 'finished' | 'archived'
                    kick_off: string | null
                    final_score: Record<string, unknown> | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    home_team: string
                    away_team: string
                    status?: 'draft' | 'open' | 'live' | 'finished' | 'archived'
                    kick_off?: string | null
                    final_score?: Record<string, unknown> | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    home_team?: string
                    away_team?: string
                    status?: 'draft' | 'open' | 'live' | 'finished' | 'archived'
                    kick_off?: string | null
                    final_score?: Record<string, unknown> | null
                    created_at?: string
                    updated_at?: string
                }
            }
            prediction_types: {
                Row: {
                    id: string
                    match_id: string
                    label: string
                    category: string
                    points_value: number
                    is_bonus: boolean
                    required_menu_item_id: string | null
                    sort_order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    match_id: string
                    label: string
                    category?: string
                    points_value?: number
                    is_bonus?: boolean
                    required_menu_item_id?: string | null
                    sort_order?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    match_id?: string
                    label?: string
                    category?: string
                    points_value?: number
                    is_bonus?: boolean
                    required_menu_item_id?: string | null
                    sort_order?: number
                    created_at?: string
                }
            }
            predictions: {
                Row: {
                    id: string
                    player_id: string
                    match_id: string
                    prediction_type_id: string
                    predicted_value: string
                    is_correct: boolean | null
                    points_earned: number
                    submitted_at: string
                }
                Insert: {
                    id?: string
                    player_id: string
                    match_id: string
                    prediction_type_id: string
                    predicted_value: string
                    is_correct?: boolean | null
                    points_earned?: number
                    submitted_at?: string
                }
                Update: {
                    id?: string
                    player_id?: string
                    match_id?: string
                    prediction_type_id?: string
                    predicted_value?: string
                    is_correct?: boolean | null
                    points_earned?: number
                    submitted_at?: string
                }
            }
            match_results: {
                Row: {
                    id: string
                    match_id: string
                    prediction_type_id: string
                    actual_value: string
                    recorded_at: string
                }
                Insert: {
                    id?: string
                    match_id: string
                    prediction_type_id: string
                    actual_value: string
                    recorded_at?: string
                }
                Update: {
                    id?: string
                    match_id?: string
                    prediction_type_id?: string
                    actual_value?: string
                    recorded_at?: string
                }
            }
            menu_items: {
                Row: {
                    id: string
                    restaurant_id: string
                    name: string
                    description: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id: string
                    name: string
                    description?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string
                    name?: string
                    description?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            table_bonuses: {
                Row: {
                    id: string
                    table_id: string
                    match_id: string
                    menu_item_id: string
                    activated_by: string
                    activated_at: string
                }
                Insert: {
                    id?: string
                    table_id: string
                    match_id: string
                    menu_item_id: string
                    activated_by: string
                    activated_at?: string
                }
                Update: {
                    id?: string
                    table_id?: string
                    match_id?: string
                    menu_item_id?: string
                    activated_by?: string
                    activated_at?: string
                }
            }
        }
    }
}

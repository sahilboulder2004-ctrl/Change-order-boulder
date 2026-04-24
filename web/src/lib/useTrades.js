import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseReady } from './supabase.js'

// Shape matches the legacy TRADE_CATS entries the UI expects:
// { id, label, color, Icon } — but color/Icon are supplied by the consumer as defaults.
const fromDB = (r) => ({ id: r.id, name: r.name, sort: r.sort_order ?? 0 })

export function useTrades(fallback = []) {
  const [trades, setTrades] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    if (!supabaseReady) {
      setTrades(fallback)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('name', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    setTrades((data || []).map(fromDB))
    setLoading(false)
  }, [fallback])

  useEffect(() => { load() }, [load])

  const addTrade = useCallback(async (name) => {
    const n = (name || '').trim()
    if (!n) return { ok: false, error: 'Name required' }
    const id = n.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    if (!supabaseReady) {
      setTrades((prev) => [...prev, { id, name: n, sort: 999 }])
      return { ok: true, id }
    }
    const { error } = await supabase.from('trades').insert({ id, name: n, sort_order: 999 })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true, id }
  }, [load])

  return { trades, loading, error, addTrade, reload: load }
}

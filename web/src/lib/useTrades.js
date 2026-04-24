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
    const baseId = n.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    if (!baseId) return { ok: false, error: 'Name must contain letters or numbers' }

    if (!supabaseReady) {
      const taken = new Set(trades.map((t) => t.id))
      let id = baseId, n2 = 2
      while (taken.has(id)) id = `${baseId}-${n2++}`
      setTrades((prev) => [...prev, { id, name: n, sort: 999 }])
      return { ok: true, id }
    }

    // Case-insensitive name check so we don't create "HVAC" and "hvac" twice.
    const { data: existingByName } = await supabase
      .from('trades').select('id,name').ilike('name', n).limit(1)
    if (existingByName && existingByName.length) {
      return { ok: true, id: existingByName[0].id, existed: true }
    }

    // Resolve a non-colliding id.
    let id = baseId, n2 = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: hit } = await supabase.from('trades').select('id').eq('id', id).maybeSingle()
      if (!hit) break
      id = `${baseId}-${n2++}`
      if (n2 > 50) return { ok: false, error: 'Could not generate unique id' }
    }

    const { error } = await supabase.from('trades').insert({ id, name: n, sort_order: 999 })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true, id }
  }, [load, trades])

  return { trades, loading, error, addTrade, reload: load }
}

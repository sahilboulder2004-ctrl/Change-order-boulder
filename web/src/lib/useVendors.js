import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseReady } from './supabase.js'

// kind: 'vendor' | 'subcontractor'
const fromDB = (r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  contact: r.contact || '',
  phone: r.phone || '',
  email: r.email || '',
})

const slug = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

export function useVendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    if (!supabaseReady) { setVendors([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('vendors').select('*').order('name', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    setVendors((data || []).map(fromDB))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addVendor = useCallback(async (name, kind = 'vendor') => {
    const n = (name || '').trim()
    if (!n) return { ok: false, error: 'Name required' }
    const baseSlug = slug(n)
    if (!baseSlug) return { ok: false, error: 'Name must contain letters or numbers' }
    const baseId = `${baseSlug}-${kind}`

    if (!supabaseReady) {
      const taken = new Set(vendors.map((v) => v.id))
      let id = baseId, n2 = 2
      while (taken.has(id)) id = `${baseId}-${n2++}`
      const v = { id, name: n, kind, contact: '', phone: '', email: '' }
      setVendors((prev) => [...prev, v])
      return { ok: true, vendor: v }
    }

    // Case-insensitive dedupe by (name, kind).
    const { data: existing } = await supabase
      .from('vendors').select('id,name,kind').ilike('name', n).eq('kind', kind).limit(1)
    if (existing && existing.length) {
      return { ok: true, id: existing[0].id, name: existing[0].name, kind, existed: true }
    }

    let id = baseId, n2 = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: hit } = await supabase.from('vendors').select('id').eq('id', id).maybeSingle()
      if (!hit) break
      id = `${baseId}-${n2++}`
      if (n2 > 50) return { ok: false, error: 'Could not generate unique id' }
    }

    const { error } = await supabase.from('vendors').insert({ id, name: n, kind })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true, id, name: n, kind }
  }, [load, vendors])

  const subcontractors = vendors.filter((v) => v.kind === 'subcontractor')
  const plainVendors   = vendors.filter((v) => v.kind === 'vendor')

  return { vendors, subcontractors, plainVendors, loading, error, addVendor, reload: load }
}

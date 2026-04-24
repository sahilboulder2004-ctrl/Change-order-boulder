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
    const id = slug(n) + '-' + kind
    if (!supabaseReady) {
      const v = { id, name: n, kind, contact: '', phone: '', email: '' }
      setVendors((prev) => [...prev, v])
      return { ok: true, vendor: v }
    }
    const { error } = await supabase.from('vendors').insert({ id, name: n, kind })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true, id, name: n, kind }
  }, [load])

  const subcontractors = vendors.filter((v) => v.kind === 'subcontractor')
  const plainVendors   = vendors.filter((v) => v.kind === 'vendor')

  return { vendors, subcontractors, plainVendors, loading, error, addVendor, reload: load }
}

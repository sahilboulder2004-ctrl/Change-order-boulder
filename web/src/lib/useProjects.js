import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseReady } from './supabase.js'

// Mirrors the PROJECTS constant shape used everywhere in the UI:
// { id, prefix, name, originalContract, currentContract }
const fromDB = (r) => ({
  id: r.id,
  prefix: r.prefix,
  name: r.name,
  originalContract: Number(r.original_contract ?? 0),
  currentContract:  Number(r.current_contract  ?? 0),
  startDate:        r.start_date    || null, // legacy alias
  contractDate:     r.contract_date || r.start_date || null,
  contractType:     r.contract_type || null, // 'labour' | 'turnkey'
  status:           r.status || 'active',
  subcontractors:   Array.isArray(r.subcontractors) ? r.subcontractors : [],
  vendors:          Array.isArray(r.vendors) ? r.vendors : [],
  contractPdfPath:  r.contract_pdf_path || null,
  contractPdfName:  r.contract_pdf_name || null,
})

const toDB = (p) => ({
  id: p.id,
  prefix: p.prefix,
  name: p.name,
  original_contract: p.originalContract ?? 0,
  current_contract:  p.currentContract  ?? p.originalContract ?? 0,
  start_date:    p.contractDate || p.startDate || null,
  contract_date: p.contractDate || p.startDate || null,
  contract_type: p.contractType || null,
  status:        p.status || 'active',
  subcontractors: p.subcontractors || [],
  vendors:        p.vendors || [],
  contract_pdf_path: p.contractPdfPath || null,
  contract_pdf_name: p.contractPdfName || null,
})

export function useProjects(fallback = []) {
  const [projects, setProjects] = useState(fallback)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setError(null)
    if (!supabaseReady) {
      setProjects(fallback)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('projects').select('*').order('sort_order', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    setProjects((data || []).map(fromDB))
    setLoading(false)
  }, [fallback])

  useEffect(() => { load() }, [load])

  const addProject = useCallback(async (p) => {
    if (!supabaseReady) {
      setProjects((prev) => [...prev, p])
      return { ok: true }
    }
    const { error } = await supabase.from('projects').insert(toDB(p))
    if (error) { setError(error.message); return { ok: false, error: error.message } }
    setProjects((prev) => [...prev, p])
    return { ok: true }
  }, [])

  return { projects, loading, error, addProject, reload: load }
}

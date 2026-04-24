import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, supabaseReady } from './supabase.js'

const LS_KEY = 'cot.cos.v2'

const toDB = (c) => ({
  id: c.id,
  num: c.num,
  title: c.title,
  type: c.type,
  category: c.category,
  priority: c.priority,
  project: c.project,
  status: c.status,
  submitted_by: c.submittedBy,
  reviewed_by: c.reviewedBy,
  submitted_date: c.submittedDate || null,
  reviewed_date: c.reviewedDate || null,
  executed_date: c.executedDate || null,
  due_date: c.dueDate || null,
  requested_amt: c.requestedAmt ?? 0,
  approved_amt: c.approvedAmt ?? 0,
  schedule_impact: c.scheduleImpact ?? 0,
  description: c.description ?? '',
  justification: c.justification ?? '',
  linked_rfi: c.linkedRFI ?? '',
  linked_spec: c.linkedSpec ?? '',
  linked_drawing: c.linkedDrawing ?? '',
  assignees: c.assignees ?? [],
  photos: c.photos ?? [],
  attachments: c.attachments ?? [],
  comments: c.comments ?? [],
  line_items: c.lineItems ?? [],
  owner_markup: c.ownerMarkup ?? 0,
  gc_markup: c.gcMarkup ?? 0,
  is_sub_co: !!c.isSubCO,
  sub_cos: c.subCOs ?? [],
})

const fromDB = (r) => ({
  id: r.id,
  num: r.num,
  title: r.title,
  type: r.type,
  category: r.category,
  priority: r.priority,
  project: r.project,
  status: r.status,
  submittedBy: r.submitted_by,
  reviewedBy: r.reviewed_by,
  submittedDate: r.submitted_date,
  reviewedDate: r.reviewed_date,
  executedDate: r.executed_date,
  dueDate: r.due_date,
  requestedAmt: Number(r.requested_amt ?? 0),
  approvedAmt: Number(r.approved_amt ?? 0),
  scheduleImpact: r.schedule_impact ?? 0,
  description: r.description ?? '',
  justification: r.justification ?? '',
  linkedRFI: r.linked_rfi ?? '',
  linkedSpec: r.linked_spec ?? '',
  linkedDrawing: r.linked_drawing ?? '',
  assignees: r.assignees ?? [],
  photos: r.photos ?? [],
  attachments: r.attachments ?? [],
  comments: r.comments ?? [],
  lineItems: r.line_items ?? [],
  ownerMarkup: Number(r.owner_markup ?? 0),
  gcMarkup: Number(r.gc_markup ?? 0),
  isSubCO: !!r.is_sub_co,
  subCOs: r.sub_cos ?? [],
})

// A legacy "file" entry is a plain string. Real entries are objects with a `path`.
// We keep legacy strings only if they look like a filename (contains a dot
// extension). Anything else (emoji placeholder from early demo data) is dropped.
const isRealFile = (f) => {
  if (f && typeof f === 'object' && typeof f.path === 'string') return true
  if (typeof f === 'string' && /\.[a-z0-9]{1,5}$/i.test(f)) return true
  return false
}
const scrubCO = (co) => ({
  ...co,
  photos: Array.isArray(co.photos) ? co.photos.filter(isRealFile) : [],
  attachments: Array.isArray(co.attachments) ? co.attachments.filter(isRealFile) : [],
})

const lsLoad = (fb) => {
  if (typeof window === 'undefined') return fb
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fb
    const p = JSON.parse(raw)
    if (!Array.isArray(p) || !p.length) return fb
    return p.map(scrubCO)
  } catch { return fb }
}
const lsSave = (cos) => {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(cos)) } catch {}
}

export function useCOs(seed, user) {
  const [cos, setCOs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const seeded = useRef(false)

  // Cloud mode whenever Supabase is configured — login is not required.
  // The schema's RLS allows anon access to change_orders / sub_cos / projects.
  const useSupabase = supabaseReady

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      if (!useSupabase) {
        setCOs(lsLoad(seed))
        setLoading(false)
        return
      }
      const { data, error } = await supabase.from('change_orders').select('*').order('num')
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      if ((!data || data.length === 0) && !seeded.current) {
        seeded.current = true
        const rows = seed.map(toDB)
        const { error: insErr } = await supabase.from('change_orders').insert(rows)
        if (insErr) { setError(insErr.message); setLoading(false); return }
        setCOs(seed)
      } else {
        setCOs((data || []).map(fromDB))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [useSupabase, user?.id])

  useEffect(() => {
    if (!useSupabase && !loading) lsSave(cos)
  }, [cos, useSupabase, loading])

  const addCO = useCallback(async (c) => {
    setCOs(p => [...p, c])
    if (!useSupabase) return
    const { error } = await supabase.from('change_orders').insert(toDB(c))
    if (error) setError(error.message)
  }, [useSupabase])

  const updateCO = useCallback(async (c) => {
    setCOs(p => p.map(x => x.id === c.id ? c : x))
    if (!useSupabase) return
    const { error } = await supabase.from('change_orders').update(toDB(c)).eq('id', c.id)
    if (error) setError(error.message)
  }, [useSupabase])

  const deleteCO = useCallback(async (id) => {
    setCOs(p => p.filter(x => x.id !== id))
    if (!useSupabase) return
    const { error } = await supabase.from('change_orders').delete().eq('id', id)
    if (error) setError(error.message)
  }, [useSupabase])

  const resetDemo = useCallback(async () => {
    if (!useSupabase) {
      if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
      setCOs(seed)
      return
    }
    const { error: delErr } = await supabase.from('change_orders').delete().neq('id', '__none__')
    if (delErr) { setError(delErr.message); return }
    const { error: insErr } = await supabase.from('change_orders').insert(seed.map(toDB))
    if (insErr) { setError(insErr.message); return }
    setCOs(seed)
  }, [useSupabase, seed])

  return { cos, setCOs, loading, error, addCO, updateCO, deleteCO, resetDemo, mode: useSupabase ? 'cloud' : 'local' }
}

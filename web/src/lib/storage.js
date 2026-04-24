import { supabase, supabaseReady } from './supabase.js'

export const BUCKET = 'co-files'
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
export const SIGNED_URL_TTL_SEC = 60 * 60      // 1 hour

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

function randId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export async function uploadFile(coId, file, kind /* 'attachment' | 'photo' */) {
  if (!supabaseReady) throw new Error('Cloud storage not configured — sign in to upload files.')
  if (file.size > MAX_FILE_BYTES) throw new Error(`File too large. Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`)
  const path = `${coId}/${kind}/${randId()}-${sanitize(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw error
  return {
    name: file.name,
    path,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }
}

export async function getSignedUrl(path) {
  if (!supabaseReady) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function removeFile(path) {
  if (!supabaseReady) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function isFileMeta(x) {
  return x && typeof x === 'object' && typeof x.path === 'string'
}

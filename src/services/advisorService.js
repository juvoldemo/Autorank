import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const ADVISORS_TABLE = 'advisors'
const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE = 512
const WEBP_QUALITY = 0.82

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

export const normalizeAdvisorName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const slugify = (value) =>
  normalizeAdvisorName(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'

const getAdvisorCode = (advisor = {}) =>
  String(advisor.advisor_code ?? advisor.advisorCode ?? advisor.code ?? advisor.id ?? '').trim()

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Không đọc được file ảnh avatar.'))
    }
    image.src = objectUrl
  })

const compressAvatarImage = async (file) => {
  if (!file?.type?.startsWith('image/')) throw new Error('File avatar không phải ảnh hợp lệ.')
  try {
    const image = await loadImage(file)
    const ratio = Math.min(1, MAX_AVATAR_SIZE / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không nén được avatar.'))), 'image/webp', WEBP_QUALITY)
    })
  } catch (error) {
    console.error('compressAvatarImage error', error)
    return file
  }
}

export const toAdvisorRecord = (advisor = {}) => {
  const advisorName = String(advisor.advisor_name ?? advisor.advisorName ?? advisor.name ?? '').trim()
  const advisorCode = getAdvisorCode(advisor) || null
  const normalizedName = normalizeAdvisorName(advisor.normalized_name ?? advisorName)
  return {
    advisor_code: advisorCode,
    advisor_name: advisorName,
    team_name: String(advisor.team_name ?? advisor.teamName ?? advisor.team ?? '').trim() || null,
    department_name: String(advisor.department_name ?? advisor.departmentName ?? advisor.department ?? '').trim() || null,
    normalized_name: normalizedName,
    avatar_url: advisor.avatar_url ?? advisor.avatarUrl ?? advisor.avatar ?? null,
  }
}

export async function fetchAdvisors() {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(ADVISORS_TABLE)
      .select('*')
      .order('advisor_name', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('fetchAdvisors error', error)
    throw new Error(`Không tải được danh sách tư vấn viên: ${error.message}`, { cause: error })
  }
}

export async function upsertAdvisor(advisor) {
  try {
    ensureSupabase()
    const row = toAdvisorRecord(advisor)
    if (!row.advisor_name || !row.normalized_name) throw new Error('Thiếu tên tư vấn viên.')

    let query = supabase.from(ADVISORS_TABLE).select('id')
    if (row.advisor_code) query = query.eq('advisor_code', row.advisor_code)
    else query = query.eq('normalized_name', row.normalized_name)

    const { data: existing, error: findError } = await query.limit(1).maybeSingle()
    if (findError) throw findError

    const request = existing?.id
      ? supabase.from(ADVISORS_TABLE).update(row).eq('id', existing.id)
      : supabase.from(ADVISORS_TABLE).insert(row)
    const { data, error } = await request.select('*').single()
    if (error) throw error
    return data
  } catch (error) {
    console.error('upsertAdvisor error', error)
    throw new Error(`Không lưu được tư vấn viên: ${error.message}`, { cause: error })
  }
}

export async function upsertAdvisors(advisors) {
  try {
    const saved = []
    for (const advisor of advisors ?? []) {
      saved.push(await upsertAdvisor(advisor))
    }
    return saved
  } catch (error) {
    console.error('upsertAdvisors error', error)
    throw error
  }
}

export async function uploadAdvisorAvatar(file, advisor) {
  try {
    ensureSupabase()
    const advisorName = String(advisor?.advisor_name ?? advisor?.name ?? '').trim()
    const advisorCode = getAdvisorCode(advisor)
    const normalizedName = normalizeAdvisorName(advisorName)
    if (!advisorName || !normalizedName) throw new Error('Thiếu tên tư vấn viên để upload avatar.')

    const compressedFile = await compressAvatarImage(file)
    const objectPath = `${slugify(advisorCode || normalizedName)}/avatar-${Date.now()}.webp`
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, compressedFile, {
        cacheControl: '31536000',
        upsert: true,
        contentType: 'image/webp',
      })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)
    const avatarUrl = data.publicUrl
    const profile = await upsertAdvisor({ ...advisor, advisor_name: advisorName, avatar_url: avatarUrl })
    return { avatarUrl, avatarPath: `${AVATAR_BUCKET}/${objectPath}`, profile }
  } catch (error) {
    console.error('uploadAdvisorAvatar error', error)
    throw new Error(`Không upload được avatar: ${error.message}`, { cause: error })
  }
}

export function mergeRowsWithAdvisorAvatars(rows, advisors) {
  const codeMap = new Map()
  const nameMap = new Map()
  ;(advisors ?? []).forEach((advisor) => {
    if (!advisor?.avatar_url) return
    const code = String(advisor.advisor_code || '').trim()
    const normalized = normalizeAdvisorName(advisor.normalized_name || advisor.advisor_name)
    if (code) codeMap.set(code, advisor.avatar_url)
    if (normalized && !nameMap.has(normalized)) nameMap.set(normalized, advisor.avatar_url)
  })

  return (rows ?? []).map((row) => {
    const code = String(row.advisor_code ?? row.code ?? '').trim()
    const normalized = normalizeAdvisorName(row.normalized_name || row.advisor_name || row.name)
    const avatarUrl = (code && codeMap.get(code)) || nameMap.get(normalized) || row.avatar_url || row.avatar || ''
    return { ...row, avatar_url: avatarUrl, avatar: avatarUrl }
  })
}

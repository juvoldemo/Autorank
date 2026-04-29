import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE = 512

export const normalizeName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeKey = (value) =>
  normalizeName(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-advisor'

const AVATAR_SCOPE_FOLDERS = {
  month: 'top-thang',
  day: 'top-ngay',
  'top-thang': 'top-thang',
  'top-ngay': 'top-ngay',
  campaign: 'campaign',
}

const getAdvisorCode = (advisor = {}) => {
  const rawCode = advisor.advisor_code ?? advisor.advisorCode ?? advisor.code ?? advisor.maDaiLy ?? advisor.id
  const code = String(rawCode || '').trim()
  return code || null
}

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
      reject(new Error('Không thể đọc file ảnh avatar.'))
    }
    image.src = objectUrl
  })

const normalizeAvatarImage = async (file) => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('File avatar không phải là hình ảnh hợp lệ.')
  }

  try {
    const image = await loadImage(file)
    const ratio = Math.min(1, MAX_AVATAR_SIZE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, width, height)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Không thể nén ảnh avatar.'))
            return
          }
          resolve(blob)
        },
        'image/png',
      )
    })
  } catch (error) {
    console.error('compress avatar image error', error)
    return file
  }
}

const assertAvatarBucketReady = async (folder) => {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).list(folder, { limit: 1 })
  if (!error) return

  const message = error.message || String(error)
  if (/bucket not found|not found/i.test(message)) {
    throw new Error('Bucket "avatars" chưa tồn tại trên Supabase Storage. Hãy chạy SQL tạo bucket public "avatars" rồi thử lại.')
  }

  throw new Error(`Không thể kiểm tra bucket "avatars": ${message}`)
}

export const fetchAdvisorProfiles = async () => {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetch advisor_profiles error', error)
    return []
  }

  return data ?? []
}

export const upsertAdvisorProfile = async (profile) => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Không thể lưu hồ sơ tư vấn viên.')
  }

  const advisorName = String(profile.advisor_name ?? profile.advisorName ?? profile.name ?? '').trim()
  const normalizedName = normalizeName(profile.normalized_name ?? profile.normalizedName ?? advisorName)
  if (!advisorName || !normalizedName) {
    throw new Error('Thiếu tên tư vấn viên để lưu avatar.')
  }

  const advisorCode = String(profile.advisor_code ?? profile.advisorCode ?? '').trim() || null
  const row = {
    advisor_code: advisorCode,
    advisor_name: advisorName,
    normalized_name: normalizedName,
    team_name: String(profile.team_name ?? profile.teamName ?? profile.team ?? '').trim() || null,
    avatar_url: profile.avatar_url ?? profile.avatarUrl ?? null,
    avatar_path: profile.avatar_path ?? profile.avatarPath ?? null,
  }

  let existingProfile = null
  if (advisorCode) {
    const { data, error } = await supabase
      .from('advisor_profiles')
      .select('id')
      .eq('advisor_code', advisorCode)
      .maybeSingle()
    if (error) {
      console.error('find advisor profile by code error', error)
      throw error
    }
    existingProfile = data
  }

  if (!existingProfile && !advisorCode) {
    const { data, error } = await supabase
      .from('advisor_profiles')
      .select('id')
      .eq('normalized_name', normalizedName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('find advisor profile by normalized_name error', error)
      throw error
    }
    existingProfile = data
  }

  const query = existingProfile
    ? supabase.from('advisor_profiles').update(row).eq('id', existingProfile.id)
    : supabase.from('advisor_profiles').insert(row)

  const { data, error } = await query.select('*').single()
  if (error) {
    console.error('upsert advisor_profiles error', error)
    throw error
  }

  return data
}

export const uploadAdvisorAvatar = async (file, advisor, scope = 'top-thang') => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Không thể upload avatar.')
  }

  const advisorName = String(advisor?.name ?? advisor?.advisor_name ?? '').trim()
  const normalizedName = normalizeKey(advisorName)
  const advisorCode = getAdvisorCode(advisor)
  if (!advisorName || !normalizedName) {
    throw new Error('Thiếu tên tư vấn viên để upload avatar.')
  }

  const avatarFile = await normalizeAvatarImage(file)
  const folder = AVATAR_SCOPE_FOLDERS[scope] ?? AVATAR_SCOPE_FOLDERS['top-thang']
  const objectPath = `${folder}/${normalizedName}.png`
  const storedPath = `${AVATAR_BUCKET}/${objectPath}`

  await assertAvatarBucketReady(folder)

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, avatarFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/png',
    })

  if (uploadError) {
    console.error('upload advisor avatar error', uploadError)
    const message = uploadError.message || String(uploadError)
    if (/bucket not found|not found/i.test(message)) {
      throw new Error('Bucket "avatars" chưa tồn tại trên Supabase Storage. Hãy chạy SQL tạo bucket public "avatars" rồi thử lại.')
    }
    throw uploadError
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath)
  const avatarUrl = data.publicUrl

  const profile = await upsertAdvisorProfile({
    advisor_code: advisorCode,
    advisor_name: advisorName,
    normalized_name: normalizedName,
    team_name: advisor?.team,
    avatar_url: avatarUrl,
    avatar_path: storedPath,
  })

  return { avatarUrl, avatarPath: storedPath, profile }
}

export const mergeAdvisorsWithProfiles = (advisors, profiles) => {
  const codeMap = new Map()
  const nameMap = new Map()

  ;(profiles ?? []).forEach((profile) => {
    const avatarUrl = profile?.avatar_url
    if (!avatarUrl) return

    const code = String(profile.advisor_code || '').trim()
    const normalizedName = normalizeName(profile.normalized_name || profile.advisor_name)
    if (code) codeMap.set(code, avatarUrl)
    if (normalizedName && !nameMap.has(normalizedName)) nameMap.set(normalizedName, avatarUrl)
  })

  return (advisors ?? []).map((advisor) => {
    const code = getAdvisorCode(advisor)
    const normalizedName = normalizeName(advisor?.normalized_name || advisor?.name)
    const avatarFromProfile = (code && codeMap.get(code)) || nameMap.get(normalizedName)

    return avatarFromProfile
      ? { ...advisor, avatar: avatarFromProfile, avatar_url: avatarFromProfile }
      : advisor
  })
}

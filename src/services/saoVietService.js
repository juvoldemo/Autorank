import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { fetchAdvisorProfiles, mergeAdvisorsWithProfiles, normalizeName } from './advisorProfiles'
import { createImportLog } from './settingsService'
import { fetchSheetRows } from './importService'

const MEMBERS_TABLE = 'sao_viet_members'
const SETTINGS_TABLE = 'sao_viet_settings'
const MIN_REVENUE = 100000000
export const DEFAULT_SAO_VIET_SHEET = 'TongHop'

export const SAO_VIET_TIERS = [
  { key: 'gold', label: 'Vàng', displayName: 'Sao Việt Vàng', threshold: 550000000 },
  { key: 'platinum', label: 'Bạch Kim', displayName: 'Sao Việt Bạch Kim', threshold: 900000000 },
  { key: 'diamond', label: 'Kim Cương', displayName: 'Sao Việt Kim Cương', threshold: 1600000000 },
]

const REQUIRED_COLUMNS = [
  { label: 'STT', aliases: ['STT'], index: 0 },
  { label: 'Tên tư vấn viên', aliases: ['Tên tư vấn viên', 'Ten tu van vien'], index: 1 },
  { label: 'Nhóm', aliases: ['Nhóm', 'Nhom'], index: 2 },
  { label: 'Doanh thu tổng', aliases: ['Doanh thu tổng', 'Doanh thu tong'], index: 3 },
  { label: 'Sao Việt Vàng', aliases: ['Sao Việt Vàng', 'Sao Viet Vang'], index: 4 },
  { label: 'Sao Việt Bạch Kim', aliases: ['Sao Việt Bạch Kim', 'Sao Viet Bach Kim'], index: 5 },
  { label: 'Sao Việt Kim Cương', aliases: ['Sao Việt Kim Cương', 'Sao Viet Kim Cuong'], index: 6 },
]

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

const formatSupabaseError = (action, error) => {
  const message = error?.message ?? String(error)
  if (
    message.includes('sao_viet_settings') ||
    message.includes('sao_viet_members') ||
    message.includes('schema cache')
  ) {
    return `${action}: chưa tạo bảng Sao Việt trên Supabase. Hãy chạy file supabase/20260430_create_sao_viet.sql trong Supabase SQL Editor rồi thử lại.`
  }
  return `${action}: ${message}`
}

const normalizeHeader = (value) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const getCellValue = (row, index, fallback = '') => {
  const cells = Array.isArray(row?.__cells) ? row.__cells : []
  const value = cells[index]
  return value !== undefined && value !== null && value !== '' ? value : fallback
}

const getRawValue = (row, aliases, index, fallback = '') => {
  for (const alias of aliases) {
    if (row?.[alias] !== undefined && row?.[alias] !== null && row?.[alias] !== '') return row[alias]
  }

  const normalizedEntries = Object.entries(row ?? {}).map(([key, value]) => [normalizeHeader(key), value])
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias)
    const match = normalizedEntries.find(
      ([key, value]) => key === normalizedAlias && value !== undefined && value !== null && value !== '',
    )
    if (match) return match[1]
  }

  return getCellValue(row, index, fallback)
}

export const parseMoney = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export const formatMoney = (value, { compact = false } = {}) => {
  const amount = Number(value || 0)
  const sign = amount < 0 ? '-' : ''
  const absolute = Math.abs(amount)
  if (compact && absolute >= 1000000000) {
    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(absolute / 1000000000)} tỷ`
  }
  if (compact && absolute >= 1000000) {
    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(absolute / 1000000)} triệu`
  }
  return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(absolute)} đ`
}

export const getSaoVietTier = (revenue) => {
  const value = Number(revenue || 0)
  if (value >= SAO_VIET_TIERS[2].threshold) return 'diamond'
  if (value >= SAO_VIET_TIERS[1].threshold) return 'platinum'
  if (value >= SAO_VIET_TIERS[0].threshold) return 'gold'
  return 'candidate'
}

export const getNextTier = (revenue) => {
  const value = Number(revenue || 0)
  return SAO_VIET_TIERS.find((tier) => value < tier.threshold)?.key ?? 'diamond'
}

export const getProgressPercent = (revenue) => {
  const value = Number(revenue || 0)
  const target = SAO_VIET_TIERS.find((tier) => value < tier.threshold)?.threshold
  if (!target) return 100
  return Math.max(0, Math.min(100, Number(((value / target) * 100).toFixed(2))))
}

export const getSaoVietTierMeta = (key) =>
  SAO_VIET_TIERS.find((tier) => tier.key === key) ?? {
    key: 'candidate',
    label: 'Đang chinh phục',
    displayName: 'Đang chinh phục',
    threshold: SAO_VIET_TIERS[0].threshold,
  }

const validateRequiredColumns = (rows) => {
  if (!rows?.length) throw new Error('Sheet Sao Việt không có dữ liệu.')
  const headerKeys = Object.keys(rows?.[0] ?? {}).filter((key) => key !== '__cells')
  const normalizedHeaders = new Set(headerKeys.map(normalizeHeader))
  const missing = REQUIRED_COLUMNS.filter(
    (column) => !column.aliases.some((alias) => normalizedHeaders.has(normalizeHeader(alias))),
  ).map((column) => column.label)

  if (missing.length) {
    throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}.`)
  }
}

const toSaoVietRow = (row) => {
  const advisorName = String(getRawValue(row, ['Tên tư vấn viên', 'Ten tu van vien'], 1)).trim()
  if (!advisorName) return null

  const totalRevenue = parseMoney(getRawValue(row, ['Doanh thu tổng', 'Doanh thu tong'], 3))
  if (totalRevenue < MIN_REVENUE) return null

  const currentTier = getSaoVietTier(totalRevenue)
  return {
    stt: Math.trunc(parseMoney(getRawValue(row, ['STT'], 0))),
    advisor_name: advisorName,
    normalized_name: normalizeName(advisorName),
    group_name: String(getRawValue(row, ['Nhóm', 'Nhom'], 2)).trim() || null,
    total_revenue: totalRevenue,
    gap_gold: parseMoney(getRawValue(row, ['Sao Việt Vàng', 'Sao Viet Vang'], 4)),
    gap_platinum: parseMoney(getRawValue(row, ['Sao Việt Bạch Kim', 'Sao Viet Bach Kim'], 5)),
    gap_diamond: parseMoney(getRawValue(row, ['Sao Việt Kim Cương', 'Sao Viet Kim Cuong'], 6)),
    current_tier: currentTier,
    next_tier: getNextTier(totalRevenue),
    progress_percent: getProgressPercent(totalRevenue),
    synced_at: new Date().toISOString(),
  }
}

const toAppMember = (row, index = 0) => ({
  id: row.id,
  stt: Number(row.stt ?? index + 1),
  rank: index + 1,
  advisor_name: row.advisor_name ?? '',
  name: row.advisor_name ?? '',
  normalized_name: row.normalized_name ?? normalizeName(row.advisor_name),
  group_name: row.group_name ?? '',
  team: row.group_name ?? '',
  avatar_url: row.avatar_url ?? '',
  avatar: row.avatar_url ?? '',
  total_revenue: Number(row.total_revenue ?? 0),
  revenue: Number(row.total_revenue ?? 0),
  gap_gold: Number(row.gap_gold ?? 0),
  gap_platinum: Number(row.gap_platinum ?? 0),
  gap_diamond: Number(row.gap_diamond ?? 0),
  current_tier: row.current_tier ?? getSaoVietTier(row.total_revenue),
  next_tier: row.next_tier ?? getNextTier(row.total_revenue),
  progress_percent: Number(row.progress_percent ?? getProgressPercent(row.total_revenue)),
  synced_at: row.synced_at ?? row.updated_at ?? row.created_at ?? '',
})

export async function getSaoVietMembers() {
  ensureSupabase()
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .select('*')
    .gte('total_revenue', MIN_REVENUE)
    .order('total_revenue', { ascending: false })
  if (error) throw new Error(formatSupabaseError('Không thể tải dữ liệu Sao Việt', error), { cause: error })

  const rows = (data ?? []).map(toAppMember)
  try {
    const profiles = await fetchAdvisorProfiles()
    return mergeAdvisorsWithProfiles(rows, profiles)
  } catch {
    return rows
  }
}

export async function getSaoVietSettings() {
  ensureSupabase()
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(formatSupabaseError('Không thể tải cấu hình Sao Việt', error), { cause: error })
  return data ?? { sheet_url: '', sheet_name: DEFAULT_SAO_VIET_SHEET, last_synced_at: null }
}

export async function saveSaoVietSettings(settings) {
  ensureSupabase()
  const payload = {
    sheet_url: String(settings.sheet_url ?? '').trim(),
    sheet_name: String(settings.sheet_name ?? DEFAULT_SAO_VIET_SHEET).trim() || DEFAULT_SAO_VIET_SHEET,
    updated_at: new Date().toISOString(),
  }
  const existing = await getSaoVietSettings()
  const query = existing.id
    ? supabase.from(SETTINGS_TABLE).update(payload).eq('id', existing.id)
    : supabase.from(SETTINGS_TABLE).insert(payload)
  const { data, error } = await query.select('*').single()
  if (error) throw new Error(formatSupabaseError('Không thể lưu cấu hình Sao Việt', error), { cause: error })
  return data
}

export async function syncSaoVietFromSheet(settingsOverride = null) {
  ensureSupabase()
  const settings = settingsOverride ?? (await getSaoVietSettings())
  const sheetUrl = String(settings.sheet_url ?? '').trim()
  const sheetName = String(settings.sheet_name ?? DEFAULT_SAO_VIET_SHEET).trim() || DEFAULT_SAO_VIET_SHEET
  if (!sheetUrl) throw new Error('Vui lòng nhập Google Sheet URL cho Sao Việt.')

  try {
    const rawRows = await fetchSheetRows(sheetUrl, sheetName)
    validateRequiredColumns(rawRows)
    const rows = rawRows
      .map(toSaoVietRow)
      .filter(Boolean)
      .sort((left, right) => Number(right.total_revenue || 0) - Number(left.total_revenue || 0))

    const profiles = await fetchAdvisorProfiles()
    const avatarMap = new Map(
      (profiles ?? [])
        .filter((profile) => profile.avatar_url)
        .map((profile) => [normalizeName(profile.normalized_name || profile.advisor_name), profile.avatar_url]),
    )
    const payload = rows.map((row) => ({
      ...row,
      avatar_url: avatarMap.get(row.normalized_name) ?? null,
    }))

    const { error: deleteError } = await supabase.from(MEMBERS_TABLE).delete().neq('advisor_name', '__autorank_keep_none__')
    if (deleteError) throw deleteError

    const { data, error } = payload.length
      ? await supabase.from(MEMBERS_TABLE).insert(payload).select('*')
      : { data: [], error: null }
    if (error) throw error

    const syncedAt = new Date().toISOString()
    const savedSettings = await saveSaoVietSettings({ ...settings, sheet_url: sheetUrl, sheet_name: sheetName })
    await supabase.from(SETTINGS_TABLE).update({ last_synced_at: syncedAt }).eq('id', savedSettings.id)
    await createImportLog({
      import_type: 'sao_viet',
      source_name: sheetUrl,
      status: 'success',
      total_rows: data?.length ?? 0,
      message: `Đã đồng bộ Sao Việt: ${data?.length ?? 0} dòng.`,
    }).catch((logError) => {
      console.warn('Không ghi được lịch sử import Sao Việt, bỏ qua để không chặn đồng bộ.', logError)
    })

    return (data ?? []).map(toAppMember)
  } catch (error) {
    await createImportLog({
      import_type: 'sao_viet',
      source_name: sheetUrl,
      status: 'failed',
      total_rows: 0,
      message: error.message,
    }).catch(() => {})
    throw error
  }
}

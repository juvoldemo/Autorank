import Papa from 'papaparse'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const TABLE = 'competition_leaderboard_entries'
const DEFAULT_SHEET_NAME = 'CTTD_GIO_TO'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
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

const normalizeMoney = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeInteger = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

const toStableUuid = (value) => {
  const raw = String(value ?? '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase()
  }

  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  let h3 = 0x85ebca6b
  let h4 = 0xc2b2ae35

  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 0x01000193)
    h2 = Math.imul(h2 ^ code, 0x85ebca6b)
    h3 = Math.imul(h3 ^ code, 0xc2b2ae35)
    h4 = Math.imul(h4 ^ code, 0x27d4eb2f)
  }

  const hex = [h1, h2, h3, h4]
    .map((item) => (item >>> 0).toString(16).padStart(8, '0'))
    .join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const parseSheetDate = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    epoch.setUTCDate(epoch.getUTCDate() + Math.trunc(value))
    return epoch.toISOString().slice(0, 10)
  }

  const raw = String(value).trim()
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
    if (day && month && year) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const getGoogleSheetId = (url) => {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Link Google Sheet không hợp lệ.')
  return match[1]
}

const googleSheetCsvUrl = (url, sheetName = DEFAULT_SHEET_NAME) => {
  const spreadsheetId = getGoogleSheetId(url)
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&cacheBust=${Date.now()}`
}

const parseCsvRows = (text) => {
  const parsed = Papa.parse(String(text || '').replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors?.length) console.log('[CTTD leaderboard] CSV warnings', parsed.errors)
  return parsed.data ?? []
}

const getRawValue = (row, aliases) => {
  const entries = Object.entries(row ?? {})
  for (const alias of aliases) {
    const exact = entries.find(([key, value]) => key === alias && String(value ?? '').trim() !== '')
    if (exact) return exact[1]
  }

  const normalizedAliases = aliases.map(normalizeHeader)
  const match = entries.find(
    ([key, value]) => normalizedAliases.includes(normalizeHeader(key)) && String(value ?? '').trim() !== '',
  )
  return match?.[1] ?? ''
}

const toLeaderboardEntry = (row, index, { competitionId, sourceUrl }) => {
  const advisorName = String(getRawValue(row, ['Tên tư vấn viên', 'Ten tu van vien', 'TVV', 'Họ tên', 'Ho ten'])).trim()
  if (!advisorName) return null
  const pdtValue = getRawValue(row, [
    'PĐT/IP hợp đồng',
    'PDT/IP hop dong',
    'PDT IP hop dong',
    'PĐT IP hợp đồng',
    'Tổng PĐT TVV',
    'Tong PDT TVV',
    'Tong PĐT TVV',
  ])
  const achievedRewardValue = getRawValue(row, [
    'Thưởng TVV đã đạt',
    'Thuong TVV da dat',
    'Thưởng TVV đã đạt T4',
    'Thuong TVV da dat T4',
    'Thưởng TVV đạt T4',
  ])

  return {
    competition_id: competitionId ? String(competitionId) : null,
    sheet_source: sourceUrl,
    rank: normalizeInteger(getRawValue(row, ['STT', 'stt'])) || index + 1,
    advisor_name: advisorName,
    group_name: String(getRawValue(row, ['Nhóm', 'Nhom', 'Tên nhóm', 'Ten nhom'])).trim(),
    customer_name: String(getRawValue(row, ['Khách hàng', 'Khach hang', 'Tên khách hàng', 'Ten khach hang'])).trim(),
    collection_date: parseSheetDate(getRawValue(row, ['Ngày thu', 'Ngay thu'])),
    total_pdt_tvv: normalizeMoney(pdtValue),
    reward_achieved_t4: normalizeMoney(achievedRewardValue),
    raw_data: row,
  }
}

const sortEntries = (rows) =>
  [...(rows ?? [])].sort((a, b) => {
    const rankDelta = Number(a.rank || 0) - Number(b.rank || 0)
    if (rankDelta) return rankDelta
    return Number(b.total_pdt_tvv || 0) - Number(a.total_pdt_tvv || 0)
  })

export async function fetchCompetitionLeaderboardSheet(url, sheetName = DEFAULT_SHEET_NAME) {
  if (!url?.trim()) throw new Error('Chưa có link Google Sheet BXH CTTĐ.')
  const finalUrl = url.includes('docs.google.com') ? googleSheetCsvUrl(url, sheetName || DEFAULT_SHEET_NAME) : url
  const response = await fetch(finalUrl)
  if (!response.ok) throw new Error(`Không đọc được Google Sheet CTTĐ. Mã lỗi ${response.status}.`)
  const text = await response.text()
  if (/<!DOCTYPE|<html|Google Docs/i.test(text)) {
    throw new Error('Google Sheet CTTĐ chưa public hoặc sai tên tab/sheet.')
  }
  return parseCsvRows(text)
}

export async function syncCompetitionLeaderboardFromSheet({
  competitionId,
  sheetUrl,
  sheetName = DEFAULT_SHEET_NAME,
}) {
  ensureSupabase()
  const sourceUrl = String(sheetUrl ?? '').trim()
  const storedCompetitionId = competitionId ? toStableUuid(competitionId) : null
  const rawRows = await fetchCompetitionLeaderboardSheet(sourceUrl, sheetName)
  const rows = rawRows
    .map((row, index) => toLeaderboardEntry(row, index, { competitionId: storedCompetitionId, sourceUrl }))
    .filter(Boolean)

  const deleteQuery = supabase.from(TABLE).delete()
  const { error: deleteError } = competitionId
    ? await deleteQuery.eq('competition_id', storedCompetitionId)
    : await deleteQuery.is('competition_id', null)
  if (deleteError) throw deleteError

  if (!rows.length) return []

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, {
      onConflict: 'competition_id,advisor_name,customer_name,collection_date,total_pdt_tvv',
    })
    .select('*')

  if (error) throw error
  return sortEntries(data ?? [])
}

export async function getCompetitionLeaderboardEntries(competitionId) {
  ensureSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('competition_id', toStableUuid(competitionId))
    .order('rank', { ascending: true })
    .order('total_pdt_tvv', { ascending: false })
  if (error) throw error
  return sortEntries(data ?? [])
}

export const DEFAULT_COMPETITION_LEADERBOARD_SHEET = DEFAULT_SHEET_NAME

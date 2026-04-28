import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { normalizeName } from './advisorService'

const DAILY_TABLE = 'daily_rankings'
const MONTHLY_TABLE = 'monthly_rankings'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

const toAppAdvisor = (row) => ({
  id: String(row.id ?? `${row.advisor_code || row.normalized_name}-${row.rank}`),
  advisor_code: row.advisor_code ?? '',
  normalized_name: row.normalized_name ?? '',
  name: row.advisor_name ?? '',
  team: row.team_name || row.department_name || '',
  department_name: row.department_name ?? '',
  initials:
    String(row.advisor_name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'TV',
  revenue: Number(row.revenue ?? 0),
  avatar: row.avatar_url ?? '',
  avatar_url: row.avatar_url ?? '',
  rank: Number(row.rank ?? 0),
})

const newestTimestamp = (row) => {
  const timestamp = new Date(row.created_at ?? row.updated_at ?? 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

const latestRowsByRank = (rows, limit) => {
  const byRank = new Map()
  ;(rows ?? []).forEach((row) => {
    const rank = Number(row.rank ?? 0)
    if (!rank) return
    const current = byRank.get(rank)
    if (!current || newestTimestamp(row) > newestTimestamp(current)) {
      byRank.set(rank, row)
    }
  })
  return [...byRank.values()]
    .sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0))
    .slice(0, limit)
}

const withoutUndefined = (row) =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))

const toRankingRecord = (row, periodFields) =>
  withoutUndefined({
    ...periodFields,
    rank: Number(row.rank ?? 0),
    advisor_code: row.advisor_code ?? null,
    advisor_name: String(row.advisor_name ?? row.name ?? '').trim(),
    normalized_name: normalizeName(row.advisor_name ?? row.name ?? ''),
    team_name: row.team_name ?? row.team ?? null,
    revenue: Number(row.revenue ?? 0),
    avatar_url: row.avatar_url ?? row.avatar ?? null,
    avatar_path: row.avatar_path ?? null,
  })

const normalizeRankingRows = (rows) =>
  (rows ?? [])
    .filter((row) => String(row.advisor_name ?? row.name ?? '').trim())
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }))

export async function fetchDailyRankings(limit = 10) {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(DAILY_TABLE)
      .select('*')
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 10, 50))
    if (error) throw error
    const latestDate = data?.[0]?.report_date
    return latestRowsByRank((data ?? []).filter((row) => row.report_date === latestDate), limit).map(toAppAdvisor)
  } catch (error) {
    console.error('fetchDailyRankings error', error)
    throw new Error(`Không tải được Top ngày từ Supabase: ${error.message}`, { cause: error })
  }
}

export async function fetchMonthlyRankings(limit = 10) {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(MONTHLY_TABLE)
      .select('*')
      .order('report_year', { ascending: false })
      .order('report_month', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 10, 50))
    if (error) throw error
    const latest = data?.[0]
    return latestRowsByRank(
      (data ?? []).filter((row) => row.report_year === latest?.report_year && row.report_month === latest?.report_month),
      limit,
    ).map(toAppAdvisor)
  } catch (error) {
    console.error('fetchMonthlyRankings error', error)
    throw new Error(`Không tải được Top tháng từ Supabase: ${error.message}`, { cause: error })
  }
}

export async function replaceDailyRankings(reportDate, rows) {
  try {
    ensureSupabase()
    const { error: deleteError } = await supabase.from(DAILY_TABLE).delete().eq('report_date', reportDate)
    if (deleteError) throw deleteError
    if (!rows?.length) return []
    const payload = normalizeRankingRows(rows).map((row) => toRankingRecord(row, { report_date: reportDate }))
    console.log('[daily_rankings] insert rows', payload)
    const { data, error } = await supabase.from(DAILY_TABLE).insert(payload).select('*')
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('replaceDailyRankings error', error)
    throw new Error(`Không ghi được Top ngày vào Supabase: ${error.message}`, { cause: error })
  }
}

export async function replaceMonthlyRankings(reportMonth, reportYear, rows) {
  try {
    ensureSupabase()
    const { error: deleteError } = await supabase
      .from(MONTHLY_TABLE)
      .delete()
      .eq('report_month', reportMonth)
      .eq('report_year', reportYear)
    if (deleteError) throw deleteError
    if (!rows?.length) return []
    const today = new Date()
    const reportDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const payload = normalizeRankingRows(rows).map((row) =>
      toRankingRecord(row, { report_month: reportMonth, report_year: reportYear, report_date: row.report_date ?? reportDate }),
    )
    console.log('[monthly_rankings] insert rows', payload)
    const { data, error } = await supabase.from(MONTHLY_TABLE).insert(payload).select('*')
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('replaceMonthlyRankings error', error)
    throw new Error(`Không ghi được Top tháng vào Supabase: ${error.message}`, { cause: error })
  }
}

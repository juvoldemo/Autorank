import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

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

export async function fetchDailyRankings(limit = 10) {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(DAILY_TABLE)
      .select('*')
      .order('report_date', { ascending: false })
      .order('rank', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(toAppAdvisor)
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
      .order('rank', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(toAppAdvisor)
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
    const { data, error } = await supabase.from(DAILY_TABLE).insert(rows).select('*')
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
    const { data, error } = await supabase.from(MONTHLY_TABLE).insert(rows).select('*')
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('replaceMonthlyRankings error', error)
    throw new Error(`Không ghi được Top tháng vào Supabase: ${error.message}`, { cause: error })
  }
}

import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const TABLE = 'team_overview'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

const toAppTeam = (row) => ({
  id: String(row.id ?? `${row.normalized_team_name}-${row.rank}`),
  stt: Number(row.rank ?? 0),
  tenNhom: row.team_name ?? '',
  doanhThu: Number(row.total_revenue ?? 0),
  tvvHoatDong: Number(row.active_advisors ?? 0),
  soHopDong: Number(row.contract_count ?? 0),
  percentOfCompany: Number(row.percent_of_company ?? 0),
  reportDate: row.report_date,
})

const uniqueLatestRows = (rows) => {
  const latestDate = rows[0]?.report_date
  const seen = new Set()
  return rows.filter((row) => {
    if (row.report_date !== latestDate) return false
    const key = row.normalized_team_name || `${row.rank}-${row.team_name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function fetchTeamOverview() {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('report_date', { ascending: false })
      .order('rank', { ascending: true })
    if (error) throw error
    const rows = data ?? []
    return uniqueLatestRows(rows).map(toAppTeam)
  } catch (error) {
    console.error('fetchTeamOverview error', error)
    throw new Error(`Không tải được TBTN từ Supabase: ${error.message}`, { cause: error })
  }
}

export async function replaceTeamOverview(reportDate, rows) {
  try {
    ensureSupabase()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq('report_date', reportDate)
    if (deleteError) throw deleteError
    if (!rows?.length) return []
    const { data, error } = await supabase.from(TABLE).insert(rows).select('*')
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('replaceTeamOverview error', error)
    throw new Error(`Không ghi được TBTN vào Supabase: ${error.message}`, { cause: error })
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1'

const DATA_SETTING_KEYS = {
  topMonthUrl: 'google_sheet_monthly_url',
  topDayUrl: 'google_sheet_daily_url',
  tbtnUrl: 'google_sheet_tbtn_url',
} as const

const LEGACY_DATA_SETTING_KEYS = {
  [DATA_SETTING_KEYS.topMonthUrl]: 'top_month_sheet_url',
  [DATA_SETTING_KEYS.topDayUrl]: 'top_day_sheet_url',
  [DATA_SETTING_KEYS.tbtnUrl]: 'tbtn_sheet_url',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
}

const todayIso = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeName = normalizeHeader

const slugify = (value: unknown) => normalizeHeader(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'

const normalizeRevenue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const parsed = Number(String(value ?? '').replace(/[^\d-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const cleanTeamName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*[A-Z]{1,4}\d{2,}.*$/i, '')
    .replace(/\s*\([A-Z]{1,4}\d{2,}.*\)\s*$/i, '')
    .trim()

const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => String(value ?? '').trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => String(value ?? '').trim() !== '')) rows.push(row)
  return rows
}

const parseCsvTextToObjects = (text: string) => {
  const table = parseCsv(String(text || '').replace(/^\uFEFF/, ''))
  const headers = (table[0] ?? []).map((header) => String(header ?? '').trim())
  return table.slice(1).map((cells) => {
    const row: Record<string, unknown> = { __cells: cells }
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index] ?? ''
    })
    return row
  })
}

const getGoogleSheetId = (url: string) => {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Link Google Sheet khong hop le.')
  return match[1]
}

const googleSheetCsvUrl = (url: string, sheetName: string) => {
  const spreadsheetId = getGoogleSheetId(url)
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

const hasAnyValue = (row: Record<string, unknown>) => {
  const cells = row.__cells
  if (Array.isArray(cells)) return cells.some((value) => String(value ?? '').trim() !== '')
  return Object.values(row).some((value) => String(value ?? '').trim() !== '')
}

const getRawValue = (row: Record<string, unknown>, aliases: string[], fallback = '') => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias]
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value] as const)
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias)
    const match = normalizedEntries.find((entry) => entry[0] === normalizedAlias && entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    if (match) return match[1]
  }

  return fallback
}

const getCellValue = (row: Record<string, unknown>, index: number, fallback: unknown = '') => {
  const cells = Array.isArray(row.__cells) ? row.__cells : []
  const value = cells[index]
  return value !== undefined && value !== null && value !== '' ? value : fallback
}

const fetchSheetRows = async (url: string, sheetName: string) => {
  if (!url?.trim()) throw new Error('Chua co link Google Sheet.')
  const finalUrl = url.includes('docs.google.com') ? googleSheetCsvUrl(url, sheetName) : url
  const response = await fetch(finalUrl)
  if (!response.ok) throw new Error(`Google Sheet returned ${response.status}.`)
  const text = await response.text()
  if (/<!DOCTYPE|<html|Google Docs/i.test(text)) throw new Error('Sheet is not public or tab name is wrong.')
  return parseCsvTextToObjects(text).filter(hasAnyValue)
}

const requireSetting = (settings: Record<string, string>, key: string, label: string) => {
  const value = String(settings[key] ?? '').trim()
  if (!value) throw new Error(`Thieu link ${label}. Hay luu cau hinh trong admin.`)
  return value
}

const toRankingSheetRow = (
  row: Record<string, unknown>,
  index: number,
  config: {
    advisorIndex: number
    teamIndex: number
    revenueIndex: number
    advisorHeaders: string[]
    teamHeaders: string[]
    revenueHeaders: string[]
  },
  sourceName: string,
  periodFields: Record<string, unknown>,
) => {
  const advisorName = String(getRawValue(row, config.advisorHeaders, getCellValue(row, config.advisorIndex))).trim()
  const teamName = cleanTeamName(getRawValue(row, config.teamHeaders, getCellValue(row, config.teamIndex)))
  const revenue = normalizeRevenue(getRawValue(row, config.revenueHeaders, getCellValue(row, config.revenueIndex)))
  if (!advisorName) return null

  return {
    ...periodFields,
    rank: index + 1,
    advisor_name: advisorName,
    normalized_name: normalizeName(advisorName),
    advisor_code: null,
    team_name: teamName || null,
    department_name: null,
    revenue,
    avatar_url: null,
    avatar_path: null,
    source_file_name: sourceName,
  }
}

const withStoredAvatars = (rows: Record<string, unknown>[], profiles: Record<string, unknown>[]) => {
  const nameMap = new Map<string, Record<string, unknown>>()
  profiles.forEach((profile) => {
    const normalized = normalizeName(profile.normalized_name || profile.advisor_name)
    if (normalized && !nameMap.has(normalized)) nameMap.set(normalized, profile)
  })

  return rows.map((row) => {
    const profile = nameMap.get(normalizeName(row.normalized_name || row.advisor_name))
    return profile?.avatar_url
      ? { ...row, avatar_url: profile.avatar_url, avatar_path: profile.avatar_path ?? null }
      : row
  })
}

const toTeamOverviewSheetRow = (row: Record<string, unknown>, reportDate: string, totalCompanyRevenue: number) => {
  const rank = normalizeInteger(getRawValue(row, ['STT'], getCellValue(row, 0)))
  const teamName = cleanTeamName(getRawValue(row, ['Ten nhom'], getCellValue(row, 1)))
  const normalizedTeamName = normalizeHeader(teamName)
  if (!rank || !teamName) return null
  if (normalizedTeamName.includes('le thi my chau') || normalizedTeamName.includes('tong toan bo')) return null

  const totalRevenue = normalizeRevenue(getRawValue(row, ['Tong AFYP'], getCellValue(row, 2)))
  const activeAdvisors = normalizeInteger(getRawValue(row, ['So luong TVV co hop dong'], getCellValue(row, 3)))

  return {
    report_date: reportDate,
    team_name: teamName,
    normalized_team_name: slugify(teamName),
    total_revenue: totalRevenue,
    active_advisors: activeAdvisors,
    contract_count: 0,
    percent_of_company: totalCompanyRevenue ? Number(((totalRevenue / totalCompanyRevenue) * 100).toFixed(2)) : 0,
    rank,
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const syncSecret = Deno.env.get('AUTO_SYNC_SECRET')
  if (syncSecret && request.headers.get('x-sync-secret') !== syncSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const reportDate = todayIso()
  const now = new Date()
  const reportMonth = now.getMonth() + 1
  const reportYear = now.getFullYear()
  const results: Record<string, unknown> = {}

  const logResult = async (log: Record<string, unknown>) => {
    await supabase.from('import_logs').insert({
      import_type: log.import_type,
      source_name: log.source_name ?? '',
      status: log.status ?? 'success',
      message: log.message ?? '',
      total_rows: Number(log.total_rows ?? 0),
    })
  }

  try {
    const { data: settingsRows, error: settingsError } = await supabase.from('app_settings').select('key,value')
    if (settingsError) throw settingsError
    const settings = (settingsRows ?? []).reduce<Record<string, string>>((items, row) => ({ ...items, [row.key]: row.value ?? '' }), {})
    Object.entries(LEGACY_DATA_SETTING_KEYS).forEach(([currentKey, legacyKey]) => {
      if (!settings[currentKey] && settings[legacyKey]) settings[currentKey] = settings[legacyKey]
    })

    const { data: profiles } = await supabase.from('advisor_profiles').select('normalized_name,advisor_name,avatar_url,avatar_path')

    const monthlyUrl = requireSetting(settings, DATA_SETTING_KEYS.topMonthUrl, 'Top thang')
    const monthlyRawRows = await fetchSheetRows(monthlyUrl, 'TopThang')
    const monthlyRows = withStoredAvatars(
      monthlyRawRows
        .map((row, index) =>
          toRankingSheetRow(
            row,
            index,
            {
              advisorIndex: 1,
              teamIndex: 2,
              revenueIndex: 3,
              advisorHeaders: ['Ten tu van vien', 'Ho ten'],
              teamHeaders: ['Nhom', 'Doi'],
              revenueHeaders: ['Doanh thu'],
            },
            monthlyUrl,
            { report_date: reportDate, report_month: reportMonth, report_year: reportYear },
          ),
        )
        .filter(Boolean) as Record<string, unknown>[],
      profiles ?? [],
    )
    await supabase.from('monthly_rankings').delete().eq('report_month', reportMonth).eq('report_year', reportYear)
    const { data: savedMonthly, error: monthlyError } = monthlyRows.length
      ? await supabase.from('monthly_rankings').insert(monthlyRows).select('id')
      : { data: [], error: null }
    if (monthlyError) throw monthlyError
    await logResult({ import_type: 'monthly_rankings', source_name: monthlyUrl, status: 'success', total_rows: savedMonthly?.length ?? 0, message: `Auto sync Top thang: ${savedMonthly?.length ?? 0} dong.` })
    results.monthly = savedMonthly?.length ?? 0

    const dailyUrl = requireSetting(settings, DATA_SETTING_KEYS.topDayUrl, 'Top ngay')
    const dailyRawRows = await fetchSheetRows(dailyUrl, 'TopNgay')
    const dailyRows = withStoredAvatars(
      dailyRawRows
        .map((row, index) =>
          toRankingSheetRow(
            row,
            index,
            {
              advisorIndex: 1,
              teamIndex: 2,
              revenueIndex: 3,
              advisorHeaders: ['Ten tu van vien'],
              teamHeaders: ['Nhom'],
              revenueHeaders: ['Doanh thu'],
            },
            dailyUrl,
            { report_date: reportDate },
          ),
        )
        .filter(Boolean) as Record<string, unknown>[],
      profiles ?? [],
    )
    await supabase.from('daily_rankings').delete().eq('report_date', reportDate)
    const { data: savedDaily, error: dailyError } = dailyRows.length
      ? await supabase.from('daily_rankings').insert(dailyRows).select('id')
      : { data: [], error: null }
    if (dailyError) throw dailyError
    await logResult({ import_type: 'daily_rankings', source_name: dailyUrl, status: 'success', total_rows: savedDaily?.length ?? 0, message: `Auto sync Top ngay: ${savedDaily?.length ?? 0} dong.` })
    results.daily = savedDaily?.length ?? 0

    const tbtnUrl = requireSetting(settings, DATA_SETTING_KEYS.tbtnUrl, 'TBTN')
    const tbtnRawRows = await fetchSheetRows(tbtnUrl, 'TBTN')
    const preliminaryRows = tbtnRawRows.map((row) => toTeamOverviewSheetRow(row, reportDate, 0)).filter(Boolean) as Record<string, unknown>[]
    const totalCompanyRevenue = preliminaryRows.reduce((total, row) => total + Number(row.total_revenue || 0), 0)
    const teamRows = preliminaryRows.map((row) => ({
      ...row,
      percent_of_company: totalCompanyRevenue ? Number(((Number(row.total_revenue || 0) / totalCompanyRevenue) * 100).toFixed(2)) : 0,
    }))
    await supabase.from('team_overview').delete().eq('report_date', reportDate)
    const { data: savedTeams, error: teamError } = teamRows.length
      ? await supabase.from('team_overview').insert(teamRows).select('id')
      : { data: [], error: null }
    if (teamError) throw teamError
    await logResult({ import_type: 'team_overview', source_name: tbtnUrl, status: 'success', total_rows: savedTeams?.length ?? 0, message: `Auto sync TBTN: ${savedTeams?.length ?? 0} nhom.` })
    results.teamOverview = savedTeams?.length ?? 0

    return new Response(JSON.stringify({ ok: true, reportDate, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    await logResult({
      import_type: 'auto_sync',
      source_name: 'scheduled edge function',
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
      total_rows: 0,
    })

    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), results }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

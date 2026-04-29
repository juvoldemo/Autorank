import Papa from 'papaparse'
import { DATA_SETTING_KEYS, createImportLog, fetchAppSettings } from './settingsService'
import { normalizeAdvisorName } from './advisorService'
import { replaceDailyRankings, replaceMonthlyRankings } from './rankingService'
import { replaceTeamOverview } from './teamOverviewService'

const GOOGLE_SHEET_ERROR = 'Không đọc được Google Sheet: kiểm tra share Anyone with link hoặc tên tab'

const todayIso = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

const slugify = (value) => normalizeHeader(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'

const normalizeRevenue = (value) => {
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
  const parsed = Number(String(value ?? '').replace(/[^\d-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const cleanTeamName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*[A-Z]{1,4}\d{2,}.*$/i, '')
    .replace(/\s*\([A-Z]{1,4}\d{2,}.*\)\s*$/i, '')
    .trim()

const hasAnyValue = (row) => {
  if (!row || typeof row !== 'object') return false
  if (Array.isArray(row.__cells)) {
    return row.__cells.some((value) => String(value ?? '').trim() !== '')
  }
  return Object.values(row).some((value) => String(value ?? '').trim() !== '')
}

const getRawValue = (row, aliases, fallback = '') => {
  if (!row || typeof row !== 'object') return fallback

  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias]
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias)
    const match = normalizedEntries.find(
      ([key, value]) => key === normalizedAlias && value !== undefined && value !== null && value !== '',
    )
    if (match) return match[1]
  }

  return fallback
}

const getCellValue = (row, index, fallback = '') => {
  const cells = Array.isArray(row?.__cells) ? row.__cells : []
  const value = cells[index]
  return value !== undefined && value !== null && value !== '' ? value : fallback
}

const parseCsvTextToObjects = (text) => {
  const parsed = Papa.parse(String(text || '').replace(/^\uFEFF/, ''), {
    header: false,
    skipEmptyLines: true,
  })
  if (parsed.errors?.length) console.log('[Google Sheet] PapaParse warnings', parsed.errors)
  const table = parsed.data ?? []
  const headers = (table[0] ?? []).map((header) => String(header ?? '').trim())
  return table.slice(1).map((cells) => {
    const row = { __cells: cells }
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index] ?? ''
    })
    return row
  })
}

const getGoogleSheetId = (url) => {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Link Google Sheet không hợp lệ.')
  return match[1]
}

const googleSheetCsvUrl = (url, sheetName) => {
  const spreadsheetId = getGoogleSheetId(url)
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

export async function fetchSheetRows(url, sheetName) {
  if (!url?.trim()) throw new Error('Chưa có link Google Sheet.')

  try {
    const currentSheetName = Array.isArray(sheetName) ? sheetName[0] : sheetName
    const finalUrl = url.includes('docs.google.com') ? googleSheetCsvUrl(url, currentSheetName) : url
    console.log('[Google Sheet] fetch URL', finalUrl)

    const response = await fetch(finalUrl)
    if (!response.ok) throw new Error(`Google Sheet returned ${response.status}.`)

    const text = await response.text()
    if (/<!DOCTYPE|<html|Google Docs/i.test(text)) {
      throw new Error('Sheet is not public or tab name is wrong.')
    }

    const rows = parseCsvTextToObjects(text).filter(hasAnyValue)
    console.log('[Google Sheet] raw row count', rows.length)
    return rows
  } catch (error) {
    console.error('fetchSheetRows error', error)
    throw new Error(GOOGLE_SHEET_ERROR, { cause: error })
  }
}

const logResult = async (log) => {
  try {
    await createImportLog(log)
  } catch (error) {
    console.error('import log failed', error)
  }
}

const resolveSyncSettings = async (settingsOverride = null) => {
  let savedSettings = {}
  try {
    savedSettings = await fetchAppSettings()
  } catch (error) {
    console.warn('Không tải được app_settings, dùng cấu hình đang nhập trên màn hình nếu có.', error)
  }
  const override = settingsOverride ?? {}
  return Object.values(DATA_SETTING_KEYS).reduce(
    (settings, key) => ({
      ...settings,
      [key]: String(override[key] ?? '').trim() || String(savedSettings[key] ?? '').trim(),
    }),
    {},
  )
}

const requireSetting = (settings, key, label) => {
  const value = String(settings[key] ?? '').trim()
  if (!value) throw new Error(`Thiếu link ${label}. Hãy nhập và bấm "Lưu cấu hình".`)
  return value
}

const toRankingSheetRow = (row, index, config, sourceName, periodFields) => {
  const advisorName = String(getRawValue(row, config.advisorHeaders, getCellValue(row, config.advisorIndex))).trim()
  const teamName = cleanTeamName(getRawValue(row, config.teamHeaders, getCellValue(row, config.teamIndex)))
  const revenue = normalizeRevenue(getRawValue(row, config.revenueHeaders, getCellValue(row, config.revenueIndex)))

  if (!advisorName) return null

  return {
    ...periodFields,
    rank: index + 1,
    advisor_name: advisorName,
    normalized_name: normalizeAdvisorName(advisorName),
    advisor_code: null,
    team_name: teamName || null,
    department_name: null,
    revenue,
    avatar_url: null,
    source_file_name: sourceName,
  }
}

const toTeamOverviewSheetRow = (row, reportDate, totalCompanyRevenue) => {
  const rank = normalizeInteger(getRawValue(row, ['STT'], getCellValue(row, 0)))
  const teamName = cleanTeamName(getCellValue(row, 1, getRawValue(row, ['Tên nhóm', 'Ten nhom'])))
  const normalizedTeamName = normalizeHeader(teamName)

  if (!rank || !teamName) return null
  if (normalizedTeamName.includes('le thi my chau') || normalizedTeamName.includes('tong toan bo')) return null

  const totalRevenue = normalizeRevenue(getCellValue(row, 2, getRawValue(row, ['Tổng AFYP', 'Tong AFYP'])))
  const totalAdvisors = normalizeInteger(
    getCellValue(row, 3, getRawValue(row, ['Số lượng TVV có hợp đồng', 'So luong TVV co hop dong'])),
  )

  return {
    report_date: reportDate,
    team_name: teamName,
    normalized_team_name: slugify(teamName),
    total_revenue: totalRevenue,
    active_advisors: totalAdvisors,
    contract_count: 0,
    percent_of_company: totalCompanyRevenue ? Number(((totalRevenue / totalCompanyRevenue) * 100).toFixed(2)) : 0,
    rank,
  }
}

export async function syncDailyRankings(settingsOverride = null) {
  const settings = await resolveSyncSettings(settingsOverride)
  const sourceUrl = requireSetting(settings, DATA_SETTING_KEYS.topDayUrl, 'Google Sheet Top ngày')
  const reportDate = todayIso()

  try {
    const rawRows = await fetchSheetRows(sourceUrl, 'TopNgay')
    const rows = rawRows
      .map((row, index) =>
        toRankingSheetRow(
          row,
          index,
          {
            rankIndex: 0,
            advisorIndex: 1,
            teamIndex: 2,
            revenueIndex: 3,
            rankHeaders: ['STT', 'stt'],
            advisorHeaders: ['Tên tư vấn viên', 'Ten tu van vien', 'ten tu van vien'],
            teamHeaders: ['Nhóm', 'Nhom', 'nhom'],
            revenueHeaders: ['Doanh thu', 'Doanh Thu', 'doanh thu'],
          },
          sourceUrl,
          { report_date: reportDate },
        ),
      )
      .filter(Boolean)

    console.log('[Top ngày] parsed rows', rows)
    const withAvatars = rows.map((row) => ({ ...row, avatar_url: row.avatar_url || null, avatar_path: row.avatar_path || null }))
    const savedRows = await replaceDailyRankings(reportDate, withAvatars)
    await logResult({
      import_type: 'daily_rankings',
      source_name: sourceUrl,
      status: 'success',
      total_rows: savedRows.length,
      message: `Đã đồng bộ Top ngày: ${savedRows.length} dòng.`,
    })
    return { rows: savedRows, reportDate, sourceName: sourceUrl }
  } catch (error) {
    await logResult({
      import_type: 'daily_rankings',
      source_name: sourceUrl,
      status: 'failed',
      message: error.message,
      total_rows: 0,
    })
    throw error
  }
}

export async function syncMonthlyRankings(settingsOverride = null) {
  const settings = await resolveSyncSettings(settingsOverride)
  const sourceUrl = requireSetting(settings, DATA_SETTING_KEYS.topMonthUrl, 'Google Sheet Top tháng')
  const now = new Date()
  const reportMonth = now.getMonth() + 1
  const reportYear = now.getFullYear()

  try {
    const rawRows = await fetchSheetRows(sourceUrl, 'TopThang')
    const rows = rawRows
      .map((row, index) =>
        toRankingSheetRow(
          row,
          index,
          {
            rankIndex: 0,
            advisorIndex: 1,
            teamIndex: 2,
            revenueIndex: 3,
            rankHeaders: ['Hạng', 'Hang', 'hang'],
            revenueHeaders: ['Doanh thu', 'Doanh Thu', 'doanh thu'],
            advisorHeaders: ['Ten tu van vien', 'ten tu van vien', 'Ho ten', 'ho ten'],
            teamHeaders: ['Nhom', 'nhom', 'Doi', 'doi'],
          },
          sourceUrl,
          { report_date: todayIso(), report_month: reportMonth, report_year: reportYear },
        ),
      )
      .filter(Boolean)

    console.log('[Top tháng] parsed rows', rows)
    const withAvatars = rows.map((row) => ({ ...row, avatar_url: row.avatar_url || null, avatar_path: row.avatar_path || null }))
    const savedRows = await replaceMonthlyRankings(reportMonth, reportYear, withAvatars)
    await logResult({
      import_type: 'monthly_rankings',
      source_name: sourceUrl,
      status: 'success',
      total_rows: savedRows.length,
      message: `Đã đồng bộ Top tháng: ${savedRows.length} dòng.`,
    })
    return { rows: savedRows, reportMonth, reportYear, sourceName: sourceUrl }
  } catch (error) {
    await logResult({
      import_type: 'monthly_rankings',
      source_name: sourceUrl,
      status: 'failed',
      message: error.message,
      total_rows: 0,
    })
    throw error
  }
}

export async function syncTeamOverview(settingsOverride = null) {
  const settings = await resolveSyncSettings(settingsOverride)
  const sourceUrl = requireSetting(settings, DATA_SETTING_KEYS.tbtnUrl, 'Google Sheet TBTN')
  const reportDate = todayIso()

  try {
    const rawRows = await fetchSheetRows(sourceUrl, 'TBTN')
    const preliminaryRows = rawRows
      .map((row) => toTeamOverviewSheetRow(row, reportDate, 0))
      .filter(Boolean)
    const totalCompanyRevenue = preliminaryRows.reduce((total, row) => total + Number(row.total_revenue || 0), 0)
    const rows = preliminaryRows.map((row) => ({
      ...row,
      percent_of_company: totalCompanyRevenue ? Number(((row.total_revenue / totalCompanyRevenue) * 100).toFixed(2)) : 0,
    }))

    console.log('[TBTN] parsed rows', rows)
    await replaceTeamOverview(reportDate, rows)
    await logResult({
      import_type: 'team_overview',
      source_name: sourceUrl,
      status: 'success',
      total_rows: rows.length,
      message: `Đã đồng bộ TBTN: ${rows.length} nhóm.`,
    })
    return { rows, reportDate, sourceName: sourceUrl, totalCompanyRevenue }
  } catch (error) {
    await logResult({
      import_type: 'team_overview',
      source_name: sourceUrl,
      status: 'failed',
      message: error.message,
      total_rows: 0,
    })
    throw error
  }
}

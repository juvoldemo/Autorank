import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { DATA_SETTING_KEYS, createImportLog, fetchAppSettings } from './settingsService'
import { fetchAdvisors, mergeRowsWithAdvisorAvatars, normalizeAdvisorName, upsertAdvisors } from './advisorService'
import { replaceDailyRankings, replaceMonthlyRankings } from './rankingService'
import { replaceTeamOverview } from './teamOverviewService'

const EXCLUDED_STATUSES = ['tu choi', 'ycbh het hieu luc', 'tri hoan', 'da cham dut']
const UNGROUPED_SPECIAL_ADVISOR = normalizeAdvisorName('Lê Thị Mỹ Châu')

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

const slugify = (value) => normalizeHeader(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '')

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

const getRawValue = (row, aliases, fallback = '') => {
  if (!row || typeof row !== 'object') return fallback
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias]
  }
  const entries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias)
    const match = entries.find(([key, value]) => key === normalizedAlias && value !== undefined && value !== null && value !== '')
    if (match) return match[1]
  }
  return fallback
}

const parseDate = (value) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const vn = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (vn) {
    const year = Number(vn[3].length === 2 ? `20${vn[3]}` : vn[3])
    return new Date(year, Number(vn[2]) - 1, Number(vn[1]))
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toDateIso = (date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''

const cleanTeamName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*[A-Z]{1,4}\d{2,}.*$/i, '')
    .replace(/\s*\([A-Z]{1,4}\d{2,}.*\)\s*$/i, '')
    .trim()

const parseCsvTextToObjects = (text) => {
  const parsed = Papa.parse(String(text || '').replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors?.length) console.log('CSV parse warnings', parsed.errors)
  return parsed.data ?? []
}

const getGoogleSheetGid = (url) => {
  const parsedUrl = new URL(String(url || '').trim())
  return parsedUrl.searchParams.get('gid') || String(parsedUrl.hash || '').match(/gid=(\d+)/)?.[1] || '0'
}

const getGoogleSheetId = (url) => {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Link Google Sheet không hợp lệ.')
  return match[1]
}

const googleSheetCsvUrl = (url) =>
  `https://docs.google.com/spreadsheets/d/${getGoogleSheetId(url)}/export?format=csv&gid=${getGoogleSheetGid(url)}`

export async function fetchSheetRows(url) {
  if (!url?.trim()) throw new Error('Chưa có link nguồn dữ liệu.')
  try {
    const finalUrl = url.includes('docs.google.com') ? googleSheetCsvUrl(url) : url
    const response = await fetch(finalUrl)
    if (!response.ok) throw new Error(`Nguồn trả về mã lỗi ${response.status}.`)
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await response.json()
      if (Array.isArray(json)) return json
      if (Array.isArray(json?.data)) return json.data
      throw new Error('JSON không có mảng dữ liệu.')
    }
    const text = await response.text()
    if (/<!DOCTYPE|<html|Google Docs/i.test(text)) throw new Error('Sheet chưa public hoặc link không trỏ tới dữ liệu CSV.')
    return parseCsvTextToObjects(text)
  } catch (error) {
    console.error('fetchSheetRows error', error)
    throw new Error(`Không đọc được dữ liệu Sheet/API: ${error.message}`, { cause: error })
  }
}

const extractDriveFolderId = (url) =>
  String(url || '').match(/folders\/([a-zA-Z0-9-_]+)/)?.[1] ||
  String(url || '').match(/[?&]id=([a-zA-Z0-9-_]+)/)?.[1] ||
  String(url || '').trim()

const fetchLatestPhiBaoHiemRows = async (folderUrl) => {
  const folderId = extractDriveFolderId(folderUrl)
  if (!folderId) throw new Error('Chưa có Google Drive folder chứa file PhiBaoHiem.')
  const response = await fetch(`https://drive.google.com/drive/folders/${folderId}`)
  if (!response.ok) throw new Error(`Không mở được Drive folder. Mã lỗi ${response.status}.`)
  const html = await response.text()
  const matches = [...html.matchAll(/\["([a-zA-Z0-9_-]{20,})","(PhiBaoHiem[^"]+)"/g)]
  const latest = matches
    .map((match) => ({ id: match[1], name: match[2] }))
    .sort((a, b) => b.name.localeCompare(a.name, 'vi'))
    .at(0)
  if (!latest) throw new Error('Không tìm thấy file có tên bắt đầu bằng PhiBaoHiem trong folder.')
  const download = await fetch(`https://drive.google.com/uc?export=download&id=${latest.id}`)
  if (!download.ok) throw new Error(`Không tải được file ${latest.name}.`)
  const buffer = await download.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return {
    sourceName: latest.name,
    rows: XLSX.utils.sheet_to_json(firstSheet, { defval: '' }),
  }
}

const toContractRow = (row) => {
  const advisorName = String(getRawValue(row, ['Họ tên', 'Họ và tên', 'Tên tư vấn viên', 'Ten tu van vien', 'Ten TVV', 'Tên đại lý', 'Ten dai ly', 'Name'])).trim()
  const advisorCode = String(getRawValue(row, ['Mã TVV', 'Ma TVV', 'Mã đại lý', 'Ma dai ly', 'advisor_code', 'Code', 'Mã'])).trim()
  const teamName = cleanTeamName(getRawValue(row, ['Tên nhóm', 'Nhóm', 'Nhom', 'Team', 'Đội', 'Doi', 'Ban nhóm']))
  const departmentName = cleanTeamName(getRawValue(row, ['Tên ban', 'Ban', 'Department', 'Phòng ban', 'Khoi']))
  const revenue = normalizeRevenue(getRawValue(row, ['AFYP', 'Tổng AFYP', 'Tong AFYP', 'Doanh thu', 'Revenue'], 0))
  const status = normalizeHeader(getRawValue(row, ['Tình trạng', 'Tinh trang', 'Trạng thái', 'Trang thai', 'Status']))
  const paidDate = parseDate(getRawValue(row, ['Ngày thu', 'Ngay thu', 'Ngày nộp phí', 'Ngay nop phi', 'Paid date', 'Issue date']))
  const contractId = String(getRawValue(row, ['Số hợp đồng', 'So hop dong', 'Mã hồ sơ', 'Ma ho so', 'Policy No', 'contract_id'])).trim()
  return {
    advisorName,
    advisorCode,
    normalizedName: normalizeAdvisorName(advisorName),
    teamName: teamName || departmentName,
    departmentName,
    revenue,
    status,
    paidDate,
    contractId,
  }
}

const validContract = (contract) =>
  contract.advisorName &&
  contract.revenue > 0 &&
  !EXCLUDED_STATUSES.some((status) => contract.status.includes(status))

const groupAdvisorRankings = (contracts, sourceFileName, modeDate) => {
  const grouped = new Map()
  contracts.filter(validContract).forEach((contract) => {
    const key = contract.advisorCode || contract.normalizedName
    const current = grouped.get(key) ?? {
      advisor_code: contract.advisorCode || null,
      advisor_name: contract.advisorName,
      normalized_name: contract.normalizedName,
      team_name: contract.teamName || contract.departmentName || null,
      department_name: contract.departmentName || null,
      revenue: 0,
      avatar_url: null,
      source_file_name: sourceFileName,
    }
    current.revenue += contract.revenue
    if (!current.team_name && contract.teamName) current.team_name = contract.teamName
    if (!current.department_name && contract.departmentName) current.department_name = contract.departmentName
    grouped.set(key, current)
  })
  return [...grouped.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((row, index) => ({ ...row, ...modeDate, rank: index + 1 }))
}

const attachAvatarsAndSaveAdvisors = async (rankingRows) => {
  await upsertAdvisors(rankingRows)
  const advisors = await fetchAdvisors()
  return mergeRowsWithAdvisorAvatars(rankingRows, advisors).map((row) => ({
    ...row,
    advisor_name: row.advisor_name ?? row.name,
    team_name: row.team_name ?? row.team,
    avatar_url: row.avatar_url || row.avatar || null,
  }))
}

const logResult = async (log) => {
  try {
    await createImportLog(log)
  } catch (error) {
    console.error('import log failed', error)
  }
}

export async function syncDailyRankings(settingsOverride = null) {
  const settings = settingsOverride ?? await fetchAppSettings()
  const reportDate = todayIso()
  try {
    const sourceUrl = settings[DATA_SETTING_KEYS.driveFolderUrl] || settings[DATA_SETTING_KEYS.topDayUrl]
    const source = settings[DATA_SETTING_KEYS.driveFolderUrl]
      ? await fetchLatestPhiBaoHiemRows(sourceUrl)
      : { sourceName: sourceUrl, rows: await fetchSheetRows(sourceUrl) }
    const contracts = source.rows.map(toContractRow).filter((row) => toDateIso(row.paidDate) === reportDate)
    const ranked = groupAdvisorRankings(contracts, source.sourceName, { report_date: reportDate })
    const withAvatars = await attachAvatarsAndSaveAdvisors(ranked)
    await replaceDailyRankings(reportDate, withAvatars)
    await logResult({ import_type: 'daily_rankings', source_name: source.sourceName, status: 'success', total_rows: withAvatars.length, message: `Đã đồng bộ Top ngày ${reportDate}.` })
    return { rows: withAvatars, reportDate, sourceName: source.sourceName }
  } catch (error) {
    await logResult({ import_type: 'daily_rankings', source_name: settings[DATA_SETTING_KEYS.driveFolderUrl] || settings[DATA_SETTING_KEYS.topDayUrl], status: 'failed', message: error.message, total_rows: 0 })
    throw error
  }
}

export async function syncMonthlyRankings(settingsOverride = null) {
  const settings = settingsOverride ?? await fetchAppSettings()
  const now = new Date()
  const reportMonth = now.getMonth() + 1
  const reportYear = now.getFullYear()
  try {
    const sourceUrl = settings[DATA_SETTING_KEYS.topMonthUrl] || settings[DATA_SETTING_KEYS.driveFolderUrl]
    const source = sourceUrl === settings[DATA_SETTING_KEYS.driveFolderUrl]
      ? await fetchLatestPhiBaoHiemRows(sourceUrl)
      : { sourceName: sourceUrl, rows: await fetchSheetRows(sourceUrl) }
    const contracts = source.rows
      .map(toContractRow)
      .filter((row) => row.paidDate && row.paidDate.getMonth() + 1 === reportMonth && row.paidDate.getFullYear() === reportYear)
    const ranked = groupAdvisorRankings(contracts, source.sourceName, { report_month: reportMonth, report_year: reportYear })
    const withAvatars = await attachAvatarsAndSaveAdvisors(ranked)
    await replaceMonthlyRankings(reportMonth, reportYear, withAvatars)
    await logResult({ import_type: 'monthly_rankings', source_name: source.sourceName, status: 'success', total_rows: withAvatars.length, message: `Đã đồng bộ Top tháng ${reportMonth}/${reportYear}.` })
    return { rows: withAvatars, reportMonth, reportYear, sourceName: source.sourceName }
  } catch (error) {
    await logResult({ import_type: 'monthly_rankings', source_name: settings[DATA_SETTING_KEYS.topMonthUrl], status: 'failed', message: error.message, total_rows: 0 })
    throw error
  }
}

export async function syncTeamOverview(settingsOverride = null) {
  const settings = settingsOverride ?? await fetchAppSettings()
  const reportDate = todayIso()
  try {
    const sourceUrl = settings[DATA_SETTING_KEYS.tbtnUrl] || settings[DATA_SETTING_KEYS.topMonthUrl] || settings[DATA_SETTING_KEYS.driveFolderUrl]
    const source = sourceUrl === settings[DATA_SETTING_KEYS.driveFolderUrl]
      ? await fetchLatestPhiBaoHiemRows(sourceUrl)
      : { sourceName: sourceUrl, rows: await fetchSheetRows(sourceUrl) }
    const contracts = source.rows.map(toContractRow).filter(validContract)
    let totalCompanyRevenue = 0
    const teamMap = new Map()
    contracts.forEach((contract) => {
      totalCompanyRevenue += contract.revenue
      const teamName = cleanTeamName(contract.teamName || contract.departmentName)
      if (!teamName) return
      const normalizedTeamName = slugify(teamName)
      if (!normalizedTeamName) return
      const current = teamMap.get(normalizedTeamName) ?? {
        report_date: reportDate,
        team_name: teamName,
        normalized_team_name: normalizedTeamName,
        total_revenue: 0,
        activeAdvisorSet: new Set(),
        contract_count: 0,
      }
      current.total_revenue += contract.revenue
      current.contract_count += 1
      if (contract.normalizedName && contract.normalizedName !== UNGROUPED_SPECIAL_ADVISOR) {
        current.activeAdvisorSet.add(contract.advisorCode || contract.normalizedName)
      }
      teamMap.set(normalizedTeamName, current)
    })
    const rows = [...teamMap.values()]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map((row, index) => ({
        report_date: row.report_date,
        team_name: row.team_name,
        normalized_team_name: row.normalized_team_name,
        total_revenue: row.total_revenue,
        active_advisors: row.activeAdvisorSet.size,
        contract_count: row.contract_count,
        percent_of_company: totalCompanyRevenue ? Number(((row.total_revenue / totalCompanyRevenue) * 100).toFixed(2)) : 0,
        rank: index + 1,
      }))
    await replaceTeamOverview(reportDate, rows)
    await logResult({ import_type: 'team_overview', source_name: source.sourceName, status: 'success', total_rows: rows.length, message: `Đã đồng bộ TBTN. Tổng doanh thu công ty: ${totalCompanyRevenue.toLocaleString('vi-VN')}.` })
    return { rows, reportDate, sourceName: source.sourceName, totalCompanyRevenue }
  } catch (error) {
    await logResult({ import_type: 'team_overview', source_name: settings[DATA_SETTING_KEYS.tbtnUrl], status: 'failed', message: error.message, total_rows: 0 })
    throw error
  }
}

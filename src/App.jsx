import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import {
  Check,
  ChevronLeft,
  FileText,
  Flame,
  Menu,
  Medal,
  Plus,
  Settings,
  Target,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  fetchAdvisorProfiles,
  mergeAdvisorsWithProfiles,
  normalizeName as normalizeAdvisorName,
  uploadAdvisorAvatar,
} from './services/advisorProfiles'
import {
  DATA_SETTING_KEYS,
  fetchImportLogs,
  loadSettingsFromSupabase,
  saveSettingsToSupabase,
} from './services/settingsService'
import { syncDailyRankings, syncMonthlyRankings, syncTeamOverview } from './services/importService'
import { fetchDailyRankings, fetchMonthlyRankings } from './services/rankingService'
import defaultThiDuaBanner from './assets/21fd45f3-37f4-43a5-9929-2b509e8a095e.png'
import defaultTopBanner from './assets/69d1e3d6-07e7-473d-b4e1-d1f4ee7598f1.png'
import './App.css'

const SUPABASE_TABLES = {
  campaigns: 'competitions',
  campaignRankings: 'campaign_rankings',
  banners: 'page_banners',
}

const SUPABASE_BUCKET = 'autorank-assets'

const SHEET_CONFIG = {
  shared: import.meta.env.VITE_GOOGLE_SHEET_URL || import.meta.env.VITE_PUBLIC_GOOGLE_SHEET_URL || '',
  topMonth: import.meta.env.VITE_TOP_THANG_URL || import.meta.env.VITE_TOP_MONTH_URL || '',
  topDay: import.meta.env.VITE_TOP_NGAY_URL || import.meta.env.VITE_TOP_DAY_URL || '',
  teams: import.meta.env.VITE_TBTN_URL || import.meta.env.VITE_TEAM_OVERVIEW_URL || '',
}

const TBTN_STORAGE_KEY = 'autorank_tbtn_rows'
const TBTN_URL_STORAGE_KEY = 'autorank_tbtn_url'
const TOP_DAY_URL_STORAGE_KEY = 'topDaySheetUrl'
const TOP_DAY_LEGACY_URL_STORAGE_KEY = 'autorank_top_ngay_url'

const ADMIN_CREDENTIALS = {
  username: 'bvntkh',
  password: 'hoangvu95',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang diễn ra' },
  { value: 'upcoming', label: 'Sắp diễn ra' },
  { value: 'ended', label: 'Đã kết thúc' },
]

const compactMoneyFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const defaultCampaigns = [
  {
    id: 'c1',
    title: 'Chinh phục tái tục',
    image: '',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'active',
    details: 'Tăng tốc tái tục hợp đồng và duy trì năng suất đội nhóm.',
  },
  {
    id: 'c2',
    title: 'Bứt phá doanh thu',
    image: '',
    startDate: '2026-05-05',
    endDate: '2026-06-05',
    status: 'upcoming',
    details: 'Đẩy mạnh khai thác mới với thưởng nóng theo tuần.',
  },
]

const defaultCampaignRankings = {
  c1: [
    { id: 'cr1', name: 'Huỳnh Thị Thu Lan', team: 'Nguyên Phát', initials: 'HL', revenue: 35105000, avatar: '' },
    { id: 'cr2', name: 'Đặng Trần Khoa', team: 'Khánh Hòa 1', initials: 'ĐK', revenue: 18865100, avatar: '' },
    { id: 'cr3', name: 'Nguyễn Tấn Trung', team: 'Quyết Thắng', initials: 'NT', revenue: 15520305, avatar: '' },
  ],
  c2: [],
}

const TEXT_REPAIRS = {
  '\u81bcang di\u5cc4\u536c ra': 'Đang diễn ra',
  'S\u5cb7\u75ef di\u5cc4\u536c ra': 'Sắp diễn ra',
  '\u81bc\u832b k\u5cb7\u7e2f th\u7164c': 'Đã kết thúc',
  'Nguy\u5cc4\u536c N\u5cc4?\u81bc\u5cc4\u30fd Hi\u5cc4\u4e76': 'Nguyễn Nữ Đức Hiền',
  'Tr\u5cb7\ue734 Th\u5cc4?Minh Th\u5564': 'Trần Thị Minh Thơ',
  'Hu\u5cc4\u7841h Th\u5cc4?Thu Lan': 'Huỳnh Thị Thu Lan',
  'Nguy\u5cc4\u536c T\u5cb7\ue674 Trung': 'Nguyễn Tấn Trung',
  'B\u9709i Th\u5cc4?V\u8292n': 'Bùi Thị Vân',
  '\u81bc\u5cc4?Tr\u5cc4\u5ceeg Nguy\u951an': 'Đỗ Trọng Nguyên',
  'Ho\u813fng Nguy\u5cc4\u536c Lan Chi': 'Hoàng Nguyễn Lan Chi',
  'Ph\u5cb7\ue4f3 Ho\u813fng Ng\u8292n': 'Phạm Hoàng Ngân',
  '\u81bc\u5cb7\u7a58g Tr\u5cb7\ue734 Khoa': 'Đặng Trần Khoa',
  'Nguy\u951an Ph\u8c29t': 'Nguyên Phát',
  'Quy\u5cb7\u7e2f Th\u5cb7\u75edg': 'Quyết Thắng',
  'Thu\u5cb7\u74b6 Ph\u8c29t': 'Thuận Phát',
  'H\u5cc4\u6409g \u81bc\u5cc4\u30fd': 'Hồng Đức',
  'Kh\u8c29nh H\u8c8ca 1': 'Khánh Hòa 1',
  'Kh\u8c29nh H\u8c8ca 2': 'Khánh Hòa 2',
  'Chinh ph\u5cc4\ue669 t\u8c29i t\u5cc4\ue669': 'Chinh phục tái tục',
  'B\u5cc4\ufe56 ph\u8c29 doanh thu': 'Bứt phá doanh thu',
  'T\u74e2 v\u5cb7\ue674 vi\u951an m\u5cc4\u6cac': 'Tư vấn viên mới',
  '\u81bc\u5cc4\u6a8c m\u5cc4\u6cac': 'Đội mới',
  'Ch\u74e2\u5564ng tr\u77dbnh m\u5cc4\u6cac': 'Chương trình mới',
  'M\u4e48 t\u5cb7?ch\u74e2\u5564ng tr\u77dbnh': 'Mô tả chương trình',
}

const mainTabs = [
  { id: 'bang-vang', label: 'Bảng Vàng', icon: Trophy },
  { id: 'thi-dua', label: 'Thi Đua', icon: Flame },
]

const adminTabs = [
  { id: 'data', label: 'Dữ liệu Supabase' },
  { id: 'campaigns', label: 'Chương trình thi đua' },
  { id: 'banners', label: 'Banner' },
]

const bannerPages = [
  {
    id: 'bang-vang',
    label: 'Bảng Vàng',
    title: 'Bảng Xếp Hạng',
    subtitle: 'Vinh danh chiến binh tháng',
    variant: 'leaderboard',
    icon: Trophy,
  },
  {
    id: 'thi-dua',
    label: 'Thi Đua',
    title: 'Thi Đua',
    subtitle: 'Tăng tốc, bứt phá, về đích',
    variant: 'competition',
    icon: Target,
  },
  {
    id: 'admin',
    label: 'Quản Trị',
    title: 'Quản Trị',
    subtitle: 'Quản lý dữ liệu, banner và chương trình',
    variant: 'admin',
    icon: Target,
  },
]

const defaultBanners = bannerPages.reduce((items, page) => ({ ...items, [page.id]: '' }), {})
const bannerPageIds = new Set(bannerPages.map((page) => page.id))
const defaultBannerImages = {
  'bang-vang': defaultTopBanner,
  'thi-dua': defaultThiDuaBanner,
  admin: defaultTopBanner,
}

const getBannerPage = (pageId) =>
  bannerPages.find((page) => page.id === pageId) ?? bannerPages[0]

const generateId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

const getInitials = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TV'

const safeArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback)

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getRawValue = (raw, keys, fallback = '') => {
  if (!raw || typeof raw !== 'object') return fallback

  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key]
  }

  const normalizedEntries = Object.entries(raw).map(([key, value]) => [
    slugify(key),
    value,
  ])
  for (const key of keys) {
    const normalizedKey = slugify(key)
    const match = normalizedEntries.find(([entryKey, value]) => entryKey === normalizedKey && value !== '')
    if (match) return match[1]
  }

  return fallback
}

const normalizeTeamName = (teamName) => {
  let normalized = String(teamName || '').trim().replace(/\s+/g, ' ')
  const prefixPattern = /^(doi|đội|ban|nhom|nhóm|to|tổ|pdt|pđt|ip)\s+/i

  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, '').trim()
  }

  return normalized
}

const displayTeamName = (teamName) => normalizeTeamName(teamName) || 'Chưa cập nhật'

const repairStoredText = (value) => {
  if (typeof value === 'string') return TEXT_REPAIRS[value] ?? value
  if (Array.isArray(value)) return value.map(repairStoredText)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, repairStoredText(item)]),
  )
}

const isValidBannerImage = (image) =>
  typeof image === 'string' &&
  (image === '' || /^https?:\/\//i.test(image))

const normalizeBanners = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultBanners }

  return bannerPages.reduce((items, page) => {
    const image = value[page.id]
    return {
      ...items,
      [page.id]: isValidBannerImage(image) ? image : '',
    }
  }, {})
}

const getBannerImage = (banners, pageId) =>
  typeof banners?.[pageId] === 'string' ? banners[pageId] : ''

const rowsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const getCompetitionStatus = (competition) => {
  if (competition?.published === false) return 'ended'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = parseLocalDate(competition?.start_date ?? competition?.startDate)
  const endDate = parseLocalDate(competition?.end_date ?? competition?.endDate)

  if (startDate && startDate > today) return 'upcoming'
  if (endDate && endDate < today) return 'ended'
  return 'active'
}

const getComputedCompetitionStatus = ({ startDate, start_date, endDate, end_date }) =>
  getCompetitionStatus({
    start_date: start_date ?? startDate,
    end_date: end_date ?? endDate,
    published: true,
  })

const createCampaignDraft = () => ({
  id: generateId('campaign'),
  title: '',
  poster: '',
  image: '',
  startDate: '',
  endDate: '',
  details: '',
  summary: '',
  reward: '',
  target: '',
  rules: '',
  published: true,
})

const fromAdvisorRow = (row) => ({
  id: row.id,
  name: row.name ?? '',
  team: row.team ?? '',
  initials: row.initials ?? getInitials(row.name),
  revenue: normalizeRevenue(row.revenue),
  note: row.note ?? '',
  avatar: row.avatar ?? '',
  active_status: row.active_status ?? true,
  sort_order: Number(row.sort_order ?? 0),
})

const toCampaignRow = (campaign) => ({
  id: String(campaign.id),
  title: campaign.title ?? '',
  poster: campaign.poster ?? campaign.image ?? campaign.image_url ?? '',
  start_date: (campaign.start_date ?? campaign.startDate) || null,
  end_date: (campaign.end_date ?? campaign.endDate) || null,
  summary: campaign.summary ?? campaign.details ?? '',
  details: campaign.details ?? campaign.summary ?? '',
  reward: campaign.reward ?? '',
  target: campaign.target ?? '',
  rules: campaign.rules ?? '',
  published: getComputedCompetitionStatus(campaign) !== 'ended',
})

const fromCampaignRow = (row) => ({
  id: row.id,
  title: row.title ?? '',
  poster: row.poster ?? row.image_url ?? '',
  image: row.poster ?? row.image_url ?? '',
  startDate: row.start_date ?? '',
  endDate: row.end_date ?? '',
  status: getCompetitionStatus(row),
  summary: row.summary ?? '',
  details: row.details ?? row.summary ?? '',
  reward: row.reward ?? '',
  target: row.target ?? '',
  rules: row.rules ?? '',
  published: row.published ?? true,
})

const toCampaignRankingRow = (campaignId, advisor, index = 0) => ({
  id: String(advisor.id),
  campaign_id: String(campaignId),
  name: advisor.name ?? '',
  team: advisor.team ?? '',
  initials: advisor.initials ?? getInitials(advisor.name),
  revenue: normalizeRevenue(advisor.revenue),
  avatar: advisor.avatar ?? '',
  sort_order: index,
})

const fromCampaignRankingRows = (rows) =>
  rows.reduce((items, row) => {
    const campaignId = row.campaign_id
    return {
      ...items,
      [campaignId]: [...safeArray(items[campaignId]), fromAdvisorRow(row)],
    }
  }, {})

const toBannerRow = ([pageId, image]) => ({
  page_id: pageId,
  image: isValidBannerImage(image) ? image : '',
})

const fromBannerRows = (rows) =>
  normalizeBanners(
    rows.reduce((items, row) => ({ ...items, [row.page_id]: row.image ?? '' }), {}),
  )

const replaceTableRows = async (table, idColumn, rows) => {
  const ids = rows.map((row) => String(row[idColumn]).replaceAll('"', '""'))
  const query = supabase.from(table).delete()
  const { error: deleteError } = ids.length
    ? await query.not(idColumn, 'in', `("${ids.join('","')}")`)
    : await query.neq(idColumn, '__autorank_keep_none__')

  if (deleteError) throw deleteError
  if (!rows.length) return

  const { error } = await supabase.from(table).upsert(rows, { onConflict: idColumn })
  if (error) throw error
}

const fetchCompetitionRows = async () => {
  console.log('loading competitions from supabase')
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

const loadSupabaseData = async () => {
  const [campaignRows, rankingsResult, bannersResult] = await Promise.all([
    fetchCompetitionRows(),
    supabase
      .from(SUPABASE_TABLES.campaignRankings)
      .select('*')
      .order('campaign_id', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from(SUPABASE_TABLES.banners).select('*'),
  ])

  const results = [rankingsResult, bannersResult]
  const failed = results.find((result) => result.error)
  if (failed) throw failed.error
  console.log('Loaded competitions from Supabase', campaignRows)

  return {
    advisors: [],
    campaigns: campaignRows.map(fromCampaignRow),
    campaignRankings: fromCampaignRankingRows(rankingsResult.data),
    banners: fromBannerRows(bannersResult.data),
    isEmpty:
      !campaignRows.length &&
      !rankingsResult.data.length &&
      !bannersResult.data.length,
  }
}

const saveSupabaseData = async ({ campaignRankings, banners }) => {
  const rankingRows = Object.entries(campaignRankings).flatMap(([campaignId, rows]) =>
    safeArray(rows).map((advisor, index) => toCampaignRankingRow(campaignId, advisor, index)),
  )
  await replaceTableRows(SUPABASE_TABLES.campaignRankings, 'id', rankingRows)

  await replaceTableRows(
    SUPABASE_TABLES.banners,
    'page_id',
    Object.entries(normalizeBanners(banners)).map(toBannerRow),
  )
}

const saveCompetitionToSupabase = async (competition) => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Không thể lưu chương trình thi đua.')
  }

  const row = toCampaignRow(competition)
  console.log('saving competition to supabase', row)
  const { data, error } = await supabase
    .from('competitions')
    .upsert(row, { onConflict: 'id' })
    .select('*')

  if (error) {
    console.error('supabase insert error', error)
    throw error
  }

  console.log('supabase insert success', data)
  return data
}

const deleteCompetitionFromSupabase = async (id) => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Không thể xóa chương trình thi đua.')
  }
  const { error } = await supabase.from('competitions').delete().eq('id', id)
  if (error) throw error
  console.log('Deleted competition from Supabase', id)
}

const getFileExtension = (file) => {
  const fromName = file?.name?.split('.').pop()
  if (fromName && fromName !== file.name) return fromName.toLowerCase()
  return file?.type?.split('/').pop()?.toLowerCase() || 'png'
}

const uploadImageToStorage = async (file, folder) => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Hãy đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
  if (!file?.type?.startsWith('image/')) return ''

  const extension = getFileExtension(file)
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  console.log('Upload image to Supabase Storage success', data.publicUrl)
  return data.publicUrl
}

const normalizeRevenue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').trim()
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseMoney = (value) => normalizeRevenue(value)

const formatCompactMoney = (revenue) =>
  `${compactMoneyFormatter.format(Number(revenue || 0) / 1000000)}tr`

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(normalizeRevenue(value))

const formatPlainVnd = (value) =>
  `${normalizeRevenue(value).toLocaleString('vi-VN')} đ`

const formatTbtnMoney = (value) =>
  `${Number(normalizeRevenue(value) || 0).toLocaleString('vi-VN')} đ`

const normalizeInteger = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

const formatStatusLabel = (status) =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Chưa xác định'

const parseLocalDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const sortByRevenueDesc = (rows) =>
  [...rows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))

function normalizeImportedAdvisor(raw, index = 0) {
  const name = getRawValue(raw, [
    'Họ tên',
    'Họ và tên',
    'Tên đại lý',
    'Tên tư vấn viên',
    'Ten tu van vien',
    'Tên TVV',
    'Ten TVV',
    'Ten dai ly',
    'Ho ten',
    'Name',
    'name',
    'H峄?t锚n',
    'H峄?v脿 t锚n',
  ])
  const team = getRawValue(raw, [
    'Đội',
    'Tên nhóm',
    'Nhóm',
    'Nhom',
    'Đội',
    'Doi',
    'Doi',
    'Ten nhom',
    'Nhom',
    'Team',
    'team',
    '膼峄檌',
    'T锚n 膽峄檌',
    'T锚n 膼峄檌',
    'T锚n Nh贸m',
    'T锚n nh贸m',
    '膼峄檌 nh贸m',
  ])
  const initials = getRawValue(raw, ['Viết tắt', 'Viet tat', 'Initials', 'initials'], getInitials(name))
  const revenue = getRawValue(raw, ['Doanh thu', 'doanh thu', 'AFYP', 'Tổng AFYP', 'Tong AFYP', 'Revenue', 'revenue'], 0)
  const note = getRawValue(raw, ['Ghi chú', 'Ghi chu', 'Note', 'note'])
  const avatar = getRawValue(raw, ['Avatar', 'Avatar URL', 'avatar'])
  const activeStatus = getRawValue(raw, ['active_status', 'Trạng thái', 'Trang thai', 'Active'], true)
  const rawId = getRawValue(raw, [
    'id',
    'ID',
    'Mã',
    'Ma',
    'Mã TVV',
    'Ma TVV',
    'Mã đại lý',
    'Ma dai ly',
    'Advisor code',
    'advisor_code',
    'Code',
    'code',
  ])

  if (!String(name).trim()) return null
  const normalizedName = String(name).trim()
  const stableId = rawId ? String(rawId).trim() : `advisor-${slugify(normalizedName) || crypto.randomUUID()}`

  return {
    id: stableId,
    advisor_code: rawId ? String(rawId).trim() : '',
    normalized_name: normalizeAdvisorName(normalizedName),
    name: normalizedName,
    team: String(team || '').trim(),
    initials: String(initials || getInitials(name)).toUpperCase().slice(0, 2),
    revenue: normalizeRevenue(revenue),
    note: String(note || '').trim(),
    avatar: String(avatar || '').trim(),
    active_status: activeStatus === true || !['false', '0', 'inactive', 'ngung', 'ngừng'].includes(String(activeStatus).trim().toLowerCase()),
    sort_order: index,
  }
}

function normalizeImportedTeam(raw, index = 0) {
  const stt = getRawValue(raw, ['STT', 'stt', 'No', 'So thu tu'], index + 1)
  const name = getRawValue(raw, ['Tên nhóm', 'Ten nhom', 'tenNhom', 'Nhóm', 'nhom', 'Nhom', 'team', 'Team'])
  const leader = getRawValue(raw, [
    'Tên trưởng nhóm',
    'tenTruongNhom',
    'Trưởng nhóm',
    'truongNhom',
    'Truong nhom',
    'Leader',
    'leader',
  ])
  const avatar = getRawValue(raw, [
    'avatarTruongNhom',
    'Avatar trưởng nhóm',
    'Avatar truong nhom',
    'Avatar',
    'avatar',
  ])
  const revenue = getRawValue(raw, [
    'Tổng AFYP',
    'Tong AFYP',
    'Doanh thu của nhóm',
    'Doanh thu',
    'doanhThu',
    'doanhThuNhom',
    'Revenue',
    'AFYP',
  ], 0)
  const contracts = getRawValue(raw, ['Số lượng hợp đồng', 'Hợp đồng', 'soHopDong', 'So hop dong', 'Hop dong', 'contracts'], 0)
  const activeTvv = getRawValue(raw, [
    'Số lượng TVV có hợp đồng',
    'So luong TVV co hop dong',
    'Số lượng TVV hoạt động',
    'TVV hoạt động',
    'tvvHoatDong',
    'soLuongTVVHoatDong',
    'TVV hoat dong',
    'activeTvv',
  ], 0)
  const yesterday = getRawValue(raw, ['doanhThuHomQua', 'Doanh thu hôm qua', 'Doanh thu hom qua'], 0)
  const today = getRawValue(raw, ['doanhThuHomNay', 'Doanh thu hôm nay', 'Doanh thu hom nay'], 0)
  const nextReward = getRawValue(raw, [
    'mocThuongTiepTheo',
    'Mốc thưởng tiếp theo',
    'Moc thuong tiep theo',
    'Moc thuong',
  ], 0)

  if (!String(name).trim()) return null
  const teamName = String(name).trim()
  const normalizedName = slugify(teamName)

  return {
    id: `team-${slugify(teamName) || index}`,
    stt: normalizeInteger(stt) || index + 1,
    tenNhom: teamName,
    truongNhom: String(leader || '').trim(),
    avatarTruongNhom: String(avatar || '').trim(),
    doanhThu: parseMoney(revenue),
    soHopDong: Number(contracts || 0) || 0,
    tvvHoatDong: normalizeInteger(activeTvv),
    doanhThuHomQua: normalizeRevenue(yesterday),
    doanhThuHomNay: normalizeRevenue(today),
    mocThuongTiepTheo: normalizeRevenue(nextReward),
    isSpecial: normalizedName.includes('le-thi-my-chau') || normalizedName.includes('khong-thuoc-nhom-ban'),
    isCompanyTotal: normalizedName === 'tong-toan-bo' || normalizedName.includes('tong-toan-bo'),
    sort_order: index,
  }
}

function buildTbtnDataset(rows = []) {
  const normalized = safeArray(rows).map(normalizeImportedTeam).filter(Boolean)
  const totalRow = normalized.find((team) => team.isCompanyTotal) || null
  const specialRow = normalized.find((team) => team.isSpecial && !team.isCompanyTotal) || null
  const groups = normalized
    .filter((team) => !team.isCompanyTotal && !team.isSpecial)
    .sort((a, b) => (a.stt || a.sort_order) - (b.stt || b.sort_order))

  return { groups, specialRow, totalRow }
}

const calculateGrowth = (team) =>
  normalizeRevenue(team?.doanhThuHomNay) - normalizeRevenue(team?.doanhThuHomQua)

const calculateRewardProgress = (team) => {
  const target = normalizeRevenue(team?.mocThuongTiepTheo)
  if (target <= 0) return { conThieu: 0, progress: 0, isReached: false }

  const revenue = normalizeRevenue(team?.doanhThu)
  const conThieu = target - revenue
  return {
    conThieu,
    progress: Math.max(0, Math.min(100, (revenue / target) * 100)),
    isReached: conThieu <= 0,
  }
}

const getTeamStatus = (team) => {
  const growth = calculateGrowth(team)
  const reward = calculateRewardProgress(team)
  if (reward.isReached) return { label: 'Đã đạt mốc', tone: 'reached' }
  if (reward.progress >= 80) return { label: 'Gần đạt mốc', tone: 'near' }
  if (growth > 0) return { label: 'Đang bứt phá', tone: 'breakout' }
  return { label: 'Cần tăng tốc', tone: 'speedup' }
}

function parseCsvTextToObjects(text) {
  const workbook = XLSX.read(text, { type: 'string' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
}

function getGoogleSheetGid(url) {
  const parsedUrl = new URL(String(url || '').trim())
  const queryGid = parsedUrl.searchParams.get('gid')
  if (queryGid) return queryGid

  const hashGid = String(parsedUrl.hash || '').match(/gid=(\d+)/)?.[1]
  return hashGid || '0'
}

function getGoogleSheetId(url) {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error('Link Google Sheet không hợp lệ.')
  return match[1]
}

function createGoogleSheetCsvExportUrl(url) {
  const spreadsheetId = getGoogleSheetId(url)
  const gid = getGoogleSheetGid(url)
  return {
    gid,
    csvUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
  }
}

function convertGoogleSheetUrlToCsvUrl(url, sheetName = '') {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Link Google Sheet không hợp lệ.')
  }

  const spreadsheetId = match[1]
  const parsedUrl = new URL(url)
  const hashGid = String(parsedUrl.hash || '').match(/gid=(\d+)/)?.[1]
  const gid = parsedUrl.searchParams.get('gid') || hashGid || '0'
  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  }
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
}

const normalizeSheetHeader = (value) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const TBTN_HEADER_ALIASES = {
  stt: ['stt', 'so thu tu'],
  name: ['ten nhom', 'nhom', 'doi', 'ten doi', 'ten ban'],
  revenue: ['tong afyp', 'afyp', 'tong doanh thu', 'doanh thu'],
  tvv: ['so luong tvv co hop dong', 'sl tvv', 'tvv co hop dong', 'so tvv'],
}

const headerMatches = (header, aliases) =>
  aliases.some((alias) => header === alias || header.includes(alias) || alias.includes(header))

function createTbtnHeaderMap(headers) {
  const normalized = headers.map((header) => ({
    raw: header,
    normalized: normalizeSheetHeader(header),
  }))
  const findHeader = (aliases) => normalized.find((header) => headerMatches(header.normalized, aliases))?.raw || ''
  const headerMap = {
    stt: findHeader(TBTN_HEADER_ALIASES.stt),
    name: findHeader(TBTN_HEADER_ALIASES.name),
    revenue: findHeader(TBTN_HEADER_ALIASES.revenue),
    tvv: findHeader(TBTN_HEADER_ALIASES.tvv),
  }
  const missing = []
  if (!headerMap.stt) missing.push('STT')
  if (!headerMap.name) missing.push('Tên nhóm')
  if (!headerMap.revenue) missing.push('Tổng AFYP')
  if (!headerMap.tvv) missing.push('Số lượng TVV có hợp đồng')
  if (missing.length) {
    const foundHeaders = headers.map((header) => `"${String(header).replace(/^\uFEFF/, '').trim()}"`).join(', ')
    throw new Error(`Không tìm thấy header TBTN: ${missing.join(', ')}. Header đọc được: ${foundHeaders || '(trống)'}. Hãy copy link đúng tab sheet đang chứa dữ liệu TBTN.`)
  }
  return headerMap
}

const isEmptyCsvCell = (value) => String(value ?? '').trim() === ''

function createTbtnObjectsFromMatrix(matrix) {
  const rows = safeArray(matrix).filter((row) => safeArray(row).some((cell) => !isEmptyCsvCell(cell)))
  const searchRows = rows.slice(0, 10)
  const headerIndex = searchRows.findIndex((row) => {
    const normalizedHeaders = safeArray(row).map(normalizeSheetHeader)
    return (
      normalizedHeaders.some((header) => headerMatches(header, TBTN_HEADER_ALIASES.stt)) &&
      normalizedHeaders.some((header) => headerMatches(header, TBTN_HEADER_ALIASES.name)) &&
      normalizedHeaders.some((header) => headerMatches(header, TBTN_HEADER_ALIASES.revenue))
    )
  })

  if (headerIndex < 0) {
    const sampledHeaders = searchRows
      .flatMap((row) => safeArray(row).map((cell) => String(cell ?? '').trim()).filter(Boolean))
      .slice(0, 12)
      .join(', ')
    throw new Error(`Không tìm thấy header TBTN: STT, Tên nhóm, Tổng AFYP. Header đọc được: ${sampledHeaders || '(trống)'}. Google Sheet chưa public hoặc fetch sai sheet.`)
  }

  const headers = safeArray(rows[headerIndex]).map((header) => String(header ?? '').replace(/^\uFEFF/, '').trim())
  const headerMap = createTbtnHeaderMap(headers)
  const bodyRows = rows.slice(headerIndex + 1)

  return bodyRows.map((row, index) => {
    const item = {}
    headers.forEach((header, columnIndex) => {
      if (!header) return
      item[header] = row[columnIndex] ?? ''
    })

    return {
      ...item,
      STT: item[headerMap.stt] ?? index + 1,
      'Ten nhom': item[headerMap.name] ?? '',
      'Tong AFYP': item[headerMap.revenue] ?? 0,
      'So luong TVV co hop dong': item[headerMap.tvv] ?? 0,
    }
  })
}

function parseTbtnCsvText(csvText) {
  const parsed = Papa.parse(String(csvText || '').replace(/^\uFEFF/, ''), {
    skipEmptyLines: true,
  })
  if (parsed.errors?.length) console.log('[TBTN] PapaParse errors', parsed.errors)
  return createTbtnObjectsFromMatrix(parsed.data)
}
async function fetchTBTNData(url) {
  if (!url?.trim()) throw new Error('Chưa có link Google Sheet TBTN.')

  const googleSheetUrl = url.trim()
  const isGoogleSheet = googleSheetUrl.includes('docs.google.com')
  const { gid, csvUrl } = isGoogleSheet
    ? createGoogleSheetCsvExportUrl(googleSheetUrl)
    : { gid: '0', csvUrl: googleSheetUrl }

  console.log('TBTN Sheet URL:', googleSheetUrl)
  console.log('TBTN gid:', gid)
  console.log('TBTN CSV URL:', csvUrl)

  const response = await fetch(csvUrl)
  if (!response.ok) {
    throw new Error(`Không fetch được Google Sheet TBTN. Mã lỗi ${response.status}. Kiểm tra quyền xem công khai.`)
  }

  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  if (!text.trim() || /<html/i.test(text) || /<!DOCTYPE/i.test(text) || /Google Docs/i.test(text)) {
    throw new Error('Google Sheet chưa public hoặc fetch sai sheet.')
  }
  if (
    !text.trim() ||
    contentType.includes('text/html') ||
    /<html/i.test(text) ||
    /<!DOCTYPE/i.test(text) ||
    /Google Docs/i.test(text)
  ) {
    throw new Error('Sheet chưa bật quyền xem công khai hoặc link không trỏ tới dữ liệu CSV.')
  }

  let rows
  try {
    rows = parseTbtnCsvText(text)
  } catch (parseError) {
    console.error('[TBTN] CSV parse error', parseError)
    throw parseError instanceof Error ? parseError : new Error('Không parse được CSV TBTN.')
  }

  console.log('[TBTN] csv row count', rows.length)
  console.log('[TBTN] headers found', Object.keys(rows[0] || {}))

  const normalized = rows.map(normalizeImportedTeam).filter(Boolean)
  const dataset = buildTbtnDataset(normalized)
  console.log('[TBTN] parsed group count', dataset.groups.length)
  console.log('[TBTN] company total revenue', dataset.totalRow?.doanhThu ?? 0)

  if (!normalized.length) throw new Error('CSV TBTN không có dòng dữ liệu hợp lệ.')
  return normalized
}

function loadStoredTbtnRows() {
  try {
    const stored = window.localStorage.getItem(TBTN_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return safeArray(parsed).map(normalizeImportedTeam).filter(Boolean)
  } catch {
    return []
  }
}

async function fetchSheetRows(url, sheetName = '') {
  if (!url) return []
  const finalUrl = url.includes('docs.google.com') ? convertGoogleSheetUrlToCsvUrl(url, sheetName) : url
  const response = await fetch(finalUrl)
  if (!response.ok) throw new Error(`Không lấy được dữ liệu. Mã lỗi ${response.status}.`)

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await response.json()
    if (Array.isArray(json)) return json
    if (Array.isArray(json?.data)) return json.data
    throw new Error('JSON không đúng định dạng mảng dữ liệu.')
  }

  const text = await response.text()
  if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
    throw new Error('Không lấy được dữ liệu. Hãy bật quyền xem Google Sheet cho người có link.')
  }
  return parseCsvTextToObjects(text)
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname || '/')

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || '/')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPath) => {
    if (nextPath === pathname) return
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  return [pathname, navigate]
}

function App() {
  const [pathname, navigate] = usePathname()
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const hasHydratedSupabase = useRef(!isSupabaseConfigured)
  const isApplyingRemoteData = useRef(false)
  const [advisors, setAdvisors] = useState([])
  const [campaigns, setCampaigns] = useState(() =>
    safeArray(repairStoredText(defaultCampaigns), defaultCampaigns),
  )
  const [campaignRankings, setCampaignRankings] = useState(() => {
    const defaults = repairStoredText(defaultCampaignRankings)
    return defaults && typeof defaults === 'object' ? defaults : defaultCampaignRankings
  })
  const [banners, setBanners] = useState(() => normalizeBanners(defaultBanners))
  const [tbtnRows] = useState(() => loadStoredTbtnRows())
  const [tbtnSheetUrl] = useState(
    () => SHEET_CONFIG.teams || window.localStorage.getItem(TBTN_URL_STORAGE_KEY) || '',
  )
  const [topDaySheetUrl, setTopDaySheetUrl] = useState(
    () =>
      SHEET_CONFIG.topDay ||
      window.localStorage.getItem(TOP_DAY_URL_STORAGE_KEY) ||
      window.localStorage.getItem(TOP_DAY_LEGACY_URL_STORAGE_KEY) ||
      '',
  )
  const [topDayAdvisors, setTopDayAdvisors] = useState([])
  const [dataSettings, setDataSettings] = useState({
    [DATA_SETTING_KEYS.topMonthUrl]: SHEET_CONFIG.topMonth || window.localStorage.getItem('autorank_top_thang_url') || '',
    [DATA_SETTING_KEYS.topDayUrl]: SHEET_CONFIG.topDay || '',
    [DATA_SETTING_KEYS.tbtnUrl]: SHEET_CONFIG.teams || window.localStorage.getItem(TBTN_URL_STORAGE_KEY) || '',
  })

  const applyRemoteData = useCallback((remoteData) => {
    isApplyingRemoteData.current = true

    setAdvisors((current) => (rowsEqual(current, remoteData.advisors) ? current : remoteData.advisors))
    setCampaigns((current) => (rowsEqual(current, remoteData.campaigns) ? current : remoteData.campaigns))
    setCampaignRankings((current) =>
      rowsEqual(current, remoteData.campaignRankings) ? current : remoteData.campaignRankings,
    )
    setBanners((current) => {
      const remoteBanners = normalizeBanners(remoteData.banners)
      return rowsEqual(normalizeBanners(current), remoteBanners) ? current : remoteBanners
    })

    window.setTimeout(() => {
      isApplyingRemoteData.current = false
    }, 0)
  }, [])

  const fetchCompetitions = useCallback(async () => {
    if (!isSupabaseConfigured) return []
    const rows = await fetchCompetitionRows()
    const remoteCampaigns = rows.map(fromCampaignRow)
    setCampaigns((current) => (rowsEqual(current, remoteCampaigns) ? current : remoteCampaigns))
    return remoteCampaigns
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let isMounted = true
    let reloadTimer = null

    const reloadFromSupabase = async () => {
      try {
        const remoteData = await loadSupabaseData()
        if (!isMounted) return

        applyRemoteData(remoteData)
        const remoteSettings = await loadSettingsFromSupabase()
        if (!isMounted) return
        setDataSettings((current) => ({ ...current, ...remoteSettings }))
        if (remoteSettings[DATA_SETTING_KEYS.topDayUrl]) setTopDaySheetUrl(remoteSettings[DATA_SETTING_KEYS.topDayUrl])

        hasHydratedSupabase.current = true
      } catch (supabaseError) {
        console.error(supabaseError)
        window.alert(`Không thể tải dữ liệu từ Supabase: ${supabaseError?.message ?? supabaseError}`)
        hasHydratedSupabase.current = true
      }
    }

    const scheduleReload = () => {
      window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(reloadFromSupabase, 150)
    }

    reloadFromSupabase()

    const channel = supabase
      .channel('autorank-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLES.campaigns }, scheduleReload)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SUPABASE_TABLES.campaignRankings },
        scheduleReload,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLES.banners }, scheduleReload)
      .subscribe()

    return () => {
      isMounted = false
      window.clearTimeout(reloadTimer)
      supabase.removeChannel(channel)
    }
  }, [applyRemoteData])

  useEffect(() => {
    if (!isSupabaseConfigured || !hasHydratedSupabase.current || isApplyingRemoteData.current) return

    saveSupabaseData({
      advisors,
      campaignRankings,
      banners: normalizeBanners(banners),
    }).catch((supabaseError) => {
      console.error(supabaseError)
    })
  }, [advisors, campaignRankings, banners])

  useEffect(() => {
    try {
      window.localStorage.setItem(TBTN_STORAGE_KEY, JSON.stringify(tbtnRows))
    } catch (storageError) {
      console.error(storageError)
    }
  }, [tbtnRows])

  if (pathname === '/admin') {
    return (
      <AdminView
        campaigns={campaigns}
        campaignRankings={campaignRankings}
        banners={banners}
        isAdminLoggedIn={isAdminLoggedIn}
        setAdvisors={setAdvisors}
        setCampaignRankings={setCampaignRankings}
        setBanners={setBanners}
        tbtnSheetUrl={tbtnSheetUrl}
        topDaySheetUrl={topDaySheetUrl}
        setTopDaySheetUrl={setTopDaySheetUrl}
        dataSettings={dataSettings}
        setDataSettings={setDataSettings}
        setTopDayAdvisors={setTopDayAdvisors}
        setIsAdminLoggedIn={setIsAdminLoggedIn}
        fetchCompetitions={fetchCompetitions}
        navigate={navigate}
      />
    )
  }

  return (
    <MainView
      advisors={advisors}
      campaigns={campaigns}
      campaignRankings={campaignRankings}
      banners={banners}
      setBanners={setBanners}
      tbtnRows={tbtnRows}
      tbtnSheetUrl={tbtnSheetUrl}
      topDaySheetUrl={topDaySheetUrl}
      dataSettings={dataSettings}
      topDayAdvisors={topDayAdvisors}
      setTopDayAdvisors={setTopDayAdvisors}
      navigate={navigate}
    />
  )
}

function MobileAppShell({ children, bottomNav = null, className = '' }) {
  return (
    <>
      <div className="mobile-page">
        <div className={`mobile-shell ${className}`.trim()}>
          {children}
        </div>
      </div>
      {bottomNav}
    </>
  )
}

function MainView({
  advisors,
  campaigns,
  campaignRankings,
  banners,
  setBanners,
  tbtnRows,
  tbtnSheetUrl,
  topDaySheetUrl,
  dataSettings,
  topDayAdvisors,
  setTopDayAdvisors,
  navigate,
}) {
  const [activeTab, setActiveTab] = useState('bang-vang')
  const [activeScreen, setActiveScreen] = useState('main')
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const menuTabRef = useRef(null)
  const [rankingPeriod, setRankingPeriod] = useState('month')
  const [leaderboardAnimationKey, setLeaderboardAnimationKey] = useState(0)
  const [competitionFilter, setCompetitionFilter] = useState('active')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [modalType, setModalType] = useState(null)
  const [remoteRankings, setRemoteRankings] = useState({
    month: { rows: [], loading: false, error: '' },
    day: { rows: [], loading: false, error: '' },
  })
  const [teamOverview, setTeamOverview] = useState({
    rows: tbtnRows,
    loading: false,
    error: '',
  })

  useEffect(() => {
    const hasStoredGroups = buildTbtnDataset(tbtnRows).groups.length > 0
    setTeamOverview((current) => {
      if (hasStoredGroups) return { ...current, rows: tbtnRows, error: '' }
      return current.loading || current.error ? current : { ...current, rows: tbtnRows }
    })
  }, [tbtnRows])

  const configuredSheets = useMemo(() => {
    const local = (key) => window.localStorage.getItem(key) || ''
    return {
      shared: SHEET_CONFIG.shared || local('autorank_google_sheet_url'),
      topMonth: dataSettings?.[DATA_SETTING_KEYS.topMonthUrl] || SHEET_CONFIG.topMonth || local('autorank_top_thang_url'),
      topDay: dataSettings?.[DATA_SETTING_KEYS.topDayUrl] || topDaySheetUrl || SHEET_CONFIG.topDay || local(TOP_DAY_URL_STORAGE_KEY) || local(TOP_DAY_LEGACY_URL_STORAGE_KEY),
      teams: dataSettings?.[DATA_SETTING_KEYS.tbtnUrl] || tbtnSheetUrl || local(TBTN_URL_STORAGE_KEY),
    }
  }, [tbtnSheetUrl, topDaySheetUrl, dataSettings])

  useEffect(() => {
    if (isSupabaseConfigured) {
      let isMounted = true
      const loadRankingsFromSupabase = async () => {
        setRemoteRankings((current) => ({
          month: { ...current.month, loading: true, error: '' },
          day: { ...current.day, loading: true, error: '' },
        }))
        try {
          const [monthlyRows, dailyRows] = await Promise.all([
            fetchMonthlyRankings(),
            fetchDailyRankings(),
          ])
          if (!isMounted) return
          setTopDayAdvisors(dailyRows)
          setRemoteRankings({
            month: { rows: monthlyRows, loading: false, error: '' },
            day: { rows: dailyRows, loading: false, error: '' },
          })
        } catch (error) {
          if (!isMounted) return
          setRemoteRankings((current) => ({
            month: { ...current.month, loading: false, error: error?.message ?? 'Không tải được Top tháng.' },
            day: { ...current.day, loading: false, error: error?.message ?? 'Không tải được Top ngày.' },
          }))
        }
      }
      loadRankingsFromSupabase()
      return () => {
        isMounted = false
      }
    }

    const loadRankings = async () => {
      const configs = [
        ['month', configuredSheets.topMonth || configuredSheets.shared, 'TopThang'],
        ['day', configuredSheets.topDay, 'TopNgay'],
      ]

      configs.forEach(async ([period, url, sheetName]) => {
        if (!url) return
        setRemoteRankings((current) => ({
          ...current,
          [period]: { ...current[period], loading: true, error: '' },
        }))
        try {
          const rows = period === 'day' ? await fetchSheetRows(url) : await fetchSheetRows(url, sheetName)
          const normalizedRows = sortByRevenueDesc(rows.map(normalizeImportedAdvisor).filter(Boolean)).slice(0, 10)
          const profiles = isSupabaseConfigured ? await fetchAdvisorProfiles() : []
          const normalized = mergeAdvisorsWithProfiles(normalizedRows, profiles)
          if (period === 'day') setTopDayAdvisors(normalized)
          setRemoteRankings((current) => ({
            ...current,
            [period]: { rows: normalized, loading: false, error: '' },
          }))
        } catch (error) {
          setRemoteRankings((current) => ({
            ...current,
            [period]: { rows: [], loading: false, error: error?.message ?? 'Không lấy được dữ liệu.' },
          }))
        }
      })
    }

    loadRankings()
  }, [configuredSheets, setTopDayAdvisors])

  useEffect(() => {
    const url = configuredSheets.teams || configuredSheets.shared
    if (!url) {
      setTeamOverview((current) => ({ ...current, rows: tbtnRows, loading: false, error: '' }))
      return
    }

    let isMounted = true
    const loadTeams = async () => {
      setTeamOverview((current) => ({ ...current, loading: true, error: '' }))
      try {
        const rows = await fetchTBTNData(url)
        if (!isMounted) return
        setTeamOverview({
          rows,
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) return
        const hasStoredGroups = buildTbtnDataset(tbtnRows).groups.length > 0
        setTeamOverview({
          rows: tbtnRows,
          loading: false,
          error: hasStoredGroups ? '' : error?.message ?? 'Không lấy được dữ liệu.',
        })
      }
    }

    loadTeams()
    return () => {
      isMounted = false
    }
  }, [configuredSheets, tbtnRows])

  const topMonthRows = remoteRankings.month.rows.length ? remoteRankings.month.rows : advisors
  const topDayRows = topDayAdvisors.length ? topDayAdvisors : remoteRankings.day.rows
  console.log('Top day advisors for render:', topDayAdvisors)
  const activeLeaderboardRows = rankingPeriod === 'day' ? topDayRows : topMonthRows
  const activeRankingState = remoteRankings[rankingPeriod]
  const activeRankingError = rankingPeriod === 'day' && topDayRows.length ? '' : activeRankingState.error
  const activeRankingLoading = rankingPeriod === 'day' && topDayRows.length ? false : activeRankingState.loading
  const sortedAdvisors = useMemo(
    () => sortByRevenueDesc(activeLeaderboardRows).slice(0, 10),
    [activeLeaderboardRows],
  )
  const podium = [sortedAdvisors[1], sortedAdvisors[0], sortedAdvisors[2]].filter(Boolean)
  const rankingRows = sortedAdvisors.slice(3)
  const filteredCampaigns = campaigns.filter((campaign) => campaign.status === competitionFilter)
  const counts = {
    active: campaigns.filter((item) => item.status === 'active').length,
    upcoming: campaigns.filter((item) => item.status === 'upcoming').length,
    ended: campaigns.filter((item) => item.status === 'ended').length,
  }

  useEffect(() => {
    if (!isMoreMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (menuTabRef.current?.contains(event.target)) return
      setIsMoreMenuOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isMoreMenuOpen])

  const closeModal = () => {
    setSelectedCampaign(null)
    setModalType(null)
  }

  const updatePageBanner = async (pageId, file) => {
    if (!bannerPageIds.has(pageId) || !file?.type?.startsWith('image/')) return

    try {
      const image = await uploadImageToStorage(file, `banners/${pageId}`)
      if (!image) return
      setBanners((current) => ({ ...normalizeBanners(current), [pageId]: image }))
    } catch (uploadError) {
      console.error(uploadError)
      setBanners((current) => ({ ...normalizeBanners(current), [pageId]: '' }))
    }
  }

  const bottomNav = (
    <nav className="bottom-tabs">
      {mainTabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => {
              setActiveScreen('main')
              setActiveTab(tab.id)
              if (tab.id === 'bang-vang') {
                setLeaderboardAnimationKey((current) => current + 1)
              }
            }}
          >
            <span className="round-icon bottom-tab__icon">
              <Icon size={20} />
            </span>
            <span className="bottom-tab__label">{tab.label}</span>
          </button>
        )
      })}
      <div className="menu-tab-wrapper" ref={menuTabRef}>
        <button
          type="button"
          className={`bottom-tab ${isMoreMenuOpen ? 'is-active' : ''}`}
          onClick={() => setIsMoreMenuOpen((current) => !current)}
        >
          <span className="round-icon bottom-tab__icon">
            <Menu size={20} />
          </span>
          <span className="bottom-tab__label">Menu</span>
        </button>
        <MoreMenuBottomSheet
          open={isMoreMenuOpen}
          onClose={() => setIsMoreMenuOpen(false)}
          onOpenTbtn={() => {
            setIsMoreMenuOpen(false)
            setActiveScreen('tbtn')
          }}
        />
      </div>
    </nav>
  )

  return (
    <MobileAppShell className="main-shell" bottomNav={bottomNav}>
      <main className="mobile-content mobile-scroll">
          {activeScreen === 'tbtn' && (
            <TeamOverviewPage
              teams={teamOverview.rows}
              isLoading={teamOverview.loading}
              error={teamOverview.error}
              onBack={() => setActiveScreen('main')}
            />
          )}
          {activeScreen === 'main' && activeTab === 'bang-vang' && (
            <BangVangTab
              key={`bang-vang-${leaderboardAnimationKey}`}
              podium={podium}
              rankingRows={rankingRows}
              advisors={sortedAdvisors}
              advisorCount={sortedAdvisors.length}
              rankingPeriod={rankingPeriod}
              onRankingPeriodChange={(period) => {
                setRankingPeriod(period)
                setLeaderboardAnimationKey((current) => current + 1)
              }}
              isLoading={activeRankingLoading}
              error={activeRankingError}
              bannerImage={getBannerImage(banners, 'bang-vang')}
              onBannerUpload={(file) => updatePageBanner('bang-vang', file)}
              onAdminAccess={() => navigate('/admin')}
            />
          )}
          {activeScreen === 'main' && activeTab === 'thi-dua' && (
            <ThiDuaTab
              campaigns={filteredCampaigns}
              campaignRankings={campaignRankings}
              counts={counts}
              currentFilter={competitionFilter}
              onFilterChange={setCompetitionFilter}
              onOpenDetail={(campaign) => {
                setSelectedCampaign(campaign)
                setModalType('detail')
              }}
              onOpenRanking={(campaign) => {
                setSelectedCampaign(campaign)
                setModalType('ranking')
              }}
              onOpenPoster={(campaign) => {
                setSelectedCampaign(campaign)
                setModalType('poster')
              }}
              bannerImage={getBannerImage(banners, 'thi-dua')}
              onBannerUpload={(file) => updatePageBanner('thi-dua', file)}
              onAdminAccess={() => navigate('/admin')}
            />
          )}
      </main>

        {selectedCampaign && modalType === 'detail' && (
          <DetailModal campaign={selectedCampaign} onClose={closeModal} />
        )}
        {selectedCampaign && modalType === 'ranking' && (
          <RankingModal
            campaign={selectedCampaign}
            rankings={sortByRevenueDesc(campaignRankings[selectedCampaign.id] ?? [])}
            onClose={closeModal}
          />
        )}
        {selectedCampaign && modalType === 'poster' && (
          <PosterModal campaign={selectedCampaign} onClose={closeModal} />
        )}
    </MobileAppShell>
  )
}

function BangVangTab({
  podium,
  rankingRows,
  advisors,
  advisorCount,
  rankingPeriod,
  onRankingPeriodChange,
  isLoading,
  error,
  bannerImage,
  onBannerUpload,
  onAdminAccess,
}) {
  const hasAdvisors = advisorCount > 0
  const isDayRanking = rankingPeriod === 'day'

  return (
    <section className="screen">
      <LeaderboardUploadBanner
        image={bannerImage}
        canEdit={false}
        onUpload={onBannerUpload}
        onAdminAccess={onAdminAccess}
      />

      <div className="screen-body">
        <RankingPeriodToggle value={rankingPeriod} onChange={onRankingPeriodChange} />

        {isLoading ? (
          <div className="empty-state">Đang tải dữ liệu xếp hạng...</div>
        ) : error ? (
          <div className="empty-state">Không lấy được dữ liệu: {error}</div>
        ) : !hasAdvisors ? (
          <div className="empty-state">Chưa có dữ liệu tư vấn viên</div>
        ) : (
          <>
            {isDayRanking ? (
              <div className="card-list daily-ranking-list">
                {advisors.map((advisor, index) => (
                  <DailyRankingCard
                    key={advisor.id || `${advisor.normalized_name || advisor.name || 'advisor'}-${index}`}
                    advisor={advisor}
                    rank={index + 1}
                    delay={index * 60}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="podium-section podium-grid">
                  <PodiumCard advisor={podium[0]} rank={2} delay={80} />
                  <PodiumCard advisor={podium[1]} rank={1} delay={0} />
                  <PodiumCard advisor={podium[2]} rank={3} delay={160} />
                </div>

                <div className="section-title">Bảng xếp hạng tiếp theo</div>
                <div className="card-list">
                  {rankingRows.map((advisor, index) => (
                    <RankingCard
                      key={advisor.id || `${advisor.normalized_name || advisor.name || 'advisor'}-${index}`}
                      advisor={advisor}
                      rank={index + 4}
                      delay={240 + index * 80}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function LeaderboardUploadBanner({ image, canEdit, onUpload, onAdminAccess }) {
  return (
    <div className="leaderboard-upload-banner">
      <PageBanner
        pageId="bang-vang"
        image={image}
        canEdit={canEdit}
        onUpload={onUpload}
        onAdminAccess={onAdminAccess}
      />
    </div>
  )
}
function ThiDuaTab({
  campaigns,
  campaignRankings,
  counts,
  currentFilter,
  onFilterChange,
  onOpenDetail,
  onOpenRanking,
  onOpenPoster,
  bannerImage,
  onBannerUpload,
  onAdminAccess,
}) {
  return (
    <section className="screen">
      <PageBanner
        pageId="thi-dua"
        image={bannerImage}
        canEdit={false}
        onUpload={onBannerUpload}
        onAdminAccess={onAdminAccess}
      />

      <div className="screen-body">
        <div className="status-row">
          <StatusPill
            active={currentFilter === 'active'}
            label="Đang diễn ra"
            count={counts.active}
            onClick={() => onFilterChange('active')}
          />
          <StatusPill
            active={currentFilter === 'upcoming'}
            label="Sắp diễn ra"
            count={counts.upcoming}
            onClick={() => onFilterChange('upcoming')}
          />
          <StatusPill
            active={currentFilter === 'ended'}
            label="Đã kết thúc"
            count={counts.ended}
            onClick={() => onFilterChange('ended')}
          />
        </div>

        <div className="card-list">
          {campaigns.length ? (
            campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onOpenDetail={() => onOpenDetail(campaign)}
                onOpenRanking={() => onOpenRanking(campaign)}
                onOpenPoster={() => onOpenPoster(campaign)}
                rankingCount={safeArray(campaignRankings[campaign.id]).length}
              />
            ))
          ) : (
            <div className="empty-state">Không có chương trình phù hợp với bộ lọc này.</div>
          )}
        </div>
      </div>
    </section>
  )
}

function EditableBanner({ className = '', canEdit = false, onUpload, children }) {
  const content = (
    <>
      {children}
      {canEdit ? (
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload?.(file)
            event.target.value = ''
          }}
        />
      ) : null}
    </>
  )

  if (canEdit) {
    return <label className={`editable-banner can-edit ${className}`.trim()}>{content}</label>
  }

  return <div className={`editable-banner ${className}`.trim()}>{content}</div>
}

function HiddenAdminEntry({ onAdminAccess }) {
  if (!onAdminAccess) return null

  return (
    <button
      type="button"
      className="hidden-admin-entry"
      aria-label="Admin access"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onAdminAccess()
      }}
    />
  )
}

function TeamOverviewPage({ teams, isLoading, error, onBack }) {
  const { groups, totalRow } = buildTbtnDataset(teams)
  const activeTeams = groups.filter((team) =>
    normalizeRevenue(team.total_revenue ?? team.totalRevenue ?? team.doanhThu) > 0
  )
  const totalCompanyRevenue = totalRow?.doanhThu ?? groups.reduce((sum, team) => sum + normalizeRevenue(team.doanhThu), 0)
  const totalActiveAdvisors = groups.reduce((sum, team) => sum + normalizeInteger(team.tvvHoatDong), 0)
  const hasGroups = groups.length > 0

  console.log('TBTN groups:', groups.length, groups)

  return (
    <section className="screen tbtn-screen tbtn-page">
      <div className="tbtn-header">
        <button type="button" className="back-link tbtn-back" onClick={onBack}>
          <span className="round-icon button-icon">
            <ChevronLeft size={18} />
          </span>
        </button>
      </div>

      <div className="screen-body tbtn-body">
        <section className="tbtn-hero-card">
          <span>Doanh thu</span>
          <strong>{formatTbtnMoney(totalCompanyRevenue)}</strong>
        </section>

        <div className="tbtn-mini-stats">
          <div>
            <span>Nhóm</span>
            <strong>{activeTeams.length}</strong>
          </div>
          <div>
            <span>TVV có hợp đồng</span>
            <strong>{totalActiveAdvisors}</strong>
          </div>
        </div>

        {isLoading && !hasGroups ? <TbtnLoadingState /> : null}
        {!isLoading && !hasGroups && error ? <div className="empty-state">Không lấy được dữ liệu TBTN: {error}</div> : null}
        {!isLoading && !hasGroups && !error ? (
          <div className="empty-state">Chưa có dữ liệu TBTN từ Google Sheet.</div>
        ) : null}

        {hasGroups ? (
          <section className="tbtn-list-section">
            <div className="tbtn-section-header">
              <h2>Danh sách nhóm</h2>
            </div>
            <div className="tbtn-group-list">
              {groups.map((group, index) => (
                <GroupRowCard
                  key={group.id}
                  group={group}
                  rank={group.stt || index + 1}
                  totalCompanyRevenue={totalCompanyRevenue}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}

function TbtnLoadingState() {
  return (
    <div className="tbtn-loading-list">
      {[1, 2, 3].map((item) => (
        <div key={item} className="tbtn-group-card tbtn-skeleton-card" />
      ))}
    </div>
  )
}

function GroupRowCard({ group, rank, totalCompanyRevenue }) {
  const revenue = normalizeRevenue(group.doanhThu ?? group.revenue)
  const activeAdvisors = normalizeInteger(group.tvvHoatDong ?? group.activeAdvisors)
  const percentOfTotal = totalCompanyRevenue > 0 ? (revenue / totalCompanyRevenue) * 100 : 0
  const safePercent = Math.min(100, Math.max(0, percentOfTotal))
  const isTop = rank === 1 && revenue > 0
  const isZero = revenue <= 0

  return (
    <article className={`tbtn-group-card ${isTop ? 'is-leading' : ''} ${isZero ? 'is-zero' : ''}`}>
      <div className="tbtn-group-card-main">
        <span className="tbtn-rank">{rank}</span>
        <div className="tbtn-group-main">
          <div className="tbtn-group-title-row">
            <h3 className="tbtn-group-name">{group.tenNhom ?? group.name}</h3>
            {isTop ? <span className="tbtn-leading-badge">Dẫn đầu</span> : null}
          </div>
          <span className="tbtn-group-meta">{activeAdvisors} TVV có hợp đồng</span>
        </div>
        <div className="tbtn-group-side">
          <strong className="tbtn-group-revenue">{formatTbtnMoney(revenue)}</strong>
          <span className="tbtn-group-percent">{percentOfTotal.toFixed(1)}%</span>
        </div>
      </div>
      <div className="tbtn-progress-track" aria-label={`Tỷ trọng doanh thu ${safePercent.toFixed(1)}%`}>
        <div className="tbtn-progress-fill" style={{ width: `${safePercent}%` }} />
      </div>
    </article>
  )
}

function TeamAvatar({ team }) {
  const initials = getInitials(team.truongNhom || team.tenNhom)
  return (
    <div className="avatar-circle team-avatar">
      {team.avatarTruongNhom ? (
        <img src={team.avatarTruongNhom} alt={team.truongNhom || team.tenNhom} className="avatar-circle__image" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

function RewardProgressBar({ progress }) {
  return (
    <div className="reward-progress" aria-label={`Tiến độ ${Math.round(progress)}%`}>
      <div style={{ width: `${Math.round(progress)}%` }} />
    </div>
  )
}

// eslint-disable-next-line no-unused-vars
function TeamCard({ team }) {
  const growth = calculateGrowth(team)
  const reward = calculateRewardProgress(team)
  const status = getTeamStatus(team)

  return (
    <article className="team-card">
      <div className="team-card__top">
        <TeamAvatar team={team} />
        <div>
          <h2>{team.tenNhom}</h2>
          <span>{team.truongNhom || 'Chưa có trưởng nhóm'}</span>
        </div>
        <span className={`team-status team-status--${status.tone}`}>{status.label}</span>
      </div>

      <div className="team-card__revenue">
        <span>Doanh thu</span>
        <strong>{formatCurrency(team.doanhThu)}</strong>
      </div>

      <div className="team-metrics">
        <div>
          <span>HĐ</span>
          <strong>{team.soHopDong || 0}</strong>
        </div>
        <div>
          <span>TVV hoạt động</span>
          <strong>{team.tvvHoatDong || 0}</strong>
        </div>
        <div>
          <span>Tăng trưởng</span>
          <strong className={growth >= 0 ? 'is-positive' : 'is-negative'}>
            {growth >= 0 ? '+' : ''}
            {formatCompactMoney(growth)}
          </strong>
        </div>
      </div>

      <div className="team-reward">
        <div>
          <span>Mốc thưởng tiếp theo</span>
          <strong>{formatCurrency(team.mocThuongTiepTheo)}</strong>
        </div>
        <div>
          <span>{reward.isReached ? 'Đã đạt mốc' : 'Còn thiếu'}</span>
          <strong>{reward.isReached ? 'Đã đạt mốc' : formatCurrency(Math.max(0, reward.conThieu))}</strong>
        </div>
      </div>

      <RewardProgressBar progress={reward.progress} />
    </article>
  )
}

function PageBanner({
  pageId,
  image = '',
  canEdit = false,
  onUpload,
  onAdminAccess,
}) {
  const page = getBannerPage(pageId)
  const bannerImage = image || defaultBannerImages[pageId] || defaultTopBanner

  return (
    <EditableBanner
      className={`banner banner--${page.variant} has-image`}
      canEdit={canEdit}
      onUpload={onUpload}
    >
      <img src={bannerImage} alt={page.label} className="banner__image" />
      <HiddenAdminEntry onAdminAccess={onAdminAccess} />
    </EditableBanner>
  )
}
function AvatarCircle({ advisor, size = 'md' }) {
  const initials = advisor?.initials || getInitials(advisor?.name || '')
  const avatar = advisor?.avatar || advisor?.avatar_url || ''
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasImageError(false)
  }, [avatar])

  return (
    <div className={`avatar-circle avatar-circle--${size}`}>
      {avatar && !hasImageError ? (
        <img
          src={avatar}
          alt={advisor.name || initials}
          className="avatar-circle__image"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

function PodiumCard({ advisor, rank, delay = 0 }) {
  if (!advisor) return <div className="podium-card podium-card--empty" />
  const tierLabel = rank === 1 ? 'Vàng' : rank === 2 ? 'Bạc' : 'Đồng'

  return (
    <div
      className={`podium-card podium-card--rank-${rank} podium-animated ${rank === 1 ? 'is-first' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`podium-avatar podium-avatar--${rank}`}>
        <AvatarCircle advisor={advisor} size={rank === 1 ? 'lg' : 'md'} />
        <i>{rank}</i>
      </div>
      <div className="podium-name">{advisor.name}</div>
      <div className="podium-team">{displayTeamName(advisor.team)}</div>
      <div className={`podium-base podium-base--${rank}`}>
        <Medal size={18} />
        <strong>{tierLabel}</strong>
        <span>{formatCompactMoney(advisor.revenue)}</span>
      </div>
    </div>
  )
}

function RankingCard({ advisor, rank, delay = 0 }) {
  return (
    <div className="ranking-card ranking-card--animated" style={{ animationDelay: `${delay}ms` }}>
      <div className="round-icon ranking-card__rank">{rank}</div>
      <AvatarCircle advisor={advisor} />
      <div className="ranking-card__content">
        <div className="ranking-card__name">{advisor.name}</div>
        <div className="ranking-card__team">{displayTeamName(advisor.team)}</div>
      </div>
      <div className="ranking-card__value">{formatCompactMoney(advisor.revenue)}</div>
    </div>
  )
}

function DailyRankingCard({ advisor, rank, delay = 0 }) {
  const medalClass = rank <= 3 ? `daily-ranking-card--top-${rank}` : 'daily-ranking-card--default'

  return (
    <div
      className={`daily-ranking-card ranking-card--animated ${medalClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="daily-ranking-card__rank">{rank}</div>
      <div className="daily-ranking-card__content">
        <strong>{advisor.name}</strong>
        <span>{displayTeamName(advisor.team)}</span>
      </div>
      <div className="daily-ranking-card__value">{formatPlainVnd(advisor.revenue)}</div>
    </div>
  )
}

function StatusPill({ label, count, active, onClick }) {
  return (
    <button type="button" className={`status-pill ${active ? 'is-active' : ''}`} onClick={onClick}>
      {label} - {count}
    </button>
  )
}

function CampaignVisual({ campaign, compact = false }) {
  if (campaign.image) {
    return (
      <div className={`campaign-image-wrap ${compact ? 'is-compact' : ''}`}>
        <img src={campaign.image} alt={campaign.title} className="campaign-image" />
      </div>
    )
  }

  return (
    <div className={`campaign-fallback-banner ${compact ? 'mini' : ''}`}>
      <div className="campaign-fallback-banner__orb" />
      <div>
        <div className="campaign-fallback-banner__title">{campaign.title}</div>
      </div>
      <Trophy size={compact ? 24 : 34} />
    </div>
  )
}

function CampaignCard({ campaign, onOpenDetail, onOpenRanking, onOpenPoster }) {
  return (
    <article className="campaign-card">
      <button type="button" className="campaign-poster-button" onClick={onOpenPoster}>
        <CampaignVisual campaign={campaign} />
      </button>
      <div className="campaign-card__body">
        <h3>{campaign.title}</h3>
        <div className="campaign-actions">
          <button type="button" className="button-light" onClick={onOpenDetail}>
            Chi tiết
          </button>
          <button type="button" className="button-primary" onClick={onOpenRanking}>
            Bảng xếp hạng
          </button>
        </div>
      </div>
    </article>
  )
}

function DetailModal({ campaign, onClose }) {
  return (
    <ModalShell title="Chi tiết chương trình" onClose={onClose}>
      <CampaignVisual campaign={campaign} compact />
      <div className="modal-card">
        <h3>{campaign.title}</h3>
        <div className="modal-line">
          <strong>Thời gian:</strong> {campaign.startDate} - {campaign.endDate}
        </div>
        <div className="modal-line">
          <strong>Trạng thái:</strong> {formatStatusLabel(campaign.status)}
        </div>
        <div className="modal-line modal-line--block">
          <strong>Nội dung:</strong>
          <p>{campaign.details}</p>
        </div>
      </div>
    </ModalShell>
  )
}

function RankingModal({ campaign, rankings, onClose }) {
  return (
    <ModalShell title={`BXH - ${campaign.title}`} onClose={onClose}>
      <CampaignVisual campaign={campaign} compact />
      <div className="modal-card">
        <h3>{campaign.title}</h3>
        {rankings.length ? (
          <div className="card-list compact-list">
            {rankings.map((advisor, index) => (
              <RankingCard key={advisor.id} advisor={advisor} rank={index + 1} />
            ))}
          </div>
        ) : (
          <div className="empty-state">Chương trình này chưa có dữ liệu BXH.</div>
        )}
      </div>
    </ModalShell>
  )
}

function PosterModal({ campaign, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const image = campaign.image || campaign.poster

  return (
    <div className="poster-modal-overlay" onClick={onClose}>
      <div className="poster-modal-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="poster-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
        {image ? (
          <img src={image} alt={campaign.title} className="poster-modal-image" />
        ) : (
          <div className="poster-modal-fallback">
            <CampaignVisual campaign={campaign} compact />
          </div>
        )}
      </div>
    </div>
  )
}

function ModalShell({ title, children, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="round-icon icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function AdminView({
  campaigns,
  campaignRankings,
  banners,
  isAdminLoggedIn,
  setAdvisors,
  setCampaignRankings,
  setBanners,
  tbtnSheetUrl,
  topDaySheetUrl,
  setTopDaySheetUrl,
  dataSettings,
  setDataSettings,
  setTopDayAdvisors,
  setIsAdminLoggedIn,
  fetchCompetitions,
  navigate,
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [activeAdminTab, setActiveAdminTab] = useState('data')
  const [expandedCampaignId, setExpandedCampaignId] = useState(null)
  const [campaignImportState, setCampaignImportState] = useState({})
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [campaignDraft, setCampaignDraft] = useState(() => createCampaignDraft())
  const [campaignDraftRankings, setCampaignDraftRankings] = useState([])
  const [campaignDraftImport, setCampaignDraftImport] = useState({
    remoteUrl: '',
    preview: [],
    source: '',
    error: '',
  })
  const [campaignDraftError, setCampaignDraftError] = useState('')
  const [isSavingCampaignDraft, setIsSavingCampaignDraft] = useState(false)
  const [adminToast, setAdminToast] = useState('')
  const [avatarUploadStatus, setAvatarUploadStatus] = useState({})
  const [dataConfigDraft, setDataConfigDraft] = useState(() => ({
    [DATA_SETTING_KEYS.topMonthUrl]: dataSettings?.[DATA_SETTING_KEYS.topMonthUrl] || '',
    [DATA_SETTING_KEYS.topDayUrl]: dataSettings?.[DATA_SETTING_KEYS.topDayUrl] || topDaySheetUrl || '',
    [DATA_SETTING_KEYS.tbtnUrl]: dataSettings?.[DATA_SETTING_KEYS.tbtnUrl] || tbtnSheetUrl || '',
  }))
  const [dataSyncStatus, setDataSyncStatus] = useState({ loading: '', message: '', error: '' })
  const [importLogs, setImportLogs] = useState([])

  useEffect(() => {
    if (!adminTabs.some((tab) => tab.id === activeAdminTab)) {
      setActiveAdminTab('data')
    }
  }, [activeAdminTab])

  useEffect(() => {
    setDataConfigDraft((current) => ({
      ...current,
      ...dataSettings,
      [DATA_SETTING_KEYS.topMonthUrl]: dataSettings?.[DATA_SETTING_KEYS.topMonthUrl] || current[DATA_SETTING_KEYS.topMonthUrl] || '',
      [DATA_SETTING_KEYS.topDayUrl]: dataSettings?.[DATA_SETTING_KEYS.topDayUrl] || topDaySheetUrl || current[DATA_SETTING_KEYS.topDayUrl] || '',
      [DATA_SETTING_KEYS.tbtnUrl]: dataSettings?.[DATA_SETTING_KEYS.tbtnUrl] || tbtnSheetUrl || current[DATA_SETTING_KEYS.tbtnUrl] || '',
    }))
  }, [dataSettings, topDaySheetUrl, tbtnSheetUrl])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let isMounted = true

    const loadSavedSettings = async () => {
      try {
        const savedSettings = await loadSettingsFromSupabase()
        if (!isMounted) return
        setDataSettings((current) => ({ ...current, ...savedSettings }))
        setDataConfigDraft((current) => ({
          ...current,
          ...savedSettings,
          [DATA_SETTING_KEYS.topMonthUrl]: savedSettings[DATA_SETTING_KEYS.topMonthUrl] || current[DATA_SETTING_KEYS.topMonthUrl] || '',
          [DATA_SETTING_KEYS.topDayUrl]: savedSettings[DATA_SETTING_KEYS.topDayUrl] || current[DATA_SETTING_KEYS.topDayUrl] || '',
          [DATA_SETTING_KEYS.tbtnUrl]: savedSettings[DATA_SETTING_KEYS.tbtnUrl] || current[DATA_SETTING_KEYS.tbtnUrl] || '',
        }))
        if (savedSettings[DATA_SETTING_KEYS.topDayUrl]) setTopDaySheetUrl(savedSettings[DATA_SETTING_KEYS.topDayUrl])
      } catch (settingsError) {
        console.error('Không tải được cấu hình link từ Supabase', settingsError)
      }
    }

    loadSavedSettings()
    return () => {
      isMounted = false
    }
  }, [setDataSettings, setTopDaySheetUrl])

  const reloadImportLogs = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      setImportLogs(await fetchImportLogs())
    } catch (logError) {
      console.error(logError)
    }
  }, [])

  useEffect(() => {
    reloadImportLogs()
  }, [reloadImportLogs])

  const alertSupabaseError = (action, supabaseError) => {
    console.error(action, supabaseError)
    window.alert(`${action}: ${supabaseError?.message ?? supabaseError}`)
  }

  const showAdminToast = (message) => {
    setAdminToast(message)
    window.setTimeout(() => setAdminToast(''), 2600)
  }

  const saveDataConfig = async () => {
    setDataSyncStatus({ loading: 'settings', message: '', error: '' })
    try {
      await saveSettingsToSupabase(dataConfigDraft)
      setDataSettings((current) => ({ ...current, ...dataConfigDraft }))
      setTopDaySheetUrl(dataConfigDraft[DATA_SETTING_KEYS.topDayUrl] || '')
      window.localStorage.setItem('autorank_top_thang_url', dataConfigDraft[DATA_SETTING_KEYS.topMonthUrl] || '')
      window.localStorage.setItem(TOP_DAY_URL_STORAGE_KEY, dataConfigDraft[DATA_SETTING_KEYS.topDayUrl] || '')
      window.localStorage.setItem(TBTN_URL_STORAGE_KEY, dataConfigDraft[DATA_SETTING_KEYS.tbtnUrl] || '')
      setDataSyncStatus({ loading: '', message: 'Đã lưu cấu hình', error: '' })
      showAdminToast('Đã lưu cấu hình')
    } catch (saveError) {
      setDataSyncStatus({ loading: '', message: '', error: saveError.message })
    }
  }

  const runDataSync = async () => {
    const settings = { ...dataSettings, ...dataConfigDraft }
    const toSyncedAdvisor = (row, index) => {
      const advisorName = String(row.advisor_name ?? row.name ?? '').trim()
      const normalizedName = normalizeAdvisorName(row.normalized_name || advisorName)
      return {
        id: String(row.id || row.advisor_code || `${row.rank || index + 1}-${normalizedName}`),
        advisor_code: row.advisor_code || '',
        normalized_name: normalizedName,
        name: advisorName,
        team: row.team_name || row.team || '',
        initials: getInitials(advisorName),
        revenue: normalizeRevenue(row.revenue),
        avatar: row.avatar_url || row.avatar || '',
        avatar_url: row.avatar_url || row.avatar || '',
        rank: Number(row.rank || index + 1),
      }
    }
    setDataSyncStatus({ loading: 'all', message: '', error: '' })
    try {
      const runStep = async (label, task) => {
        try {
          return await task()
        } catch (stepError) {
          throw new Error(`Lỗi đồng bộ ${label}: ${stepError?.message ?? stepError}`, { cause: stepError })
        }
      }

      const monthly = await runStep('Top tháng', () => syncMonthlyRankings(settings))
      const daily = await runStep('Top ngày', () => syncDailyRankings(settings))
      const tbtn = await runStep('TBTN', () => syncTeamOverview(settings))

      setTopDayAdvisors(daily.rows.map(toSyncedAdvisor))
      setAdvisors(monthly.rows.map(toSyncedAdvisor))
      setDataSyncStatus({
        loading: '',
        message: `Đã đồng bộ: ${monthly.rows.length} Top tháng, ${daily.rows.length} Top ngày, ${tbtn.rows.length} nhóm.`,
        error: '',
      })
      await reloadImportLogs()
      showAdminToast('Đã đồng bộ dữ liệu')
    } catch (syncError) {
      setDataSyncStatus({ loading: '', message: '', error: syncError.message })
      await reloadImportLogs()
    }
  }

  const mergeWithStoredAvatars = async (rows) => {
    if (!isSupabaseConfigured) return rows
    try {
      const profiles = await fetchAdvisorProfiles()
      return mergeAdvisorsWithProfiles(rows, profiles)
    } catch (profileError) {
      console.error('Không thể lấy advisor_profiles để merge avatar', profileError)
      return rows
    }
  }

  const handleLogin = (event) => {
    event.preventDefault()
    if (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      setIsAdminLoggedIn(true)
      setError('')
      return
    }
    setError('Thông tin đăng nhập chưa đúng.')
  }

  const updateCampaign = async (id, field, value) => {
    const currentCampaign = campaigns.find((campaign) => campaign.id === id)
    if (!currentCampaign) return
    const nextCampaign = { ...currentCampaign, [field]: value }

    try {
      await saveCompetitionToSupabase(nextCampaign)
      await fetchCompetitions()
    } catch (supabaseError) {
      alertSupabaseError('Không thể lưu chương trình thi đua lên Supabase', supabaseError)
    }
  }

  const openCampaignModal = () => {
    setCampaignDraft(createCampaignDraft())
    setCampaignDraftRankings([])
    setCampaignDraftImport({ remoteUrl: '', preview: [], source: '', error: '' })
    setCampaignDraftError('')
    setIsCampaignModalOpen(true)
  }

  const closeCampaignModal = () => {
    if (isSavingCampaignDraft) return
    setIsCampaignModalOpen(false)
    setCampaignDraftError('')
  }

  const updateCampaignDraft = (field, value) => {
    setCampaignDraft((current) => ({ ...current, [field]: value }))
    setCampaignDraftError('')
  }

  const validateCampaignDraft = () => {
    if (!campaignDraft.title.trim()) return 'Vui lòng nhập tên chương trình'
    if (!campaignDraft.startDate) return 'Vui lòng chọn ngày bắt đầu'
    if (!campaignDraft.endDate) return 'Vui lòng chọn ngày kết thúc'
    if (parseLocalDate(campaignDraft.endDate) < parseLocalDate(campaignDraft.startDate)) {
      return 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu'
    }
    return ''
  }

  const saveCampaignDraft = async () => {
    const validationError = validateCampaignDraft()
    if (validationError) {
      setCampaignDraftError(validationError)
      return
    }

    const status = getComputedCompetitionStatus(campaignDraft)
    const nextCampaign = {
      ...campaignDraft,
      status,
      summary: campaignDraft.summary || campaignDraft.details,
      published: status !== 'ended',
    }

    setIsSavingCampaignDraft(true)
    try {
      await saveCompetitionToSupabase(nextCampaign)
      setCampaignRankings((current) => ({
        ...current,
        [campaignDraft.id]: campaignDraftRankings,
      }))
      await fetchCompetitions()
      setIsCampaignModalOpen(false)
      showAdminToast('Đã thêm chương trình thi đua')
    } catch (supabaseError) {
      alertSupabaseError('Không thể thêm chương trình thi đua vào Supabase', supabaseError)
    } finally {
      setIsSavingCampaignDraft(false)
    }
  }

  const deleteCampaign = async (id) => {
    try {
      await deleteCompetitionFromSupabase(id)
      await fetchCompetitions()
      setCampaignRankings((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      if (expandedCampaignId === id) setExpandedCampaignId(null)
    } catch (supabaseError) {
      alertSupabaseError('Không thể xóa chương trình thi đua khỏi Supabase', supabaseError)
    }
  }

  const updateCampaignRanking = (campaignId, id, field, value) => {
    setCampaignRankings((current) => ({
      ...current,
      [campaignId]: safeArray(current[campaignId]).map((advisor) =>
        advisor.id === id
          ? {
              ...advisor,
              [field]:
                field === 'revenue'
                  ? normalizeRevenue(value)
                  : field === 'initials'
                    ? String(value).toUpperCase().slice(0, 2)
                    : value,
            }
          : advisor,
      ),
    }))
  }

  const addCampaignRanking = (campaignId) => {
    setCampaignRankings((current) => ({
      ...current,
      [campaignId]: [
        ...safeArray(current[campaignId]),
        {
          id: generateId('campaign-row'),
          name: 'Tư vấn viên mới',
          team: 'Đội mới',
          initials: 'TV',
          revenue: 0,
          avatar: '',
        },
      ],
    }))
  }

  const deleteCampaignRanking = (campaignId, id) => {
    setCampaignRankings((current) => ({
      ...current,
      [campaignId]: safeArray(current[campaignId]).filter((item) => item.id !== id),
    }))
  }

  const handleAvatarUpload = async (id, file, scope, campaignId) => {
    if (!file) return
    const statusKey = `${scope}:${campaignId || 'main'}:${id}`
    const advisor = safeArray(campaignRankings[campaignId]).find((item) => item.id === id)
    if (!advisor) return

    setAvatarUploadStatus((current) => ({ ...current, [statusKey]: 'saving' }))
    try {
      const { avatarUrl } = await uploadAdvisorAvatar(file, advisor)
      updateCampaignRanking(campaignId, id, 'avatar', avatarUrl)
      setAvatarUploadStatus((current) => ({ ...current, [statusKey]: 'saved' }))
      showAdminToast('Đã lưu avatar')
    } catch (uploadError) {
      console.error('Không thể upload/lưu avatar tư vấn viên', uploadError)
      setAvatarUploadStatus((current) => ({ ...current, [statusKey]: 'error' }))
      alertSupabaseError('Không thể upload/lưu avatar tư vấn viên', uploadError)
    }
  }

  const handleCampaignImageUpload = async (id, file) => {
    try {
      const image = await uploadImageToStorage(file, `campaigns/${id}`)
      await updateCampaign(id, 'poster', image)
    } catch (uploadError) {
      alertSupabaseError('Không thể upload poster chương trình lên Supabase Storage', uploadError)
    }
  }

  const parseExcelFile = async (file) => {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
  }

  const parseRemoteDataset = async (url) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Không thể lấy dữ liệu. Mã lỗi ${response.status}.`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await response.json()
      if (Array.isArray(json)) return json
      if (Array.isArray(json?.data)) return json.data
      throw new Error('JSON không đúng định dạng mảng dữ liệu.')
    }
    return parseCsvTextToObjects(await response.text())
  }

  const fetchGoogleSheetCsvRows = async (url) => {
    const csvUrl = convertGoogleSheetUrlToCsvUrl(url)
    const response = await fetch(csvUrl)
    if (!response.ok) {
      throw new Error(
        'Không lấy được dữ liệu. Hãy vào Google Sheet > Share > Anyone with the link can view.',
      )
    }

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    if (
      contentType.includes('text/html') ||
      text.trim().startsWith('<!DOCTYPE html') ||
      text.trim().startsWith('<html')
    ) {
      throw new Error(
        'Không lấy được dữ liệu. Hãy vào Google Sheet > Share > Anyone with the link can view.',
      )
    }

    return parseCsvTextToObjects(text)
  }

  const getCampaignImport = (campaignId) =>
    campaignImportState[campaignId] ?? {
      remoteUrl: '',
      preview: [],
      source: '',
      error: '',
    }

  const setCampaignImport = (campaignId, patch) => {
    setCampaignImportState((current) => ({
      ...current,
      [campaignId]: { ...getCampaignImport(campaignId), ...patch },
    }))
  }

  const handleRankingExcelImport = async (campaignId, file) => {
    try {
      const rows = await parseExcelFile(file)
      const normalized = await mergeWithStoredAvatars(rows.map(normalizeImportedAdvisor).filter(Boolean))
      setCampaignImport(campaignId, {
        preview: normalized,
        source: `Excel: ${file.name}`,
        error: '',
      })
    } catch {
      setCampaignImport(campaignId, {
        error: 'Không thể đọc file Excel BXH. Vui lòng kiểm tra lại file.',
      })
    }
  }

  const handleRankingRemoteImport = async (campaignId) => {
    const currentImport = getCampaignImport(campaignId)
    try {
      const rows = await parseRemoteDataset(currentImport.remoteUrl)
      const normalized = await mergeWithStoredAvatars(rows.map(normalizeImportedAdvisor).filter(Boolean))
      setCampaignImport(campaignId, {
        preview: normalized,
        source: `Google Sheet/API: ${currentImport.remoteUrl}`,
        error: '',
      })
    } catch (remoteError) {
      setCampaignImport(campaignId, { error: remoteError.message })
    }
  }

  const applyRankingPreview = (campaignId) => {
    const currentImport = getCampaignImport(campaignId)
    if (!currentImport.preview.length) return
    setCampaignRankings((current) => ({ ...current, [campaignId]: currentImport.preview }))
    setCampaignImport(campaignId, { preview: [], source: '' })
  }

  const handleCampaignDraftImageUpload = async (file) => {
    try {
      const image = await uploadImageToStorage(file, `campaigns/${campaignDraft.id}`)
      setCampaignDraft((current) => ({ ...current, poster: image, image }))
    } catch (uploadError) {
      alertSupabaseError('Không thể upload poster chương trình lên Supabase Storage', uploadError)
    }
  }

  const handleCampaignDraftRankingExcelImport = async (file) => {
    try {
      const rows = await parseExcelFile(file)
      const normalized = await mergeWithStoredAvatars(rows.map(normalizeImportedAdvisor).filter(Boolean))
      setCampaignDraftImport({
        ...campaignDraftImport,
        preview: normalized,
        source: `Excel: ${file.name}`,
        error: '',
      })
    } catch {
      setCampaignDraftImport((current) => ({
        ...current,
        error: 'Không thể đọc file Excel BXH. Vui lòng kiểm tra lại file.',
      }))
    }
  }

  const handleCampaignDraftRankingRemoteImport = async () => {
    try {
      const rows = campaignDraftImport.remoteUrl.includes('docs.google.com')
        ? await fetchGoogleSheetCsvRows(campaignDraftImport.remoteUrl)
        : await parseRemoteDataset(campaignDraftImport.remoteUrl)
      const normalized = await mergeWithStoredAvatars(rows.map(normalizeImportedAdvisor).filter(Boolean))
      setCampaignDraftImport({
        ...campaignDraftImport,
        preview: normalized,
        source: `Google Sheet/API: ${campaignDraftImport.remoteUrl}`,
        error: '',
      })
    } catch (remoteError) {
      setCampaignDraftImport((current) => ({ ...current, error: remoteError.message }))
    }
  }

  const applyCampaignDraftRankingPreview = () => {
    if (!campaignDraftImport.preview.length) return
    setCampaignDraftRankings(campaignDraftImport.preview)
    setCampaignDraftImport((current) => ({ ...current, preview: [], source: '' }))
  }

  const updatePageBanner = async (pageId, file) => {
    if (!bannerPageIds.has(pageId) || !file?.type?.startsWith('image/')) return

    try {
      const image = await uploadImageToStorage(file, `banners/${pageId}`)
      if (!image) return
      setBanners((current) => ({ ...normalizeBanners(current), [pageId]: image }))
    } catch (uploadError) {
      console.error(uploadError)
      setBanners((current) => ({ ...normalizeBanners(current), [pageId]: '' }))
    }
  }

  const resetPageBanner = (pageId) => {
    if (!bannerPageIds.has(pageId)) return
    setBanners((current) => ({ ...normalizeBanners(current), [pageId]: '' }))
  }

  return (
    <MobileAppShell className="admin-shell">
      <div className="admin-scroll">
        <PageBanner
          pageId="admin"
          image={getBannerImage(banners, 'admin')}
          canEdit={false}
          onUpload={(file) => updatePageBanner('admin', file)}
          navigate={navigate}
          showAdmin={false}
        />
        {!isAdminLoggedIn ? (
          <div className="admin-login">
            <button type="button" className="back-link" onClick={() => navigate('/')}>
              <span className="round-icon button-icon">
                <ChevronLeft size={18} />
              </span>
              Về trang chính
            </button>

            <div className="admin-login__card">
              <h1>Quản Trị</h1>
              <p>Đăng nhập để quản lý Top 10, chương trình thi đua và BXH từng chương trình.</p>

              <form className="admin-form" onSubmit={handleLogin}>
                <label>
                  <span>Username</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} />
                </label>
                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {error ? <div className="form-error">{error}</div> : null}
                <button type="submit" className="button-primary full-width">
                  Đăng nhập
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="admin-panel">
            <div className="admin-topbar">
              <button type="button" className="back-link" onClick={() => navigate('/')}>
                <span className="round-icon button-icon">
                  <ChevronLeft size={18} />
                </span>
                Về trang chính
              </button>
              <button type="button" className="button-light" onClick={() => setIsAdminLoggedIn(false)}>
                Đăng xuất
              </button>
            </div>

            <div className="admin-tab-switcher">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-tab ${activeAdminTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveAdminTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeAdminTab === 'data' && (
              <section className="admin-section">
                <div className="admin-section__head">
                  <div>
                    <h2>Cấu hình dữ liệu Supabase</h2>
                    <p>Lưu nguồn Sheet/Drive, đồng bộ dữ liệu vào Supabase và xem lịch sử import.</p>
                  </div>
                </div>

                <div className="editor-grid">
                  <label className="full-row">
                    <span>Google Sheet Top tháng</span>
                    <input
                      value={dataConfigDraft[DATA_SETTING_KEYS.topMonthUrl] || ''}
                      onChange={(event) =>
                        setDataConfigDraft((current) => ({
                          ...current,
                          [DATA_SETTING_KEYS.topMonthUrl]: event.target.value,
                        }))
                      }
                      placeholder="Dán link Google Sheet Top tháng"
                    />
                  </label>
                  <label className="full-row">
                    <span>Google Sheet Top ngày</span>
                    <input
                      value={dataConfigDraft[DATA_SETTING_KEYS.topDayUrl] || ''}
                      onChange={(event) =>
                        setDataConfigDraft((current) => ({
                          ...current,
                          [DATA_SETTING_KEYS.topDayUrl]: event.target.value,
                        }))
                      }
                      placeholder="Dán link Google Sheet Top ngày"
                    />
                  </label>
                  <label className="full-row">
                    <span>Google Sheet / nguồn TBTN</span>
                    <input
                      value={dataConfigDraft[DATA_SETTING_KEYS.tbtnUrl] || ''}
                      onChange={(event) =>
                        setDataConfigDraft((current) => ({
                          ...current,
                          [DATA_SETTING_KEYS.tbtnUrl]: event.target.value,
                        }))
                      }
                      placeholder="Dán link Google Sheet TBTN"
                    />
                  </label>
                </div>

                <div className="tbtn-config-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={saveDataConfig}
                    disabled={dataSyncStatus.loading === 'settings'}
                  >
                    {dataSyncStatus.loading === 'settings' ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                  <button type="button" className="button-primary" onClick={runDataSync} disabled={Boolean(dataSyncStatus.loading)}>
                    {dataSyncStatus.loading === 'all' ? 'Đang đồng bộ...' : 'Đồng bộ'}
                  </button>
                </div>

                {dataSyncStatus.error ? <div className="form-error">{dataSyncStatus.error}</div> : null}
                {dataSyncStatus.message ? <div className="form-success">{dataSyncStatus.message}</div> : null}

                <div className="admin-section__head admin-section__head--compact">
                  <div>
                    <h2>Lịch sử import</h2>
                    <p>
                      Cập nhật gần nhất:{' '}
                      {importLogs[0]?.created_at
                        ? new Date(importLogs[0].created_at).toLocaleString('vi-VN')
                        : 'Chưa có'}
                    </p>
                  </div>
                  <button type="button" className="button-light" onClick={reloadImportLogs}>
                    Tải lại
                  </button>
                </div>

                <div className="admin-list">
                  {importLogs.length ? (
                    importLogs.map((log) => (
                      <div key={log.id} className="preview-row">
                        <div className="preview-row__content">
                          <strong>{log.import_type} - {log.status}</strong>
                          <span>{new Date(log.created_at).toLocaleString('vi-VN')} - {log.total_rows || 0} dòng</span>
                          <span>{log.message || log.source_name}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">Chưa có lịch sử import.</div>
                  )}
                </div>
              </section>
            )}

            {activeAdminTab === 'campaigns' && (
              <section className="admin-section">
                <div className="admin-section__head">
                  <div>
                    <h2>Chương trình thi đua</h2>
                    <p>Quản lý chương trình và BXH riêng cho từng chương trình.</p>
                  </div>
                  <button
                    type="button"
                    className="button-primary admin-add-campaign-btn"
                    aria-label="Thêm chương trình"
                    onClick={openCampaignModal}
                  >
                    <span className="round-icon button-icon">
                      <Plus size={18} />
                    </span>
                  </button>
                </div>

                <div className="admin-list">
                  {campaigns.map((campaign) => {
                    const expanded = expandedCampaignId === campaign.id
                    const campaignImport = getCampaignImport(campaign.id)
                    const rankings = sortByRevenueDesc(campaignRankings[campaign.id] ?? [])

                    return (
                      <div key={campaign.id} className="compact-card admin-campaign-card">
                        <div className="compact-card__summary">
                          <div className="compact-card__left">
                            <div className="campaign-card-thumb">
                              <CampaignVisual campaign={campaign} compact />
                            </div>
                            <div className="compact-card__content">
                              <div className="admin-campaign-title-row">
                                <strong>{campaign.title}</strong>
                                <div className="compact-card__actions">
                                  <button
                                    type="button"
                                    className="admin-action-btn admin-action-btn--edit"
                                    aria-label={expanded ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}
                                    onClick={() =>
                                      setExpandedCampaignId(expanded ? null : campaign.id)
                                    }
                                  >
                                    <Settings size={17} strokeWidth={2} />
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-action-btn admin-action-btn--delete"
                                    aria-label="Xóa"
                                    onClick={() => deleteCampaign(campaign.id)}
                                  >
                                    <Trash2 size={17} strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                              <div className="admin-campaign-meta">
                                <span className={`admin-status-badge admin-status-badge--${campaign.status}`}>
                                  {formatStatusLabel(campaign.status)}
                                </span>
                                <span className="admin-tvv-pill">{rankings.length} TVV</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {expanded && (
                          <div className="compact-card__editor">
                            <div className="campaign-editor-banner">
                              <CampaignVisual campaign={campaign} compact />
                              <label className="upload-inline">
                                <span className="round-icon button-icon">
                                  <Upload size={14} />
                                </span>
                                Upload hình ảnh
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleCampaignImageUpload(campaign.id, e.target.files?.[0])
                                  }
                                />
                              </label>
                            </div>

                            <div className="editor-grid">
                              <label className="full-row">
                                <span>Tên chương trình</span>
                                <input
                                  value={campaign.title}
                                  onChange={(e) => updateCampaign(campaign.id, 'title', e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Ngày bắt đầu</span>
                                <input
                                  type="date"
                                  value={campaign.startDate}
                                  onChange={(e) =>
                                    updateCampaign(campaign.id, 'startDate', e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                <span>Ngày kết thúc</span>
                                <input
                                  type="date"
                                  value={campaign.endDate}
                                  onChange={(e) =>
                                    updateCampaign(campaign.id, 'endDate', e.target.value)
                                  }
                                />
                              </label>
                              <label className="full-row">
                                <span>Chi tiết chương trình</span>
                                <textarea
                                  rows="4"
                                  value={campaign.details}
                                  onChange={(e) =>
                                    updateCampaign(campaign.id, 'details', e.target.value)
                                  }
                                />
                              </label>
                            </div>

                            <div className="subsection-box">
                              <div className="subsection-box__head">
                                <div>
                                  <h3>BXH chương trình</h3>
                                  <p>Nhập tay, upload Excel hoặc lấy từ Google Sheet / API.</p>
                                </div>
                                <button
                                  type="button"
                                  className="button-primary"
                                  onClick={() => addCampaignRanking(campaign.id)}
                                >
                                  <span className="round-icon button-icon">
                                    <Plus size={16} />
                                  </span>
                                  Thêm TVV
                                </button>
                              </div>

                              <ImportTools
                                remoteUrl={campaignImport.remoteUrl}
                                setRemoteUrl={(value) =>
                                  setCampaignImport(campaign.id, { remoteUrl: value })
                                }
                                onFileImport={(file) => handleRankingExcelImport(campaign.id, file)}
                                onRemoteImport={() => handleRankingRemoteImport(campaign.id)}
                                error={campaignImport.error}
                              />

                              <PreviewPanel
                                title="Preview BXH chương trình"
                                source={campaignImport.source}
                                rows={campaignImport.preview}
                                onApply={() => applyRankingPreview(campaign.id)}
                                onClear={() =>
                                  setCampaignImport(campaign.id, { preview: [], source: '' })
                                }
                              />

                              <div className="admin-list nested-list">
                                {rankings.map((advisor) => {
                                  const avatarStatusKey = `campaign:${campaign.id}:${advisor.id}`
                                  const avatarStatus = avatarUploadStatus[avatarStatusKey]
                                  return (
                                  <div key={advisor.id} className="editor-card compact-editor-card">
                                    <div className="editor-card__top">
                                      <AvatarCircle advisor={advisor} />
                                      <label className="upload-inline">
                                        <span className="round-icon button-icon">
                                          <Upload size={14} />
                                        </span>
                                        Upload avatar
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            handleAvatarUpload(
                                              advisor.id,
                                              e.target.files?.[0],
                                              'campaign',
                                              campaign.id,
                                            )
                                            e.target.value = ''
                                          }}
                                        />
                                      </label>
                                      {avatarStatus === 'saving' ? <span className="avatar-save-status">Đang lưu...</span> : null}
                                      {avatarStatus === 'saved' ? <span className="avatar-save-status">Đã lưu avatar</span> : null}
                                      {avatarStatus === 'error' ? <span className="avatar-save-status avatar-save-status--error">Lưu lỗi</span> : null}
                                    </div>

                                    <div className="editor-grid">
                                      <label>
                                        <span>Họ tên</span>
                                        <input
                                          value={advisor.name}
                                          onChange={(e) =>
                                            updateCampaignRanking(
                                              campaign.id,
                                              advisor.id,
                                              'name',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>Đội nhóm</span>
                                        <input
                                          value={advisor.team}
                                          onChange={(e) =>
                                            updateCampaignRanking(
                                              campaign.id,
                                              advisor.id,
                                              'team',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>Viết tắt</span>
                                        <input
                                          value={advisor.initials}
                                          onChange={(e) =>
                                            updateCampaignRanking(
                                              campaign.id,
                                              advisor.id,
                                              'initials',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>Doanh thu</span>
                                        <input
                                          type="number"
                                          min="0"
                                          value={advisor.revenue}
                                          onChange={(e) =>
                                            updateCampaignRanking(
                                              campaign.id,
                                              advisor.id,
                                              'revenue',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                    </div>

                                    <button
                                      type="button"
                                      className="admin-action-btn admin-action-btn--delete"
                                      aria-label="Xóa"
                                      onClick={() => deleteCampaignRanking(campaign.id, advisor.id)}
                                    >
                                      <Trash2 size={17} strokeWidth={2} />
                                    </button>
                                  </div>
                                )})}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {activeAdminTab === 'banners' && (
              <BannerManager
                banners={banners}
                onUpload={updatePageBanner}
                onReset={resetPageBanner}
              />
            )}
          </div>
        )}
      </div>
      {adminToast ? <div className="admin-toast">{adminToast}</div> : null}
      {isCampaignModalOpen && (
        <CampaignCreateModal
          draft={campaignDraft}
          rankings={campaignDraftRankings}
          importState={campaignDraftImport}
          error={campaignDraftError}
          isSaving={isSavingCampaignDraft}
          onClose={closeCampaignModal}
          onChange={updateCampaignDraft}
          onPosterUpload={handleCampaignDraftImageUpload}
          onFileImport={handleCampaignDraftRankingExcelImport}
          onRemoteImport={handleCampaignDraftRankingRemoteImport}
          onRemoteUrlChange={(value) =>
            setCampaignDraftImport((current) => ({ ...current, remoteUrl: value }))
          }
          onApplyPreview={applyCampaignDraftRankingPreview}
          onClearPreview={() =>
            setCampaignDraftImport((current) => ({ ...current, preview: [], source: '' }))
          }
          onConfirm={saveCampaignDraft}
        />
      )}
    </MobileAppShell>
  )
}

function RankingPeriodToggle({ value, onChange }) {
  return (
    <div className="ranking-period-toggle" role="group" aria-label="Chọn kỳ xếp hạng">
      <button
        type="button"
        className={value === 'month' ? 'is-active' : ''}
        onClick={() => onChange('month')}
      >
        Top tháng
      </button>
      <button
        type="button"
        className={value === 'day' ? 'is-active' : ''}
        onClick={() => onChange('day')}
      >
        Top ngày
      </button>
    </div>
  )
}

function MoreMenuBottomSheet({ open, onClose, onOpenTbtn }) {
  if (!open) return null

  return (
    <div className="more-menu-sheet more-menu-popover" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="more-menu-item" onClick={onOpenTbtn}>
        <span className="round-icon more-menu-item__icon">
          <Users size={20} />
        </span>
        <span>
          <strong>TBTN</strong>
          <small>Tổng quan thi đua theo nhóm</small>
        </span>
      </button>
      <button type="button" className="more-menu-item" onClick={onClose}>
        <span className="round-icon more-menu-item__icon">
          <FileText size={20} />
        </span>
        <span>
          <strong>Khác</strong>
          <small>Tiện ích mở rộng</small>
        </span>
      </button>
    </div>
  )
}

function CampaignCreateModal({
  draft,
  rankings,
  importState,
  error,
  isSaving,
  onClose,
  onChange,
  onPosterUpload,
  onFileImport,
  onRemoteImport,
  onRemoteUrlChange,
  onApplyPreview,
  onClearPreview,
  onConfirm,
}) {
  const computedStatus = getComputedCompetitionStatus(draft)

  return (
    <div className="campaign-modal-overlay" onClick={onClose}>
      <div className="campaign-modal" onClick={(event) => event.stopPropagation()}>
        <div className="campaign-modal__head">
          <div>
            <h2>Thêm chương trình thi đua</h2>
            <span className={`admin-status-badge admin-status-badge--${computedStatus}`}>
              {formatStatusLabel(computedStatus)}
            </span>
          </div>
          <button type="button" className="campaign-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="campaign-modal__body hide-scrollbar">
          <div className="campaign-modal__poster">
            <CampaignVisual campaign={draft} compact />
            <label className="upload-inline upload-inline--solid">
              <span className="round-icon button-icon">
                <Upload size={14} />
              </span>
              Upload hình ảnh
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onPosterUpload(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="campaign-modal__grid">
            <label className="full-row">
              <span>Tên chương trình</span>
              <input
                value={draft.title}
                onChange={(event) => onChange('title', event.target.value)}
                placeholder="Nhập tên chương trình"
              />
            </label>
            <label>
              <span>Ngày bắt đầu</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) => onChange('startDate', event.target.value)}
              />
            </label>
            <label>
              <span>Ngày kết thúc</span>
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) => onChange('endDate', event.target.value)}
              />
            </label>
            <label className="full-row">
              <span>Chi tiết chương trình</span>
              <textarea
                rows="4"
                value={draft.details}
                onChange={(event) => onChange('details', event.target.value)}
                placeholder="Nhập nội dung, thể lệ hoặc mục tiêu chương trình"
              />
            </label>
          </div>

          <div className="campaign-modal__ranking">
            <div className="campaign-modal__section-head">
              <div>
                <h3>BXH chương trình</h3>
                <p>Upload Excel hoặc lấy dữ liệu từ Google Sheet/API.</p>
              </div>
              <span>{rankings.length} TVV</span>
            </div>

            <ImportTools
              remoteUrl={importState.remoteUrl}
              setRemoteUrl={onRemoteUrlChange}
              onFileImport={onFileImport}
              onRemoteImport={onRemoteImport}
              error={importState.error}
            />

            <PreviewPanel
              title="Preview BXH chương trình"
              source={importState.source}
              rows={importState.preview}
              onApply={onApplyPreview}
              onClear={onClearPreview}
            />

            {rankings.length ? (
              <div className="campaign-modal__ranking-list">
                {sortByRevenueDesc(rankings).slice(0, 5).map((advisor, index) => (
                  <RankingCard key={advisor.id} advisor={advisor} rank={index + 1} />
                ))}
              </div>
            ) : null}
          </div>

          {error ? <div className="form-error campaign-modal__error">{error}</div> : null}
        </div>

        <div className="campaign-modal__footer">
          <button
            type="button"
            className="campaign-confirm-btn"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="loading-spinner" />
            ) : (
              <span className="round-icon button-icon">
                <Check size={16} />
              </span>
            )}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )
}

function BannerManager({ banners, onUpload, onReset }) {
  const safeBanners = normalizeBanners(banners)

  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <div>
          <h2>Banner</h2>
          <p>Upload ảnh banner riêng cho từng page. Ảnh được lưu Supabase và đổi ngay trên app.</p>
        </div>
      </div>

      <div className="admin-list">
        {bannerPages.map((page) => (
          <div key={page.id} className="banner-manager-card">
            <PageBanner
              pageId={page.id}
              image={getBannerImage(safeBanners, page.id)}
              navigate={() => {}}
              showAdmin={false}
              canEdit
              onUpload={(file) => onUpload(page.id, file)}
            />

            <div className="banner-manager-card__body">
              <div>
                <strong>{page.label}</strong>
                <span>{getBannerImage(safeBanners, page.id) ? 'Đang dùng ảnh đã upload' : 'Đang dùng banner mặc định'}</span>
              </div>

              <div className="banner-manager-card__actions">
                <label className="upload-inline upload-inline--solid">
                  <span className="round-icon button-icon">
                    <Upload size={14} />
                  </span>
                  Upload ảnh mới
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) onUpload(page.id, file)
                      event.target.value = ''
                    }}
                  />
                </label>

                <button type="button" className="icon-button" onClick={() => onReset(page.id)}>
                  <span className="round-icon button-icon">
                    <Trash2 size={16} />
                  </span>
                  Xóa / Khôi phục
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImportTools({
  remoteUrl,
  setRemoteUrl,
  onFileImport,
  onRemoteImport,
  error,
  message = '',
}) {
  return (
    <div className="import-tools">
      <div className="import-tools__row">
        <label className="upload-inline upload-inline--solid">
          <span className="round-icon button-icon">
            <Upload size={14} />
          </span>
          Upload Excel
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFileImport(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="import-tools__row import-tools__row--remote">
        <input
          placeholder="Dán link Google Sheet API hoặc endpoint JSON/CSV"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
        />
        <button type="button" className="button-light" onClick={onRemoteImport}>
          Lấy dữ liệu
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}
    </div>
  )
}

function PreviewPanel({ title, source, rows, onApply, onClear }) {
  if (!rows.length) return null

  return (
    <div className="preview-panel">
      <div className="preview-panel__head">
        <div>
          <h3>{title}</h3>
          <p>{source}</p>
        </div>
        <div className="preview-panel__actions">
          <button type="button" className="button-light" onClick={onClear}>
            Xóa preview
          </button>
          <button type="button" className="button-primary" onClick={onApply}>
            Lưu vào Supabase
          </button>
        </div>
      </div>

      <div className="preview-list">
        {rows.map((row) => (
          <div key={row.id} className="preview-row">
            <AvatarCircle advisor={row} />
            <div className="preview-row__content">
              <strong>{row.name}</strong>
              <span>
                {displayTeamName(row.team)} • {formatCompactMoney(row.revenue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App

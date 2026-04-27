import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
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
  TrendingDown,
  TrendingUp,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import defaultThiDuaBanner from './assets/21fd45f3-37f4-43a5-9929-2b509e8a095e.png'
import defaultTopBanner from './assets/69d1e3d6-07e7-473d-b4e1-d1f4ee7598f1.png'
import './App.css'

const SUPABASE_TABLES = {
  advisors: 'advisors',
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
  { id: 'advisors', label: 'Tư vấn viên' },
  { id: 'campaigns', label: 'Chương trình thi đua' },
  { id: 'tbtn', label: 'TBTN / Trưởng nhóm' },
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

const toAdvisorRow = (advisor, index = 0) => ({
  id: String(advisor.id || `advisor-${slugify(advisor.name) || crypto.randomUUID()}`),
  name: advisor.name ?? '',
  team: advisor.team ?? '',
  initials: advisor.initials ?? getInitials(advisor.name),
  revenue: normalizeRevenue(advisor.revenue),
  note: advisor.note ?? '',
  avatar: advisor.avatar ?? '',
  active_status: advisor.active_status ?? advisor.activeStatus ?? true,
  sort_order: index,
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

const sortAdvisorRowsFromSupabase = (rows) => {
  const advisors = safeArray(rows)
  const allSortOrderZero = advisors.length > 0 && advisors.every((row) => Number(row.sort_order || 0) === 0)
  if (allSortOrderZero) return sortByRevenueDesc(advisors)
  return [...advisors].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

const fetchAdvisorRows = async () => {
  console.log('loading advisors from supabase')
  const { data, error } = await supabase
    .from('advisors')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return sortAdvisorRowsFromSupabase(data ?? [])
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
  const [advisorRows, campaignRows, rankingsResult, bannersResult] = await Promise.all([
    fetchAdvisorRows(),
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
    advisors: advisorRows.map(fromAdvisorRow),
    campaigns: campaignRows.map(fromCampaignRow),
    campaignRankings: fromCampaignRankingRows(rankingsResult.data),
    banners: fromBannerRows(bannersResult.data),
    isEmpty:
      !advisorRows.length &&
      !campaignRows.length &&
      !rankingsResult.data.length &&
      !bannersResult.data.length,
  }
}

const saveSupabaseData = async ({ advisors, campaignRankings, banners }) => {
  await replaceTableRows(SUPABASE_TABLES.advisors, 'id', advisors.map(toAdvisorRow))

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

const saveAdvisorsToSupabase = async (advisors) => {
  if (!isSupabaseConfigured) {
    throw new Error('Thiếu cấu hình Supabase. Không thể lưu danh sách tư vấn viên.')
  }

  const rows = safeArray(advisors).map(toAdvisorRow)
  if (!rows.length) {
    throw new Error('Không có dữ liệu tư vấn viên hợp lệ để lưu.')
  }

  console.log('saving advisors to supabase', rows)
  const { data, error } = await supabase
    .from('advisors')
    .upsert(rows, { onConflict: 'id' })
    .select('*')

  if (error) {
    console.error('supabase advisors upsert error', error)
    throw error
  }

  console.log(`supabase advisors upsert success: saved ${data?.length ?? rows.length} rows`, data)
  window.alert('Đã lưu vào Supabase')
  return data
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
  const cleaned = String(value ?? '').replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCompactMoney = (revenue) =>
  `${compactMoneyFormatter.format(Number(revenue || 0) / 1000000)}tr`

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(normalizeRevenue(value))

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
  const revenue = getRawValue(raw, ['Doanh thu', 'AFYP', 'Revenue', 'revenue'], 0)
  const note = getRawValue(raw, ['Ghi chú', 'Ghi chu', 'Note', 'note'])
  const avatar = getRawValue(raw, ['Avatar', 'Avatar URL', 'avatar'])
  const activeStatus = getRawValue(raw, ['active_status', 'Trạng thái', 'Trang thai', 'Active'], true)
  const rawId = getRawValue(raw, ['id', 'ID', 'Mã', 'Ma', 'Mã TVV', 'Ma TVV'])

  if (!String(name).trim()) return null
  const normalizedName = String(name).trim()
  const stableId = rawId ? String(rawId).trim() : `advisor-${slugify(normalizedName) || crypto.randomUUID()}`

  return {
    id: stableId,
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
  const name = getRawValue(raw, ['Tên nhóm', 'tenNhom', 'Nhóm', 'nhom', 'Ten nhom', 'Nhom', 'team', 'Team'])
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
    'Doanh thu của nhóm',
    'Doanh thu',
    'doanhThu',
    'doanhThuNhom',
    'Revenue',
    'AFYP',
  ], 0)
  const contracts = getRawValue(raw, ['Số lượng hợp đồng', 'Hợp đồng', 'soHopDong', 'So hop dong', 'Hop dong', 'contracts'], 0)
  const activeTvv = getRawValue(raw, [
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

  return {
    id: `team-${slugify(teamName) || index}`,
    tenNhom: teamName,
    truongNhom: String(leader || '').trim(),
    avatarTruongNhom: String(avatar || '').trim(),
    doanhThu: normalizeRevenue(revenue),
    soHopDong: Number(contracts || 0) || 0,
    tvvHoatDong: Number(activeTvv || 0) || 0,
    doanhThuHomQua: normalizeRevenue(yesterday),
    doanhThuHomNay: normalizeRevenue(today),
    mocThuongTiepTheo: normalizeRevenue(nextReward),
    sort_order: index,
  }
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

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

function convertCsvRowsToObjects(rows) {
  if (!rows.length) return []
  const [headers, ...body] = rows
  return body.map((row) => {
    const item = {}
    headers.forEach((header, index) => {
      item[header] = row[index] ?? ''
    })
    return item
  })
}

function parseCsvTextToObjects(text) {
  const workbook = XLSX.read(text, { type: 'string' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
}

function convertGoogleSheetUrlToCsvUrl(url, sheetName = '') {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Link Google Sheet không hợp lệ.')
  }

  const spreadsheetId = match[1]
  const parsedUrl = new URL(url)
  const gid = parsedUrl.searchParams.get('gid') || '0'
  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  }
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
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
  const [tbtnRows, setTbtnRows] = useState(() => loadStoredTbtnRows())

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

  const fetchAdvisors = useCallback(async () => {
    if (!isSupabaseConfigured) return []
    const rows = await fetchAdvisorRows()
    const remoteAdvisors = rows.map(fromAdvisorRow)
    setAdvisors((current) => (rowsEqual(current, remoteAdvisors) ? current : remoteAdvisors))
    return remoteAdvisors
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
      .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLES.advisors }, scheduleReload)
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
        advisors={advisors}
        campaigns={campaigns}
        campaignRankings={campaignRankings}
        banners={banners}
        isAdminLoggedIn={isAdminLoggedIn}
        setAdvisors={setAdvisors}
        setCampaignRankings={setCampaignRankings}
        setBanners={setBanners}
        tbtnRows={tbtnRows}
        setTbtnRows={setTbtnRows}
        setIsAdminLoggedIn={setIsAdminLoggedIn}
        fetchAdvisors={fetchAdvisors}
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
  navigate,
}) {
  const [activeTab, setActiveTab] = useState('bang-vang')
  const [activeScreen, setActiveScreen] = useState('main')
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
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
    setTeamOverview((current) =>
      current.loading || current.error ? current : { ...current, rows: tbtnRows },
    )
  }, [tbtnRows])

  const configuredSheets = useMemo(() => {
    const local = (key) => window.localStorage.getItem(key) || ''
    return {
      shared: SHEET_CONFIG.shared || local('autorank_google_sheet_url'),
      topMonth: SHEET_CONFIG.topMonth || local('autorank_top_thang_url'),
      topDay: SHEET_CONFIG.topDay || local('autorank_top_ngay_url'),
      teams: SHEET_CONFIG.teams || local('autorank_tbtn_url'),
    }
  }, [])

  useEffect(() => {
    const loadRankings = async () => {
      const configs = [
        ['month', configuredSheets.topMonth || configuredSheets.shared, 'TopThang'],
        ['day', configuredSheets.topDay || configuredSheets.shared, 'TopNgay'],
      ]

      configs.forEach(async ([period, url, sheetName]) => {
        if (!url) return
        setRemoteRankings((current) => ({
          ...current,
          [period]: { ...current[period], loading: true, error: '' },
        }))
        try {
          const rows = await fetchSheetRows(url, sheetName)
          const normalized = sortByRevenueDesc(rows.map(normalizeImportedAdvisor).filter(Boolean)).slice(0, 10)
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
  }, [configuredSheets])

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
        const rows = await fetchSheetRows(url, 'TBTN')
        if (!isMounted) return
        setTeamOverview({
          rows: rows.map(normalizeImportedTeam).filter(Boolean),
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) return
        setTeamOverview({ rows: [], loading: false, error: error?.message ?? 'Không lấy được dữ liệu.' })
      }
    }

    loadTeams()
    return () => {
      isMounted = false
    }
  }, [configuredSheets, tbtnRows])

  const topMonthRows = remoteRankings.month.rows.length ? remoteRankings.month.rows : advisors
  const topDayRows = remoteRankings.day.rows
  const activeLeaderboardRows = rankingPeriod === 'day' ? topDayRows : topMonthRows
  const activeRankingState = remoteRankings[rankingPeriod]
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
      <button
        type="button"
        className={`bottom-tab ${isMoreMenuOpen ? 'is-active' : ''}`}
        onClick={() => setIsMoreMenuOpen(true)}
      >
        <span className="round-icon bottom-tab__icon">
          <Menu size={20} />
        </span>
        <span className="bottom-tab__label">Menu</span>
      </button>
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
              advisorCount={sortedAdvisors.length}
              rankingPeriod={rankingPeriod}
              onRankingPeriodChange={(period) => {
                setRankingPeriod(period)
                setLeaderboardAnimationKey((current) => current + 1)
              }}
              isLoading={activeRankingState.loading}
              error={activeRankingState.error}
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

        <MoreMenuBottomSheet
          open={isMoreMenuOpen}
          onClose={() => setIsMoreMenuOpen(false)}
          onOpenTbtn={() => {
            setIsMoreMenuOpen(false)
            setActiveScreen('tbtn')
          }}
        />

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
            <div className="podium-section podium-grid">
              <PodiumCard advisor={podium[0]} rank={2} delay={80} />
              <PodiumCard advisor={podium[1]} rank={1} delay={0} />
              <PodiumCard advisor={podium[2]} rank={3} delay={160} />
            </div>

            <div className="section-title">Bảng xếp hạng tiếp theo</div>
            <div className="card-list">
              {rankingRows.map((advisor, index) => (
                <RankingCard
                  key={advisor.id}
                  advisor={advisor}
                  rank={index + 4}
                  delay={240 + index * 80}
                />
              ))}
            </div>
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
  const totalRevenue = teams.reduce((sum, team) => sum + normalizeRevenue(team.doanhThu), 0)
  const totalToday = teams.reduce((sum, team) => sum + normalizeRevenue(team.doanhThuHomNay), 0)
  const totalYesterday = teams.reduce((sum, team) => sum + normalizeRevenue(team.doanhThuHomQua), 0)
  const totalGrowth = totalToday - totalYesterday
  const growthTone = totalGrowth >= 0 ? 'up' : 'down'

  return (
    <section className="screen tbtn-screen">
      <div className="tbtn-header">
        <button type="button" className="back-link tbtn-back" onClick={onBack}>
          <span className="round-icon button-icon">
            <ChevronLeft size={18} />
          </span>
          Quay lại
        </button>
        <div>
          <h1>TBTN - Tổng quan nhóm</h1>
          <span>Hôm nay</span>
        </div>
      </div>

      <div className="screen-body tbtn-body">
        <div className="tbtn-summary-card">
          <span>Tổng doanh thu hệ thống</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
          <div className={`tbtn-summary-card__growth is-${growthTone}`}>
            {growthTone === 'up' ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
            {totalGrowth >= 0 ? '+' : ''}
            {formatCurrency(totalGrowth)} so với hôm qua
          </div>
        </div>

        {isLoading ? <div className="empty-state">Đang tải tổng quan nhóm...</div> : null}
        {!isLoading && error ? <div className="empty-state">Không lấy được dữ liệu TBTN: {error}</div> : null}
        {!isLoading && !error && !teams.length ? (
          <div className="empty-state">Chưa có dữ liệu TBTN từ Google Sheet.</div>
        ) : null}

        {!isLoading && !error && teams.length ? (
          <div className="team-grid">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
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
  return (
    <div className={`avatar-circle avatar-circle--${size}`}>
      {advisor?.avatar ? (
        <img src={advisor.avatar} alt={advisor.name || initials} className="avatar-circle__image" />
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
  advisors,
  campaigns,
  campaignRankings,
  banners,
  tbtnRows,
  isAdminLoggedIn,
  setAdvisors,
  setCampaignRankings,
  setBanners,
  setTbtnRows,
  setIsAdminLoggedIn,
  fetchAdvisors,
  fetchCompetitions,
  navigate,
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [activeAdminTab, setActiveAdminTab] = useState('advisors')
  const [expandedAdvisorId, setExpandedAdvisorId] = useState(null)
  const [expandedCampaignId, setExpandedCampaignId] = useState(null)
  const [advisorPreview, setAdvisorPreview] = useState([])
  const [advisorPreviewSource, setAdvisorPreviewSource] = useState('')
  const [advisorRemoteUrl, setAdvisorRemoteUrl] = useState('')
  const [advisorImportError, setAdvisorImportError] = useState('')
  const [advisorImportMessage, setAdvisorImportMessage] = useState('')
  const [tbtnImportState, setTbtnImportState] = useState({
    remoteUrl: '',
    preview: [],
    source: '',
    error: '',
    message: '',
  })
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

  const alertSupabaseError = (action, supabaseError) => {
    console.error(action, supabaseError)
    window.alert(`${action}: ${supabaseError?.message ?? supabaseError}`)
  }

  const showAdminToast = (message) => {
    setAdminToast(message)
    window.setTimeout(() => setAdminToast(''), 2600)
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

  const updateAdvisor = (id, field, value) => {
    setAdvisors((current) =>
      current.map((advisor) =>
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
    )
  }

  const addAdvisor = () => {
    const id = generateId('advisor')
    setAdvisors((current) => [
      ...current,
      { id, name: 'Tư vấn viên mới', team: 'Đội mới', initials: 'TV', revenue: 0, avatar: '' },
    ])
    setExpandedAdvisorId(id)
  }

  const deleteAdvisor = (id) => {
    setAdvisors((current) => current.filter((advisor) => advisor.id !== id))
    if (expandedAdvisorId === id) setExpandedAdvisorId(null)
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
    try {
      const avatar = await uploadImageToStorage(
        file,
        scope === 'advisors' ? `advisors/${id}` : `campaign-rankings/${campaignId}/${id}`,
      )
      if (scope === 'advisors') {
        updateAdvisor(id, 'avatar', avatar)
        return
      }
      updateCampaignRanking(campaignId, id, 'avatar', avatar)
    } catch (uploadError) {
      console.error(uploadError)
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
    return convertCsvRowsToObjects(parseCsv(await response.text()))
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

  const handleAdvisorExcelImport = async (file) => {
    try {
      const rows = await parseExcelFile(file)
      const normalized = rows.map(normalizeImportedAdvisor).filter(Boolean)
      await saveAdvisorsToSupabase(normalized)
      await fetchAdvisors()
      setAdvisorPreview(normalized)
      setAdvisorPreviewSource(`Excel: ${file.name}`)
      setAdvisorImportError('')
      setAdvisorImportMessage('Đã lưu danh sách TVV lên Supabase.')
    } catch (importError) {
      console.error(importError)
      window.alert(`Không thể lưu danh sách TVV lên Supabase: ${importError?.message ?? importError}`)
      setAdvisorImportError(importError?.message ?? 'Không thể đọc/lưu file Excel. Vui lòng kiểm tra lại file.')
      setAdvisorImportMessage('')
    }
  }

  const handleAdvisorRemoteImport = async () => {
    try {
      const rows = advisorRemoteUrl.includes('docs.google.com')
        ? await fetchGoogleSheetCsvRows(advisorRemoteUrl)
        : await parseRemoteDataset(advisorRemoteUrl)
      const normalized = sortByRevenueDesc(
        rows.map(normalizeImportedAdvisor).filter(Boolean),
      ).slice(0, 10)
      await saveAdvisorsToSupabase(normalized)
      await fetchAdvisors()
      setAdvisorPreview([])
      setAdvisorPreviewSource('')
      setAdvisorImportError('')
      setAdvisorImportMessage('Đã cập nhật Top 10 từ Google Sheet lên Supabase.')
    } catch (remoteError) {
      console.error(remoteError)
      window.alert(`Không thể lưu danh sách TVV lên Supabase: ${remoteError?.message ?? remoteError}`)
      setAdvisorImportError(remoteError.message)
      setAdvisorImportMessage('')
    }
  }

  const applyAdvisorPreview = async () => {
    if (!advisorPreview.length) return
    try {
      await saveAdvisorsToSupabase(advisorPreview)
      await fetchAdvisors()
      setAdvisorPreview([])
      setAdvisorPreviewSource('')
      setAdvisorImportError('')
      setAdvisorImportMessage('Đã lưu danh sách TVV lên Supabase.')
    } catch (previewError) {
      console.error(previewError)
      window.alert(`Không thể lưu danh sách TVV lên Supabase: ${previewError?.message ?? previewError}`)
      setAdvisorImportError(previewError?.message ?? 'Không thể lưu danh sách TVV lên Supabase.')
    }
  }

  const handleTbtnRemoteImport = async () => {
    try {
      const rows = tbtnImportState.remoteUrl.includes('docs.google.com')
        ? await fetchGoogleSheetCsvRows(tbtnImportState.remoteUrl)
        : await parseRemoteDataset(tbtnImportState.remoteUrl)
      const normalized = rows.map(normalizeImportedTeam).filter(Boolean)
      setTbtnImportState((current) => ({
        ...current,
        preview: normalized,
        source: `Google Sheet/API: ${current.remoteUrl}`,
        error: '',
        message: '',
      }))
    } catch (remoteError) {
      setTbtnImportState((current) => ({
        ...current,
        error: remoteError?.message ?? 'Không lấy được dữ liệu TBTN.',
        message: '',
      }))
    }
  }

  const applyTbtnPreview = () => {
    if (!tbtnImportState.preview.length) return
    setTbtnRows(tbtnImportState.preview)
    setTbtnImportState((current) => ({
      ...current,
      preview: [],
      source: '',
      error: '',
      message: 'Đã lưu dữ liệu TBTN vào trình duyệt.',
    }))
    showAdminToast('Đã cập nhật dữ liệu TBTN')
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
      const normalized = rows.map(normalizeImportedAdvisor).filter(Boolean)
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
      const normalized = rows.map(normalizeImportedAdvisor).filter(Boolean)
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
      const normalized = rows.map(normalizeImportedAdvisor).filter(Boolean)
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
      const normalized = rows.map(normalizeImportedAdvisor).filter(Boolean)
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

            {activeAdminTab === 'advisors' && (
              <section className="admin-section">
                <div className="admin-section__head">
                  <div>
                    <h2>Tư vấn viên</h2>
                    <p>Quản lý Top bảng vàng.</p>
                  </div>
                  <button
                    type="button"
                    className="button-primary"
                    aria-label="Thêm tư vấn viên"
                    onClick={addAdvisor}
                  >
                    <span className="round-icon button-icon">
                      <Plus size={18} />
                    </span>
                  </button>
                </div>

                <ImportTools
                  remoteUrl={advisorRemoteUrl}
                  setRemoteUrl={setAdvisorRemoteUrl}
                  onFileImport={handleAdvisorExcelImport}
                  onRemoteImport={handleAdvisorRemoteImport}
                  error={advisorImportError}
                  message={advisorImportMessage}
                />

                <PreviewPanel
                  title="Preview dữ liệu tư vấn viên"
                  source={advisorPreviewSource}
                  rows={advisorPreview}
                  onApply={applyAdvisorPreview}
                  onClear={() => {
                    setAdvisorPreview([])
                    setAdvisorPreviewSource('')
                  }}
                />

                <div className="admin-list">
                  {sortByRevenueDesc(advisors).map((advisor) => {
                    const expanded = expandedAdvisorId === advisor.id
                    return (
                      <div key={advisor.id} className="compact-card">
                        <div className="compact-card__summary">
                          <div className="compact-card__left">
                            <AvatarCircle advisor={advisor} />
                            <div className="compact-card__content">
                              <strong>{advisor.name}</strong>
                              <span>{displayTeamName(advisor.team)}</span>
                            </div>
                          </div>
                          <div className="compact-card__right">
                            <span className="compact-card__value">{formatCompactMoney(advisor.revenue)}</span>
                            <div className="compact-card__actions">
                              <button
                                type="button"
                                className="admin-action-btn admin-action-btn--edit"
                                aria-label={expanded ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}
                                onClick={() =>
                                  setExpandedAdvisorId(expanded ? null : advisor.id)
                                }
                              >
                                <Settings size={17} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="admin-action-btn admin-action-btn--delete"
                                aria-label="Xóa"
                                onClick={() => deleteAdvisor(advisor.id)}
                              >
                                <Trash2 size={17} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {expanded && (
                          <div className="compact-card__editor">
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
                                  onChange={(e) =>
                                    handleAvatarUpload(advisor.id, e.target.files?.[0], 'advisors')
                                  }
                                />
                              </label>
                            </div>

                            <div className="editor-grid">
                              <label>
                                <span>Họ tên</span>
                                <input
                                  value={advisor.name}
                                  onChange={(e) => updateAdvisor(advisor.id, 'name', e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Đội nhóm</span>
                                <input
                                  value={advisor.team}
                                  onChange={(e) => updateAdvisor(advisor.id, 'team', e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Viết tắt</span>
                                <input
                                  value={advisor.initials}
                                  onChange={(e) =>
                                    updateAdvisor(advisor.id, 'initials', e.target.value)
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
                                    updateAdvisor(advisor.id, 'revenue', e.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                                {rankings.map((advisor) => (
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
                                          onChange={(e) =>
                                            handleAvatarUpload(
                                              advisor.id,
                                              e.target.files?.[0],
                                              'campaign',
                                              campaign.id,
                                            )
                                          }
                                        />
                                      </label>
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
                                ))}
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

            {activeAdminTab === 'tbtn' && (
              <section className="admin-section">
                <div className="admin-section__head">
                  <div>
                    <h2>TBTN / Trưởng nhóm</h2>
                    <p>Nhập API Google Sheet, JSON hoặc CSV để cập nhật tổng quan nhóm.</p>
                  </div>
                </div>

                <ImportTools
                  remoteUrl={tbtnImportState.remoteUrl}
                  setRemoteUrl={(value) =>
                    setTbtnImportState((current) => ({ ...current, remoteUrl: value }))
                  }
                  onFileImport={async (file) => {
                    try {
                      const rows = await parseExcelFile(file)
                      setTbtnImportState((current) => ({
                        ...current,
                        preview: rows.map(normalizeImportedTeam).filter(Boolean),
                        source: `Excel: ${file.name}`,
                        error: '',
                        message: '',
                      }))
                    } catch {
                      setTbtnImportState((current) => ({
                        ...current,
                        error: 'Không đọc được file TBTN. Vui lòng kiểm tra lại.',
                        message: '',
                      }))
                    }
                  }}
                  onRemoteImport={handleTbtnRemoteImport}
                  error={tbtnImportState.error}
                  message={tbtnImportState.message}
                />

                <TeamPreviewPanel
                  title="Preview TBTN / Trưởng nhóm"
                  source={tbtnImportState.source}
                  rows={tbtnImportState.preview}
                  onApply={applyTbtnPreview}
                  onClear={() =>
                    setTbtnImportState((current) => ({
                      ...current,
                      preview: [],
                      source: '',
                      error: '',
                    }))
                  }
                />

                <div className="admin-section__head admin-section__head--compact">
                  <div>
                    <h2>Dữ liệu đang dùng</h2>
                    <p>{tbtnRows.length} nhóm đã lưu trong trình duyệt.</p>
                  </div>
                </div>

                <div className="admin-list">
                  {tbtnRows.length ? (
                    tbtnRows.map((team) => <TeamAdminRow key={team.id} team={team} />)
                  ) : (
                    <div className="empty-state">Chưa có dữ liệu TBTN.</div>
                  )}
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
    <div className="more-menu-overlay" onClick={onClose}>
      <div className="more-menu-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="more-menu-sheet__handle" />
        <div className="more-menu-sheet__head">
          <h2>Menu</h2>
          <button type="button" className="more-menu-sheet__close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
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
    </div>
  )
}

function TeamPreviewPanel({ title, source, rows, onApply, onClear }) {
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
            Lưu dữ liệu TBTN
          </button>
        </div>
      </div>

      <div className="preview-list">
        {rows.map((team) => (
          <TeamAdminRow key={team.id} team={team} />
        ))}
      </div>
    </div>
  )
}

function TeamAdminRow({ team }) {
  return (
    <div className="preview-row team-preview-row">
      <TeamAvatar team={team} />
      <div className="preview-row__content">
        <strong>{team.tenNhom}</strong>
        <span>
          {team.truongNhom || 'Chưa có trưởng nhóm'} - {formatCompactMoney(team.doanhThu)} - {team.tvvHoatDong || 0} TVV
        </span>
      </div>
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

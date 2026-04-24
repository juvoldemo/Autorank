import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  CalendarDays,
  ChevronLeft,
  Flame,
  Medal,
  Plus,
  Settings,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import defaultThiDuaBanner from './assets/21fd45f3-37f4-43a5-9929-2b509e8a095e.png'
import defaultTopBanner from './assets/69d1e3d6-07e7-473d-b4e1-d1f4ee7598f1.png'
import './App.css'

const SUPABASE_TABLES = {
  advisors: 'advisors',
  campaigns: 'campaigns',
  campaignRankings: 'campaign_rankings',
  banners: 'page_banners',
}

const STORAGE_KEYS = {
  advisors: 'bvnt_advisors_v2',
  campaigns: 'bvnt_campaigns_v2',
  campaignRankings: 'bvnt_campaign_rankings_v2',
  banners: 'bvnt_page_banners_v1',
}

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

const defaultAdvisors = [
  { id: 'a1', name: 'Nguyễn Nữ Đức Hiền', team: 'Nguyên Phát', initials: 'NH', revenue: 163000000, avatar: '' },
  { id: 'a2', name: 'Trần Thị Minh Thơ', team: 'Nha Trang 5', initials: 'TT', revenue: 125200000, avatar: '' },
  { id: 'a3', name: 'Lê Thị Mỹ Lệ', team: 'Tâm Phát', initials: 'LL', revenue: 122700000, avatar: '' },
  { id: 'a4', name: 'Huỳnh Thị Thu Lan', team: 'Nguyên Phát', initials: 'HL', revenue: 87700000, avatar: '' },
  { id: 'a5', name: 'Nguyễn Tấn Trung', team: 'Quyết Thắng', initials: 'NT', revenue: 77500000, avatar: '' },
  { id: 'a6', name: 'Bùi Thị Vân', team: 'Quyết Thắng', initials: 'BV', revenue: 72100000, avatar: '' },
  { id: 'a7', name: 'Đỗ Trọng Nguyên', team: 'Thuận Phát', initials: 'ĐN', revenue: 70200000, avatar: '' },
  { id: 'a8', name: 'Hoàng Nguyễn Lan Chi', team: 'Hồng Đức', initials: 'HC', revenue: 60900000, avatar: '' },
  { id: 'a9', name: 'Phạm Hoàng Ngân', team: 'Khánh Hòa 2', initials: 'PN', revenue: 57400000, avatar: '' },
  { id: 'a10', name: 'Đặng Trần Khoa', team: 'Khánh Hòa 1', initials: 'ĐK', revenue: 54100000, avatar: '' },
]

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

const normalizeTeamName = (teamName) => {
  let normalized = String(teamName || '').trim().replace(/\s+/g, ' ')
  const prefixPattern = /^(doi|đội|ban|nhom|nhóm|to|tổ|pdt|pđt|ip)\s+/i

  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, '').trim()
  }

  return normalized
}

const displayTeamName = (teamName) => normalizeTeamName(teamName) || 'Chưa cập nhật'

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const repairStoredText = (value) => {
  if (typeof value === 'string') return TEXT_REPAIRS[value] ?? value
  if (Array.isArray(value)) return value.map(repairStoredText)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, repairStoredText(item)]),
  )
}

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (storageError) {
    console.error(storageError)
    return false
  }
}

const isValidBannerImage = (image) =>
  typeof image === 'string' &&
  (image === '' || image.startsWith('data:image/') || /^https?:\/\//i.test(image))

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

const toAdvisorRow = (advisor, index = 0) => ({
  id: String(advisor.id),
  name: advisor.name ?? '',
  team: advisor.team ?? '',
  initials: advisor.initials ?? getInitials(advisor.name),
  revenue: normalizeRevenue(advisor.revenue),
  avatar: advisor.avatar ?? '',
  sort_order: index,
})

const fromAdvisorRow = (row) => ({
  id: row.id,
  name: row.name ?? '',
  team: row.team ?? '',
  initials: row.initials ?? getInitials(row.name),
  revenue: normalizeRevenue(row.revenue),
  avatar: row.avatar ?? '',
})

const toCampaignRow = (campaign, index = 0) => ({
  id: String(campaign.id),
  title: campaign.title ?? '',
  image: campaign.image ?? '',
  start_date: campaign.startDate || null,
  end_date: campaign.endDate || null,
  status: campaign.status ?? 'active',
  details: campaign.details ?? '',
  sort_order: index,
})

const fromCampaignRow = (row) => ({
  id: row.id,
  title: row.title ?? '',
  image: row.image ?? '',
  startDate: row.start_date ?? '',
  endDate: row.end_date ?? '',
  status: row.status ?? 'active',
  details: row.details ?? '',
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

const loadSupabaseData = async () => {
  const [advisorsResult, campaignsResult, rankingsResult, bannersResult] = await Promise.all([
    supabase.from(SUPABASE_TABLES.advisors).select('*').order('sort_order', { ascending: true }),
    supabase.from(SUPABASE_TABLES.campaigns).select('*').order('sort_order', { ascending: true }),
    supabase
      .from(SUPABASE_TABLES.campaignRankings)
      .select('*')
      .order('campaign_id', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from(SUPABASE_TABLES.banners).select('*'),
  ])

  const results = [advisorsResult, campaignsResult, rankingsResult, bannersResult]
  const failed = results.find((result) => result.error)
  if (failed) throw failed.error

  return {
    advisors: advisorsResult.data.map(fromAdvisorRow),
    campaigns: campaignsResult.data.map(fromCampaignRow),
    campaignRankings: fromCampaignRankingRows(rankingsResult.data),
    banners: fromBannerRows(bannersResult.data),
    isEmpty:
      !advisorsResult.data.length &&
      !campaignsResult.data.length &&
      !rankingsResult.data.length &&
      !bannersResult.data.length,
  }
}

const saveSupabaseData = async ({ advisors, campaigns, campaignRankings, banners }) => {
  await replaceTableRows(SUPABASE_TABLES.advisors, 'id', advisors.map(toAdvisorRow))
  await replaceTableRows(SUPABASE_TABLES.campaigns, 'id', campaigns.map(toCampaignRow))

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

const normalizeRevenue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '').replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCompactMoney = (revenue) =>
  `${compactMoneyFormatter.format(Number(revenue || 0) / 1000000)}tr`

const formatStatusLabel = (status) =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Chưa xác định'

const parseLocalDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const getCampaignTimeBadge = (campaign) => {
  if (campaign.status === 'upcoming') return { label: 'Sắp bắt đầu', tone: 'upcoming' }
  if (campaign.status === 'ended') return { label: 'Đã kết thúc', tone: 'ended' }

  const endDate = parseLocalDate(campaign.endDate)
  if (!endDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400000)
  if (daysLeft > 0) return { label: `Còn ${daysLeft} ngày`, tone: 'active' }
  if (daysLeft === 0) return { label: 'Kết thúc hôm nay', tone: 'today' }
  return { label: 'Đã kết thúc', tone: 'ended' }
}

const sortByRevenueDesc = (rows) =>
  [...rows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))

async function fileToDataUrl(file) {
  if (!file) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Không thể đọc file.'))
    reader.readAsDataURL(file)
  })
}

function normalizeImportedAdvisor(raw) {
  const name =
    raw['Họ tên'] ??
    raw['Ho ten'] ??
    raw.Name ??
    raw.name ??
    raw['Họ và tên'] ??
    ''
  const team =
    raw['Đội'] ??
    raw['Tên đội'] ??
    raw['Tên Đội'] ??
    raw['Tên Nhóm'] ??
    raw['Tên nhóm'] ??
    raw['Đội nhóm'] ??
    raw.Nhom ??
    raw.Team ??
    raw.team ??
    ''
  const initials =
    raw['Viết tắt'] ?? raw['Viet tat'] ?? raw.Initials ?? raw.initials ?? getInitials(name)
  const revenue =
    raw['Doanh thu'] ?? raw.Revenue ?? raw.AFYP ?? raw.revenue ?? raw['AFYP'] ?? 0
  const avatar = raw.Avatar ?? raw['Avatar URL'] ?? raw.avatar ?? ''

  if (!String(name).trim()) return null

  return {
    id: generateId('row'),
    name: String(name).trim(),
    team: String(team || '').trim(),
    initials: String(initials || getInitials(name)).toUpperCase().slice(0, 2),
    revenue: normalizeRevenue(revenue),
    avatar: String(avatar || '').trim(),
  }
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

function convertGoogleSheetUrlToCsvUrl(url) {
  const match = String(url).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Link Google Sheet không hợp lệ.')
  }

  const spreadsheetId = match[1]
  const parsedUrl = new URL(url)
  const gid = parsedUrl.searchParams.get('gid') || '0'
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
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
  const [advisors, setAdvisors] = useState(() =>
    safeArray(repairStoredText(readStorage(STORAGE_KEYS.advisors, defaultAdvisors)), defaultAdvisors),
  )
  const [campaigns, setCampaigns] = useState(() =>
    safeArray(repairStoredText(readStorage(STORAGE_KEYS.campaigns, defaultCampaigns)), defaultCampaigns),
  )
  const [campaignRankings, setCampaignRankings] = useState(() => {
    const stored = repairStoredText(readStorage(STORAGE_KEYS.campaignRankings, defaultCampaignRankings))
    return stored && typeof stored === 'object' ? stored : defaultCampaignRankings
  })
  const [banners, setBanners] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.banners, defaultBanners)
    return normalizeBanners(stored)
  })
  const initialSupabaseData = useRef(null)

  if (initialSupabaseData.current == null) {
    initialSupabaseData.current = {
      advisors,
      campaigns,
      campaignRankings,
      banners: normalizeBanners(banners),
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let isMounted = true
    let reloadTimer = null

    const applyRemoteData = (remoteData) => {
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
    }

    const reloadFromSupabase = async () => {
      try {
        const remoteData = await loadSupabaseData()
        if (!isMounted) return

        if (remoteData.isEmpty) {
          await saveSupabaseData(initialSupabaseData.current)
        } else {
          applyRemoteData(remoteData)
        }

        hasHydratedSupabase.current = true
      } catch (supabaseError) {
        console.error(supabaseError)
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
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) return
    writeStorage(STORAGE_KEYS.advisors, advisors)
    writeStorage(STORAGE_KEYS.campaigns, campaigns)
    writeStorage(STORAGE_KEYS.campaignRankings, campaignRankings)
    writeStorage(STORAGE_KEYS.banners, normalizeBanners(banners))
  }, [advisors, campaigns, campaignRankings, banners])

  useEffect(() => {
    if (!isSupabaseConfigured || !hasHydratedSupabase.current || isApplyingRemoteData.current) return

    saveSupabaseData({
      advisors,
      campaigns,
      campaignRankings,
      banners: normalizeBanners(banners),
    }).catch((supabaseError) => {
      console.error(supabaseError)
    })
  }, [advisors, campaigns, campaignRankings, banners])

  if (pathname === '/admin') {
    return (
      <AdminView
        advisors={advisors}
        campaigns={campaigns}
        campaignRankings={campaignRankings}
        banners={banners}
        isAdminLoggedIn={isAdminLoggedIn}
        setAdvisors={setAdvisors}
        setCampaigns={setCampaigns}
        setCampaignRankings={setCampaignRankings}
        setBanners={setBanners}
        setIsAdminLoggedIn={setIsAdminLoggedIn}
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
      navigate={navigate}
    />
  )
}

function MobileAppShell({ children, bottomNav = null, className = '' }) {
  return (
    <div className="mobile-page">
      <div className={`mobile-shell ${className}`.trim()}>
        {children}
        {bottomNav}
      </div>
    </div>
  )
}

function MainView({
  advisors,
  campaigns,
  campaignRankings,
  banners,
  setBanners,
  navigate,
}) {
  const [activeTab, setActiveTab] = useState('bang-vang')
  const [leaderboardAnimationKey, setLeaderboardAnimationKey] = useState(0)
  const [competitionFilter, setCompetitionFilter] = useState('active')
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [modalType, setModalType] = useState(null)

  const sortedAdvisors = useMemo(() => sortByRevenueDesc(advisors).slice(0, 10), [advisors])
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
      const image = await fileToDataUrl(file)
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
    </nav>
  )

  return (
    <MobileAppShell className="main-shell" bottomNav={bottomNav}>
      <main className="mobile-content mobile-scroll">
          {activeTab === 'bang-vang' && (
            <BangVangTab
              key={`bang-vang-${leaderboardAnimationKey}`}
              podium={podium}
              rankingRows={rankingRows}
              bannerImage={getBannerImage(banners, 'bang-vang')}
              onBannerUpload={(file) => updatePageBanner('bang-vang', file)}
              onAdminAccess={() => navigate('/admin')}
            />
          )}
          {activeTab === 'thi-dua' && (
            <ThiDuaTab
              campaigns={filteredCampaigns}
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
    </MobileAppShell>
  )
}

function BangVangTab({
  podium,
  rankingRows,
  bannerImage,
  onBannerUpload,
  onAdminAccess,
}) {
  return (
    <section className="screen">
      <LeaderboardUploadBanner
        image={bannerImage}
        canEdit={false}
        onUpload={onBannerUpload}
        onAdminAccess={onAdminAccess}
      />

      <div className="screen-body">
        <div className="podium-grid">
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
  counts,
  currentFilter,
  onFilterChange,
  onOpenDetail,
  onOpenRanking,
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
  if (!advisor) return <div />
  const tierLabel = rank === 1 ? 'Vàng' : rank === 2 ? 'Bạc' : 'Đồng'

  return (
    <div
      className={`podium-card podium-animated ${rank === 1 ? 'is-first' : ''}`}
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

function CampaignCard({ campaign, onOpenDetail, onOpenRanking }) {
  const timeBadge = getCampaignTimeBadge(campaign)

  return (
    <article className="campaign-card">
      <CampaignVisual campaign={campaign} />
      <div className="campaign-card__body">
        <h3>{campaign.title}</h3>
        <p>{campaign.details}</p>
        <div className="campaign-meta">
          <CalendarDays size={16} />
          <span>
            {campaign.startDate} - {campaign.endDate}
          </span>
        </div>
        {timeBadge ? (
          <div className="campaign-badges">
            <span className={`campaign-time-badge campaign-time-badge--${timeBadge.tone}`}>
              <CalendarDays size={12} strokeWidth={2} />
              {timeBadge.label}
            </span>
          </div>
        ) : null}
        <div className="campaign-actions">
          <button type="button" className="button-light" onClick={onOpenDetail}>
            Chi tiết
          </button>
          <button type="button" className="button-primary" onClick={onOpenRanking}>
            BXH
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

function ModalShell({ title, children, onClose }) {
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
  isAdminLoggedIn,
  setAdvisors,
  setCampaigns,
  setCampaignRankings,
  setBanners,
  setIsAdminLoggedIn,
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
  const [campaignImportState, setCampaignImportState] = useState({})

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

  const updateCampaign = (id, field, value) => {
    setCampaigns((current) =>
      current.map((campaign) => (campaign.id === id ? { ...campaign, [field]: value } : campaign)),
    )
  }

  const addCampaign = () => {
    const id = generateId('campaign')
    setCampaigns((current) => [
      ...current,
      {
        id,
        title: 'Chương trình mới',
        image: '',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        status: 'active',
        details: 'Mô tả chương trình',
      },
    ])
    setCampaignRankings((current) => ({ ...current, [id]: [] }))
    setExpandedCampaignId(id)
  }

  const deleteCampaign = (id) => {
    setCampaigns((current) => current.filter((campaign) => campaign.id !== id))
    setCampaignRankings((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (expandedCampaignId === id) setExpandedCampaignId(null)
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
      const avatar = await fileToDataUrl(file)
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
      const image = await fileToDataUrl(file)
      updateCampaign(id, 'image', image)
    } catch (uploadError) {
      console.error(uploadError)
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
      setAdvisorPreview(normalized)
      setAdvisorPreviewSource(`Excel: ${file.name}`)
      setAdvisorImportError('')
      setAdvisorImportMessage('')
    } catch {
      setAdvisorImportError('Không thể đọc file Excel. Vui lòng kiểm tra lại file.')
      setAdvisorImportMessage('')
    }
  }

  const handleAdvisorRemoteImport = async () => {
    try {
      const rows = await fetchGoogleSheetCsvRows(advisorRemoteUrl)
      const normalized = sortByRevenueDesc(
        rows.map(normalizeImportedAdvisor).filter(Boolean),
      ).slice(0, 10)
      setAdvisors(normalized)
      setAdvisorPreview([])
      setAdvisorPreviewSource('')
      setAdvisorImportError('')
      setAdvisorImportMessage('Đã cập nhật Top 10 từ Google Sheet.')
    } catch (remoteError) {
      setAdvisorImportError(remoteError.message)
      setAdvisorImportMessage('')
    }
  }

  const applyAdvisorPreview = () => {
    if (!advisorPreview.length) return
    setAdvisors(advisorPreview)
    setAdvisorPreview([])
    setAdvisorPreviewSource('')
    setAdvisorImportMessage('')
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

  const updatePageBanner = async (pageId, file) => {
    if (!bannerPageIds.has(pageId) || !file?.type?.startsWith('image/')) return

    try {
      const image = await fileToDataUrl(file)
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
                    onClick={addCampaign}
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
                                <span>Trạng thái</span>
                                <select
                                  value={campaign.status}
                                  onChange={(e) =>
                                    updateCampaign(campaign.id, 'status', e.target.value)
                                  }
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
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
    </MobileAppShell>
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

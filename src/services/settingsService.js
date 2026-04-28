import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const SETTINGS_TABLE = 'app_settings'
const LOGS_TABLE = 'import_logs'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

export const DATA_SETTING_KEYS = {
  topMonthUrl: 'google_sheet_monthly_url',
  topDayUrl: 'google_sheet_daily_url',
  tbtnUrl: 'google_sheet_tbtn_url',
}

const LEGACY_DATA_SETTING_KEYS = {
  [DATA_SETTING_KEYS.topMonthUrl]: 'top_month_sheet_url',
  [DATA_SETTING_KEYS.topDayUrl]: 'top_day_sheet_url',
  [DATA_SETTING_KEYS.tbtnUrl]: 'tbtn_sheet_url',
}

const normalizeSettings = (rows) => {
  const settings = (rows ?? []).reduce((items, row) => ({ ...items, [row.key]: row.value ?? '' }), {})
  Object.entries(LEGACY_DATA_SETTING_KEYS).forEach(([currentKey, legacyKey]) => {
    if (!settings[currentKey] && settings[legacyKey]) settings[currentKey] = settings[legacyKey]
  })
  return settings
}

let settingsCache = {}

export async function loadSettingsFromSupabase() {
  try {
    ensureSupabase()
    const { data, error } = await supabase.from(SETTINGS_TABLE).select('*')
    if (error) throw error
    settingsCache = normalizeSettings(data)
    return settingsCache
  } catch (error) {
    console.error('loadSettingsFromSupabase error', error)
    throw new Error(`Không tải được cấu hình dữ liệu: ${error.message}`, { cause: error })
  }
}

export const fetchAppSettings = loadSettingsFromSupabase

export async function saveSettingsToSupabase(settings) {
  try {
    ensureSupabase()
    const rows = Object.entries(settings)
      .filter(([key]) => Object.values(DATA_SETTING_KEYS).includes(key))
      .map(([key, value]) => ({
      key,
      value: String(value ?? '').trim(),
      updated_at: new Date().toISOString(),
    }))
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(rows, { onConflict: 'key' })
      .select('*')
    if (error) throw error
    settingsCache = { ...settingsCache, ...normalizeSettings(data) }
    return data ?? []
  } catch (error) {
    console.error('saveSettingsToSupabase error', error)
    throw new Error(`Không lưu được cấu hình dữ liệu: ${error.message}`, { cause: error })
  }
}

export const saveAppSettings = saveSettingsToSupabase

export async function getSettingValue(key) {
  if (!settingsCache[key]) {
    await loadSettingsFromSupabase()
  }
  return settingsCache[key] ?? ''
}

export async function fetchImportLogs(limit = 20) {
  try {
    ensureSupabase()
    const { data, error } = await supabase
      .from(LOGS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('fetchImportLogs error', error)
    throw new Error(`Không tải được lịch sử import: ${error.message}`, { cause: error })
  }
}

export async function createImportLog(log) {
  try {
    ensureSupabase()
    const row = {
      import_type: log.import_type,
      source_name: log.source_name ?? '',
      status: log.status ?? 'success',
      message: log.message ?? '',
      total_rows: Number(log.total_rows ?? 0),
    }
    const { data, error } = await supabase.from(LOGS_TABLE).insert(row).select('*').single()
    if (error) throw error
    return data
  } catch (error) {
    console.error('createImportLog error', error)
    throw new Error(`Không ghi được lịch sử import: ${error.message}`, { cause: error })
  }
}

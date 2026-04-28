import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const SETTINGS_TABLE = 'app_settings'
const LOGS_TABLE = 'import_logs'

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.')
  }
}

export const DATA_SETTING_KEYS = {
  topMonthUrl: 'top_month_sheet_url',
  topDayUrl: 'top_day_sheet_url',
  driveFolderUrl: 'phibaohiem_drive_folder_url',
  tbtnUrl: 'tbtn_sheet_url',
}

export async function fetchAppSettings() {
  try {
    ensureSupabase()
    const { data, error } = await supabase.from(SETTINGS_TABLE).select('*')
    if (error) throw error
    return (data ?? []).reduce((items, row) => ({ ...items, [row.key]: row.value ?? '' }), {})
  } catch (error) {
    console.error('fetchAppSettings error', error)
    throw new Error(`Không tải được cấu hình dữ liệu: ${error.message}`, { cause: error })
  }
}

export async function saveAppSettings(settings) {
  try {
    ensureSupabase()
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value ?? '').trim(),
    }))
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(rows, { onConflict: 'key' })
      .select('*')
    if (error) throw error
    return data ?? []
  } catch (error) {
    console.error('saveAppSettings error', error)
    throw new Error(`Không lưu được cấu hình dữ liệu: ${error.message}`, { cause: error })
  }
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

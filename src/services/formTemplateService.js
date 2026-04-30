import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const TABLE = 'form_templates'
const BUCKET = 'form-templates'

export const FORM_TEMPLATE_CATEGORIES = [
  { value: 'health_supplement', label: 'Bổ sung sức khỏe', color: 'gold', icon: 'folder' },
  { value: 'contract_issue', label: 'Phát hành hợp đồng', color: 'green', icon: 'file-text' },
  { value: 'contract_management', label: 'Quản lý hợp đồng', color: 'blue', icon: 'folder' },
]

export const DEFAULT_FORM_CATEGORIES = FORM_TEMPLATE_CATEGORIES.map((category, index) => ({
  id: category.value,
  slug: category.value,
  name: category.label,
  color: category.color,
  icon: category.icon,
  sort_order: index + 1,
  is_active: true,
}))

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Thiếu cấu hình Supabase.')
}

export const getFormCategoryLabel = (value) =>
  FORM_TEMPLATE_CATEGORIES.find((category) => category.value === value)?.label || value || 'Chưa chọn nghiệp vụ'

export const getFormCategoryMeta = (value) =>
  FORM_TEMPLATE_CATEGORIES.find((category) => category.value === value) || FORM_TEMPLATE_CATEGORIES[0]

export const slugifyFormValue = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'mau-bieu'

const sortTemplates = (rows) =>
  [...(rows ?? [])].sort((left, right) => {
    const categoryDelta =
      FORM_TEMPLATE_CATEGORIES.findIndex((category) => category.value === left.category) -
      FORM_TEMPLATE_CATEGORIES.findIndex((category) => category.value === right.category)
    if (categoryDelta) return categoryDelta
    return new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0)
  })

export async function fetchFormTemplates({ includeInactive = false } = {}) {
  if (!isSupabaseConfigured) return []
  ensureSupabase()
  let query = supabase
    .from(TABLE)
    .select('*')
    .in('category', FORM_TEMPLATE_CATEGORIES.map((category) => category.value))
    .order('updated_at', { ascending: false })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) {
    if (/form_templates|schema cache/i.test(error.message ?? '')) return []
    throw error
  }
  return sortTemplates(data ?? [])
}

export async function uploadFormTemplatePdf(file, category) {
  ensureSupabase()
  if (!file) throw new Error('Vui lòng chọn file PDF.')
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) throw new Error('Chỉ hỗ trợ upload file PDF.')
  const objectPath = `${category || 'forms'}/${slugifyFormValue(file.name.replace(/\.pdf$/i, ''))}-${Date.now()}.pdf`
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'application/pdf',
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  return {
    file_url: data.publicUrl,
    file_path: objectPath,
    file_name: file.name,
  }
}

export async function saveFormTemplate({ title, category, is_active = true, file }) {
  ensureSupabase()
  const cleanTitle = String(title || '').trim()
  const cleanCategory = String(category || '').trim()
  if (!cleanTitle) throw new Error('Vui lòng nhập tên mẫu biểu.')
  if (!FORM_TEMPLATE_CATEGORIES.some((item) => item.value === cleanCategory)) throw new Error('Vui lòng chọn nghiệp vụ.')
  if (!file) throw new Error('Vui lòng chọn file PDF.')
  const uploaded = await uploadFormTemplatePdf(file, cleanCategory)
  const row = {
    title: cleanTitle,
    category: cleanCategory,
    file_url: uploaded.file_url,
    file_path: uploaded.file_path,
    is_active,
  }
  const { data, error } = await supabase.from(TABLE).insert(row).select('*').single()
  if (error) throw error
  return { ...data, file_name: uploaded.file_name }
}

export async function setFormTemplateActive(id, isActive) {
  ensureSupabase()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteFormTemplate(template) {
  ensureSupabase()
  if (template?.file_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([template.file_path])
    if (storageError) console.warn('Không thể xóa file mẫu biểu khỏi Storage', storageError)
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', template.id)
  if (error) throw error
}

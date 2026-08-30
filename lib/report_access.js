const REPORT_ID_REGEX = /^[a-zA-Z0-9._:-]{1,200}$/;

function reportId(report) {
  return String(report?.id || report?.fileId || '');
}

function reportOwnerId(report) {
  return String(report?.user_id || report?.userId || '');
}

function reportIsPublic(report) {
  return Boolean(report?.is_public || report?.isPublic || report?.inPool || report?.in_pool);
}

function reportIsDeleted(report) {
  return Boolean(report?.is_deleted || report?.isDeleted || report?.deletedAt || report?.deleted_at);
}

function canReadReport(user, report) {
  if (!user || !report) return false;
  if (user.role === 'admin') return true;
  if (reportOwnerId(report) === String(user.id)) return true;
  return reportIsPublic(report) && !reportIsDeleted(report);
}

function canManageReport(user, report) {
  if (!user || !report) return false;
  return user.role === 'admin' || reportOwnerId(report) === String(user.id);
}

function boundedString(value, maxLength, fallback = '') {
  const result = String(value ?? fallback);
  return result.length <= maxLength ? result : result.slice(0, maxLength);
}

function buildOwnedReportRow(report, user, { ownerId = user?.id } = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Geçerli bir rapor nesnesi gereklidir.');
  }
  const id = reportId(report);
  if (!REPORT_ID_REGEX.test(id)) throw new Error('Geçersiz rapor kimliği.');
  if (!user?.id || !ownerId) throw new Error('Rapor sahibi gereklidir.');

  const ownerName = boundedString(user.full_name || user.fullName || user.username, 200);
  const ownerUsername = boundedString(user.username, 100);
  const ownerDepartment = boundedString(user.department, 200);
  const isPublic = reportIsPublic(report);
  const isDeleted = Boolean(report.isDeleted || report.is_deleted);
  const now = new Date().toISOString();
  const sharedAt = isPublic ? (report.sharedAt || report.shared_at || now) : null;
  const deletedAt = isDeleted ? (report.deletedAt || report.deleted_at || now) : null;

  const safeData = {
    ...report,
    id,
    userId: String(ownerId),
    user_id: String(ownerId),
    isPublic,
    is_public: isPublic,
    isDeleted,
    is_deleted: isDeleted,
    ownerName,
    owner_name: ownerName,
    ownerUsername,
    owner_username: ownerUsername,
    ownerDepartment,
    owner_department: ownerDepartment,
    sharedAt,
    shared_at: sharedAt,
    deletedAt,
    deleted_at: deletedAt
  };

  return {
    id,
    name: boundedString(report.name || report.fileName, 300, 'İsimsiz Rapor'),
    user_id: String(ownerId),
    file_size: Math.max(0, Number(report.sizeBytes || report.size || report.file_size || 0) || 0),
    category: boundedString(report.category, 150),
    tags: Array.isArray(report.tags) ? report.tags.slice(0, 100).map(tag => boundedString(tag, 100)) : [],
    user_note: boundedString(report.userNote || report.user_note, 5000),
    is_favorite: Boolean(report.isFavorite || report.favorite || report.is_favorite),
    is_pinned: Boolean(report.isPinned || report.pinned || report.is_pinned),
    is_deleted: isDeleted,
    is_public: isPublic,
    owner_name: ownerName,
    owner_username: ownerUsername,
    owner_department: ownerDepartment,
    shared_at: sharedAt,
    deleted_at: deletedAt,
    sql_count: Array.isArray(report.queries) ? report.queries.length : Number(report.stats?.sqlCount || report.sql_count || 0) || 0,
    memo_count: Array.isArray(report.memos) ? report.memos.length : Number(report.stats?.memoCount || report.memo_count || 0) || 0,
    dataset_count: Array.isArray(report.datasets) ? report.datasets.length : Number(report.dataset_count || 0) || 0,
    page_count: Array.isArray(report.pages) ? report.pages.length : Number(report.stats?.pageCount || report.page_count || 1) || 1,
    has_script: Boolean(report.pascalScript && String(report.pascalScript).trim()),
    data: safeData,
    updated_at: now
  };
}

function reportRowToClient(row) {
  const data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
  return {
    ...data,
    id: String(row.id),
    name: row.name || data.name || 'İsimsiz Rapor',
    userId: row.user_id,
    user_id: row.user_id,
    sizeBytes: Number(row.file_size || data.sizeBytes || 0),
    category: row.category || data.category || '',
    tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(data.tags) ? data.tags : []),
    userNote: row.user_note || data.userNote || '',
    isFavorite: Boolean(row.is_favorite),
    isPinned: Boolean(row.is_pinned),
    isDeleted: Boolean(row.is_deleted),
    isPublic: Boolean(row.is_public),
    ownerName: row.owner_name || '',
    ownerUsername: row.owner_username || '',
    ownerDepartment: row.owner_department || '',
    sharedAt: row.shared_at || null,
    deletedAt: row.deleted_at || null,
    loadedAt: row.updated_at || data.loadedAt || null
  };
}

module.exports = {
  REPORT_ID_REGEX,
  buildOwnedReportRow,
  canManageReport,
  canReadReport,
  reportId,
  reportIsDeleted,
  reportIsPublic,
  reportOwnerId,
  reportRowToClient
};

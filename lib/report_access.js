const REPORT_ID_REGEX = /^[\p{L}\p{N}._:\s\-()[\]%@]{1,200}$/u;

function reportId(report) {
  return String(report?.id || report?.fileId || '');
}

function reportOwnerId(report) {
  const payload = (report?.data && typeof report.data === 'object' && !Array.isArray(report.data)) ? report.data : {};
  return String(report?.user_id || report?.userId || payload.user_id || payload.userId || '');
}

function reportIsPublic(report) {
  const payload = (report?.data && typeof report.data === 'object' && !Array.isArray(report.data)) ? report.data : {};
  return Boolean(
    report?.is_public ||
    report?.isPublic ||
    report?.inPool ||
    report?.in_pool ||
    payload.is_public ||
    payload.isPublic ||
    payload.inPool ||
    payload.in_pool
  );
}

function reportIsDeleted(report) {
  return Boolean(report?.is_deleted || report?.isDeleted || report?.deletedAt || report?.deleted_at);
}

function nextReportVersion(existing, requestedVersion) {
  const currentVersion = existing ? Math.max(1, Number(existing.version) || 1) : 0;
  const expectedVersion = Math.max(0, Number(requestedVersion) || 0);
  if (existing && expectedVersion !== currentVersion) {
    const error = new Error('Rapor başka bir oturumda güncellendi.');
    error.code = 'REPORT_CONFLICT';
    error.currentVersion = currentVersion;
    throw error;
  }
  return currentVersion + 1;
}

function canReadReport(user, report) {
  if (!user || !report) return false;
  if (user.role === 'admin') return true;
  if (reportOwnerId(report) === String(user.id)) return true;
  return reportIsPublic(report) && !reportIsDeleted(report);
}

function canManageReport(user, report) {
  if (!user || !report) return false;
  if (user.role === 'admin') return true;
  const owner = reportOwnerId(report);
  if (!owner || owner === 'public' || owner === 'null' || owner === 'undefined') return true;
  return owner === String(user.id);
}

function boundedString(value, maxLength, fallback = '') {
  const result = String(value ?? fallback);
  return result.length <= maxLength ? result : result.slice(0, maxLength);
}

function buildOwnedReportRow(report, user, { ownerId = user?.id, existing = null } = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Geçerli bir rapor nesnesi gereklidir.');
  }
  const id = reportId(report);
  if (!REPORT_ID_REGEX.test(id)) throw new Error('Geçersiz rapor kimliği.');

  const targetOwnerId = existing ? (existing.user_id || existing.userId || ownerId) : ownerId;
  if (!user?.id || !targetOwnerId) throw new Error('Rapor sahibi gereklidir.');

  const ownerName = existing
    ? boundedString(existing.owner_name || existing.ownerName || user.full_name || user.fullName || user.username, 200)
    : boundedString(user.full_name || user.fullName || user.username, 200);
  const ownerUsername = existing
    ? boundedString(existing.owner_username || existing.ownerUsername || user.username, 100)
    : boundedString(user.username, 100);
  const ownerDepartment = existing
    ? boundedString(existing.owner_department || existing.ownerDepartment || user.department, 200)
    : boundedString(user.department, 200);

  const isPublic = reportIsPublic(report);
  const isDeleted = Boolean(report.isDeleted || report.is_deleted);
  const now = new Date().toISOString();
  const sharedAt = isPublic ? (report.sharedAt || report.shared_at || now) : null;
  const deletedAt = isDeleted ? (report.deletedAt || report.deleted_at || now) : null;

  const safeData = {
    ...report,
    id,
    userId: String(targetOwnerId),
    user_id: String(targetOwnerId),
    isPublic,
    is_public: isPublic,
    inPool: isPublic,
    in_pool: isPublic,
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
    deleted_at: deletedAt,
    version: Math.max(0, Number(report.version) || 0)
  };

  return {
    id,
    name: boundedString(report.name || report.fileName, 300, 'İsimsiz Rapor'),
    user_id: String(targetOwnerId),
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

function toSupabaseReportRow(row) {
  if (!row || typeof row !== 'object') return row;
  const supabaseKnownColumns = new Set([
    'id', 'name', 'user_id', 'file_size', 'category', 'tags', 'user_note',
    'is_favorite', 'is_pinned', 'is_deleted', 'deleted_at', 'sql_count',
    'memo_count', 'dataset_count', 'page_count', 'has_script', 'data',
    'created_at', 'updated_at'
  ]);
  const sanitized = {};
  for (const [key, value] of Object.entries(row)) {
    if (supabaseKnownColumns.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function reportRowToClient(row) {
  const data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? { ...row.data } : {};
  const hasAuthoritativePublic = row.is_public !== undefined && row.is_public !== null;
  const isPublicVal = Boolean(
    hasAuthoritativePublic
      ? row.is_public
      : (data.isPublic || data.is_public || data.inPool || data.in_pool || row.isPublic)
  );
  return {
    ...data,
    id: String(row.id),
    name: row.name || data.name || 'İsimsiz Rapor',
    userId: row.user_id || data.user_id || data.userId,
    user_id: row.user_id || data.user_id || data.userId,
    sizeBytes: Number(row.file_size || data.sizeBytes || 0),
    category: row.category || data.category || '',
    tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(data.tags) ? data.tags : []),
    userNote: row.user_note || data.userNote || '',
    isFavorite: Boolean(row.is_favorite !== undefined ? row.is_favorite : (data.isFavorite || data.is_favorite)),
    isPinned: Boolean(row.is_pinned !== undefined ? row.is_pinned : (data.isPinned || data.is_pinned)),
    isDeleted: Boolean(row.is_deleted !== undefined ? row.is_deleted : (data.isDeleted || data.is_deleted)),
    isPublic: isPublicVal,
    is_public: isPublicVal,
    inPool: isPublicVal,
    in_pool: isPublicVal,
    ownerName: row.owner_name || row.ownerName || data.ownerName || data.owner_name || '',
    ownerUsername: row.owner_username || row.ownerUsername || data.ownerUsername || data.owner_username || '',
    ownerDepartment: row.owner_department || row.ownerDepartment || data.ownerDepartment || data.owner_department || '',
    sharedAt: row.shared_at || row.sharedAt || data.sharedAt || data.shared_at || null,
    deletedAt: row.deleted_at || row.deletedAt || data.deletedAt || data.deleted_at || null,
    version: Math.max(0, Number(row.version != null ? row.version : data.version) || 1),
    loadedAt: row.updated_at || data.loadedAt || null
  };
}

function reportRowToSummaryClient(row) {
  if (!row || typeof row !== 'object') return null;
  const data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  const isPublicVal = Boolean(
    row.is_public !== undefined && row.is_public !== null ? row.is_public :
    (row.isPublic !== undefined && row.isPublic !== null ? row.isPublic :
    (row.inPool !== undefined && row.inPool !== null ? row.inPool :
    (row.in_pool !== undefined && row.in_pool !== null ? row.in_pool :
    (data.isPublic || data.is_public || data.inPool || data.in_pool))))
  );
  const isDeletedVal = Boolean(
    row.is_deleted !== undefined && row.is_deleted !== null ? row.is_deleted :
    (row.isDeleted !== undefined && row.isDeleted !== null ? row.isDeleted :
    (data.isDeleted || data.is_deleted))
  );

  const reportName = row.name || data.name || (row.meta && row.meta.reportName) || 'İsimsiz Rapor';
  const meta = (row.meta && typeof row.meta === 'object') ? row.meta : (data.meta || { reportName });

  return {
    id: String(row.id),
    name: reportName,
    userId: String(row.user_id || data.user_id || row.userId || data.userId || ''),
    user_id: String(row.user_id || data.user_id || row.userId || data.userId || ''),
    sizeBytes: Number(row.file_size != null ? row.file_size : (data.sizeBytes || row.sizeBytes || 0)),
    category: row.category || data.category || '',
    tags: Array.isArray(row.tags) ? row.tags : (Array.isArray(data.tags) ? data.tags : []),
    userNote: row.user_note || data.userNote || row.userNote || '',
    isFavorite: Boolean(row.is_favorite !== undefined ? row.is_favorite : (data.isFavorite || data.is_favorite || row.isFavorite)),
    isPinned: Boolean(row.is_pinned !== undefined ? row.is_pinned : (data.isPinned || data.is_pinned || row.isPinned)),
    isDeleted: isDeletedVal,
    isPublic: isPublicVal,
    is_public: isPublicVal,
    inPool: isPublicVal,
    in_pool: isPublicVal,
    ownerName: row.owner_name || row.ownerName || data.ownerName || data.owner_name || '',
    ownerUsername: row.owner_username || row.ownerUsername || data.ownerUsername || data.owner_username || '',
    ownerDepartment: row.owner_department || row.ownerDepartment || data.ownerDepartment || data.owner_department || '',
    sharedAt: row.shared_at || row.sharedAt || data.sharedAt || data.shared_at || null,
    deletedAt: row.deleted_at || row.deletedAt || data.deletedAt || data.deleted_at || null,
    version: Math.max(0, Number(row.version != null ? row.version : data.version) || 1),
    loadedAt: row.updated_at || data.loadedAt || row.loadedAt || null,
    updatedAt: row.updated_at || data.updatedAt || row.updatedAt || null,
    meta,
    stats: {
      sqlCount: Number(row.sql_count != null ? row.sql_count : (data.stats?.sqlCount || 0)),
      memoCount: Number(row.memo_count != null ? row.memo_count : (data.stats?.memoCount || 0)),
      datasetCount: Number(row.dataset_count != null ? row.dataset_count : (data.stats?.datasetCount || 0)),
      pageCount: Number(row.page_count != null ? row.page_count : (data.stats?.pageCount || 1)),
      hasScript: Boolean(row.has_script !== undefined ? row.has_script : data.stats?.hasScript)
    },
    queries: [],
    datasets: [],
    tree: [],
    pages: [],
    dialogPages: [],
    rawXml: null,
    pascalScript: null
  };
}

module.exports = {
  REPORT_ID_REGEX,
  buildOwnedReportRow,
  canManageReport,
  canReadReport,
  nextReportVersion,
  reportId,
  reportIsDeleted,
  reportIsPublic,
  reportOwnerId,
  reportRowToClient,
  reportRowToSummaryClient,
  toSupabaseReportRow
};

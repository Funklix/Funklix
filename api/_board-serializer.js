function serializeBoardForAccess(board = {}, access = {}) {
  const restricted = access.role === 'viewer' || access.role === 'public_viewer';
  if (restricted) {
    return {
      id: board.id,
      name: board.name,
      canvas_json: board.canvas_json,
      created_at: board.created_at,
      updated_at: board.updated_at,
      access,
      brand_visibility: 'hidden'
    };
  }
  const { brand_core_snapshot_backup, brand_core_backup_source_revision,
    brand_core_backup_source_updated_at, brand_core_backup_snapshot_copied_at, ...safe } = board;
  return {
    ...safe,
    brand_core_restore_available: !!brand_core_snapshot_backup && typeof brand_core_snapshot_backup === 'object',
    brand_core_source_revision: board.brand_core_source_revision == null ? null : Number(board.brand_core_source_revision),
    access,
    brand_visibility: board.brand_id ? 'visible' : 'unbranded'
  };
}

module.exports = { serializeBoardForAccess };

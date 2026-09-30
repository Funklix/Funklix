(function (root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const WORKSPACE_ROLES = new Set(['owner', 'admin', 'member', 'viewer']);
  const BRAND_ROLES = new Set(['owner', 'admin', 'editor', 'viewer']);
  const BOARD_ROLES = new Set(['owner', 'editor', 'viewer']);
  function invalid() { const error = new Error('Workspace catalog response is invalid'); error.code = 'RESPONSE_INVALID'; return error; }
  function id(value) { return typeof value === 'string' && UUID.test(value); }
  function text(value, max) { return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max; }
  function nullableString(value, max) { return value === null || (typeof value === 'string' && value.length <= max); }
  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.contract !== 'workspace_catalog_v1'
      || !/^[a-f0-9]{24}$/.test(payload.request_id || '') || !Array.isArray(payload.workspaces)
      || Object.keys(payload).some((key) => !['contract', 'request_id', 'workspaces'].includes(key))) throw invalid();
    const workspaceIds = new Set(); const brandIds = new Set(); const boardIds = new Set();
    const workspaces = payload.workspaces.map((workspace) => {
      if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)
        || Object.keys(workspace).some((key) => !['id','name','avatar_url','locale','revision','role','brands','boards'].includes(key))
        || !id(workspace.id) || workspaceIds.has(workspace.id) || !text(workspace.name, 160)
        || !nullableString(workspace.avatar_url, 2048) || !(workspace.locale === null || ['en','de'].includes(workspace.locale))
        || !Number.isSafeInteger(workspace.revision) || workspace.revision < 0 || !WORKSPACE_ROLES.has(workspace.role)
        || !Array.isArray(workspace.brands) || !Array.isArray(workspace.boards)) throw invalid();
      workspaceIds.add(workspace.id);
      const brands = workspace.brands.map((brand) => {
        if (!brand || Object.keys(brand).some((key) => !['id','name','avatar_url','revision','role'].includes(key))
          || !id(brand.id) || brandIds.has(brand.id) || !text(brand.name,160) || !nullableString(brand.avatar_url,2048)
          || !Number.isSafeInteger(brand.revision) || brand.revision < 0 || !BRAND_ROLES.has(brand.role)) throw invalid();
        brandIds.add(brand.id); return Object.freeze({ ...brand, workspace_id: workspace.id });
      });
      const localBrands = new Set(brands.map((brand) => brand.id));
      const boards = workspace.boards.map((board) => {
        if (!board || Object.keys(board).some((key) => !['id','name','brand_id','role'].includes(key))
          || !id(board.id) || boardIds.has(board.id) || !text(board.name,160) || !BOARD_ROLES.has(board.role)
          || !(board.brand_id === null || (id(board.brand_id) && localBrands.has(board.brand_id)))) throw invalid();
        boardIds.add(board.id); return Object.freeze({ ...board, workspace_id: workspace.id });
      });
      return Object.freeze({ ...workspace, brands: Object.freeze(brands), boards: Object.freeze(boards) });
    });
    return Object.freeze({ contract: payload.contract, request_id: payload.request_id, workspaces: Object.freeze(workspaces) });
  }
  async function load(fetchImpl = root.fetch.bind(root)) {
    const response = await fetchImpl('/api/workspaces', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => { throw invalid(); });
    if (!response.ok) { const error = new Error('Workspace catalog unavailable'); error.code = payload?.error?.code || 'INTERNAL_ERROR'; error.stage = payload?.error?.stage || 'response'; throw error; }
    return validate(payload);
  }
  function deriveActiveWorkspaceId(catalog, context = {}) {
    const workspaces = catalog?.workspaces || []; const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const board = workspaces.flatMap((workspace) => workspace.boards).find((item) => item.id === context.boardId);
    if (board && byId.has(board.workspace_id)) return board.workspace_id;
    const brand = workspaces.flatMap((workspace) => workspace.brands).find((item) => item.id === context.brandId);
    if (brand && byId.has(brand.workspace_id)) return brand.workspace_id;
    return workspaces.length === 1 ? workspaces[0].id : null;
  }
  root.FunklixWorkspaceCatalog = Object.freeze({ load, validate, deriveActiveWorkspaceId });
}(typeof globalThis !== 'undefined' ? globalThis : window));

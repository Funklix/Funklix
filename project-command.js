(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./workspace-name') : root.FunklixWorkspaceName);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FunklixProjectCommand = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function (names) {
  'use strict';
  const CONTRACT = 'project_command_v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const id = value => typeof value === 'string' && UUID.test(value);
  const revision = value => Number.isSafeInteger(value) && value >= 0;
  const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
  function error(code) { return Object.assign(new Error('Project command failed'), { code }); }
  function name(value) {
    const checked = names.validateWorkspaceName(value);
    if (!checked.ok || checked.name.length > 160) throw error('NAME_INVALID');
    return checked.name;
  }
  function request(body) {
    if (!exact(body, ['contract','request_id','workspace_id','project_name','brand']) || body.contract !== CONTRACT
      || typeof body.request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(body.request_id || '') || !id(body.workspace_id)) throw error('REQUEST_INVALID');
    const projectName = name(body.project_name);
    let brand;
    if (exact(body.brand, ['existing_id']) && id(body.brand.existing_id)) brand = { existing_id: body.brand.existing_id.toLowerCase() };
    else if (exact(body.brand, ['new_name'])) brand = { new_name: name(body.brand.new_name) };
    else throw error('REQUEST_INVALID');
    return { contract: CONTRACT, request_id: body.request_id, workspace_id: body.workspace_id.toLowerCase(), project_name: projectName, brand };
  }
  function build(workspaceId, projectName, brand, requestId) {
    return request({ contract: CONTRACT, request_id: requestId, workspace_id: workspaceId, project_name: projectName, brand });
  }
  function blankCanvas(now) {
    return { nodes: [], edges: [], nodeCounter: 1, postitCounter: 1, zoom: 1, schemaVersion: 1, metadata: { createdAt: now, updatedAt: now } };
  }
  function validCanvas(canvas) {
    return exact(canvas, ['nodes','edges','nodeCounter','postitCounter','zoom','schemaVersion','metadata'])
      && Array.isArray(canvas.nodes) && canvas.nodes.length === 0 && Array.isArray(canvas.edges) && canvas.edges.length === 0
      && canvas.nodeCounter === 1 && canvas.postitCounter === 1 && canvas.zoom === 1 && canvas.schemaVersion === 1
      && exact(canvas.metadata,['createdAt','updatedAt']) && date(canvas.metadata.createdAt) && date(canvas.metadata.updatedAt);
  }
  function validName(value) { try { return name(value) === value; } catch { return false; } }
  function validate(payload, input) {
    const fail = () => { throw error('RESPONSE_INVALID'); };
    if (!exact(payload,['contract','request_id','ok','created','workspace','brand','setup_required','board','snapshot','next_route'])
      || payload.contract !== CONTRACT || payload.request_id !== input.request_id || payload.ok !== true || typeof payload.created !== 'boolean'
      || typeof payload.setup_required !== 'boolean') fail();
    const w = payload.workspace, b = payload.brand, board = payload.board, s = payload.snapshot;
    if (!exact(w,['id','name','role','revision']) || w.id !== input.workspace_id || !id(w.id) || !validName(w.name)
      || !['owner','admin','member','viewer'].includes(w.role) || !revision(w.revision)) fail();
    if (!exact(b,['id','workspace_id','name','revision','role','logo_url','logo_revision','access','brand_core','created_at','updated_at'])
      || !id(b.id) || b.workspace_id !== w.id || !validName(b.name) || !revision(b.revision) || b.revision < 1
      || !['owner','admin','editor'].includes(b.role) || !object(b.brand_core) || !date(b.created_at) || !date(b.updated_at)
      || !revision(b.logo_revision) || !(b.logo_url === null || b.logo_url === `/api/brands/${b.id}/logo?revision=${b.logo_revision}`)
      || !exact(b.access,['role','canCreateBrandBoards','canEditCanonicalBrand']) || b.access.role !== b.role
      || b.access.canCreateBrandBoards !== true || b.access.canEditCanonicalBrand !== true) fail();
    if (input.brand.existing_id ? b.id !== input.brand.existing_id || payload.setup_required : !payload.setup_required || b.name !== input.brand.new_name || b.role !== 'owner') fail();
    if (!exact(board,['id','name','workspace_id','brand_id','canvas_json','brand_core_snapshot','brand_core_source_revision','brand_core_source_updated_at','brand_core_snapshot_copied_at','created_at','updated_at','access'])
      || !id(board.id) || board.name !== input.project_name || board.workspace_id !== w.id || board.brand_id !== b.id
      || !validCanvas(board.canvas_json) || !object(board.brand_core_snapshot) || !revision(board.brand_core_source_revision)
      || board.brand_core_source_revision !== b.revision || board.brand_core_source_updated_at !== b.updated_at
      || !date(board.brand_core_snapshot_copied_at) || !date(board.created_at) || !date(board.updated_at)
      || !exact(board.access,['role','canRead','canView','canEdit','canViewBoardBrandCore','canManageMembers','canManagePermissions','canRename','canDelete','canChangeBrandAssociation','canRefreshFromCanonical','canRestoreBrandCore','canCompareBrandCores','canViewPresence','publicView'])
      || board.access.role !== 'owner' || board.access.publicView !== false
      || Object.keys(board.access).some(key => key !== 'role' && key !== 'publicView' && board.access[key] !== true)) fail();
    if (!exact(s,['brand_id','source_revision','source_updated_at','copied_at']) || s.brand_id !== b.id || s.source_revision !== b.revision
      || s.source_updated_at !== b.updated_at || s.copied_at !== board.brand_core_snapshot_copied_at
      || JSON.stringify(board.brand_core_snapshot) !== JSON.stringify(b.brand_core)) fail();
    const route = payload.setup_required ? `/brands/${b.id}/setup?board=${board.id}` : `/boards/${board.id}`;
    if (payload.next_route !== route) fail();
    return Object.freeze(payload);
  }
  const CATEGORIES = Object.freeze({ REQUEST_INVALID:'validation', NAME_INVALID:'validation', AUTHENTICATION_REQUIRED:'authentication', SESSION_INVALID:'authentication',
    IDENTITY_INVALID:'authentication', IDENTITY_DISABLED:'permission', IDENTITY_AMBIGUOUS:'conflict', MEMBERSHIP_REQUIRED:'permission', PERMISSION_DENIED:'permission',
    WORKSPACE_NOT_FOUND:'not_found', BRAND_NOT_FOUND:'not_found', CROSS_WORKSPACE_BRAND:'permission', BRAND_CHANGED:'conflict', WORKSPACE_CHANGED:'conflict',
    IDEMPOTENCY_CONFLICT:'conflict', DATABASE_UNAVAILABLE:'network', SCHEMA_UNAVAILABLE:'network', OUTCOME_UNKNOWN:'outcome_unknown', RESPONSE_INVALID:'integrity', INTERNAL_ERROR:'internal', METHOD_NOT_ALLOWED:'validation', STALE_OPERATION:'conflict' });
  function validateFailure(payload, requestId) {
    if (!exact(payload,['contract','request_id','ok','error']) || payload.contract !== CONTRACT || payload.request_id !== requestId || payload.ok !== false
      || !exact(payload.error,['code','category','retryable']) || CATEGORIES[payload.error.code] !== payload.error.category || typeof payload.error.retryable !== 'boolean') throw error('RESPONSE_INVALID');
    return payload.error;
  }
  function reconcile(catalog, library, outcome) {
    const index = catalog?.workspaces?.findIndex(w => w.id === outcome.workspace.id);
    if (index == null || index < 0) throw error('STALE_OPERATION');
    const w = catalog.workspaces[index], b = outcome.brand, board = outcome.board;
    const brandSummary = Object.freeze({ id:b.id, workspace_id:w.id, name:b.name, revision:b.revision, role:b.role, logo_url:b.logo_url, logo_revision:b.logo_revision });
    const boardSummary = Object.freeze({ id:board.id, name:board.name, workspace_id:w.id, brand_id:b.id, role:'owner' });
    const upsert = (list, item) => Object.freeze([...list.filter(old => old.id !== item.id), item]);
    const workspaces = catalog.workspaces.slice();
    workspaces[index] = Object.freeze({ ...w, ...outcome.workspace, brands:upsert(w.brands,brandSummary), boards:upsert(w.boards,boardSummary) });
    const libraryBoard = Object.freeze({ ...board, access_role:'owner', brand_display:{name:b.name,avatarUrl:b.logo_url} });
    return { catalog:Object.freeze({...catalog,workspaces:Object.freeze(workspaces)}), library:upsert(library,libraryBoard) };
  }
  function createBoundary({ context, fetchImpl, reconcile:apply, navigate }) {
    let flight = null, epoch = 0;
    function invalidate() { epoch++; flight = null; }
    function submit(input) {
      const body = request(input), captured = context(), generation = epoch;
      const same = () => { const live=context(); return generation===epoch && live.account===captured.account && live.generation===captured.generation && live.workspaceId===captured.workspaceId; };
      if (!captured.account || captured.workspaceId !== body.workspace_id) return Promise.reject(error('STALE_OPERATION'));
      const fingerprint = JSON.stringify(body);
      if (flight) return flight.fingerprint === fingerprint ? flight.promise : Promise.reject(error('IDEMPOTENCY_CONFLICT'));
      const operation = {fingerprint};
      operation.promise = (async () => {
        let response;
        try { response = await fetchImpl('/api/projects',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)}); }
        catch { throw error('OUTCOME_UNKNOWN'); }
        if (!same()) throw error('STALE_OPERATION');
        const payload = await response.json().catch(() => { throw error('RESPONSE_INVALID'); });
        if (!same()) throw error('STALE_OPERATION');
        if (!response.ok) throw error(validateFailure(payload,body.request_id).code);
        const result = validate(payload,body);
        apply(result);
        if (!same()) throw error('STALE_OPERATION');
        await navigate(result);
        return result;
      })().finally(() => { if (flight===operation) flight=null; });
      flight=operation; return operation.promise;
    }
    return {submit,invalidate};
  }
  function navigate(outcome, { history, setView, openBoard, openSetup }) {
    history.pushState({},'',outcome.next_route);
    setView(outcome.setup_required ? 'home' : 'board');
    return outcome.setup_required ? openSetup(outcome) : openBoard(outcome);
  }
  return Object.freeze({CONTRACT,CATEGORIES,request,build,name,blankCanvas,validCanvas,validate,validateFailure,reconcile,createBoundary,navigate,error});
}));

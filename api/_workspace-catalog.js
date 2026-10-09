'use strict';

const { WORKSPACE_ROLES, normalizeWorkspaceRole } = require('./_workspace-authorization');
const { normalizeLogoRevision } = require('./_brand-logo');

const BRAND_ROLES = Object.freeze(['owner', 'admin', 'editor', 'viewer']);
const BOARD_ROLES = Object.freeze(['owner', 'editor', 'viewer']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class WorkspaceCatalogError extends Error {
  constructor(code, stage) { super(code); this.code = code; this.stage = stage; }
}

function validId(value) { return typeof value === 'string' && UUID.test(value); }
function boundedText(value, max) {
  return typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
}
function boardRole(value) {
  if (value === 'owner') return 'owner';
  if (['editor', 'brand_owner', 'brand_admin', 'brand_editor'].includes(value)) return 'editor';
  if (['viewer', 'brand_viewer'].includes(value)) return 'viewer';
  return null;
}

// Optional presentation metadata is not an authorization or relationship
// boundary. Invalid logo metadata projects to the shared no-logo shape.
function projectBrandLogo(row) {
  let logoRevision;
  try { logoRevision = normalizeLogoRevision(row?.logo_revision); }
  catch { return { logo_url: null, logo_revision: 0 }; }
  const usable = typeof row?.logo_object_path === 'string' && row.logo_object_path.length > 0
    && ['uploaded', 'discovered'].includes(row.logo_source)
    && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(row.logo_mime_type)
    && Number.isSafeInteger(logoRevision) && logoRevision >= 0;
  return usable
    ? { logo_url: `/api/brands/${row.id}/logo?revision=${logoRevision}`, logo_revision: logoRevision }
    : { logo_url: null, logo_revision: 0 };
}

function projectCatalog({ memberships, brands, boards }) {
  if (!Array.isArray(memberships) || !Array.isArray(brands) || !Array.isArray(boards)) {
    throw new WorkspaceCatalogError('RESPONSE_INVALID', 'projection');
  }
  const workspaceIds = new Set();
  const output = memberships.map((row) => {
    const role = normalizeWorkspaceRole(row.role);
    if (!validId(row.id) || workspaceIds.has(row.id) || !boundedText(row.name, 160)
      || !WORKSPACE_ROLES.includes(role) || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 0
      || (row.avatar_url != null && typeof row.avatar_url !== 'string')
      || (row.locale != null && !['en', 'de'].includes(row.locale))) {
      throw new WorkspaceCatalogError('WORKSPACE_CATALOG_CONFLICT', 'workspace_projection');
    }
    workspaceIds.add(row.id);
    return { id: row.id, name: row.name.trim(), avatar_url: row.avatar_url || null, locale: row.locale || null,
      revision: Number(row.revision), role, brands: [], boards: [] };
  });
  const byWorkspace = new Map(output.map((workspace) => [workspace.id, workspace]));
  const brandIds = new Set();
  const brandWorkspaceIds = new Map();
  for (const row of brands) {
    if (!validId(row.id) || brandIds.has(row.id) || !validId(row.workspace_id) || !byWorkspace.has(row.workspace_id)
      || !boundedText(row.name, 160) || !BRAND_ROLES.includes(row.role)
      || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 0) {
      throw new WorkspaceCatalogError('WORKSPACE_CATALOG_CONFLICT', 'brand_projection');
    }
    brandIds.add(row.id);
    brandWorkspaceIds.set(row.id, row.workspace_id);
    const logo = projectBrandLogo(row);
    byWorkspace.get(row.workspace_id).brands.push({ id: row.id, name: row.name.trim(), ...logo,
      revision: Number(row.revision), role: row.role });
  }
  const boardIds = new Set();
  for (const row of boards) {
    const role = boardRole(row.role);
    if (!validId(row.id) || boardIds.has(row.id) || !validId(row.workspace_id) || !byWorkspace.has(row.workspace_id)
      || !boundedText(row.name, 160) || !role || (row.brand_id != null && !validId(row.brand_id))
      || (brandIds.has(row.brand_id) && brandWorkspaceIds.get(row.brand_id) !== row.workspace_id)) {
      throw new WorkspaceCatalogError('WORKSPACE_CATALOG_CONFLICT', 'board_projection');
    }
    boardIds.add(row.id);
    // Existing Board authority does not imply Brand authority. Hide the association
    // when its Brand is not independently visible rather than leaking a Brand UUID.
    byWorkspace.get(row.workspace_id).boards.push({ id: row.id, name: row.name.trim(), brand_id: brandIds.has(row.brand_id) ? row.brand_id : null, role });
  }
  return output;
}

async function loadWorkspaceCatalog({ db, identityId, canonicalEmail, diagnostic = () => {} }) {
  diagnostic('membership_lookup');
  const membershipResult = await db.query(
    `SELECT w.id, w.name, w.avatar_url, w.locale, w.revision, m.role
       FROM public.workspace_memberships m
       JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE m.identity_id = $1 AND m.status = 'accepted' AND w.status = 'active'
      ORDER BY w.name, w.id`, [identityId]);
  const memberships = membershipResult.rows;
  if (!memberships.length) return [];
  projectCatalog({ memberships, brands: [], boards: [] });
  const ids = memberships.map((row) => row.id);
  diagnostic('catalog_projection');
  const brandResult = await db.query(
    `SELECT b.id, b.workspace_id, b.name, b.revision, b.logo_object_path, b.logo_mime_type, b.logo_source, b.logo_revision,
            CASE WHEN lower(b.owner_email) = $1 THEN 'owner' ELSE bm.role END AS role
       FROM public.brands b
       LEFT JOIN public.brand_members bm ON bm.brand_id = b.id AND bm.email = $1
      WHERE b.workspace_id = ANY($2::uuid[])
        AND (lower(b.owner_email) = $1 OR bm.role IN ('admin','editor','viewer'))
      ORDER BY b.name, b.id`, [canonicalEmail, ids]);
  const boardResult = await db.query(
    `SELECT b.id, b.workspace_id, b.brand_id, b.name, br.workspace_id AS brand_workspace_id,
            CASE WHEN lower(coalesce(b.owner_email, '')) = $1 THEN 'owner'
                 WHEN br.owner_email = $1 THEN 'brand_owner'
                 WHEN bm.role = 'admin' THEN 'brand_admin'
                 WHEN bm.role = 'editor' THEN 'brand_editor'
                 WHEN be.role = 'editor' THEN 'editor'
                 WHEN bm.role = 'viewer' THEN 'brand_viewer'
                 WHEN be.role = 'viewer' THEN 'viewer' END AS role
       FROM public.boards b
       LEFT JOIN public.board_editors be ON be.board_id = b.id AND be.email = $1 AND be.role IN ('editor','viewer')
       LEFT JOIN public.brands br ON br.id = b.brand_id
       LEFT JOIN public.brand_members bm ON bm.brand_id = b.brand_id AND bm.email = $1 AND bm.role IN ('admin','editor','viewer')
      WHERE b.workspace_id = ANY($2::uuid[])
        AND (lower(coalesce(b.owner_email, '')) = $1 OR be.email IS NOT NULL OR br.owner_email = $1 OR bm.email IS NOT NULL)
      ORDER BY b.name, b.id`, [canonicalEmail, ids]);
  // Workspace membership bounds this projection, not the independent Board API.
  // Null/out-of-scope legacy and shared rows cannot poison an accepted catalog.
  const allowed = new Set(ids);
  const brands = brandResult.rows.filter((row) => allowed.has(row.workspace_id));
  const boards = boardResult.rows.filter((row) => allowed.has(row.workspace_id));
  // Validate the actual Brand relationship even when independent Brand authority
  // hides that Brand from the response. Never project its UUID or other metadata.
  if (boards.some((row) => row.brand_id != null
    && (!validId(row.brand_workspace_id) || row.brand_workspace_id !== row.workspace_id))) {
    throw new WorkspaceCatalogError('WORKSPACE_CATALOG_CONFLICT', 'relationship_validation');
  }
  return projectCatalog({ memberships, brands, boards });
}

module.exports = { BRAND_ROLES, BOARD_ROLES, WorkspaceCatalogError, boardRole, projectBrandLogo, projectCatalog, loadWorkspaceCatalog };

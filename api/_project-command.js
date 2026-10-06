'use strict';
const crypto = require('crypto');
const contract = require('../project-command');
const { validateIdentityRow, compareIdentityToSessionEmail, APP_IDENTITY_ERRORS } = require('./_app-identity');
const { getBrandAccess } = require('./_brand-access');
const { getBoardAccess } = require('./_board-access');
const { projectBrandLogo } = require('./_workspace-catalog');
function reject(code) { throw contract.error(code); }
function iso(value) { return value instanceof Date ? value.toISOString() : value; }
function core() { return {brandCore:'',toneOfVoice:[],messagingPillars:[],valueProposition:'',personas:[],contentGuidelines:[],dosAndDonts:{dos:[],donts:[]},brandVoiceExamples:{good:'',avoid:''},keywords:[],brandAssets:{domain:'',logo:'',colors:[],typography:'',references:[]},brandDNA:null,customTiles:[]}; }
async function execute({db,user,canonicalEmail,input}) {
  const client = await db.connect(); let committing=false;
  try {
    await client.query('BEGIN');
    const identities=await client.query(`SELECT id, canonical_email, status, revision FROM public.app_identities WHERE canonical_email = $1 ORDER BY id LIMIT 2 FOR UPDATE`,[canonicalEmail]);
    const identity=validateIdentityRow(identities.rows);
    if(!identity.ok) reject(identity.code===APP_IDENTITY_ERRORS.DISABLED?'IDENTITY_DISABLED':identity.code===APP_IDENTITY_ERRORS.AMBIGUOUS?'IDENTITY_AMBIGUOUS':'IDENTITY_INVALID');
    if(!compareIdentityToSessionEmail(identity,canonicalEmail).ok) reject('SESSION_INVALID');
    await client.query(`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 36133))`,[`${identity.identityId}:${input.request_id}`]);
    const workspace=(await client.query(`SELECT id,name,status,revision FROM public.workspaces WHERE id=$1 FOR UPDATE`,[input.workspace_id])).rows[0];
    if(!workspace||workspace.status!=='active') reject('WORKSPACE_NOT_FOUND');
    const membership=(await client.query(`SELECT role,status FROM public.workspace_memberships WHERE workspace_id=$1 AND identity_id=$2 FOR UPDATE`,[workspace.id,identity.identityId])).rows[0];
    if(!membership||membership.status!=='accepted'||!['owner','admin','member','viewer'].includes(membership.role)) reject('MEMBERSHIP_REQUIRED');
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const previous=(await client.query(`SELECT fingerprint,outcome FROM public.project_commands WHERE identity_id=$1 AND request_id=$2 FOR UPDATE`,[identity.identityId,input.request_id])).rows[0];
    if(previous&&previous.fingerprint!==fingerprint) reject('IDEMPOTENCY_CONFLICT');
    const brandId=previous?.outcome?.brand?.id || input.brand.existing_id;
    let brand, access;
    if(brandId) {
      // Lock the Brand before independently resolving its current established authority.
      await client.query(`SELECT id FROM public.brands WHERE id=$1 FOR UPDATE`,[brandId]);
      const resolved=await getBrandAccess(brandId,user,{client,skipEnsure:true,lockMembership:true,columns:'id,workspace_id,name,brand_core,revision,created_at,updated_at,logo_object_path,logo_mime_type,logo_source,logo_revision'});
      brand=resolved.brand; access=resolved.access;
      if(!brand) reject('BRAND_NOT_FOUND');
      if(!access.canCreateBrandBoards) reject('PERMISSION_DENIED');
      if(brand.workspace_id!==workspace.id) reject('CROSS_WORKSPACE_BRAND');
    } else {
      if(!['owner','admin'].includes(membership.role)) reject('PERMISSION_DENIED');
      brand=(await client.query(`INSERT INTO public.brands (workspace_id,owner_email,name,brand_core,revision)
        VALUES ($1,$2,$3,$4::jsonb,1) RETURNING id,workspace_id,name,brand_core,revision,created_at,updated_at`,[workspace.id,canonicalEmail,input.brand.new_name,JSON.stringify(core())])).rows[0];
      // owner_email is the established owner relationship; brand_members disallows role=owner.
      access={role:'owner',canCreateBrandBoards:true,canEditCanonicalBrand:true};
    }
    if(previous) {
      const owner=await getBoardAccess(previous.outcome.board.id,user,{client,columns:'id,workspace_id,brand_id,owner_email,owner_id'});
      if(!owner.board||owner.access?.role!=='owner'||owner.board.workspace_id!==workspace.id||owner.board.brand_id!==brand.id) reject('PERMISSION_DENIED');
      const replay={...previous.outcome,created:false,workspace:{id:workspace.id,name:workspace.name,role:membership.role,revision:Number(workspace.revision)},brand:{...previous.outcome.brand,role:access.role,access:{role:access.role,canCreateBrandBoards:access.canCreateBrandBoards,canEditCanonicalBrand:access.canEditCanonicalBrand}}}; contract.validate(replay,input);
      committing=true; await client.query('COMMIT'); return replay;
    }
    if(!brand||brand.workspace_id!==workspace.id||!brand.brand_core||typeof brand.brand_core!=='object'||Array.isArray(brand.brand_core)) reject('INTERNAL_ERROR');
    const canvas=contract.blankCanvas(new Date().toISOString());
    if(!contract.validCanvas(canvas)) reject('INTERNAL_ERROR');
    const row=(await client.query(`INSERT INTO public.boards (workspace_id,brand_id,name,canvas_json,brand_core_snapshot,brand_core_source_revision,
      brand_core_source_updated_at,brand_core_snapshot_copied_at,owner_id,owner_email,owner_name,owner_avatar,created_by)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,NOW(),$8,$8,$9,$10,$8)
      RETURNING id,workspace_id,brand_id,name,canvas_json,brand_core_snapshot,brand_core_source_revision,brand_core_source_updated_at,
        brand_core_snapshot_copied_at,created_at,updated_at`,[workspace.id,brand.id,input.project_name,JSON.stringify(canvas),JSON.stringify(brand.brand_core),Number(brand.revision),brand.updated_at,canonicalEmail,user.name||null,user.avatar||null])).rows[0];
    if(!row) reject('INTERNAL_ERROR');
    const ownership=await getBoardAccess(row.id,user,{client,columns:'id,workspace_id,brand_id,owner_email,owner_id'});
    if(ownership.access?.role!=='owner'||ownership.board?.workspace_id!==workspace.id||ownership.board?.brand_id!==brand.id) reject('INTERNAL_ERROR');
    const board={...row,brand_core_source_revision:Number(row.brand_core_source_revision),brand_core_source_updated_at:iso(row.brand_core_source_updated_at),brand_core_snapshot_copied_at:iso(row.brand_core_snapshot_copied_at),created_at:iso(row.created_at),updated_at:iso(row.updated_at),access:ownership.access};
    const summary={id:brand.id,workspace_id:workspace.id,name:brand.name,revision:Number(brand.revision),role:access.role,...projectBrandLogo(brand),access:{role:access.role,canCreateBrandBoards:access.canCreateBrandBoards,canEditCanonicalBrand:access.canEditCanonicalBrand},brand_core:brand.brand_core,created_at:iso(brand.created_at),updated_at:iso(brand.updated_at)};
    const outcome={contract:contract.CONTRACT,request_id:input.request_id,ok:true,created:true,workspace:{id:workspace.id,name:workspace.name,role:membership.role,revision:Number(workspace.revision)},brand:summary,setup_required:!!input.brand.new_name,board,
      snapshot:{brand_id:brand.id,source_revision:board.brand_core_source_revision,source_updated_at:board.brand_core_source_updated_at,copied_at:board.brand_core_snapshot_copied_at},next_route:input.brand.new_name?`/brands/${brand.id}/setup?board=${board.id}`:`/boards/${board.id}`};
    contract.validate(outcome,input);
    await client.query(`INSERT INTO public.project_commands (identity_id,request_id,fingerprint,workspace_id,brand_id,board_id,outcome)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,[identity.identityId,input.request_id,fingerprint,workspace.id,brand.id,board.id,JSON.stringify(outcome)]);
    committing=true; await client.query('COMMIT'); return outcome;
  } catch(error) {
    try { await client.query('ROLLBACK'); } catch {}
    if(committing) throw contract.error('OUTCOME_UNKNOWN');
    throw error;
  } finally {client.release();}
}
module.exports={execute,core};

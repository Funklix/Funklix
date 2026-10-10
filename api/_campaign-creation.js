'use strict';
const crypto=require('crypto');
const contract=require('../campaign-creation');
const {validateIdentityRow}=require('./_app-identity');
const {getBoardAccess}=require('./_board-access');
const {projectBrandLogo}=require('./_workspace-catalog');
const reject=code=>{throw contract.error(code);};
const iso=v=>v instanceof Date?v.toISOString():v;
async function execute({db,user,canonicalEmail,input}){
  const client=await db.connect();let committing=false;
  try{
    await client.query('BEGIN');
    const identity=validateIdentityRow((await client.query('SELECT id,canonical_email,status,revision FROM public.app_identities WHERE canonical_email=$1 ORDER BY id LIMIT 2 FOR SHARE',[canonicalEmail])).rows);
    if(!identity.ok||identity.canonicalEmail!==canonicalEmail)reject('PERMISSION_DENIED');
    const board=(await client.query(`SELECT id,name,workspace_id,brand_id,canvas_json,brand_core_snapshot,brand_core_source_revision,
      brand_core_source_updated_at,brand_core_snapshot_copied_at,created_at,updated_at FROM public.boards WHERE id=$1 FOR UPDATE`,[input.board_id])).rows[0];
    if(!board)reject('BOARD_MISSING');
    await client.query('SELECT role FROM board_editors WHERE board_id=$1 AND email=$2 FOR SHARE',[board.id,canonicalEmail]);
    if(board.brand_id)await client.query('SELECT role FROM brand_members WHERE brand_id=$1 AND email=$2 FOR SHARE',[board.brand_id,canonicalEmail]);
    let {access}=await getBoardAccess(board.id,user,{client,columns:'id,brand_id,owner_id,owner_email'});
    if(!access?.canEdit||access.role==='unowned')reject('PERMISSION_DENIED');
    if(!board.brand_id)reject('BRAND_MISSING');
    if(board.workspace_id!==input.workspace_id||board.brand_id!==input.brand_id)reject('CONFLICT');
    const workspace=(await client.query('SELECT id,name,status FROM public.workspaces WHERE id=$1 FOR SHARE',[board.workspace_id])).rows[0];
    const membership=(await client.query('SELECT role,status FROM public.workspace_memberships WHERE workspace_id=$1 AND identity_id=$2 FOR SHARE',[board.workspace_id,identity.identityId])).rows[0];
    if(!workspace||workspace.status!=='active'||membership?.status!=='accepted')reject('PERMISSION_DENIED');
    const brand=(await client.query('SELECT id,workspace_id,name,logo_object_path,logo_mime_type,logo_source,logo_revision FROM public.brands WHERE id=$1 FOR SHARE',[board.brand_id])).rows[0];
    if(!brand||brand.workspace_id!==board.workspace_id)reject('CONFLICT');
    ({access}=await getBoardAccess(board.id,user,{client,columns:'id,brand_id,owner_id,owner_email'}));
    if(!access?.canEdit||access.role==='unowned')reject('PERMISSION_DENIED');
    if(!board.canvas_json||!Array.isArray(board.canvas_json.nodes)||!Array.isArray(board.canvas_json.edges)||!board.brand_core_snapshot||typeof board.brand_core_snapshot!=='object'||Array.isArray(board.brand_core_snapshot))reject('SAVE_FAILED');
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const nodeId=`campaign-${input.request_id}`,previous=board.canvas_json.nodes.find(n=>n.id===nodeId);
    if(previous&&(previous.metadata?.creationFingerprint!==fingerprint||previous.metadata?.creationIdentity!==identity.identityId))reject('CONFLICT');
    // A removed seed cannot be replayed: its original revision is now stale. Never replace the Canvas.
    if(!previous&&Date.parse(iso(board.updated_at))!==Date.parse(input.board_revision))reject('STALE_REVISION');
    let saved=board;
    if(!previous){
      const maxY=board.canvas_json.nodes.reduce((y,n)=>Math.max(y,Number(n.position?.y)||0),-400);
      const node={id:nodeId,type:'Idea',title:input.idea.slice(0,160),content:input.idea+(input.context?'\n\n'+input.context:''),status:'Draft',tags:[],variants:[],contentFormat:'1:1',audience:'',goal:input.idea,channel:'',funnelStage:'',tone:'',images:[],favoriteImageId:null,
        social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''},imagePrompt:'',landingPage:{headerVisualPrompt:'',headerClaim:'',problem:'',solution:'',trust:'',cta:''},reactions:{},postits:[],compact:false,justConnectedAt:null,position:{x:80,y:maxY+480},metadata:{creationFingerprint:fingerprint,creationIdentity:identity.identityId}};
      const canvas={...board.canvas_json,nodes:[...board.canvas_json.nodes,node],metadata:{...board.canvas_json.metadata,updatedAt:new Date().toISOString()}};
      saved=(await client.query(`UPDATE public.boards SET canvas_json=$2::jsonb,updated_at=GREATEST(clock_timestamp(),updated_at + interval '1 millisecond') WHERE id=$1
        RETURNING id,name,workspace_id,brand_id,canvas_json,brand_core_snapshot,brand_core_source_revision,brand_core_source_updated_at,brand_core_snapshot_copied_at,created_at,updated_at`,[board.id,JSON.stringify(canvas)])).rows[0];
      if(!saved)reject('SAVE_FAILED');
    }
    const safeBoard={...saved,created_at:iso(saved.created_at),updated_at:iso(saved.updated_at),brand_core_source_updated_at:iso(saved.brand_core_source_updated_at),brand_core_snapshot_copied_at:iso(saved.brand_core_snapshot_copied_at),access};
    const outcome={contract:contract.CONTRACT,ok:true,created:!previous,request_id:input.request_id,board:safeBoard,workspace:{id:workspace.id,name:workspace.name},brand:{id:brand.id,workspace_id:brand.workspace_id,name:brand.name,...projectBrandLogo(brand)},node_id:nodeId,next_route:`/boards/${board.id}`};
    contract.validate(outcome,input);committing=true;await client.query('COMMIT');return outcome;
  }catch(error){try{await client.query('ROLLBACK');}catch{}if(committing)throw contract.error('OUTCOME_UNKNOWN');throw error;}finally{client.release();}
}
module.exports={execute};

'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FINGERPRINT = /^(?:v2-[0-9a-f]{64}|[A-Za-z0-9_-]{1,128})$/;
const SCHEDULE_KEYS = ['localDate', 'localTime', 'timeZone', 'disambiguation'];
const COMMAND_KEYS = ['boardId', 'nodeId', 'schedule', 'expectedBoardRevision', 'expectedScheduleRevision', 'expectedMaterialFingerprint', 'expectedStatus'];

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function validTimeZone(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80 || !/^[A-Za-z0-9_+./-]+$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return value.includes('/') || value === 'UTC'; } catch (_) { return false; }
}
function resolveLocalDateTime(localDate, localTime, timeZone, disambiguation = 'compatible') {
  const dm = DATE.exec(localDate || ''), tm = TIME.exec(localTime || '');
  if (!dm || !tm || !validTimeZone(timeZone) || !['compatible', 'earlier', 'later'].includes(disambiguation)) return { ok: false, code: 'schedule_invalid' };
  const y=+dm[1],mo=+dm[2],d=+dm[3],h=+tm[1],mi=+tm[2];
  const check=new Date(Date.UTC(y,mo-1,d));
  if (check.getUTCFullYear()!==y||check.getUTCMonth()!==mo-1||check.getUTCDate()!==d) return { ok:false,code:'schedule_invalid' };
  const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const wanted=`${localDate} ${localTime}`, center=Date.UTC(y,mo-1,d,h,mi), matches=[];
  for(let offset=-14*60;offset<=14*60;offset+=15){const ms=center-offset*60000;const p=Object.fromEntries(format.formatToParts(ms).map(x=>[x.type,x.value]));if(`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`===wanted)matches.push(ms);}
  const unique=[...new Set(matches)].sort((a,b)=>a-b);
  if(!unique.length)return{ok:false,code:'schedule_invalid'};
  if(unique.length>1&&!['earlier','later'].includes(disambiguation))return{ok:false,code:'schedule_ambiguous'};
  const ms=disambiguation==='later'?unique[unique.length-1]:unique[0];
  return { ok:true, scheduledAtUtc:new Date(ms).toISOString(), disambiguation:unique.length>1?disambiguation:'compatible' };
}
function validateCommand(body) {
  if (!plain(body) || Object.keys(body).some(k=>!COMMAND_KEYS.includes(k)) || Object.keys(body).length !== COMMAND_KEYS.length) return { ok:false,code:'request_invalid' };
  if (!UUID.test(body.boardId||'') || !NODE_ID.test(body.nodeId||'') || !Number.isInteger(body.expectedScheduleRevision) || body.expectedScheduleRevision<0 || body.expectedScheduleRevision>1e9 || typeof body.expectedBoardRevision!=='string' || body.expectedBoardRevision.length>64 || !Number.isFinite(Date.parse(body.expectedBoardRevision)) || !FINGERPRINT.test(body.expectedMaterialFingerprint||'') || typeof body.expectedStatus!=='string' || body.expectedStatus.length>32) return {ok:false,code:'request_invalid'};
  if (body.schedule === null) return { ok:true, value:{...body,schedule:null} };
  if (!plain(body.schedule) || Object.keys(body.schedule).length!==SCHEDULE_KEYS.length || Object.keys(body.schedule).some(k=>!SCHEDULE_KEYS.includes(k))) return {ok:false,code:'schedule_invalid'};
  const resolved=resolveLocalDateTime(body.schedule.localDate,body.schedule.localTime,body.schedule.timeZone,body.schedule.disambiguation);
  if(!resolved.ok)return resolved;
  return {ok:true,value:{...body,schedule:{...body.schedule,scheduledAtUtc:resolved.scheduledAtUtc,disambiguation:resolved.disambiguation}}};
}
module.exports={UUID,NODE_ID,validateCommand,resolveLocalDateTime,validTimeZone};

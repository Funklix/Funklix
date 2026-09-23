'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FINGERPRINT = /^(?:v2-[0-9a-f]{64}|[A-Za-z0-9_-]{1,128})$/;
const SCHEDULE_KEYS = ['localDate', 'localTime', 'timeZone', 'disambiguation'];
const COMMAND_KEYS = ['boardId', 'nodeId', 'schedule', 'expectedBoardRevision', 'expectedScheduleRevision', 'expectedMaterialFingerprint', 'expectedStatus'];

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
const boundedTimezone = require('../../timezone-resolver');
function validTimeZone(value) {
  return typeof value === 'string' && value.length <= 80 && /^[A-Za-z0-9_+./-]+$/.test(value) && (value.includes('/') || value === 'UTC') && boundedTimezone.validTimeZone(value);
}
function resolveLocalDateTime(localDate, localTime, timeZone, disambiguation = 'compatible') {
  if (!['compatible', 'earlier', 'later'].includes(disambiguation) || !validTimeZone(timeZone)) return { ok:false,code:'schedule_invalid' };
  const result=boundedTimezone.resolveLocalDateTime(localDate,localTime,timeZone,disambiguation);
  if(result.ok)return result;
  return {ok:false,code:result.reasonCodes?.includes('LOCAL_TIME_AMBIGUOUS')?'schedule_ambiguous':'schedule_invalid',formatterOperations:result.formatterOperations};
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

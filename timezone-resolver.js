(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.FunklixTimezoneResolver=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const formatterCache=new Map(),MAX_FORMATTERS=32,PROBES=Object.freeze([-36,-12,0,12,36]),MAX_FORMAT_OPERATIONS=10;
function formatter(zone){if(formatterCache.has(zone))return formatterCache.get(zone);const value=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});formatterCache.set(zone,value);while(formatterCache.size>MAX_FORMATTERS)formatterCache.delete(formatterCache.keys().next().value);return value;}
function parts(format,ms,counter){counter.count+=1;return Object.fromEntries(format.formatToParts(ms).map(part=>[part.type,part.value]));}
function resolveLocalDateTime(localDate,localTime,timeZone,disambiguation="compatible"){
 const reasons=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(String(localDate||"").trim()))reasons.push("SCHEDULE_DATE_INVALID");if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(localTime||"").trim()))reasons.push("SCHEDULE_TIME_INVALID");if(!String(timeZone||"").trim())reasons.push("TIMEZONE_REQUIRED");let format;if(!reasons.length)try{format=formatter(timeZone);}catch(_){reasons.push("TIMEZONE_INVALID");}if(reasons.length)return{ok:false,reasonCodes:reasons,formatterOperations:0};
 const [y,m,d]=localDate.split("-").map(Number),[hh,mm]=localTime.split(":").map(Number),center=Date.UTC(y,m-1,d,hh,mm);if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==localDate)return{ok:false,reasonCodes:["SCHEDULE_DATE_INVALID"],formatterOperations:0};
 const counter={count:0},offsets=new Set;for(const hours of PROBES){const probe=center+hours*3600000,p=parts(format,probe,counter);offsets.add((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-probe)/60000);}
 const wanted=`${localDate}T${localTime}`,matches=[];for(const offset of offsets){const candidate=center-offset*60000,p=parts(format,candidate,counter);if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===wanted)matches.push(candidate);}
 const unique=[...new Set(matches)].sort((a,b)=>a-b);if(!unique.length)return{ok:false,reasonCodes:["LOCAL_TIME_NONEXISTENT"],formatterOperations:counter.count};if(unique.length>1&&!['earlier','later'].includes(disambiguation))return{ok:false,reasonCodes:["LOCAL_TIME_AMBIGUOUS"],choices:unique.map(ms=>new Date(ms).toISOString()),formatterOperations:counter.count};const ms=disambiguation==="later"?unique[unique.length-1]:unique[0];return{ok:true,scheduledAtUtc:new Date(ms).toISOString(),ambiguous:unique.length>1,disambiguation:unique.length>1?disambiguation:"compatible",formatterOperations:counter.count};
}
function validTimeZone(zone){try{return!!String(zone||"").trim()&&!!formatter(zone);}catch(_){return false;}}
function instrumentation(){return Object.freeze({maxFormatterOperations:MAX_FORMAT_OPERATIONS,probeCount:PROBES.length,cacheSize:formatterCache.size,maxCacheSize:MAX_FORMATTERS});}
return Object.freeze({resolveLocalDateTime,validTimeZone,instrumentation});
});

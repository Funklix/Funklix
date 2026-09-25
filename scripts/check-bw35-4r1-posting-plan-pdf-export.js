'use strict';
const assert=require('assert'),fs=require('fs');
const csv=require('../posting-plan-export'),pdf=require('../posting-plan-pdf'),pkg=require('../package.json');
const workspace=fs.readFileSync('content-workspace.js','utf8'),css=fs.readFileSync('styles.css','utf8'),html=fs.readFileSync('index.html','utf8'),workflow=fs.readFileSync('.github/workflows/runtime-boot-safety.yml','utf8');
const schedule=(date,time)=>({version:1,localDate:date,localTime:time,timeZone:'Europe/Berlin',disambiguation:'earlier'});
const nodes=[
 {id:'secret-node-a',type:'Social Media Posting',title:'Launch',content:'Absatz eins\n\nUnicode ✓ 🚀 #Hallo https://example.test/a',status:'Approved',social:{platform:'LinkedIn',link:'https://example.test/content'},planningSchedule:schedule('2026-09-25','10:30'),images:[{url:'https://images.example.test/safe.jpg'},{url:'https://images.example.test/second.jpg'}]},
 {id:'secret-node-b',type:'Social Media Posting',title:'',content:'Ungeplant',status:'Draft',social:{platform:'Instagram',link:'https://example.test/?token=secret'},images:[{url:'javascript:alert(1)'}]},
 {id:'secret-node-c',type:'Social Media Posting',title:'Earlier',content:'First',status:'Ready',social:{platform:'Facebook'},planningSchedule:schedule('2026-09-25','08:00')},
 {id:'secret-node-d',type:'Social Media Posting',title:'Done',content:'Published copy',status:'Published',social:{platform:'X'},publication:{publishedAt:'2026-09-20',providerPublicationId:'never-print'}},
 {id:'not-a-post',type:'Content',content:'excluded private copy'}
];
const projection=csv.project({nodes,context:{boardId:'secret-board',accountId:'member@test',canView:true},readiness:()=>({level:'Ready'}),mediaPreview:n=>({url:n.images?.[0]?.url,count:n.images?.length||0}),destinationLabel:()=> 'Campaign page'});
const en=pdf.build({projection,includeUnscheduled:true,locale:'en',boardName:'Autumn Campaign',generatedAt:new Date('2026-09-25T12:00:00Z')}),de=pdf.build({projection,includeUnscheduled:true,locale:'de',boardName:'Herbstkampagne',generatedAt:new Date('2026-09-25T12:00:00Z')}),markup=pdf.render(en,{preview:true}),source=fs.readFileSync('posting-plan-pdf.js','utf8');
assert.deepStrictEqual(en.groups[0].posts.map(x=>x.row.scheduled_time),['08:00','10:30']);
assert.equal(en.groups[0].heading,'Friday, September 25, 2026');assert.equal(de.groups[0].heading,'Freitag, 25. September 2026');
assert.deepStrictEqual(en.counts,{total:4,scheduled:2,unscheduled:1,finalized:1,excluded:1,unsafe:2});
for(const value of ['Posting Plan','Autumn Campaign','Scheduled posts','Unscheduled posts','Finalized posts','Absatz eins\n\nUnicode ✓ 🚀 #Hallo','LinkedIn','Campaign page','+1 media','No safe media preview'])assert(markup.includes(value),value);
for(const forbidden of ['secret-board','secret-node','never-print','providerPublicationId','revision','fingerprint','token=secret','javascript:','excluded private copy'])assert(!markup.includes(forbidden),forbidden);
assert(markup.includes('&lt;')===false);assert(!/<script|onerror=|onclick=/i.test(markup));
for(const token of ['format:"csv"','session.format','data-export-format="pdf"','data-export-create','Create PDF','PDF erstellen','session.unscheduledDecision','PRINT_UNAVAILABLE','session.pending','requestLifecycleGeneration','exportAuthorized(c)','pdfModel(c,lang,latest,session)'])assert(workspace.includes(token),token);
for(const token of ['data-posting-plan-print-root','afterprint','FALLBACK_CLEANUP_MS','waitForImages','win.print()','posting-plan-is-printing'])assert(source.includes(token),token);
for(const forbidden of ['fetch(','XMLHttpRequest','localStorage','sessionStorage','console.'])assert(!source.includes(forbidden),forbidden);
for(const token of ['@page{size:A4 portrait','print-color-adjust:exact','break-inside:avoid','orphans:3','widows:3','max-height:42mm','max-width:640px','forced-colors:active','prefers-reduced-motion:reduce','.posting-plan-is-printing>*:not([data-posting-plan-print-root])'])assert(css.includes(token),token);
assert(html.indexOf('posting-plan-export.js')<html.indexOf('posting-plan-pdf.js'));assert(html.indexOf('posting-plan-pdf.js')<html.indexOf('content-workspace.js'));
assert.equal(pkg.scripts['check:bw35.4r1'],'node scripts/check-bw35-4r1-posting-plan-pdf-export.js');assert(workflow.indexOf('check:bw35.4r1')>workflow.indexOf('check:bw35.4'));
const csvBefore=csv.serialize(projection.rows);assert.equal(csvBefore,csv.serialize(projection.rows));assert(!/onSchedule|onPublish|server-side PDF|provider request/i.test(source));
console.log('BW-35.4R1 visual Posting Plan PDF export passed (format, projection, privacy, print, CSS, architecture).');

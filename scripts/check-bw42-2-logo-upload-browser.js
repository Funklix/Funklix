'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {png,B}=require('./fixtures/bw36-13r5-local-runtime');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true});
    const p=f.page,key=k=>p.locator(`[data-profile-key="${k}"]`);
    const original=structuredClone(f.r.db.brands[0].brand_core);
    // Actual protected GET handler and storage read, rather than an unconditional image success.
    await p.route('**/api/brands/*/logo?*',async route=>{
      const out=await f.r.request('GET',new URL(route.request().url()).pathname+new URL(route.request().url()).search);
      return Buffer.isBuffer(out.body)?route.fulfill({status:out.statusCode,contentType:'image/png',body:out.body})
        :route.fulfill({status:out.statusCode,json:out.body});
    });
    await p.route('**/api/workspaces',route=>{
      const catalog=structuredClone(f.c);
      for(const entry of catalog.workspaces[0].brands){const b=f.r.db.brands.find(b=>b.id===entry.id);Object.assign(entry,{name:b.name,revision:b.revision,logo_revision:b.logo_revision,logo_url:b.logo_object_path?`/api/brands/${b.id}/logo?revision=${b.logo_revision}`:null});}
      return route.fulfill({json:catalog});
    });
    async function open(){await p.evaluate(()=>{void openRegularBrandProfile();});await p.waitForFunction(()=>brandProfileController&&canonicalBrandDetail.status==='ready');await key('Brand Assets').click();}
    async function idle(){await p.waitForFunction(()=>!brandProfileController.busy());}
    async function image(){await p.waitForFunction(()=>{const img=document.querySelector('.profile-header .profile-logo img');return img?.complete&&img.naturalWidth>0;});}
    await open();
    await key('file').setInputFiles({name:'disposable-logo.png',mimeType:'image/png',buffer:png});
    await p.waitForFunction(()=>!!brandProfileController.state.fileData);
    await p.waitForFunction(()=>{const img=document.querySelector('.profile-logo-candidate');return img?.complete&&img.naturalWidth>0;});
    assert.equal(f.r.objects.size,0,'Preview has not uploaded any bytes');
    f.r.db.failStorageUpload=true;await key('Upload logo').click();await idle();
    assert.equal(await p.evaluate(()=>brandProfileController.state.message),'Logo storage is temporarily unavailable. Your Brand information can still be saved.');
    assert.equal(f.r.objects.size,0);assert.equal(f.r.db.brands[0].logo_revision,0);
    await p.evaluate(()=>{state.uiLanguage='de';brandProfileController.render();});
    assert(await p.locator('.guided-brand-profile').innerText().then(t=>t.includes('Der Logo-Speicher ist vorübergehend nicht verfügbar.')));
    f.r.db.failStorageUpload=false;f.r.db.failLogoMetadata=true;
    await key('Upload logo').click();await idle();
    assert.equal(f.r.objects.size,1);assert.equal(f.r.db.brands[0].logo_revision,0);
    assert(await p.evaluate(()=>!!brandProfileController.state.fileData));
    assert(await p.locator('.guided-brand-profile').innerText().then(t=>t.includes('Der Logo-Upload ist fehlgeschlagen. Deine Datei bleibt erhalten.')));
    f.r.db.failLogoMetadata=false;await key('Upload logo').click();await idle();
    assert.equal(await p.evaluate(()=>brandProfileController.state.logo),'Logo saved');
    assert.equal(f.r.db.brands[0].logo_revision,1);assert.equal(f.r.objects.size,1);
    assert.equal(await p.evaluate(()=>brandProfileController.state.fileData),null);await image();
    const attempts=f.r.requests.filter(q=>q.method==='POST'&&q.path.endsWith('/logo'));
    assert.equal(attempts.length,3);assert.deepEqual(attempts[0].body,attempts[2].body);
    assert.equal(f.r.db.history.length,1,'One persisted logo transition after retry');
    await key('Overview').click();await key('Brand name').fill('Disposable saved Brand');
    await key('Confirm and save Brand Profile').click();await idle();
    assert.equal(f.r.db.brands[0].name,'Disposable saved Brand');
    assert.deepEqual(f.r.db.brands[0].brand_core,original,'Profile save preserves core and avatar');
    await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);await open();await image();
    assert.equal(await p.locator('.profile-header .profile-logo img').getAttribute('src'),`/api/brands/${B}/logo?revision=1`);
    await key('file').setInputFiles({name:'disposable-replacement.png',mimeType:'image/png',buffer:png});
    await p.waitForFunction(()=>!!brandProfileController.state.fileData);
    await key('Change logo').click();await idle();
    assert.equal(f.r.db.brands[0].logo_revision,2);assert.equal(f.r.objects.size,2);await image();
    await p.locator('#brand-workspace-detail-close').click();await open();await image();
    assert.equal(await p.locator('.profile-header .profile-logo img').getAttribute('src'),`/api/brands/${B}/logo?revision=2`);
    assert.deepEqual(f.r.db.brands[0].brand_core.brandDNA,original.brandDNA);
    assert.deepEqual(f.errors,[]);await p.close();
    console.log('PASS BW-42.2 Chromium actual Brand Profile: preview versus stored/persisted image, EN/DE storage and metadata failures, retained file, immutable duplicate retry, profile save, fresh page reload, replacement and reopen. Production handlers/storage adapter with disposable external fixtures.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

(function(root) {
  'use strict';
  const COPY={
    find:['Find Learning suggestions','Learning-Vorschläge finden'],title:['AI Learning Advisor','KI-Learning-Berater'],
    board:['Select one saved Board','Ein gespeichertes Board auswählen'],choose:['Choose a Board','Board auswählen'],
    scope:['Only saved, authorized Profile and Board text plus approved/proposed Learnings are analyzed. Unsaved edits are excluded.','Analysiert werden nur gespeicherte, berechtigte Profil- und Board-Texte sowie bestätigte/vorgeschlagene Learnings. Ungespeicherte Änderungen sind ausgeschlossen.'],
    disclosure:['These selected content categories will be sent to OpenAI: canonical Brand Profile, accepted strategy modules, campaign snapshot, allowlisted Nodes and structure, approved/proposed Learnings. Private documents, images, analytics and AI Brain chats are excluded.','Diese ausgewählten Inhaltskategorien werden an OpenAI gesendet: kanonisches Markenprofil, akzeptierte Strategiemodule, Kampagnen-Snapshot, erlaubte Knoten und Struktur sowie bestätigte/vorgeschlagene Learnings. Private Dokumente, Bilder, Analysen und KI-Brain-Chats sind ausgeschlossen.'],
    discussions:['Include persisted Post-its and all their replies (optional)','Gespeicherte Post-its und alle zugehörigen Antworten einbeziehen (optional)'],
    discussionDisclosure:['Included discussions and replies will also be sent to OpenAI. Uncheck any whole thread to exclude it.','Einbezogene Diskussionen und Antworten werden ebenfalls an OpenAI gesendet. Entferne den Haken, um einen ganzen Thread auszuschließen.'],
    analyze:['Analyze selected sources','Ausgewählte Quellen analysieren'],loading:['Analyzing selected sources…','Ausgewählte Quellen werden analysiert…'],
    preview:['Loading authorized source scope…','Berechtigter Quellenumfang wird geladen…'],cancel:['Close','Schließen'],review:['Review proposal','Vorschlag prüfen'],
    advisory:['Temporary advice expires after 10 minutes; human approval is required. Confidence describes extraction, not a probability of truth.','Vorübergehende Empfehlungen laufen nach 10 Minuten ab; menschliche Bestätigung ist erforderlich. Konfidenz beschreibt die Extraktion, keine Wahrheitswahrscheinlichkeit.'],
    provenance:['This proposal preserves one primary Board/Node only. Discussion excerpts and complete evidence are not stored as a durable ledger.','Dieser Vorschlag bewahrt nur einen primären Board-/Knotenverweis. Diskussionsauszüge und vollständige Belege werden nicht als dauerhaftes Quellenverzeichnis gespeichert.'],
    manual:['Create a human-authored manual proposal. Profile-only or multi-source evidence cannot be stored as structured provenance. You take responsibility for the edited Brand-wide statement.','Erstelle einen menschlich verfassten manuellen Vorschlag. Reine Profilbelege oder mehrere Quellen können nicht als strukturierte Herkunft gespeichert werden. Du übernimmst Verantwortung für die bearbeitete markenweite Aussage.'],
    successor:['Propose an update through the existing successor workflow. It inherits the original provenance and cannot store a new multi-source evidence ledger. The original stays approved until human approval of the successor.','Schlage eine Aktualisierung über den bestehenden Nachfolgeprozess vor. Sie übernimmt die ursprüngliche Herkunft und kann kein neues Quellenverzeichnis speichern. Das Original bleibt bis zur menschlichen Bestätigung des Nachfolgers bestätigt.'],
    statement:['Human-reviewed statement','Menschlich geprüfte Aussage'],evidence:['Minimized evidence / context (optional)','Minimierte Belege / Kontext (optional)'],
    save:['Save as proposed','Als Vorschlag speichern'],back:['Back to suggestions','Zurück zu Vorschlägen'],
    saved:['Saved as proposed. Review and approve in Brand Profile Learnings.','Als Vorschlag gespeichert. Prüfe und bestätige es in den Learnings des Markenprofils.'],
    empty:['No useful suggestions were found in this selected scope.','Im ausgewählten Umfang wurden keine nützlichen Vorschläge gefunden.'],
    discard:['Discard edited proposal text?','Bearbeiteten Vorschlagstext verwerfen?'],keep:['Keep editing','Weiter bearbeiten'],discardAction:['Discard','Verwerfen'],
    expired:['These suggestions expired or their authorized context changed. Analyze again.','Diese Vorschläge sind abgelaufen oder ihr berechtigter Kontext wurde geändert. Analysiere erneut.'],
    unavailable:['The analysis could not be completed. No automatic retry was made.','Die Analyse konnte nicht abgeschlossen werden. Es gab keinen automatischen Neuversuch.'],
    CONTEXT_OVERFLOW:['The selected context exceeds the input budget. Exclude discussions or choose a smaller Board. No incomplete thread was analyzed.','Der ausgewählte Kontext überschreitet das Eingabebudget. Schließe Diskussionen aus oder wähle ein kleineres Board. Es wurde kein unvollständiger Thread analysiert.'],
    STALE_SOURCE:['Saved sources changed. Reload saved sources, then analyze again. Your selected Board and discussion options are retained.','Gespeicherte Quellen wurden geändert. Lade die gespeicherten Quellen neu und analysiere erneut. Board-Auswahl und Diskussionsoptionen bleiben erhalten.'],
    STALE_BRAND_REVISION:['The Brand changed. Reload saved sources, then analyze again.','Die Marke wurde geändert. Lade die gespeicherten Quellen neu und analysiere erneut.'],
    PROVIDER_UNAVAILABLE:['The existing OpenAI configuration is unavailable.','Die bestehende OpenAI-Konfiguration ist nicht verfügbar.'],
    PROVIDER_TIMEOUT:['Analysis timed out. No automatic retry was made.','Zeitlimit überschritten. Es gab keinen automatischen Neuversuch.'],
    PROVIDER_RATE_LIMITED:['OpenAI rejected the request due to its rate limit. No automatic retry was made.','OpenAI hat die Anfrage wegen seines Ratenlimits abgelehnt. Es gab keinen automatischen Neuversuch.'],
    INVALID_OUTPUT:['OpenAI returned unusable evidence or output. No suggestions were released.','OpenAI lieferte unbrauchbare Belege oder Ausgaben. Es wurden keine Vorschläge freigegeben.'],
    OUTPUT_LANGUAGE_MISMATCH:['OpenAI returned the wrong language. No suggestions were released.','OpenAI lieferte die falsche Sprache. Es wurden keine Vorschläge freigegeben.'],
    UNSUPPORTED_SOURCE:['This saved Board schema or source is not supported.','Dieses gespeicherte Board-Schema oder diese Quelle wird nicht unterstützt.'],
    UNSUPPORTED_THREAD:['A thread exceeds supported nesting or size. Exclude it before analysis.','Ein Thread überschreitet die unterstützte Tiefe oder Größe. Schließe ihn vor der Analyse aus.'],
    processing:['Larger analyses can require several OpenAI requests, more API usage and additional time. Analysis starts only when you press Analyze.','Größere Analysen können mehrere OpenAI-Anfragen, mehr API-Nutzung und zusätzliche Zeit erfordern. Die Analyse startet erst, wenn du auf Analysieren klickst.'],
    pass:['Analyzing source group','Quellengruppe wird analysiert'],consolidating:['Consolidating validated findings…','Validierte Ergebnisse werden zusammengeführt…'],
    planned:['OpenAI requests planned','OpenAI-Anfragen geplant'],requests:['OpenAI requests used','Verwendete OpenAI-Anfragen'],
    refresh:['Reload saved sources','Gespeicherte Quellen neu laden'],
    MODEL_CONTEXT_UNCONFIGURED:['The configured model needs a verified context-token setting on the server. Ask the administrator to configure it, then retry.','Für das konfigurierte Modell ist eine verifizierte Kontext-Token-Einstellung auf dem Server erforderlich. Bitte die Administration um die Einstellung und versuche es erneut.'],
    THREAD_CONTEXT_EXCEEDED:['One complete discussion cannot fit this model request. Exclude that whole thread or analyze with a model whose verified context supports it. No suggestions were released.','Eine vollständige Diskussion passt nicht in eine Anfrage dieses Modells. Schließe den ganzen Thread aus oder nutze ein Modell mit ausreichend verifiziertem Kontext. Es wurden keine Vorschläge freigegeben.'],
    SOURCE_CONTEXT_EXCEEDED:['A source or the consolidation evidence cannot fit the configured model context. Choose a smaller Board or exclude discussions, then retry. No suggestions were released.','Eine Quelle oder die zusammenzuführenden Belege passen nicht in den konfigurierten Modellkontext. Wähle ein kleineres Board oder schließe Diskussionen aus und versuche es erneut. Es wurden keine Vorschläge freigegeben.'],
    ANALYSIS_RUNTIME_EXCEEDED:['This analysis exceeds the server execution window. Choose a smaller Board or exclude discussions, then retry. No partial result was released.','Diese Analyse überschreitet die Ausführungszeit des Servers. Wähle ein kleineres Board oder schließe Diskussionen aus und versuche es erneut. Es wurde kein Teilergebnis freigegeben.'],
    ANALYSIS_CANCELLED:['Analysis was cancelled. Retry explicitly when ready.','Die Analyse wurde abgebrochen. Starte bei Bedarf ausdrücklich erneut.'],
    selection:['All selected source groups were processed. Up to five suggestions were selected; this is not an exhaustive knowledge inventory.','Alle ausgewählten Quellengruppen wurden verarbeitet. Bis zu fünf Vorschläge wurden ausgewählt; dies ist kein vollständiges Wissensinventar.'],
    confidence:['Extraction confidence','Extraktionskonfidenz'],low:['Low','Niedrig'],medium:['Medium','Mittel'],high:['High','Hoch'],
    learning_candidate:['Potential Learning','Mögliches Learning'],decision_candidate:['Decision statement','Entscheidungsaussage'],correction:['Correction','Korrektur'],
    knowledge_gap:['Knowledge gap','Wissenslücke'],potential_conflict:['Potential conflict','Möglicher Konflikt'],learning_update_candidate:['Learning update','Learning-Aktualisierung'],
    hypothesis:['Hypothesis','Hypothese'],explicit_statement:['Explicit statement','Explizite Aussage'],canonical_knowledge:['Canonical knowledge','Kanonisches Wissen'],
    approved_knowledge:['Approved knowledge','Bestätigtes Wissen'],generated_material:['Generated material','Generiertes Material'],mixed:['Mixed evidence','Gemischte Belege'],
    unresolved:['Unresolved','Ungeklärt'],disputed:['Disputed','Umstritten'],not_applicable:['No decision established','Keine Entscheidung festgestellt'],
    new:['New candidate','Neuer Kandidat'],possible_duplicate:['Possible duplicate','Mögliche Dublette'],exact_duplicate:['Exact duplicate; review existing Learning','Exakte Dublette; bestehendes Learning prüfen'],
    possible_conflict:['Possible conflict','Möglicher Konflikt'],update:['Update recommendation','Aktualisierungsempfehlung'],
    related:['Related Learnings','Zugehörige Learnings'],limitations:['Source limitations','Quellenbeschränkungen'],
    canonical_profile:['Canonical Profile','Kanonisches Profil'],campaign_snapshot:['Campaign snapshot','Kampagnen-Snapshot'],accepted_module:['Accepted module','Akzeptiertes Modul'],
    canvas_node:['Saved Node','Gespeicherter Knoten'],canvas_reply:['Reply','Antwort'],postit:['Post-it','Post-it'],approved_learning:['Approved Learning','Bestätigtes Learning'],proposed_learning:['Proposed Learning','Vorgeschlagenes Learning'],
    ai:['AI-generated; attribution is mutable','KI-generiert; Zuordnung ist veränderbar'],human:['Human-attributed; identity is unverified','Menschlich zugeordnet; Identität ungeprüft'],
    resolved:['Resolved state does not mean approval','Erledigt bedeutet keine Bestätigung'],open:['Open discussion','Offene Diskussion'],
    excluded:['Excluded source categories','Ausgeschlossene Quellenkategorien'],
    private_document:['Private document','Privates Dokument'],draft_or_unallowlisted_module:['Draft or unsupported module','Entwurfs- oder nicht unterstütztes Modul'],
    inactive_node:['Inactive Node','Inaktiver Knoten'],unsupported_node:['Unsupported Node type','Nicht unterstützter Knotentyp'],discussion:['Excluded discussion','Ausgeschlossene Diskussion'],deleted_discussion:['Deleted discussion','Gelöschte Diskussion'],
    unsupported_field:['Unsupported optional text field','Nicht unterstütztes optionales Textfeld'],unsupported_discussion:['Unsupported optional discussion data','Nicht unterstützte optionale Diskussionsdaten'],
    partialThreads:['Some discussion content was excluded. Coverage is limited; included threads were not truncated.','Einige Diskussionsinhalte wurden ausgeschlossen. Die Abdeckung ist begrenzt; einbezogene Threads wurden nicht gekürzt.'],
    WORKSPACE_ACCESS_DENIED:['Current Workspace membership is required.','Aktuelle Workspace-Mitgliedschaft ist erforderlich.'],
    SOURCE_UNAVAILABLE:['The selected saved source is unavailable.','Die ausgewählte gespeicherte Quelle ist nicht verfügbar.'],
    SOURCE_ACCESS_DENIED:['Access to the selected saved source was denied.','Zugriff auf die ausgewählte gespeicherte Quelle wurde verweigert.'],
    INVALID_RECEIPT:['This analysis is unavailable for the current session. Analyze again.','Diese Analyse ist für die aktuelle Sitzung nicht verfügbar. Analysiere erneut.']
  };
  function create(options) {
    const doc=options.document||root.document;
    let dialog=null,origin=null,busy=false,alive=true,generation=0,data=null,editing=null,scope=null,meta=null,monitor=null,expiry=null,activeController=null;
    const t=k=>(COPY[k]||root.FunklixBrandLearnings?.COPY[k]||COPY.unavailable)[options.language()==='de'?1:0];
    const el=(tag,value,parent)=>{const n=doc.createElement(tag);if(value)n.textContent=value;parent?.append(n);return n;};
    const button=(key,parent,fn)=>{const b=el('button',t(key),parent);b.type='button';b.className='fk-btn fk-btn-secondary';b.dataset.advisorAction=key;b.addEventListener('click',fn);return b;};
    const current=()=>alive&&options.current()&&options.connected();
    async function request(body) {
      const controller=new root.AbortController(),timer=root.setTimeout(()=>controller.abort(),body?.action==='analyze'?300000:35000),g=generation;activeController=controller;
      try{
        const url='/api/brands/'+options.brand.id+'/learning-advisor'+(body?'':'?workspace_id='+encodeURIComponent(options.workspaceId));
        const r=await (options.fetchImpl||root.fetch.bind(root))(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
          headers:{Accept:body?.action==='analyze'?'application/x-ndjson':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
        let result;
        if(r.headers?.get('content-type')?.includes('application/x-ndjson')&&r.body) {
          const reader=r.body.getReader(),decoder=new root.TextDecoder();let buffer='',terminal=false;
          while(true) {
            const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
            if(buffer.length>128000)throw Object.assign(new Error(),{code:'INVALID_OUTPUT'});
            let newline;
            while((newline=buffer.indexOf('\n'))>=0) {
              const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;
              const event=JSON.parse(line);
              if(!dialog||!current()||g!==generation)throw Object.assign(new Error(),{code:'expired'});
              if(event.error)throw Object.assign(new Error(),{code:event.error.code});
              if(event.progress&&!terminal)progress(event.progress);
              if(event.result){if(terminal)throw new Error();result=event.result;terminal=true;}
            }
            if(done){if(buffer.trim()||!terminal)throw Object.assign(new Error(),{code:'unavailable'});break;}
          }
        } else result=await r.json().catch(()=>null);
        if(!dialog||!current()||g!==generation)throw Object.assign(new Error(),{code:'expired'});
        if(!r.ok)throw Object.assign(new Error(),{code:result?.error?.code||'unavailable'});
        if(!result||!['brand_learning_advisor_v1','brand_learnings_v1'].includes(result.contract))throw new Error();
        return result;
      }catch(e){if(e.name==='AbortError')throw Object.assign(new Error(),{code:'PROVIDER_TIMEOUT'});throw e;}finally{root.clearTimeout(timer);if(activeController===controller)activeController=null;}
    }
    function clear(){data=null;editing=null;if(controls)controls.hidden=false;root.clearTimeout(expiry);}
    function close(){generation++;activeController?.abort();clear();root.clearInterval(monitor);dialog?.close();dialog?.remove();dialog=null;busy=false;doc.removeEventListener('visibilitychange',resume);root.removeEventListener('focus',resume);if(origin?.isConnected)origin.focus();}
    function discard(action){
      if(!editing?.dirty){action();return;}
      if(dialog.querySelector('[data-advisor-discard]'))return;
      const box=el('div','',dialog);box.dataset.advisorDiscard='true';el('p',t('discard'),box);
      button('keep',box,()=>{box.remove();editing?.statement.focus();});button('discardAction',box,action).focus();
    }
    function cancel(){discard(close);}
    let feedback,controls,results,select,discussion,threadList;
    function message(code){
      const state=['preview','loading'].includes(code)?'progress':code==='saved'?'info':'error';
      feedback.className='advisor-feedback advisor-feedback-'+state;feedback.dataset.state=state;
      feedback.setAttribute('role',state==='error'?'alert':'status');feedback.setAttribute('aria-live',state==='error'?'assertive':'polite');
      feedback.replaceChildren();
      const icon=el('span',state==='error'?'⚠':state==='progress'?'◌':'ⓘ',feedback);icon.setAttribute('aria-hidden','true');
      el('span',t(code),feedback);
    }
    function progress(value){
      if(!['analyzing','consolidating'].includes(value.stage)||!Number.isSafeInteger(value.completed)||!Number.isSafeInteger(value.total)||value.total<1||value.completed<0||value.completed>value.total)return;
      message('loading');feedback.lastElementChild.textContent=value.stage==='consolidating'?t('consolidating'):t('pass')+' '+(value.completed+1)+' / '+value.total;
      if(Number.isSafeInteger(value.planned_requests)&&value.planned_requests>1)feedback.lastElementChild.textContent+=' · '+value.planned_requests+' '+t('planned');
    }
    async function validate(){
      if(!data||data.expires<=Date.now())throw Object.assign(new Error(),{code:'expired'});
      await request({action:'validate',receipt:data.receipt});
    }
    async function resume(){
      if(!dialog||!data||busy||!current())return;
      results.hidden=true;
      if(doc.hidden)return;
      busy=true;
      try{await validate();results.hidden=false;}catch(e){clear();results.replaceChildren();message(e.code||'expired');}
      finally{busy=false;}
    }
    function coverage(value,parent){
      if(value.complete_threads===false){const warning=el('div','',parent);warning.className='advisor-feedback advisor-feedback-warning';warning.setAttribute('role','status');const icon=el('span','⚠',warning);icon.setAttribute('aria-hidden','true');el('span',t('partialThreads'),warning);}
      else el('p',options.language()==='de'?'Vollständige Threads im gewählten Umfang; keine gekürzten Threads. Nur erlaubte Textfelder und begrenzte akzeptierte Module. Fehlende Felder beweisen keine Wissenslücke.':'Whole threads in selected scope; no truncated threads. Allowlisted text fields and bounded accepted modules only. Missing fields do not prove a knowledge gap.',parent);
      const categories=[...new Set(value.excluded||[])].map(k=>t(k));
      el('p',t('excluded')+': '+(categories.join(', ')||'0'),parent);
    }
    function renderResults(){
      results.replaceChildren();results.hidden=false;el('p',t('advisory'),results);coverage(data.coverage,results);if(data.coverage.analysis_complete)el('p',t('selection'),results);if(Number.isSafeInteger(data.metadata?.provider_requests))el('p',data.metadata.provider_requests+' '+t('requests'),results);
      if(!data.suggestions.length)el('p',t('empty'),results);
      for(const s of data.suggestions){
        const card=el('article','',results);card.className='learning-card';el('h3',t(s.type),card);el('p',s.statement,card);el('p',s.rationale,card);
        el('p',t('confidence')+': '+t(s.confidence)+' — '+s.confidence_reason,card);
        el('p',t(s.evidence_class)+' · '+t(s.decision_status)+' · '+t(s.relationship),card);
        if(s.related_learning_ids.length)el('p',t('related')+': '+s.related_learning_ids.join(', '),card);
        const evidence=el('details','',card);el('summary',t('evidence'),evidence);
        for(const source of s.sources){
          el('p',t(source.kind)+(source.node_id?' · '+source.node_id:'')+(source.field?' · '+source.field:''),evidence);
          if(source.attribution)el('p',t(source.attribution==='ai_generated'?'ai':'human'),evidence);
          if(source.resolved!=null)el('p',t(source.resolved?'resolved':'open'),evidence);
          el('blockquote',source.excerpt,evidence);
        }
        el('p',t('limitations'),card);for(const limit of s.limitations)el('p',limit,card);
        el('p',t(s.mode==='successor'?'successor':s.mode==='manual'?'manual':'provenance'),card);
        if(s.relationship!=='exact_duplicate')button('review',card,async()=>{
          if(busy)return;busy=true;
          try{await validate();edit(s);}catch(e){clear();results.replaceChildren();message(e.code||'expired');}finally{busy=false;}
        });
      }
    }
    function edit(s){
      controls.hidden=true;results.replaceChildren();el('h3',t('review'),results);
      el('p',t(s.mode==='successor'?'successor':s.mode==='manual'?'manual':'provenance'),results);
      const field=(key,value,max)=>{const label=el('label','',results);el('span',t(key),label);const area=el('textarea','',label);area.value=value;area.maxLength=max;area.rows=4;area.dataset.advisorField=key;return area;};
      const statement=field('statement',s.statement,2000),evidence=field('evidence','',4000);
      editing={statement,dirty:false};for(const n of [statement,evidence])n.addEventListener('input',()=>{editing.dirty=true;});
      const actions=el('div','',results);actions.className='learning-actions';
      const save=button('save',actions,async()=>{
        if(busy||!editing)return;
        busy=true;save.disabled=true;back.disabled=true;
        try{
          await validate();
          const result=await request({action:'adopt',receipt:data.receipt,suggestion_id:s.id,statement:statement.value,evidence_summary:evidence.value});
          if(result.learning?.status!=='proposed')throw new Error();
          clear();controls.hidden=false;results.replaceChildren();message('saved');void options.reload?.();
        }catch(e){message(e.code||'unavailable');}finally{busy=false;if(save.isConnected){save.disabled=false;back.disabled=false;}}
      });
      const back=button('back',actions,()=>{if(!busy)discard(()=>{editing=null;controls.hidden=false;renderResults();});});
      statement.focus();
    }
    async function refreshScope(preserve=false){
      const excluded=preserve?[...(scope?.excluded_threads||[])]:[];
      generation++;const flight=generation;clear();results.replaceChildren();threadList.replaceChildren();if(!select.value){scope=null;return;}
      const board=meta.boards.find(b=>b.id===select.value);if(!board)return;
      scope={workspace_id:options.workspaceId,board_id:board.id,expected_brand_revision:meta.brand.revision,expected_board_updated_at:board.updated_at,include_discussions:discussion.checked,excluded_threads:[],language:options.language()};
      busy=true;analyze.disabled=true;message('preview');
      try{
        const preview=await request({action:'preview',scope});
        if(discussion.checked){
          el('p',t('discussionDisclosure'),threadList);
          for(const thread of preview.threads){
            const label=el('label','',threadList),check=el('input','',label);check.type='checkbox';check.checked=!excluded.includes(thread.key);check.dataset.advisorThread=thread.key;
            el('span',thread.node_id+' · '+thread.title+(thread.ai?' · '+t('ai'):''),label);
            check.addEventListener('change',()=>{clear();results.replaceChildren();scope.excluded_threads=[...threadList.querySelectorAll('input')].filter(x=>!x.checked).map(x=>x.dataset.advisorThread);});
          }
        }
        scope.excluded_threads=discussion.checked?[...threadList.querySelectorAll('input')].filter(x=>!x.checked).map(x=>x.dataset.advisorThread):[];
        coverage(preview.coverage,threadList);feedback.textContent='';
      }catch(e){if(flight===generation&&dialog){scope=null;message(e.code||'unavailable');}}
      finally{if(flight===generation&&dialog){busy=false;analyze.disabled=!scope;}}
    }
    let analyze;
    async function open(){
      if(dialog||!current())return;
      origin=doc.activeElement;generation++;const language=options.language();dialog=el('dialog');dialog.className='brand-learning-dialog learning-advisor-dialog';dialog.dataset.learningAdvisor='true';dialog.setAttribute('aria-label',t('title'));doc.body.append(dialog);
      el('h2',t('title'),dialog);const receivingBrand=el('p',options.brand.name,dialog);el('p',t('scope'),dialog);el('p',t('disclosure'),dialog);const processing=el('p',t('processing'),dialog);processing.className='advisor-context';
      feedback=el('div','',dialog);message('preview');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
      controls=el('div','',dialog);
      const label=el('label','',controls);el('span',t('board'),label);select=el('select','',label);select.dataset.advisorBoard='true';el('option',t('choose'),select).value='';
      const opt=el('label','',controls);discussion=el('input','',opt);discussion.type='checkbox';discussion.checked=false;discussion.dataset.advisorDiscussions='true';el('span',t('discussions'),opt);
      threadList=el('div','',controls);threadList.className='advisor-threads';
      analyze=button('analyze',controls,async()=>{
        if(busy||!scope)return;busy=true;analyze.disabled=select.disabled=discussion.disabled=true;
        threadList.querySelectorAll('input').forEach(n=>n.disabled=true);clear();results.replaceChildren();message('loading');
        try{
          const result=await request({action:'analyze',scope:{...scope,language:options.language()}});
          if(result.brand?.id!==options.brand.id||result.scope?.board_id!==scope.board_id||!Array.isArray(result.suggestions)||result.suggestions.length>5)throw new Error();
          data=result;feedback.textContent='';renderResults();expiry=root.setTimeout(()=>{clear();results.replaceChildren();message('expired');},Math.max(0,data.expires-Date.now()));
        }catch(e){message(e.code||'unavailable');}finally{busy=false;if(dialog){analyze.disabled=!scope;select.disabled=discussion.disabled=false;threadList.querySelectorAll('input').forEach(n=>n.disabled=false);}}
      });analyze.disabled=true;
      button('refresh',controls,async()=>{
        if(busy||!select.value)return;busy=true;analyze.disabled=true;
        try{const latest=await request();if(latest.brand?.id!==options.brand.id||!Array.isArray(latest.boards))throw new Error();const selected=select.value;meta=latest;
          select.replaceChildren();el('option',t('choose'),select).value='';for(const board of meta.boards)el('option',board.name,select).value=board.id;select.value=selected;
          if(!meta.boards.some(b=>b.id===select.value)){scope=null;threadList.replaceChildren();throw Object.assign(new Error(),{code:'SOURCE_UNAVAILABLE'});}
          await refreshScope(true);
        }catch(e){message(e.code||'unavailable');}finally{busy=false;if(dialog)analyze.disabled=!scope;}
      });
      results=el('div','',dialog);const footer=el('div','',dialog);footer.className='advisor-footer';const closeButton=button('cancel',footer,cancel);
      select.addEventListener('change',()=>void refreshScope());discussion.addEventListener('change',()=>void refreshScope());
      dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
      dialog.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();return;}
        if(e.key!=='Tab')return;
        const ns=[...dialog.querySelectorAll('button,input,select,textarea,summary')].filter(n=>!n.disabled&&n.getClientRects().length),first=ns[0],last=ns.at(-1);
        if(e.shiftKey&&doc.activeElement===first||!e.shiftKey&&doc.activeElement===last){e.preventDefault();(e.shiftKey?last:first)?.focus();}
      });
      dialog.showModal();closeButton.focus();busy=true;
      monitor=root.setInterval(()=>{if(dialog&&(!current()||options.language()!==language))close();},250);
      doc.addEventListener('visibilitychange',resume);root.addEventListener('focus',resume);
      try{meta=await request();if(meta.brand?.id!==options.brand.id||!Array.isArray(meta.boards))throw new Error();receivingBrand.textContent=meta.brand.name;for(const board of meta.boards)el('option',board.name,select).value=board.id;feedback.textContent='';}
      catch(e){message(e.code||'unavailable');}finally{busy=false;}
    }
    return {open,invalidate(){alive=false;close();}};
  }
  root.FunklixLearningAdvisor=Object.freeze({create,COPY});
}(typeof globalThis!=='undefined'?globalThis:window));

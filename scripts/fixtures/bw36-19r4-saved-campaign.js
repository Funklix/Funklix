'use strict';
// Invented Campaign Canvas data; no production content or identities.
const {advisorRuntime}=require('./bw36-19-advisor-runtime');
const {campaignBoard}=require('./bw36-19r1-saved-boards');
const {B}=require('./bw36-13r5-local-runtime');
function savedCampaign(language='en') {
  const f=advisorRuntime();f.scope.language=language;f.scope.include_discussions=true;
  f.board.canvas_json=campaignBoard();
  f.board.canvas_json.nodes[2].type='Campaign Variation';
  const de=language==='de';
  f.r.base.db.brands[0].brand_core={brandCore:de?'Hilfreiche Kommunikation für kleine Teams.':'Useful communication for small teams.',
    toneOfVoice:de?'Klar, respektvoll und konkret.':'Clear, respectful and concrete.',
    contentGuidelines:de?'Keine unbelegten Leistungsversprechen.':'Avoid unsupported performance promises.',
    valueProposition:de?'Planbare Inhalte mit menschlicher Prüfung.':'Predictable content with human review.'};
  f.board.brand_core_snapshot={brandCore:de?'Ältere Kampagnenpositionierung: schneller veröffentlichen.':'Earlier campaign positioning: publish faster.'};
  f.board.canvas_json.nodes[0].content=de?'Nutze einen klaren nächsten Schritt.':'Use a clear next step.';
  f.board.canvas_json.nodes[1].content=de?'Variation A: Lade zur Checkliste ein.':'Variation A: Invite readers to the checklist.';
  f.board.canvas_json.nodes[2].content=de?'Variation B: Lade zum Beratungsgespräch ein.':'Variation B: Invite readers to a consultation.';
  f.board.canvas_json.nodes[0].postits=[{text:de?'Sollten wir die Checkliste bevorzugen?':'Should we prefer the checklist?',replies:[
    {text:de?'Noch keine Entscheidung. Beide Varianten prüfen.':'No decision yet. Review both variations.'}]},
    {source:'ai_review',authorName:'AI Review',text:de?'Die Checkliste könnte besser funktionieren.':'The checklist might perform better.',resolved:true,
      replies:[{text:de?'Das ist eine Hypothese, kein Messergebnis.':'That is a hypothesis, not a measurement.'}]}];
  f.r.db.learnings=[{id:'11111111-1111-4111-8111-111111111111',brand_id:B,status:'approved',revision:'1',
    statement:de?'Konkrete Handlungsaufforderungen verwenden.':'Use concrete calls to action.',evidence_summary:de?'Menschlich geprüfte Brand-Richtlinie.':'Human-reviewed Brand guidance.'},
    {id:'22222222-2222-4222-8222-222222222222',brand_id:B,status:'proposed',revision:'0',
      statement:de?'Checklisten als Einstieg testen.':'Test checklists as an entry point.',evidence_summary:de?'Ungeprüfte Kampagnenhypothese.':'Unreviewed campaign hypothesis.'}];
  const template=f.config.output.suggestions[0];
  f.config.onProvider=()=>{
    const input=JSON.parse(f.config.providerCalls.at(-1).body.input[1].content);
    if(input.candidates){f.config.output={language,suggestions:input.candidates.slice(0,1)};return;}
    const source=input.sources.find(s=>s.kind==='canvas_node');
    const s=JSON.parse(JSON.stringify(template));
    s.sources=[{ref:source.ref,excerpt:de?'Nutze einen klaren nächsten Schritt.':'Use a clear next step.'}];
    s.statement=de?'Einen klaren nächsten Schritt anbieten.':'Offer a clear next step.';
    s.rationale=de?'Der gespeicherte Inhalt nennt diesen Ansatz ausdrücklich.':'The saved content explicitly describes this approach.';
    s.confidence_reason=de?'Die Formulierung ist klar; die Wirkung ist nicht geprüft.':'The wording is explicit; performance is unverified.';
    s.limitations=[de?'Vor der Übernahme ist eine menschliche Prüfung erforderlich.':'Human review is required before adoption.'];
    f.config.output={language,suggestions:[s]};
  };
  return f;
}
module.exports={savedCampaign};

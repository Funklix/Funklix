'use strict';
// Synthetic persisted data, never copied from production. Shapes follow app.js
// serializeState/createNode/addEdge and the pre-schema serializer (332aa72).
function campaignBoard() {
  const types=['Idea','Campaign Variation','Content','Social Media Posting','Landing Page','Email Campaign'];
  return {
    schemaVersion:1,nodeCounter:7,postitCounter:3,zoom:1,
    metadata:{createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-12T10:00:00Z'},activityFeed:[],
    nodes:types.map((type,i)=>({
      id:'node-'+(i+1),type,title:i===0?'CTA':type,content:i===0?'Use a clear next step.':'Campaign text.',
      status:'Draft',tags:[],variants:[],contentFormat:'1:1',audience:'',goal:'',channel:'',funnelStage:'',tone:'',
      images:[],favoriteImageId:null,imagePrompt:'',reactions:{},compact:false,justConnectedAt:null,
      position:{x:100+i*320,y:100},
      social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''},
      landingPage:{headerVisualPrompt:'',headerClaim:'',problem:'',solution:'',trust:'',cta:''},
      postits:i===0?[
        {id:'postit-1',text:'Maybe use a slogan?',user:'Reviewer',time:'Yesterday',color:'#ffe082',x:24,y:48,
          resolved:true,replies:[{id:'reply-1',text:'Rejected. Use a clear next step instead.',replies:[{text:'Keep the question open.'}]}]},
        {id:'postit-2',text:'Open question.',resolved:false}
      ]:[]
    })),
    edges:types.slice(1).map((_,i)=>['node-'+(i+1),'node-'+(i+2)])
  };
}
function legacyBoard() {
  return {nodes:[
    {id:'node-11',type:'Social Media Post',title:'Legacy posting',content:'Review the wording.',position:{x:100,y:100},
      postits:[{text:'Legacy root',user:'Reviewer',time:'12:30',replies:[{text:'Legacy reply'}]}]},
    {id:'old-custom-id',type:'Visual Concept',title:'Visual concept',images:[]},
    {id:'brief-1',type:'Image Brief'},
    {id:'optional-widget',type:'Historical custom widget',content:'Excluded optional content'}
  ].map((node,i)=>({title:'',content:'',tags:[],variants:[],images:[],reactions:{},postits:[],
    social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''},
    position:{x:100+i*320,y:100},...node})),
  edges:[['node-11','old-custom-id'],['old-custom-id','brief-1']],nodeCounter:12,zoom:1};
}
module.exports={campaignBoard,legacyBoard};

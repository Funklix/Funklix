(function(root){'use strict';
  function initials(name){return Array.from(String(name||'').trim().normalize('NFC').split(/\s+/u).filter(Boolean).map(part=>Array.from(part)[0]||'').join('')).slice(0,2).join('').toLocaleUpperCase()||'•';}
  function safeUrl(value){return typeof value==='string'&&/^\/api\/brands\/[0-9a-f-]+\/logo\?revision=\d+$/i.test(value)?value:null;}
  function render(node,brand,{label='Brand logo'}={}){if(!node)return;node.replaceChildren();node.classList.add('brand-logo');const fallback=()=>{node.replaceChildren();const text=node.ownerDocument.createElement('span');text.className='brand-logo-initials';text.textContent=initials(brand?.name);node.append(text);};const url=safeUrl(brand?.logo_url);if(url){const image=node.ownerDocument.createElement('img');image.src=url;image.alt='';image.loading='lazy';image.addEventListener('error',fallback,{once:true});node.append(image);}else fallback();node.setAttribute('role','img');node.setAttribute('aria-label',`${brand?.name||''} ${label}`.trim());}
  root.FunklixBrandLogo=Object.freeze({initials,safeUrl,render});
}(typeof globalThis!=='undefined'?globalThis:window));

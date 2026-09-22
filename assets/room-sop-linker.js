(()=>{'use strict';
  const cfg=window.LIMEWOOD_CONFIG||{};
  let db=null,cache=null,busy=false;
  const client=()=>db||(window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey?(db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})):null);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const exact=(text,label,n)=>new RegExp('\\b'+label+'\\s*0*'+n+'\\b','i').test(String(text||''));
  const water=s=>/(plumb|water|heating|radiator|hws|cws|hot water|cold water)/i.test(String(s.title||''));
  const validRoom=n=>(n>=1&&n<=12)||(n>=14&&n<=17);
  async function sops(){if(cache)return cache;const c=client();if(!c)return[];const r=await c.from('sops').select('sop_number,title,category,description,revision,status').eq('status','approved');if(r.error){console.warn('Room SOP linker skipped',r.error.message);return[];}return cache=r.data||[];}
  function sopButton(s){return `<button class="friendlySearchResult universalResult roomLinkedSop" data-us-sop="${esc(s.sop_number)}"><span class="fsIcon">📄</span><span><b>${esc(s.title||s.sop_number)}</b><small>${esc(['SOP',s.revision?'Rev '+s.revision:'',s.status].filter(Boolean).join(' · '))}</small></span><strong>Open →</strong></button>`;}
  function syncWaterStat(root,count){
    const stat=[...root.querySelectorAll('.roomStats b')].find(x=>/water\s*\/\s*heating/i.test(x.textContent||''));
    if(stat){const small=stat.querySelector('small');stat.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();});stat.insertBefore(document.createTextNode(String(count)),small||stat.firstChild);}
  }
  async function apply(){
    if(busy)return;const head=document.querySelector('.roomIntelligenceHead h2');if(!head)return;
    const m=head.textContent.trim().match(/^Room\s+(\d{1,2})$/i);if(!m)return;const n=Number(m[1]);if(!validRoom(n))return;
    const root=head.closest('.roomIntelligence');if(!root||root.dataset.sopLinked===String(n))return;busy=true;
    try{
      const all=(await sops()).filter(water);
      let matches=all.filter(s=>exact(s.title,'room',n));
      if(!matches.length)matches=all.filter(s=>exact(s.title,'bathroom',n));
      if(!matches.length){root.dataset.sopLinked=String(n);return;}
      const existing=new Set([...root.querySelectorAll('[data-us-sop]')].map(x=>x.dataset.usSop));
      matches=matches.filter(s=>!existing.has(s.sop_number));if(!matches.length){root.dataset.sopLinked=String(n);return;}
      let group=[...root.querySelectorAll('.roomCompactGroup')].find(g=>/water\s*&\s*heating isolation/i.test(g.querySelector('summary b')?.textContent||''));
      let count=matches.length;
      if(!group){
        group=document.createElement('details');group.className='roomCompactGroup';
        group.innerHTML=`<summary><span class="roomCompactIcon">🚰</span><span><b>Water & heating isolation</b><small>${count} linked procedure${count===1?'':'s'}</small></span><strong>${count}</strong></summary><div class="roomCompactBody"></div>`;
        root.querySelector('.roomCompactGroups')?.prepend(group);
      }else{
        const strong=group.querySelector('summary strong'),small=group.querySelector('summary small');
        count=(Number(strong?.textContent)||0)+matches.length;if(strong)strong.textContent=String(count);if(small)small.textContent=`${count} linked procedure${count===1?'':'s'}`;
      }
      const body=group.querySelector('.roomCompactBody');matches.forEach(s=>body?.insertAdjacentHTML('beforeend',sopButton(s)));
      syncWaterStat(root,count);
      root.dataset.sopLinked=String(n);
    }finally{busy=false;}
  }
  const mo=new MutationObserver(()=>setTimeout(apply,20));mo.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
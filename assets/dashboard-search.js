// Ranked wrapper for Limewood universal search.
// Keeps the proven search engine intact, then reorders result sections by relevance.
(() => {
  'use strict';

  const base=document.createElement('script');
  base.src='/assets/dashboard-search-base.js?v=20261002c';
  base.async=false;
  base.onload=installRanking;
  document.head.appendChild(base);

  function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}

  function intentBoost(query,title){
    let score=0;
    if(/\b(ppm|due|overdue|next due|service date|servicing due|inspection due|renewal)\b/.test(query)&&/ppm/.test(title))score+=70;
    if(/\b(circuit|electrical|db|distribution board|dimmer|mcb|rcbo|socket|lighting)\b/.test(query)&&/electrical/.test(title))score+=60;
    if(/\b(valve|isolation|isolate|isolating)\b/.test(query)&&/valve|isolation/.test(title))score+=60;
    if(/\b(sop|manual|document|certificate|drawing|schematic|procedure)\b/.test(query)&&/document|sop/.test(title))score+=60;
    if(/\b(job|repair|fault|breakdown|maintenance history|previous job)\b/.test(query)&&/maintenance/.test(title))score+=50;
    if(/\b(log|check|reading|record)\b/.test(query)&&/log|check/.test(title))score+=45;
    if(/\b(room|bedroom|building|plant room|area|location)\b/.test(query)&&/place/.test(title))score+=35;
    return score;
  }

  function scoreSection(section,query){
    const title=norm(section.querySelector('h3')?.textContent||'');
    const resultTexts=[...section.querySelectorAll('.universalResult')].slice(0,5).map(x=>norm(x.textContent));
    const hay=norm(resultTexts.join(' '));
    const words=query.split(' ').filter(w=>w.length>1);
    let score=intentBoost(query,title);
    if(query&&hay.includes(query))score+=100;
    const matched=words.filter(w=>hay.includes(w)).length;
    score+=matched*12;
    if(words.length>1&&matched===words.length)score+=45;
    const first=resultTexts[0]||'';
    if(query&&first.includes(query))score+=35;
    score+=words.filter(w=>first.includes(w)).length*5;
    return score;
  }

  function rankContainer(container,query){
    const sections=[...container.children].filter(x=>x.classList?.contains('fsSection'));
    if(sections.length<2)return;
    sections.forEach((section,index)=>{section.dataset.originalOrder=section.dataset.originalOrder||String(index);});
    const ranked=sections.map(section=>({section,score:scoreSection(section,query),order:Number(section.dataset.originalOrder||0)}))
      .sort((a,b)=>b.score-a.score||a.order-b.order);
    const desired=ranked.map(x=>x.section);
    const changed=desired.some((section,index)=>sections[index]!==section);
    if(changed)desired.forEach(section=>container.appendChild(section));
    sections.forEach(section=>{
      section.classList.remove('fsBestSection');
      const h=section.querySelector('h3');
      if(h)h.dataset.bestMatch='';
    });
    if(ranked[0]?.score>0){
      const best=ranked[0].section;
      best.classList.add('fsBestSection');
      const h=best.querySelector('h3');
      if(h)h.dataset.bestMatch='Best match';
    }
  }

  function rerank(){
    const card=document.querySelector('.universalSearchCard');
    const input=document.getElementById('globalSearch');
    const query=norm(input?.value||'');
    if(!card||!query)return;
    const roomMore=card.querySelector('.moreSearchResults > div');
    const direct=[...card.children].some(x=>x.classList?.contains('fsSection'))?card:null;
    if(direct)rankContainer(direct,query);
    if(roomMore)rankContainer(roomMore,query);
  }

  function installRanking(){
    const style=document.createElement('style');
    style.textContent='.fsBestSection{padding:14px;border:2px solid #b8cc19;border-radius:16px;background:#fbfcf7}.fsBestSection>h3:before{content:attr(data-best-match) " · ";font:800 10px Arial;letter-spacing:.08em;color:#7c8d13;margin-right:7px;text-transform:uppercase}.fsBestSection+.fsSection{margin-top:28px}';
    document.head.appendChild(style);
    let queued=false;
    const queueRank=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;rerank();});
    };
    const searchHost=document.getElementById('placeholderView');
    if(searchHost){
      const observer=new MutationObserver(queueRank);
      observer.observe(searchHost,{childList:true,subtree:true});
    }
    document.addEventListener('click',e=>{if(e.target.closest('#globalSearchBtn'))queueRank();},true);
    document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='globalSearch')queueRank();},true);
  }
})();

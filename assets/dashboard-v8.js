// Limewood Dashboard v8 - preserves existing app behaviour, modernises layout only.
(() => {
  'use strict';

  function makeHero(){
    const dash=document.getElementById('dashboardView');
    const metrics=dash?.querySelector('.v6Metrics');
    if(!dash||!metrics||document.querySelector('.lwEstateHero'))return;
    const hero=document.createElement('section');
    hero.className='lwEstateHero';
    hero.innerHTML=`<div class="lwEstateHeroContent"><span class="mini">LIMEWOOD ESTATE · LIVE</span><h3>Engineering at a glance</h3><p>Assets, planned maintenance, compliance and live estate records in one place.</p></div><div class="heroStatus">● LIVE DATABASE</div>`;
    metrics.before(hero);
  }

  function calmDashboard(){
    const dash=document.getElementById('dashboardView');
    if(!dash)return;
    const intro=dash.querySelector('.dashboardIntro');
    if(intro){const eyebrow=intro.querySelector('.eyebrow'),title=intro.querySelector('h2'),p=intro.querySelector('p');if(eyebrow)eyebrow.textContent='ENGINEERING CONTROL CENTRE';if(title)title.textContent='Good morning. Here’s the estate at a glance.';if(p)p.textContent='Find what you need quickly, then get back to the actual engineering.';}
    const searchLabel=dash.querySelector('.dashboardSearch label');
    const searchInput=document.getElementById('globalSearch');
    if(searchLabel)searchLabel.textContent='Find anything on the estate';
    if(searchInput)searchInput.placeholder='Try “Room 6”, “AC-010”, “Spa”, a serial number or document';
    const priorities=dash.querySelector('.priorityGrid');
    if(priorities && !priorities.closest('.lwDashboardPanel')){const panel=document.createElement('section');panel.className='lwDashboardPanel';panel.innerHTML='<div class="sectionHead"><h3>What needs your attention</h3><span>Live priorities from the estate</span></div>';priorities.before(panel);panel.appendChild(priorities);}
    const quick=dash.querySelector('.quickSection .sectionHead h3');
    const quickSub=dash.querySelector('.quickSection .sectionHead span');
    if(quick)quick.textContent='Quick access';if(quickSub)quickSub.textContent='Common engineering tasks';
  }

  function addPhotoInboxAccess(){
    const grid=document.querySelector('#dashboardView .quickGrid');
    if(grid && !document.getElementById('quickPhotoInbox')){
      const b=document.createElement('button');
      b.id='quickPhotoInbox';b.type='button';b.onclick=()=>location.href='/photo-inbox.html';
      b.innerHTML='<span>📥</span><b>Photo Inbox</b><small>Bulk upload now, sort later</small>';
      grid.prepend(b);
    }
    const nav=document.getElementById('drawerNav');
    if(nav && !document.getElementById('photoInboxNav')){
      const b=document.createElement('button');b.id='photoInboxNav';b.type='button';b.onclick=()=>location.href='/photo-inbox.html';b.textContent='📥 Photo Inbox';
      const more=document.getElementById('modernMoreTools');nav.insertBefore(b,more||null);
    }
  }

  function modernSidebar(){
    const nav=document.getElementById('drawerNav');
    if(!nav||document.getElementById('modernMoreTools'))return;
    const label=document.createElement('span');label.className='modernNavLabel';label.textContent='Estate controls';nav.prepend(label);
    const more=document.createElement('details');more.id='modernMoreTools';more.innerHTML='<summary>••• More engineering tools</summary><div class="modernMoreBody"></div>';nav.appendChild(more);
    const body=more.querySelector('.modernMoreBody');
    const keepIds=new Set(['assetRegistersMenu','plantRoomsMenu','photoInboxNav']);
    const keepViews=new Set(['dashboard','compliance','ppm']);
    const directKeepText=['Maintenance Centre','Document Centre','Photo Inbox'];
    [...nav.children].forEach(el=>{if(el===label||el===more)return;if(el.id&&keepIds.has(el.id))return;if(el.dataset?.view&&keepViews.has(el.dataset.view))return;if(directKeepText.some(t=>(el.textContent||'').includes(t)))return;body.appendChild(el);});
    const docBtn=[...body.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Document Centre'));if(docBtn)nav.insertBefore(docBtn,more);
  }

  function trimQuickActions(){
    const grid=document.querySelector('#dashboardView .quickGrid');if(!grid)return;
    const preferred=['quickPhotoInbox','quickEstateRegister','quickMaintenanceIssues','quickPpm','quickAddAsset','quickLogs','quickCompliance','quickBms'];
    const byId=new Map([...grid.children].map(x=>[x.id,x]));preferred.forEach(id=>{const el=byId.get(id);if(el)grid.appendChild(el);});
  }

  function run(){makeHero();calmDashboard();addPhotoInboxAccess();modernSidebar();addPhotoInboxAccess();trimQuickActions();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0));else setTimeout(run,0);
  window.addEventListener('load',()=>setTimeout(run,500));
})();

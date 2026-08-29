// Limewood Engineering navigation v9
// Simplifies routing without removing legacy views or data.
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function closeDrawer(){
    $('#drawer')?.classList.remove('open');
    $('#drawerBackdrop')?.classList.remove('open');
    $('#drawer')?.setAttribute('aria-hidden','true');
  }

  function legacy(){ return $('#lwLegacyNav'); }

  function clickLegacy(selector, text){
    const root=legacy();
    if(!root) return false;
    let el=selector ? root.querySelector(selector) : null;
    if(!el && text){
      el=$$('button,summary',root).find(x=>(x.textContent||'').toLowerCase().includes(text.toLowerCase()));
    }
    if(!el) return false;
    el.click();
    closeDrawer();
    return true;
  }

  function go(route){ location.href=route; }

  function buildNavigation(){
    const nav=$('#drawerNav');
    if(!nav || $('#lwPrimaryNav')) return;

    // Keep every original route in the DOM so existing app listeners remain intact.
    const old=[...nav.children];
    const legacyBox=document.createElement('div');
    legacyBox.id='lwLegacyNav';
    legacyBox.hidden=true;
    old.forEach(x=>legacyBox.appendChild(x));
    nav.appendChild(legacyBox);

    const shell=document.createElement('div');
    shell.id='lwPrimaryNav';
    shell.className='lwPrimaryNav';
    shell.innerHTML=`
      <button class="lwNavSearch" data-lw-action="search"><span>⌕</span><b>Find anything</b><small>Asset, room, job or document</small></button>
      <button class="lwNavMain" data-lw-action="dashboard"><span>⌂</span><b>Dashboard</b></button>
      <button class="lwNavMain" data-lw-action="estate"><span>▦</span><b>Estate</b><small>Buildings, rooms & assets</small></button>
      <details class="lwNavGroup">
        <summary><span>🧰</span><b>Maintenance</b><small>Jobs, PPM & contractors</small></summary>
        <div>
          <button data-lw-route="/maintenance-dashboard.html">Maintenance Centre</button>
          <button data-lw-route="/maintenance-report.html">Report a job</button>
          <button data-lw-action="ppm">PPM Planner</button>
          <button data-lw-route="/contractor-dashboard.html">Contractors & Quotes</button>
          <button data-lw-action="logs">Logs & Checks</button>
        </div>
      </details>
      <details class="lwNavGroup">
        <summary><span>🛡</span><b>Compliance</b><small>Evidence, electrical & safety</small></summary>
        <div>
          <button data-lw-action="compliance">Compliance Centre</button>
          <button data-lw-route="/electrical-distribution.html">Electrical Distribution</button>
          <button data-lw-route="/drawings-schematics.html">Drawings & Schematics</button>
          <button data-lw-text="Fire & Life Safety">Fire & Life Safety</button>
          <button data-lw-text="Pool & Spa Water Treatment">Pool & Spa</button>
          <button data-lw-text="Water Systems">Water Systems</button>
        </div>
      </details>
      <details class="lwNavGroup">
        <summary><span>•••</span><b>More</b><small>Documents, photos & tools</small></summary>
        <div>
          <button data-lw-route="/photo-inbox.html">Photo Inbox</button>
          <button data-lw-action="documents">Document Centre</button>
          <button data-lw-action="bms">Live BMS</button>
          <button data-lw-text="SOP Library">SOP Library</button>
          <button data-lw-text="RAMS Library">RAMS Library</button>
          <button data-lw-text="Manufacturer Manuals">Manuals</button>
          <button data-lw-text="Settings">Settings</button>
          <button data-lw-action="about">About</button>
        </div>
      </details>`;
    nav.insertBefore(shell,legacyBox);

    shell.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(!b)return;
      if(b.dataset.lwRoute){go(b.dataset.lwRoute);return;}
      if(b.dataset.lwText){clickLegacy(null,b.dataset.lwText);return;}
      switch(b.dataset.lwAction){
        case 'dashboard': clickLegacy('button[data-view="dashboard"]'); break;
        case 'estate': clickLegacy('#assetRegistersMenu > summary'); break;
        case 'search': clickLegacy('button[data-view="search"]'); break;
        case 'ppm': clickLegacy('button[data-view="ppm"]'); break;
        case 'logs': clickLegacy('button[data-view="logs"]'); break;
        case 'compliance': clickLegacy('button[data-view="compliance"]'); break;
        case 'documents': clickLegacy('button[data-view="documents"][data-doc-type=""]') || clickLegacy(null,'Document Centre'); break;
        case 'bms': clickLegacy('button[data-view="bms"]'); break;
        case 'about': clickLegacy('button[data-view="about"]'); break;
      }
    });
  }

  function buildCoreActions(){
    const dash=$('#dashboardView');
    const hero=dash?.querySelector('.lwEstateHero') || dash?.querySelector('.dashboardHero');
    if(!dash||!hero||$('#lwCoreActions'))return;
    const s=document.createElement('section');
    s.id='lwCoreActions';
    s.className='lwCoreActions';
    s.innerHTML=`
      <button data-route="/maintenance-report.html"><span>＋</span><b>Report job</b><small>Create a maintenance request</small></button>
      <button data-action="estate"><span>▦</span><b>Estate</b><small>Buildings, rooms and assets</small></button>
      <button data-route="/maintenance-dashboard.html"><span>🧰</span><b>Maintenance</b><small>Open jobs and work history</small></button>
      <button data-route="/photo-inbox.html"><span>📥</span><b>Photo Inbox</b><small>Upload and assign photos</small></button>
      <button data-action="compliance"><span>🛡</span><b>Compliance</b><small>Checks and evidence</small></button>
      <button data-action="documents"><span>📁</span><b>Documents</b><small>SOPs, RAMS and manuals</small></button>`;
    hero.after(s);
    s.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.route){go(b.dataset.route);return;}
      if(b.dataset.action==='estate') clickLegacy('#assetRegistersMenu > summary');
      if(b.dataset.action==='compliance') clickLegacy('button[data-view="compliance"]');
      if(b.dataset.action==='documents') clickLegacy('button[data-view="documents"][data-doc-type=""]') || clickLegacy(null,'Document Centre');
    });
  }

  function buildMobileBar(){
    if($('#lwMobileNav'))return;
    const bar=document.createElement('nav');
    bar.id='lwMobileNav';
    bar.className='lwMobileNav';
    bar.innerHTML=`
      <button data-action="dashboard"><span>⌂</span><b>Home</b></button>
      <button data-action="estate"><span>▦</span><b>Estate</b></button>
      <button data-route="/maintenance-dashboard.html"><span>🧰</span><b>Jobs</b></button>
      <button data-action="search"><span>⌕</span><b>Search</b></button>
      <button data-action="more"><span>•••</span><b>More</b></button>`;
    document.body.appendChild(bar);
    bar.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.route){go(b.dataset.route);return;}
      if(b.dataset.action==='dashboard')clickLegacy('button[data-view="dashboard"]');
      if(b.dataset.action==='estate')clickLegacy('#assetRegistersMenu > summary');
      if(b.dataset.action==='search')clickLegacy('button[data-view="search"]');
      if(b.dataset.action==='more')$('#menuBtn')?.click();
    });
  }

  function tidyDashboard(){
    const oldQuick=$('#dashboardView .quickSection');
    if(oldQuick)oldQuick.classList.add('lwLegacyQuickActions');
    const estate=$('#dashboardView .modernEstate');
    if(estate)estate.classList.add('lwEstateGridFixed');
  }

  function run(){
    buildNavigation();
    buildCoreActions();
    buildMobileBar();
    tidyDashboard();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(run,120));
  else setTimeout(run,120);
  window.addEventListener('load',()=>setTimeout(run,700));
})();

(() => {
  'use strict';
  if (/^\/(?:index\.html)?$/i.test(location.pathname)) return;
  if (document.getElementById('lwSiteNav')) return;

  const links = [
    ['🏠','Dashboard','/'],
    ['⚡','Electrical Distribution','/electrical-distribution.html'],
    ['🏭','Main House Electrical','/main-house-electrical.html'],
    ['🏠','Staff House Electrical','/staff-house-electrical.html'],
    ['🧰','Maintenance Centre','/maintenance-dashboard.html'],
    ['🤝','Contractors & Quotes','/contractor-dashboard.html'],
    ['📸','Photo Inbox','/photo-inbox.html'],
    ['🗺','Drawings & Schematics','/drawings-schematics.html'],
    ['🟢','Systems','/systems.html']
  ];

  const style=document.createElement('style');
  style.id='lwSiteNavStyle';
  style.textContent=`
    :root{--lw-site-nav-collapsed:56px;--lw-site-nav-open:300px}
    body.lwSiteNavBody{box-sizing:border-box;padding-left:var(--lw-site-nav-collapsed)!important;transition:padding-left .22s ease}
    body.lwSiteNavBody.lwSiteNavOpen{padding-left:var(--lw-site-nav-open)!important}
    #lwSiteNav{position:fixed;z-index:10000;left:0;top:0;bottom:0;width:var(--lw-site-nav-open);background:#17372c;color:#fff;box-shadow:7px 0 24px #0003;transform:translateX(calc(-1 * (var(--lw-site-nav-open) - var(--lw-site-nav-collapsed))));transition:transform .22s ease;overflow:hidden}
    body.lwSiteNavOpen #lwSiteNav{transform:translateX(0)}
    #lwSiteNav .lwNavHead{height:68px;display:flex;align-items:center;gap:11px;padding:10px 8px 10px 16px;border-bottom:1px solid #ffffff1f;box-sizing:border-box}
    #lwSiteNav .lwNavMark{width:38px;height:38px;min-width:38px;border:1px solid #b9c9b2;border-radius:50%;display:grid;place-items:center;font:16px Georgia,serif}
    #lwSiteNav .lwNavTitle{min-width:0;flex:1;white-space:nowrap;overflow:hidden}
    #lwSiteNav .lwNavTitle b{display:block;font:19px Georgia,serif}.lwNavTitle small{color:#c8d4cc;font-size:10px}
    #lwSiteNavToggle{width:40px;height:40px;min-width:40px;border:0;border-radius:10px;background:#ffffff12;color:#fff;font-size:26px;display:grid;place-items:center;cursor:pointer}
    #lwSiteNav nav{padding:10px;display:grid;gap:3px}
    #lwSiteNav nav a{display:flex;align-items:center;gap:11px;color:#eef5f0;text-decoration:none;padding:11px 10px;border-radius:9px;font:600 13px Arial,Helvetica,sans-serif;white-space:nowrap}
    #lwSiteNav nav a:hover,#lwSiteNav nav a.active{background:#ffffff14}
    #lwSiteNav nav .ico{width:24px;min-width:24px;text-align:center;font-size:16px}
    body:not(.lwSiteNavOpen) #lwSiteNav .lwNavTitle,body:not(.lwSiteNavOpen) #lwSiteNav nav{visibility:hidden;pointer-events:none}
    body:not(.lwSiteNavOpen) #lwSiteNavToggle{position:absolute;right:7px;top:13px;visibility:visible!important;pointer-events:auto!important}
    #lwSiteNavBackdrop{display:none}
    body.lwSiteNavBody>*:not(#lwSiteNav):not(#lwSiteNavBackdrop):not(script):not(style){transition:max-width .22s ease,width .22s ease,margin-left .22s ease,margin-right .22s ease}
    @media(max-width:900px){
      body.lwSiteNavBody,body.lwSiteNavBody.lwSiteNavOpen{padding-left:0!important}
      #lwSiteNav{width:min(88vw,340px);transform:translateX(-102%)}
      body.lwSiteNavOpen #lwSiteNav{transform:translateX(0)}
      body:not(.lwSiteNavOpen) #lwSiteNav{transform:translateX(-102%)}
      body:not(.lwSiteNavOpen) #lwSiteNavToggle{position:fixed;left:10px;top:10px;z-index:10002;background:#17372c}
      body:not(.lwSiteNavOpen) #lwSiteNav .lwNavHead{visibility:hidden}
      #lwSiteNavBackdrop{position:fixed;z-index:9999;inset:0;background:#0007;display:none}
      body.lwSiteNavOpen #lwSiteNavBackdrop{display:block}
    }
  `;
  document.head.appendChild(style);

  const aside=document.createElement('aside');
  aside.id='lwSiteNav';
  aside.setAttribute('aria-label','Site navigation');
  const path=location.pathname.toLowerCase();
  aside.innerHTML=`
    <div class="lwNavHead">
      <div class="lwNavMark">LW</div>
      <div class="lwNavTitle"><b>Limewood</b><small>Engineering Control Centre</small></div>
      <button id="lwSiteNavToggle" type="button" aria-label="Expand menu">›</button>
    </div>
    <nav>${links.map(([icon,label,href])=>`<a href="${href}" class="${path===href.toLowerCase()?'active':''}"><span class="ico">${icon}</span><span>${label}</span></a>`).join('')}</nav>
  `;
  const backdrop=document.createElement('div');backdrop.id='lwSiteNavBackdrop';
  document.body.prepend(backdrop);
  document.body.prepend(aside);
  document.body.classList.add('lwSiteNavBody');

  const toggle=document.getElementById('lwSiteNavToggle');
  const desktop=()=>matchMedia('(min-width:901px)').matches;
  const setOpen=open=>{
    document.body.classList.toggle('lwSiteNavOpen',open);
    toggle.textContent=open?'‹':'›';
    toggle.setAttribute('aria-label',open?'Collapse menu':'Expand menu');
    if(desktop()) localStorage.setItem('limewoodNavCollapsed',open?'0':'1');
  };
  toggle.addEventListener('click',()=>setOpen(!document.body.classList.contains('lwSiteNavOpen')));
  backdrop.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('lwSiteNavOpen'))setOpen(false)});
  if(desktop()&&localStorage.getItem('limewoodNavCollapsed')==='0')setOpen(true);
  else setOpen(false);
})();
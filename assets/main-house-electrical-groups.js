(()=>{
  'use strict';

  const params=new URLSearchParams(location.search);
  if(!/\/electrical-schematic-map\.html$/i.test(location.pathname))return;
  if((params.get('building')||'Main House')!=='Main House')return;

  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  ready(async()=>{
    const canvas=document.getElementById('canvas');
    const status=document.getElementById('status');
    if(!canvas||!window.supabase||!window.LIMEWOOD_CONFIG)return;

    const style=document.createElement('style');
    style.textContent=`
      #canvas.mhGrouped{background:#202220;padding:10px}
      .mhSource{max-width:540px;margin:0 auto 10px;padding:11px 13px;border:2px solid #296b52;border-radius:13px;background:#052417;color:#fff;text-align:center}
      .mhSource small{color:#c7ab6d;font-size:8px;font-weight:900}.mhSource b{display:block;margin-top:3px;font-size:14px}.mhSource span{display:block;margin-top:3px;color:#d8e6df;font-size:8px}
      .mhGroupGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .mhGroup{border:1px solid #557067;background:#29332f;color:#fff;border-radius:13px;padding:13px;text-align:left;min-height:100px;cursor:pointer}
      .mhGroup strong{display:block;color:#e7f3ee;font-size:15px}.mhGroup em{display:block;font-style:normal;color:#c9d7d1;font-size:9px;margin-top:5px}.mhGroup span{display:inline-block;margin-top:10px;padding:4px 7px;border-radius:999px;background:#10251e;color:#d5eee4;font-size:8px;font-weight:900}
      .mhGroup.lighting{border-color:#8d7743}.mhGroup.rooms{border-color:#4d7f6c}.mhGroup.other{border-color:#6c6b67}
      .mhOverlay{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(8,18,14,.78)}
      .mhOverlay.open{display:flex}.mhPanel{width:min(820px,100%);max-height:90vh;overflow:auto;background:#f5f1e8;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.32)}
      .mhPanelHead{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#173d33;color:#fff}.mhPanelHead h3{margin:0;font-size:18px}.mhClose{width:36px;height:36px;border:0;border-radius:9px;background:#ffffff20;color:#fff;font-size:21px}
      .mhPanelBody{padding:12px}.mhAssetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mhAsset{border:1px solid #d8d3ca;background:#fff;border-radius:12px;padding:11px;text-align:left;cursor:pointer}.mhAsset b{display:block;color:#173d33;font-size:12px}.mhAsset small{display:block;margin-top:3px;color:#7a827e;font-size:8px}.mhAsset span{display:inline-block;margin-top:7px;padding:3px 6px;border-radius:999px;background:#edf1ef;color:#53625d;font-size:7px;font-weight:800}
      .mhCircuitList{display:grid;gap:6px}.mhCircuit{background:#fff;border:1px solid #ddd7ce;border-radius:10px;padding:9px}.mhCircuit b{font-size:10px;color:#173d33}.mhCircuit div{font-size:9px;color:#58645f;margin-top:3px}.mhBack{border:0;background:#c6a96a;color:#173d33;border-radius:8px;padding:7px 9px;font-weight:900;font-size:9px}
      @media(max-width:600px){.mhGroupGrid{grid-template-columns:1fr}.mhGroup{min-height:78px}.mhAssetGrid{grid-template-columns:1fr}.mhPanel{max-height:92vh}}
    `;
    document.head.appendChild(style);

    const overlay=document.createElement('div');
    overlay.className='mhOverlay';
    overlay.innerHTML='<section class="mhPanel"><header class="mhPanelHead"><div><button class="mhBack" hidden>← Groups</button><h3 id="mhPanelTitle">Electrical group</h3></div><button class="mhClose" aria-label="Close">×</button></header><div class="mhPanelBody" id="mhPanelBody"></div></section>';
    document.body.appendChild(overlay);

    const title=overlay.querySelector('#mhPanelTitle');
    const body=overlay.querySelector('#mhPanelBody');
    const back=overlay.querySelector('.mhBack');
    const close=()=>{overlay.classList.remove('open');document.body.style.overflow=''};
    overlay.querySelector('.mhClose').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

    const cfg=window.LIMEWOOD_CONFIG;
    const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const [br,pr,ar,cr]=await Promise.all([
      sb.from('buildings').select('id,name'),
      sb.from('plant_rooms').select('id,name,building_id'),
      sb.from('electrical_assets').select('*').order('asset_code'),
      sb.from('electrical_circuits').select('*').order('board_asset_code').order('circuit_number')
    ]);
    if(br.error||pr.error||ar.error)return;

    const main=(br.data||[]).find(b=>b.name==='Main House');
    if(!main)return;
    const roomNames=new Set((pr.data||[]).filter(r=>String(r.building_id)===String(main.id)).map(r=>r.name));
    const assets=(ar.data||[]).filter(a=>roomNames.has(a.plant_room));
    const circuits=cr.error?[]:(cr.data||[]);
    if(!assets.length)return;

    const circuitsFor=a=>{
      const keys=[a.asset_code,a.asset_name].filter(Boolean).map(norm);
      return circuits.filter(c=>keys.includes(norm(c.board_asset_code)));
    };
    const assetText=a=>norm([a.asset_code,a.asset_name,a.category,a.system_duty,a.notes].join(' '));
    const roomNumber=a=>{
      const t=assetText(a)+' '+norm(circuitsFor(a).map(c=>[c.circuit_description,c.destination,c.notes].join(' ')).join(' '));
      const m=t.match(/\b(?:room|bedroom)\s*0*(\d{1,3})\b/);
      if(m)return Number(m[1]);
      const code=String(a.asset_code||'').toUpperCase();
      const cm=code.match(/^MH-(?:DB|DIM)-0*(\d{1,3})(?:[A-Z])?$/);
      return cm?Number(cm[1]):null;
    };
    const isLighting=a=>/light|lighting|dimmer/.test(assetText(a));
    const isIncoming=a=>/incoming|incomer|intake|meter|main switch|switchboard/.test(assetText(a));

    const incoming=assets.filter(isIncoming).sort((a,b)=>String(a.asset_code||'').localeCompare(String(b.asset_code||'')))[0];
    const usable=assets.filter(a=>a!==incoming);
    const rooms=usable.filter(a=>roomNumber(a)!==null).sort((a,b)=>roomNumber(a)-roomNumber(b)||String(a.asset_name||'').localeCompare(String(b.asset_name||''),undefined,{numeric:true}));
    const roomIds=new Set(rooms.map(a=>a.id));
    const lighting=usable.filter(a=>!roomIds.has(a.id)&&isLighting(a)).sort((a,b)=>String(a.asset_name||'').localeCompare(String(b.asset_name||''),undefined,{numeric:true}));
    const lightingIds=new Set(lighting.map(a=>a.id));
    const other=usable.filter(a=>!roomIds.has(a.id)&&!lightingIds.has(a.id)).sort((a,b)=>String(a.asset_name||'').localeCompare(String(b.asset_name||''),undefined,{numeric:true}));

    const groups={rooms,lighting,other};
    const groupLabel={rooms:'Rooms',lighting:'Lighting & dimmers',other:'Other distribution'};

    function assetCard(a){
      const rn=roomNumber(a),count=circuitsFor(a).length;
      return `<button class="mhAsset" data-asset="${esc(a.id)}"><b>${esc(rn!==null?'Room '+rn+' · '+(a.asset_name||a.asset_code):a.asset_name||a.asset_code||'Electrical asset')}</b><small>${esc(a.asset_code||'No asset code')} · ${esc(a.plant_room||'Main House')}</small><span>${count} circuit${count===1?'':'s'}</span></button>`;
    }

    function openGroup(key){
      const list=groups[key]||[];
      title.textContent=groupLabel[key];
      back.hidden=true;
      body.innerHTML=list.length?`<div class="mhAssetGrid">${list.map(assetCard).join('')}</div>`:'<div style="padding:20px;text-align:center">No items in this group.</div>';
      body.querySelectorAll('[data-asset]').forEach(btn=>btn.onclick=()=>{
        const a=assets.find(x=>String(x.id)===String(btn.dataset.asset));
        if(a)openAsset(a,key);
      });
      overlay.classList.add('open');document.body.style.overflow='hidden';
    }

    function openAsset(a,key){
      const list=circuitsFor(a);
      title.textContent=a.asset_name||a.asset_code||'Electrical asset';
      back.hidden=false;
      back.onclick=()=>openGroup(key);
      body.innerHTML=`<div style="margin-bottom:10px;font-size:9px;color:#65716c"><b>${esc(a.asset_code||'')}</b>${a.category?' · '+esc(a.category):''}${a.plant_room?' · '+esc(a.plant_room):''}</div>`+(list.length?`<div class="mhCircuitList">${list.map(c=>`<div class="mhCircuit"><b>${esc(['Circuit '+(c.circuit_number||''),c.circuit_description||c.destination||''].filter(Boolean).join(' · '))}</b><div>${esc([c.phase,c.protective_device,c.device_rating,c.destination].filter(Boolean).join(' · '))}</div></div>`).join('')}</div>`:'<div style="padding:18px;text-align:center;color:#6f7b76">No circuit schedule recorded for this item.</div>');
    }

    const countText=(list,label)=>`${list.length} ${label}`;
    canvas.classList.add('mhGrouped');
    canvas.innerHTML=`${incoming?`<div class="mhSource"><small>${esc(incoming.asset_code||'MAIN HOUSE')}</small><b>${esc(incoming.asset_name||'Main House incoming')}</b><span>${esc(incoming.plant_room||'Incoming electrical distribution')}</span></div>`:''}<div class="mhGroupGrid"><button class="mhGroup rooms" data-group="rooms"><strong>🚪 Rooms</strong><em>Room boards and room-related distribution together</em><span>${countText(rooms,'items')}</span></button><button class="mhGroup lighting" data-group="lighting"><strong>💡 Lighting & dimmers</strong><em>All lighting panels, dimmers and lighting controls together</em><span>${countText(lighting,'items')}</span></button><button class="mhGroup other" data-group="other"><strong>⚡ Other distribution</strong><em>Remaining boards, feeders, control panels and supplies</em><span>${countText(other,'items')}</span></button></div>`;
    canvas.hidden=false;if(status)status.hidden=true;
    canvas.querySelectorAll('[data-group]').forEach(btn=>btn.onclick=()=>openGroup(btn.dataset.group));
  });
})();
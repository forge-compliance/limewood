(()=>{
  'use strict';
  if(!/\/systems\.html$/i.test(location.pathname)) return;
  const qs=new URLSearchParams(location.search);
  if(qs.get('kind')!=='location') return;

  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9/]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const aliases={ac:['ac','a/c','air conditioning','air con','conditioning'],aircon:['ac','a/c','air conditioning','air con'],boiler:['boiler','heating'],pump:['pump','circulation pump','booster pump'],filter:['filter','filtration'],pool:['pool','lap pool','hydro pool'],hydro:['hydro','hydro pool'],lighting:['lighting','light','lights'],light:['lighting','light','lights'],lights:['lighting','light','lights'],fan:['fan','extract fan','supply fan'],water:['water','cws','hws','dhw','hot water','cold water'],heating:['heating','boiler','lthw','underfloor heating','ufh'],treatment:['treatment','treatment room'],socket:['socket','sockets','skts','ring main','power'],sockets:['socket','sockets','skts','ring main','power'],door:['door','doors'],fridge:['fridge','refrigerator','refrigeration'],freezer:['freezer','refrigeration'],extract:['extract','extract fan'],supply:['supply','supply fan']};

  async function init(){
    const search=document.getElementById('search'),content=document.getElementById('content'),count=document.getElementById('count'),photoCount=document.getElementById('photoCount'),meta=document.getElementById('searchMeta'),subtitle=document.getElementById('subtitle');
    if(!search||!content) return;
    const cfg=window.LIMEWOOD_CONFIG||{};
    if(!window.supabase||!cfg.supabaseUrl) return;
    const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const view=qs.get('view')||'';
    const [a,b,p,ph,ar,sa]=await Promise.all([
      client.from('assets').select('*').order('asset_code'),
      client.from('buildings').select('*').order('name'),
      client.from('plant_rooms').select('*').order('name'),
      client.from('asset_photos').select('asset_id'),
      client.from('location_areas').select('*').order('name'),
      client.from('location_sub_areas').select('*').order('name')
    ]);
    if(a.error||b.error||p.error) return;
    const assets=a.data||[],buildings=b.data||[],rooms=p.data||[],photos=ph.data||[],areas=ar.data||[],subs=sa.data||[];
    const building=buildings.find(x=>norm(x.name)===norm(view));
    const bid=building?.id||'';
    const buildingName=x=>{
      const direct=buildings.find(b=>String(b.id)===String(x.building_id))?.name||'';
      if(direct) return direct;
      const pr=rooms.find(r=>String(r.id)===String(x.plant_room_id));
      return buildings.find(b=>String(b.id)===String(pr?.building_id))?.name||'';
    };
    const areaName=x=>areas.find(r=>String(r.id)===String(x.area_id))?.name||'';
    const subName=x=>subs.find(r=>String(r.id)===String(x.sub_area_id))?.name||'';
    const scoped=assets.filter(x=>norm(buildingName(x))===norm(view));
    const photoTotal=scoped.reduce((n,x)=>n+photos.filter(p=>String(p.asset_id)===String(x.id)).length,0);

    const rich=x=>norm([x.asset_code,x.asset_name,x.category,x.system_duty,x.manufacturer,x.model,x.serial_number,x.exact_location,x.notes,buildingName(x),rooms.find(r=>String(r.id)===String(x.plant_room_id))?.name,areaName(x),subName(x)].join(' '));
    const matches=(x,raw)=>{
      const q=norm(raw); if(!q) return true;
      const hay=rich(x),room=q.match(/\b(?:room|bedroom|treatment room)\s*0*(\d{1,3})\b/);
      if(room){const n=String(Number(room[1]));if(!new RegExp('\\b(?:room|bedroom|treatment room)\\s*0*'+n+'\\b').test(hay)) return false;}
      let residual=q;if(room)residual=residual.replace(room[0],' ').replace(/\s+/g,' ').trim();
      const buildingTerms=norm(view).split(' ').filter(Boolean);
      const terms=residual.split(' ').filter(Boolean).filter(t=>!['the','and','for'].includes(t)&&!buildingTerms.includes(t));
      return terms.every(t=>(aliases[t]||[t]).some(x=>hay.includes(norm(x))));
    };
    const assetCard=x=>{
      const pr=rooms.find(r=>String(r.id)===String(x.plant_room_id))?.name||'',pc=photos.filter(p=>String(p.asset_id)===String(x.id)).length;
      const hay=[x.asset_name,x.category,x.system_duty].join(' ');
      const icon=/air conditioning|\bac\b|a\/c/i.test(hay)?'❄️':/pump/i.test(hay)?'⚙️':/filter|water/i.test(hay)?'💧':/boiler|heating/i.test(hay)?'🔥':/light|dimmer/i.test(hay)?'💡':'▣';
      return `<a class="spaResult" href="/?asset=${encodeURIComponent(x.asset_code||'')}"><div class="spaResultIcon">${icon}</div><div class="spaResultMain"><div class="spaResultTitle">${esc(x.asset_name||'Unnamed asset')}</div><div class="spaResultLocation">${esc([pr,x.exact_location].filter(Boolean).join(' · ')||view)}</div><div class="spaResultReason">${esc(view)} building match</div><div class="spaResultMeta"><span class="spaPill">${esc(x.category||'Asset')}</span><span class="spaPill">📷 ${pc}</span></div><div class="spaResultCode">${esc(x.asset_code||'')}</div></div><div class="spaResultGo">›</div></a>`;
    };
    const locationRows=()=>{
      const out=[],seen=new Set();
      const add=(type,name)=>{name=String(name||'').trim();if(!name)return;const k=type+'|'+norm(name);if(seen.has(k))return;seen.add(k);const c=scoped.filter(x=>[norm(areaName(x)),norm(subName(x)),norm(rooms.find(r=>String(r.id)===String(x.plant_room_id))?.name),norm(x.exact_location)].includes(norm(name))).length;out.push({type,name,count:c});};
      areas.filter(x=>!bid||String(x.building_id)===String(bid)).forEach(x=>add('Area',x.name));
      subs.filter(x=>areas.some(a=>String(a.id)===String(x.area_id)&&(!bid||String(a.building_id)===String(bid)))).forEach(x=>add('Sub-area',x.name));
      rooms.filter(x=>!bid||String(x.building_id)===String(bid)).forEach(x=>add('Plant room',x.name));
      scoped.forEach(x=>x.exact_location&&add('Room / location',x.exact_location));
      return out.sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true,sensitivity:'base'}));
    };
    const locCard=r=>`<a class="locationResult" href="#" data-location-search="${esc(r.name)}"><div class="spaResultIcon">📍</div><div class="spaResultMain"><div class="spaResultTitle">${esc(r.name)}</div><div class="spaResultLocation">${esc(view)} · ${esc(r.type)}</div><div class="spaResultReason">${r.count} linked asset${r.count===1?'':'s'}</div></div><div class="spaResultGo">›</div></a>`;

    function render(){
      const raw=search.value.trim();
      const list=scoped.filter(x=>matches(x,raw));
      let locs=[];
      if(raw){const terms=norm(raw).split(' ').filter(t=>!norm(view).split(' ').includes(t));locs=locationRows().filter(r=>terms.every(t=>(aliases[t]||[t]).some(x=>norm(r.name+' '+r.type).includes(norm(x)))));}
      content.classList.add('spaResults');
      subtitle.textContent=`${scoped.length} assets registered in ${view}. Search to narrow the list.`;
      count.textContent=raw?list.length+locs.length:scoped.length;
      photoCount.textContent=photoTotal;
      meta.textContent=raw?`${locs.length} location${locs.length===1?'':'s'} · ${list.length} asset${list.length===1?'':'s'}`:`Showing all ${scoped.length} ${view} assets`;
      meta.classList.add('show');
      const parts=[];
      if(raw&&locs.length){parts.push('<div class="locationGroupLabel">ROOMS & LOCATIONS</div>',...locs.map(locCard));}
      if(list.length){parts.push('<div class="locationGroupLabel">ASSETS</div>',...list.map(assetCard));}
      content.innerHTML=parts.length?parts.join(''):`<div class="empty">No matching assets in the ${esc(view)} building.</div>`;
      content.querySelectorAll('[data-location-search]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();search.value=el.dataset.locationSearch||'';render();}));
    }

    search.addEventListener('input',e=>{e.stopImmediatePropagation();render();},true);
    setTimeout(render,60);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
  else setTimeout(init,0);
})();
/* Building location groups: Building -> group -> locations/assets. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
let client,groups=[],groupAssets=[],activeBuilding=null,activeGroup=null;

function buildingIdByName(name){return (window.__lwLocationGroupBuildings||[]).find(b=>norm(b.name)===norm(name))?.id||'';}
function locationName(a){return a.exact_location||a.asset_name||a.asset_code;}
function groupIcon(slug){return ({'plant-rooms':'🏭','air-conditioning':'❄️','kitchen':'🍽️','guest-rooms':'🛏️','public-areas':'🏨','service-areas':'🧰'})[slug]||'📍';}
function groupCount(g){return groupAssets.filter(a=>a.location_group_id===g.id).length;}

function ensurePanel(){
 const hub=$('buildingHubView');const grid=hub?.querySelector('.plantHubGrid');if(!hub||!grid)return null;
 let panel=$('buildingLocationGroups');
 if(!panel){panel=document.createElement('section');panel.id='buildingLocationGroups';panel.className='buildingLocationGroups';grid.parentNode.insertBefore(panel,grid);}
 return panel;
}
function renderGroups(){
 const panel=ensurePanel();if(!panel||!activeBuilding)return;
 const rows=groups.filter(g=>g.building_id===activeBuilding.id).sort((a,b)=>(a.sort_order||100)-(b.sort_order||100)||a.name.localeCompare(b.name));
 if(!rows.length){panel.innerHTML='';return;}
 panel.innerHTML=`<div class="sectionHead"><h3>Locations</h3><span>Choose an area of ${esc(activeBuilding.name)}</span></div><div class="locationGroupGrid">${rows.map(g=>`<button type="button" data-location-group="${esc(g.id)}"><span>${groupIcon(g.slug)}</span><div><b>${esc(g.name)}</b><small>${groupCount(g)} linked asset${groupCount(g)===1?'':'s'}</small></div></button>`).join('')}</div>`;
}
function renderGroup(g){
 const panel=ensurePanel();if(!panel)return;activeGroup=g;
 const rows=groupAssets.filter(a=>a.location_group_id===g.id).sort((a,b)=>locationName(a).localeCompare(locationName(b)));
 const byLocation=new Map();rows.forEach(a=>{const n=locationName(a);if(!byLocation.has(n))byLocation.set(n,[]);byLocation.get(n).push(a);});
 panel.innerHTML=`<div class="sectionHead"><h3>${groupIcon(g.slug)} ${esc(g.name)}</h3><span>${esc(activeBuilding?.name||'Building')}</span></div><div class="locationGroupGrid"><button type="button" data-location-group-back="1"><span>←</span><div><b>All locations</b><small>${esc(activeBuilding?.name||'Building')}</small></div></button>${[...byLocation.entries()].map(([loc,items])=>`<button type="button" data-location-group-location="${esc(loc)}"><span>📍</span><div><b>${esc(loc)}</b><small>${items.map(a=>esc(a.asset_code)).join(', ')}</small></div></button>`).join('')}</div>`;
}
async function load(){
 const cfg=window.LIMEWOOD_CONFIG||{};if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
 client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
 const [b,g,a]=await Promise.all([client.from('buildings').select('id,name'),client.from('location_groups').select('id,building_id,name,slug,sort_order'),client.from('assets').select('id,asset_code,asset_name,building_id,location_group_id,exact_location')]);
 window.__lwLocationGroupBuildings=b.data||[];groups=g.data||[];groupAssets=a.data||[];
}
function detectBuilding(){
 const title=$('buildingHubTitle');if(!title)return;
 const b=(window.__lwLocationGroupBuildings||[]).find(x=>norm(x.name)===norm(title.textContent));
 if(b){activeBuilding=b;activeGroup=null;renderGroups();}
}
function init(){
 const style=document.createElement('style');style.textContent='.buildingLocationGroups{margin:14px 0}.locationGroupGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.locationGroupGrid button{min-height:58px;text-align:left;border:1px solid #dbe3de;border-radius:12px;background:#fff;padding:9px;display:flex;gap:8px;align-items:center}.locationGroupGrid button>span{font-size:20px}.locationGroupGrid b{display:block;color:#17372c}.locationGroupGrid small{display:block;color:#6e7771;margin-top:2px}@media(min-width:760px){.locationGroupGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}';document.head.appendChild(style);
 load().then(()=>{detectBuilding();const title=$('buildingHubTitle');if(title)new MutationObserver(detectBuilding).observe(title,{childList:true,characterData:true,subtree:true});});
 document.addEventListener('click',e=>{const gbtn=e.target.closest('[data-location-group]');if(gbtn){const g=groups.find(x=>x.id===gbtn.dataset.locationGroup);if(g)renderGroup(g);return;}if(e.target.closest('[data-location-group-back]'))renderGroups();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Keep the PPM browser from showing duplicate aliases for the Forest Cottages & Cabin location. */
(()=>{
'use strict';
const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const forestKey=v=>{
  const s=norm(v);
  if(!s)return '';
  if((s.includes('forest cottage')||s.includes('forest cottages')) && (s.includes('cabin')||s.includes('lodges'))) return 'forest-cottages-cabin';
  return s;
};
function dedupe(){
  const host=document.getElementById('ppmRoomButtons');
  if(!host)return;
  const seen=new Set();
  [...host.querySelectorAll('button')].forEach(btn=>{
    if(btn.matches('[data-ppm-building-back],[data-ppm-buildings-back]'))return;
    const label=btn.querySelector('b')?.textContent||btn.dataset.ppmRoom||'';
    const key=forestKey(label);
    if(key!=='forest-cottages-cabin')return;
    if(seen.has(key))btn.remove();
    else seen.add(key);
  });
}
function init(){
  const host=document.getElementById('ppmRoomButtons');
  if(!host)return setTimeout(init,300);
  const observer=new MutationObserver(()=>queueMicrotask(dedupe));
  observer.observe(host,{childList:true,subtree:true});
  dedupe();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Barn asset-register photo bridge. Uses the organised Drive source images as live asset thumbnails/gallery evidence. */
(()=>{
'use strict';
const photos={
 'BARN-B1-01':{id:'1-AFJcslYK1hlO_s6uV9aEJODDp_zQ3wh',caption:'Cold Water Booster Pump 1 · survey composite'},
 'BARN-B1-02':{id:'1Wq6lzl5FztJLn4tjNND0fd8Nj1_hHnxF',caption:'Cold Water Booster Pump 2 · survey composite'},
 'BARN-B1-03':{id:'1BqQnJpr1RAWIivfDFCa4Crlll4-eLWYl',caption:'Cold Water Booster Pump 3 · survey composite'},
 'BARN-B1-04':{id:'1OU3EgQXBGjiUt6V6-wkfqulzMjE1_1GD',caption:'Heatrae Industrial Immersion Heater · nameplate'},
 'BARN-B1-05':{id:'1OAkSL6G2wJrm41F0D4v2HZ2oRlVtWi8W',caption:'Aqua Chemical Dosing Pump · unit and controller'},
 'BARN-B1-06':{id:'1B3GVGwJGPm670LNy-3SagfECHy2Kv0wj',caption:'Flomasta Potable Water Expansion Vessel · nameplate'},
 'BARN-B1-07':{id:'1CnCZQzdceW4mLn0PlOX3uQaR27hrmcmj',caption:'Cold Water Booster Set Control Panel · Wilo VR-System'},
 'BARN-B1-08':{id:'17zzZaCj0x5AC7Gbn2IzcdhEc6-FufviA',caption:'Barn Water Consumption Meter · meter face and identification'}
};
const thumb=id=>`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
const view=id=>`https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
function applyCards(){
 document.querySelectorAll('#grid [data-id]').forEach(card=>{
   const p=photos[card.dataset.id]; if(!p)return;
   const img=card.querySelector('img'); if(img){img.src=thumb(p.id);img.alt=p.caption;img.referrerPolicy='no-referrer';}
 });
}
function applyModal(){
 const code=document.getElementById('mId')?.textContent?.trim();
 const p=photos[code]; if(!p)return;
 const gallery=document.getElementById('photoGallery'); if(!gallery)return;
 if(gallery.dataset.barnPhotoCode===code)return;
 gallery.dataset.barnPhotoCode=code;
 gallery.innerHTML=`<figure class="barnEvidencePhoto"><a href="${view(p.id)}" target="_blank" rel="noopener noreferrer"><img src="${thumb(p.id)}" alt="${p.caption}" referrerpolicy="no-referrer"></a><figcaption>${p.caption}<br><small>Tap image for the full Drive source.</small></figcaption></figure>`;
}
function apply(){applyCards();applyModal();}
function init(){
 const obs=new MutationObserver(()=>queueMicrotask(apply));
 obs.observe(document.body,{childList:true,subtree:true,characterData:true});
 document.addEventListener('click',()=>setTimeout(apply,60),true);
 apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

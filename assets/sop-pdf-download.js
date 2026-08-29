// Limewood SOP PDF download v1
// Generates a controlled, printable PDF from the live structured SOP record.
(() => {
  'use strict';
  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  const $=(s,r=document)=>r.querySelector(s);
  const MARKER='LW_SOP_BUILDER_V1:';
  let loadingPdf=false;

  function parseDescription(value){
    const s=String(value||'');
    if(!s.startsWith(MARKER))return {notes:s};
    try{return JSON.parse(s.slice(MARKER.length));}catch{return {notes:s};}
  }
  function cleanFileName(v){return String(v||'SOP').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'');}
  function isSopLibrary(){return ($('#documentViewTitle')?.textContent||'').trim()==='SOP Library';}
  async function loadJsPdf(){
    if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
    if(loadingPdf){await new Promise(r=>setTimeout(r,300));return loadJsPdf();}
    loadingPdf=true;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('PDF library could not load.'));
      document.head.appendChild(s);
    }).finally(()=>loadingPdf=false);
    if(!window.jspdf?.jsPDF)throw new Error('PDF library did not initialise.');
    return window.jspdf.jsPDF;
  }
  async function nameFor(table,id){
    if(!id)return '';
    const {data}=await db.from(table).select('name').eq('id',id).maybeSingle();
    return data?.name||'';
  }
  function addWrapped(doc,text,x,y,maxWidth,lineHeight=5){
    const lines=doc.splitTextToSize(String(text||''),maxWidth);
    doc.text(lines,x,y);
    return y+(Math.max(lines.length,1)*lineHeight);
  }
  function addPageIfNeeded(doc,y,needed=24){
    if(y+needed<278)return y;
    doc.addPage();
    return 18;
  }
  function section(doc,title,text,y){
    if(!String(text||'').trim())return y;
    y=addPageIfNeeded(doc,y,28);
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(title,16,y);
    y+=6;doc.setFont('helvetica','normal');doc.setFontSize(9.5);
    y=addWrapped(doc,text,16,y,178,4.8)+5;
    return y;
  }
  async function download(id,button){
    const old=button?.textContent;
    try{
      if(button){button.disabled=true;button.textContent='Building PDF…';}
      const {data:sop,error}=await db.from('sops').select('*').eq('id',id).single();
      if(error)throw error;
      const [building,room]=await Promise.all([
        nameFor('buildings',sop.building_id),
        nameFor('plant_rooms',sop.plant_room_id)
      ]);
      const detail=parseDescription(sop.description);
      const JsPDF=await loadJsPdf();
      const doc=new JsPDF({unit:'mm',format:'a4'});
      doc.setProperties({title:`${sop.sop_number||'SOP'} - ${sop.title||''}`,subject:'Limewood Engineering Standard Operating Procedure',author:sop.author||'Limewood Engineering'});

      doc.setFillColor(23,55,44);doc.rect(0,0,210,28,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('LIMEWOOD ENGINEERING',16,12);
      doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text('CONTROLLED STANDARD OPERATING PROCEDURE',16,19);
      doc.setTextColor(29,40,35);

      let y=38;
      doc.setFont('helvetica','bold');doc.setFontSize(15);y=addWrapped(doc,sop.title||'Untitled SOP',16,y,178,7)+3;
      doc.setDrawColor(210,216,211);doc.line(16,y,194,y);y+=7;
      const meta=[
        ['SOP number',sop.sop_number||'—'],['Revision',sop.revision||'1'],
        ['Status',String(sop.status||'draft').replaceAll('_',' ')],['Category',sop.category||'General'],
        ['Building',building||'Estate-wide'],['Plant room',room||'Not specified'],
        ['Author',sop.author||'—'],['Approved by',sop.approved_by||'—'],
        ['Issue date',sop.issue_date||'—'],['Review date',sop.review_date||'—']
      ];
      doc.setFontSize(8.5);
      for(let i=0;i<meta.length;i+=2){
        const a=meta[i],b=meta[i+1];
        doc.setFont('helvetica','bold');doc.text(`${a[0]}:`,16,y);doc.setFont('helvetica','normal');doc.text(String(a[1]),43,y);
        doc.setFont('helvetica','bold');doc.text(`${b[0]}:`,108,y);doc.setFont('helvetica','normal');doc.text(String(b[1]),134,y);
        y+=6;
      }
      y+=4;
      y=section(doc,'1. Purpose',detail.purpose,y);
      y=section(doc,'2. Scope',detail.scope,y);
      y=section(doc,'3. PPE / Equipment',detail.ppe,y);
      y=section(doc,'4. Isolation / Safety Precautions',detail.isolation,y);
      y=section(doc,'5. Procedure',detail.steps,y);
      y=section(doc,'6. Emergency / Abnormal Conditions',detail.emergency,y);
      y=section(doc,'7. Notes',detail.notes,y);

      const {data:links}=await db.from('sop_photos').select('caption,sort_order,photo_inbox:photo_inbox_id(storage_path,original_filename)').eq('sop_id',id).order('sort_order');
      if((links||[]).length){
        y=addPageIfNeeded(doc,y,24);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('8. Linked Photographs',16,y);y+=7;
        doc.setFont('helvetica','normal');doc.setFontSize(9);
        for(const row of links||[]){
          const label=row.caption||row.photo_inbox?.original_filename||'Linked SOP photograph';
          y=addPageIfNeeded(doc,y,10);y=addWrapped(doc,`• ${label}`,18,y,174,4.5)+2;
        }
        y+=2;
        doc.setFontSize(7.5);doc.setTextColor(90,100,95);doc.text('Photographs are retained in the Limewood Engineering system and linked to this controlled SOP record.',16,y);doc.setTextColor(29,40,35);
      }

      const pages=doc.getNumberOfPages();
      for(let p=1;p<=pages;p++){
        doc.setPage(p);doc.setFontSize(7.5);doc.setTextColor(100,108,103);
        doc.text(`${sop.sop_number||'SOP'} · Revision ${sop.revision||'1'} · Controlled copy`,16,291);
        doc.text(`Page ${p} of ${pages}`,194,291,{align:'right'});
      }
      doc.save(`${cleanFileName(sop.sop_number)}_${cleanFileName(sop.title)}_Rev_${cleanFileName(sop.revision||'1')}.pdf`);
    }catch(e){alert('Could not create SOP PDF: '+(e?.message||e));}
    finally{if(button){button.disabled=false;button.textContent=old||'Download PDF';}}
  }
  async function decorate(){
    if(!isSopLibrary())return;
    const {data}=await db.from('sops').select('id,sop_number');
    for(const card of document.querySelectorAll('#documentGrid .documentCard')){
      if(card.querySelector('.lwSopPdfBtn'))continue;
      const num=(card.querySelector('.documentNumber')?.textContent||'').trim();
      const row=(data||[]).find(x=>String(x.sop_number||'').trim()===num);
      if(!row)continue;
      const b=document.createElement('button');b.type='button';b.className='lwSopEditBtn lwSopPdfBtn';b.textContent='Download PDF';
      b.style.marginLeft='8px';b.onclick=()=>download(row.id,b);card.appendChild(b);
    }
    const modal=$('#lwSopBuilder');
    if(modal&&!$('#lwSopDownloadPdf')){
      const actions=modal.querySelector('.lwSopActions');
      if(actions){const b=document.createElement('button');b.type='button';b.id='lwSopDownloadPdf';b.textContent='Download PDF';b.style.cssText='border:1px solid #b9c7bf;background:#f8faf8;color:#17372c';b.onclick=()=>{
        const n=$('#lwSopNumber')?.value?.trim();
        if(!n){alert('Save the SOP first, then download it.');return;}
        db.from('sops').select('id').eq('sop_number',n).maybeSingle().then(({data})=>data?.id?download(data.id,b):alert('Save the SOP first, then download it.'));
      };actions.insertBefore(b,actions.lastElementChild);}
    }
  }
  function init(){
    const style=document.createElement('style');style.textContent='.lwSopPdfBtn{background:#fff!important}';document.head.appendChild(style);
    new MutationObserver(()=>setTimeout(decorate,100)).observe($('#documentView')||document.body,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click',()=>setTimeout(decorate,100));setTimeout(decorate,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(()=>{
'use strict';
const cfg=window.LIMEWOOD_CONFIG||{};
if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const safeName=n=>String(n||'photo').replace(/^\/+|\/+$/g,'').replace(/[\\/]+/g,'__').replace(/[^a-zA-Z0-9._-]+/g,'_');
const mime=n=>/\.png$/i.test(n)?'image/png':/\.webp$/i.test(n)?'image/webp':/\.gif$/i.test(n)?'image/gif':/\.hei[cf]$/i.test(n)?'image/heic':'image/jpeg';
async function getJSZip(){
  if(window.JSZip)return window.JSZip;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load ZIP support.'));document.head.appendChild(s);});
  if(!window.JSZip)throw new Error('ZIP support did not initialise.');
  return window.JSZip;
}
function install(){
  const photoInput=document.getElementById('photoFiles');
  if(!photoInput||document.getElementById('lwZipSafeWrap'))return;
  document.getElementById('lwZipImport')?.remove();
  document.getElementById('lwZipImportNote')?.remove();
  document.querySelectorAll('input[type=file][accept*="zip"]').forEach(x=>{if(x!==photoInput)x.remove();});
  const wrap=document.createElement('div');wrap.id='lwZipSafeWrap';wrap.style.cssText='margin-top:10px;padding:12px;border:1px solid #cdd8d1;border-radius:10px;background:#f8faf8';
  wrap.innerHTML='<b style="display:block;margin-bottom:6px;color:#17372c">Import ZIP</b><div style="font-size:11px;color:#6b746f;margin-bottom:7px">Choose the ZIP directly below. Up to 50 MB / 250 images. Upload starts automatically.</div>';
  const input=document.createElement('input');input.id='lwZipSafeFile';input.type='file';input.style.cssText='width:100%;font-size:14px';
  wrap.appendChild(input);
  photoInput.closest('.dropZone')?.insertAdjacentElement('afterend',wrap);
  const status=document.getElementById('uploadStatus');
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    let done=0,failed=0;
    try{
      if(!/\.zip$/i.test(file.name))throw new Error('Please choose a .zip file.');
      if(file.size>50*1024*1024)throw new Error('ZIP is over the 50 MB limit.');
      input.disabled=true;
      if(status){status.className='status';status.textContent='Opening ZIP…';}
      const {data:s,error:se}=await client.auth.getSession();if(se)throw se;if(!s.session)throw new Error('Sign in required.');
      const JSZip=await getJSZip();
      const zip=await JSZip.loadAsync(file);
      const entries=Object.values(zip.files).filter(e=>!e.dir&&/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(e.name));
      if(!entries.length)throw new Error('No supported images found in the ZIP.');
      if(entries.length>250)throw new Error(`ZIP contains ${entries.length} images. Limit is 250.`);
      const hint=document.getElementById('locationHint')?.value.trim()||null;
      const notes=document.getElementById('batchNotes')?.value.trim()||null;
      for(let i=0;i<entries.length;i++){
        const entry=entries[i];
        if(status){status.className='status';status.textContent=`Uploading ${i+1} of ${entries.length}: ${safeName(entry.name)}`;}
        try{
          const blob=await entry.async('blob');
          const name=safeName(entry.name);
          const path=`photo-inbox/${s.session.user.id}/${Date.now()}-${crypto.randomUUID()}-${name}`;
          const up=await client.storage.from(cfg.storageBucket||'asset-files').upload(path,blob,{contentType:mime(entry.name),upsert:false});
          if(up.error)throw up.error;
          const ins=await client.from('photo_inbox').insert({storage_path:path,original_filename:name,mime_type:mime(entry.name),file_size:blob.size||null,location_hint:hint,notes:notes,uploaded_by:s.session.user.id}).select('id').single();
          if(ins.error)throw ins.error;
          done++;
        }catch(err){failed++;console.warn('ZIP photo upload failed',entry.name,err);}
      }
      if(status){status.className='status '+(failed?'error':'success');status.textContent=`ZIP import complete. Uploaded ${done} of ${entries.length}.${failed?` ${failed} failed.`:' The inbox will refresh and start AI review.'}`;}
      if(done)setTimeout(()=>location.reload(),1200);
    }catch(e){if(status){status.className='status error';status.textContent=e?.message||String(e);}}
    finally{input.disabled=false;input.value='';}
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

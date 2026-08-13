(()=>{
'use strict';
const $=id=>document.getElementById(id); const cfg=window.LIMEWOOD_CONFIG||{};
const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session=null,jobs=[],filter='open',selected=null,profileName='Engineering';
const els={auth:$('authScreen'),app:$('app'),email:$('email'),password:$('password'),authMessage:$('authMessage'),signIn:$('signIn'),signOut:$('signOut'),refresh:$('refresh'),navRefresh:$('navRefresh'),jobList:$('jobList'),search:$('search'),tabs:$('tabs'),dialog:$('jobDialog'),close:$('closeDialog'),toast:$('toast')};
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){els.toast.textContent=msg;els.toast.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.hidden=true,2600)}
function fmtDate(v){if(!v)return '—';return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
function age(v){if(!v)return '';const mins=Math.max(0,Math.floor((Date.now()-new Date(v))/60000));if(mins<60)return `${mins}m`;const h=Math.floor(mins/60);if(h<24)return `${h}h`;return `${Math.floor(h/24)}d`}
function statusLabel(s){return ({new:'New',in_progress:'In progress',waiting_parts:'Waiting parts',waiting_contractor:'Waiting contractor',completed:'Completed',unable_to_complete:'Unable to complete'})[s]||s}
function visibleJobs(){const q=els.search.value.trim().toLowerCase();return jobs.filter(j=>{const ok=filter==='open'?j.status!=='completed':filter==='waiting'?['waiting_parts','waiting_contractor'].includes(j.status):j.status===filter;const text=[j.job_number,j.location,j.issue,j.reporter_name].join(' ').toLowerCase();return ok&&(!q||text.includes(q))})}
function render(){
 $('openCount').textContent=jobs.filter(j=>j.status!=='completed').length;
 $('urgentCount').textContent=jobs.filter(j=>j.status!=='completed'&&j.urgency==='urgent').length;
 $('waitingCount').textContent=jobs.filter(j=>['waiting_parts','waiting_contractor'].includes(j.status)).length;
 const rows=visibleJobs();
 els.jobList.innerHTML=rows.length?rows.map(j=>`<button class="job-card ${j.urgency==='urgent'?'urgent':''}" data-id="${j.id}"><div class="job-card-inner"><div class="job-top"><div><span class="job-number">${esc(j.job_number||'NEW JOB')}</span><h3>${esc(j.location)}</h3></div><span class="age">${age(j.reported_at)} ago</span></div><p>${esc(j.issue)}</p><div class="job-meta"><span class="pill ${esc(j.status)}">${esc(statusLabel(j.status))}</span>${j.urgency==='urgent'?'<span class="pill urgent">Urgent</span>':''}${j.checked_at?'<span class="pill checked">Checked</span>':''}</div></div></button>`).join(''):'<div class="empty"><b>No jobs here.</b><br><span>Either engineering is winning or somebody has hidden the defect book.</span></div>';
 document.querySelectorAll('.job-card').forEach(b=>b.onclick=()=>openJob(b.dataset.id));
}
async function loadProfile(){try{const {data}=await client.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profileName=data?.full_name||data?.display_name||data?.name||session.user.email?.split('@')[0]||'Engineering'}catch{profileName=session.user.email?.split('@')[0]||'Engineering'}$('engineerName').textContent=profileName}
async function loadJobs(){
 const {data,error}=await client.from('maintenance_jobs').select('*').order('reported_at',{ascending:false});
 if(error){els.jobList.innerHTML=`<div class="empty"><b>Engineer app database not ready.</b><br><span>${esc(error.message)}</span><br><br><span>Run <b>setup.sql</b> in Supabase once.</span></div>`;return}
 jobs=data||[];render();
}
async function setFirstViewed(job){if(job.first_viewed_at)return;const now=new Date().toISOString();const {error}=await client.from('maintenance_jobs').update({first_viewed_at:now,first_viewed_by:session.user.id}).eq('id',job.id).is('first_viewed_at',null);if(!error){job.first_viewed_at=now;job.first_viewed_by=session.user.id}}
async function loadNotes(jobId){const {data}=await client.from('maintenance_job_notes').select('*').eq('job_id',jobId).order('created_at',{ascending:false});return data||[]}
async function loadPhotos(jobId){const {data}=await client.from('maintenance_job_photos').select('*').eq('job_id',jobId).order('created_at',{ascending:false});return data||[]}
async function signedPhoto(path){const {data}=await client.storage.from(cfg.storageBucket||'asset-files').createSignedUrl(path,3600);return data?.signedUrl||''}
async function openJob(id){selected=jobs.find(j=>j.id===id);if(!selected)return;await setFirstViewed(selected);$('detailJobNumber').textContent=selected.job_number||'';$('detailLocation').textContent=selected.location;$('detailIssue').textContent=selected.issue;$('detailStatusLine').innerHTML=`<span class="pill ${esc(selected.status)}">${esc(statusLabel(selected.status))}</span>${selected.urgency==='urgent'?'<span class="pill urgent">Urgent</span>':''}${selected.checked_at?'<span class="pill checked">Checked</span>':''}`;
 $('detailReporterBlock').innerHTML=`<div><b>Reported by</b><span>${esc(selected.reporter_name||'Not supplied')}</span></div><div><b>Reported</b><span>${esc(fmtDate(selected.reported_at))}</span></div><div><b>Source</b><span>${esc(selected.source||'manual')}</span></div><div><b>Checked</b><span>${esc(selected.checked_at?fmtDate(selected.checked_at):'Not yet')}</span></div>`;
 $('detailOriginalBlock').hidden=!selected.original_message;$('detailOriginal').textContent=selected.original_message||'';
 $('markChecked').disabled=!!selected.checked_at||selected.status==='completed';$('startWork').disabled=selected.status==='completed';$('waitParts').disabled=selected.status==='completed';$('waitContractor').disabled=selected.status==='completed';$('completeJob').disabled=selected.status==='completed';$('newNote').value='';
 const notes=await loadNotes(selected.id);$('historyList').innerHTML=notes.length?notes.map(n=>`<div class="history-item"><span class="history-dot"></span><div><p>${esc(n.note)}</p><small>${esc(statusLabel(n.event_type))} · ${esc(fmtDate(n.created_at))}</small></div></div>`).join(''):'<div class="empty">No engineer notes yet.</div>';
 const photos=await loadPhotos(selected.id);const gallery=$('photoGallery');gallery.innerHTML='';for(const p of photos){const u=await signedPhoto(p.storage_path);if(u)gallery.insertAdjacentHTML('beforeend',`<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" alt="Job photo"></a>`)}
 if(!els.dialog.open)els.dialog.showModal();render();
}
async function addEvent(note,eventType='note'){if(!selected)return;const text=note.trim();if(!text)return;const {error}=await client.from('maintenance_job_notes').insert({job_id:selected.id,note:text,event_type:eventType,created_by:session.user.id});if(error)return toast(error.message);await openJob(selected.id)}
async function updateJob(patch,note,eventType){
  if(!selected)return;

  const jobId=selected.id;

  const {data,error}=await client
    .from('maintenance_jobs')
    .update(patch)
    .eq('id',jobId)
    .select()
    .single();

  if(error)return toast(error.message);

  Object.assign(selected,data);

  if(note){
    await client
      .from('maintenance_job_notes')
      .insert({
        job_id:jobId,
        note,
        event_type:eventType||'status',
        created_by:session.user.id
      });
  }

  toast(note||'Job updated');

  await loadJobs();

  if(patch.status==='completed'){
    if(els.dialog.open)els.dialog.close();
    selected=null;
    render();
    return;
  }

  await openJob(jobId);
}
  if(!selected || selected.checked_at) return;

  const btn=$('markChecked');
  btn.disabled=true;

  await updateJob(
    {
      checked_at:new Date().toISOString(),
      checked_by:session.user.id
    },
    `Checked by ${profileName}`,
    'checked'
  );
};
$('startWork').onclick=()=>updateJob({status:'in_progress',work_started_at:selected.work_started_at||new Date().toISOString(),work_started_by:selected.work_started_by||session.user.id},`Work started by ${profileName}`,'in_progress');
$('waitParts').onclick=()=>updateJob({status:'waiting_parts'},`Job placed on hold: waiting for parts`,'waiting_parts');
$('waitContractor').onclick=()=>updateJob({status:'waiting_contractor'},`Job placed on hold: waiting for contractor`,'waiting_contractor');
$('addNote').onclick=()=>{const n=$('newNote').value;if(!n.trim())return toast('Add a note first.');addEvent(n,'note')};
$('completeJob').onclick=async()=>{if(!selected||selected.status==='completed')return;if(!selected.checked_at)return toast('Check the job before completing it.');const btn=$('completeJob');btn.disabled=true;const note=$('newNote').value.trim();await updateJob({status:'completed',completed_at:new Date().toISOString(),completed_by:session.user.id},note?`Completed by ${profileName}: ${note}`:`Job completed by ${profileName}`,'completed');};
$('photoInput').onchange=async e=>{const file=e.target.files?.[0];if(!file||!selected)return;toast('Uploading photo…');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`maintenance-jobs/${selected.id}/${Date.now()}-${safe}`;const {error:upErr}=await client.storage.from(cfg.storageBucket||'asset-files').upload(path,file,{upsert:false,contentType:file.type});if(upErr){e.target.value='';return toast(`Photo upload failed: ${upErr.message}`)}const {error}=await client.from('maintenance_job_photos').insert({job_id:selected.id,storage_path:path,uploaded_by:session.user.id});if(error)return toast(error.message);await addEvent('Photo added','photo');e.target.value='';toast('Photo added')};
els.signIn.onclick=async()=>{els.authMessage.textContent='';els.signIn.disabled=true;const {error}=await client.auth.signInWithPassword({email:els.email.value.trim(),password:els.password.value});els.signIn.disabled=false;if(error)els.authMessage.textContent=error.message};
els.signOut.onclick=()=>client.auth.signOut();els.refresh.onclick=loadJobs;els.navRefresh.onclick=loadJobs;els.search.oninput=render;els.tabs.onclick=e=>{const b=e.target.closest('button[data-filter]');if(!b)return;filter=b.dataset.filter;els.tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));render()};$('navUrgent').onclick=()=>{filter='open';els.search.value='';jobs=jobs.sort((a,b)=>(b.urgency==='urgent')-(a.urgency==='urgent'));render();window.scrollTo({top:0,behavior:'smooth'})};$('navOpen').onclick=()=>{filter='open';els.search.value='';render();window.scrollTo({top:0,behavior:'smooth'})};els.close.onclick=()=>els.dialog.close();els.dialog.addEventListener('click',e=>{if(e.target===els.dialog)els.dialog.close()});
async function authState(s){
  session=s;

  if(session){
    els.auth.hidden=true;
    els.auth.style.display='none';

    els.app.hidden=false;
    els.app.style.display='block';

    await loadProfile();
    await loadJobs();
  }else{
    els.auth.hidden=false;
    els.auth.style.display='grid';

    els.app.hidden=true;
    els.app.style.display='none';

    if(els.dialog.open) els.dialog.close();
  }
}
client.auth.getSession().then(({data})=>authState(data.session));client.auth.onAuthStateChange((_e,s)=>authState(s));
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();

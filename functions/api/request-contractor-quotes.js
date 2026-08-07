export async function onRequestPost(context){
 const {request,env}=context;
 try{
  const body=await request.json(),issueId=body.issue_id,ids=body.contractor_ids||[];
  if(!issueId||!ids.length)return json({error:"issue_id and contractor_ids required"},400);
  const H={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"};
  const [ir,cr]=await Promise.all([
   fetch(`${env.SUPABASE_URL}/rest/v1/maintenance_issues?id=eq.${encodeURIComponent(issueId)}&select=*`,{headers:H}),
   fetch(`${env.SUPABASE_URL}/rest/v1/contractors?id=in.(${ids.map(encodeURIComponent).join(",")})&approved=eq.true&active=eq.true&select=*`,{headers:H})
  ]);
  const issue=(await ir.json())?.[0],contractors=await cr.json();if(!issue)return json({error:"Issue not found"},404);
  let sent=0;
  for(const c of contractors){
   const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
   const ref=`CQ-${Date.now().toString().slice(-7)}-${sent+1}`;
   const qr=await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?on_conflict=issue_id,contractor_id`,{method:"POST",headers:{...H,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({reference:ref,issue_id:issue.id,contractor_id:c.id,secure_token:token,status:"Requested",requested_at:new Date().toISOString()})});
   if(!qr.ok)continue;
   if(env.RESEND_API_KEY&&env.MAINTENANCE_FROM_EMAIL){
    const url=`${new URL(request.url).origin}/contractor-quote.html?token=${token}`;
    await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAINTENANCE_FROM_EMAIL,to:[c.email],subject:`Quotation request ${issue.reference||""} - ${issue.location}`,html:`<h2>Quotation request</h2><p><b>Site:</b> Limewood</p><p><b>Location:</b> ${esc(issue.location)}</p><p><b>Issue:</b> ${esc(issue.description)}</p><p>Please submit your repair or replacement quotation using the secure link below.</p><p><a href="${url}">Submit quotation</a></p>`})});
   }
   sent++;
  }
  return json({ok:true,sent});
 }catch(e){return json({error:String(e)},500)}
}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function json(v,s=200){return new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json"}})}

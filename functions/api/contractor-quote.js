export async function onRequest(context){
 const {request,env}=context;
 const H={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"};
 try{
  if(request.method==="GET"){
   const token=new URL(request.url).searchParams.get("token");if(!token)return json({error:"Token required"},400);
   const qr=await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?secure_token=eq.${encodeURIComponent(token)}&select=*`,{headers:H}),q=(await qr.json())?.[0];if(!q)return json({error:"Quotation request not found"},404);
   const [ir,cr]=await Promise.all([fetch(`${env.SUPABASE_URL}/rest/v1/maintenance_issues?id=eq.${q.issue_id}&select=*`,{headers:H}),fetch(`${env.SUPABASE_URL}/rest/v1/contractors?id=eq.${q.contractor_id}&select=*`,{headers:H})]);
   return json({quote:q,issue:(await ir.json())?.[0]||{},contractor:(await cr.json())?.[0]||{}});
  }
  if(request.method==="POST"){
   const b=await request.json();if(!b.token)return json({error:"Token required"},400);
   const qr=await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?secure_token=eq.${encodeURIComponent(b.token)}&select=*`,{headers:H}),q=(await qr.json())?.[0];if(!q)return json({error:"Quotation request not found"},404);
   const payload={proposal_type:b.proposal_type,quoted_amount:b.quoted_amount,lead_time:b.lead_time,warranty:b.warranty,proposal_scope:b.proposal_scope,exclusions:b.exclusions,earliest_attendance:b.earliest_attendance,contractor_quote_ref:b.contractor_quote_ref,status:"Received",received_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   const ur=await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?id=eq.${q.id}`,{method:"PATCH",headers:{...H,Prefer:"return=representation"},body:JSON.stringify(payload)});if(!ur.ok)return json({error:"Could not save quotation"},500);
   if(env.RESEND_API_KEY&&env.MAINTENANCE_FROM_EMAIL&&env.MAINTENANCE_NOTIFY_EMAIL){
    await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAINTENANCE_FROM_EMAIL,to:[env.MAINTENANCE_NOTIFY_EMAIL],subject:"Contractor quotation received",html:`<p>A contractor quotation has been received for ${q.reference||"a maintenance issue"}.</p><p>Open Limewood Engineering → Contractors & Quotes to review it.</p>`})});
   }
   return json({ok:true});
  }
  return json({error:"Method not allowed"},405);
 }catch(e){return json({error:String(e)},500)}
}
function json(v,s=200){return new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json"}})}

export async function onRequestPost(context){
 const {request,env}=context;
 try{
  const {quote_id}=await request.json();if(!quote_id)return json({error:"quote_id required"},400);
  const H={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json"};
  const qr=await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?id=eq.${quote_id}&select=*`,{headers:H}),q=(await qr.json())?.[0];if(!q)return json({error:"Quote not found"},404);
  const cr=await fetch(`${env.SUPABASE_URL}/rest/v1/contractors?id=eq.${q.contractor_id}&select=*`,{headers:H}),c=(await cr.json())?.[0];
  await fetch(`${env.SUPABASE_URL}/rest/v1/contractor_quotes?id=eq.${quote_id}`,{method:"PATCH",headers:H,body:JSON.stringify({status:"Instructed",instructed_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
  if(c?.email&&env.RESEND_API_KEY&&env.MAINTENANCE_FROM_EMAIL){
   await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAINTENANCE_FROM_EMAIL,to:[c.email],subject:"Quotation approved - please arrange attendance",html:`<h2>Quotation approved</h2><p>Your quotation ${q.contractor_quote_ref||q.reference||""} has been approved by Limewood Engineering.</p><p>Please contact the Engineering team to confirm an attendance / booking date.</p>`})});
  }
  return json({ok:true});
 }catch(e){return json({error:String(e)},500)}
}
function json(v,s=200){return new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json"}})}

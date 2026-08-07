export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok:false, error:"Missing Supabase server environment variables" }), { status:500, headers:{'content-type':'application/json'} });
    }

    const body = await request.json();
    const issueId = body.issue_id;
    if (!issueId) return new Response(JSON.stringify({ ok:false, error:"issue_id required" }), { status:400, headers:{'content-type':'application/json'} });

    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    const issueRes = await fetch(`${env.SUPABASE_URL}/rest/v1/maintenance_issues?id=eq.${encodeURIComponent(issueId)}&select=*`, { headers });
    const issues = await issueRes.json();
    const issue = issues?.[0];
    if (!issue) return new Response(JSON.stringify({ ok:false, error:"Issue not found" }), { status:404, headers:{'content-type':'application/json'} });

    let recipients = [];

    if (issue.assigned_engineer_id) {
      const engRes = await fetch(`${env.SUPABASE_URL}/rest/v1/maintenance_engineers?id=eq.${encodeURIComponent(issue.assigned_engineer_id)}&active=eq.true&select=email`, { headers });
      const engineers = await engRes.json();
      recipients = engineers.map(e => e.email).filter(Boolean);
    } else {
      const engRes = await fetch(`${env.SUPABASE_URL}/rest/v1/maintenance_engineers?active=eq.true&select=email`, { headers });
      const engineers = await engRes.json();
      recipients = engineers.map(e => e.email).filter(Boolean);
    }

    if (!recipients.length) {
      return new Response(JSON.stringify({ ok:true, notified:0, warning:"No active engineer emails configured" }), { headers:{'content-type':'application/json'} });
    }

    if (!env.RESEND_API_KEY || !env.MAINTENANCE_FROM_EMAIL) {
      return new Response(JSON.stringify({ ok:true, notified:0, warning:"Email service not configured" }), { headers:{'content-type':'application/json'} });
    }

    const subject = `${issue.priority === 'Urgent' ? 'URGENT: ' : ''}${issue.reference || 'Maintenance issue'} - ${issue.location}`;
    const html = `
      <h2>${escapeHtml(issue.reference || 'Maintenance issue')}</h2>
      <p><strong>Location:</strong> ${escapeHtml(issue.location)}</p>
      <p><strong>Priority:</strong> ${escapeHtml(issue.priority)}</p>
      <p><strong>Category:</strong> ${escapeHtml(issue.category)}</p>
      <p><strong>Reported by:</strong> ${escapeHtml(issue.reporter_name)}</p>
      <p><strong>Issue:</strong><br>${escapeHtml(issue.description)}</p>
      ${issue.photo_url ? `<p><a href="${issue.photo_url}">View photo</a></p>` : ''}
      <p>Open Limewood Engineering to assign or update this issue.</p>
    `;

    const mailRes = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{
        Authorization:`Bearer ${env.RESEND_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        from: env.MAINTENANCE_FROM_EMAIL,
        to: recipients,
        subject,
        html
      })
    });

    const mailData = await mailRes.json();
    if (!mailRes.ok) {
      return new Response(JSON.stringify({ ok:false, error:mailData }), { status:500, headers:{'content-type':'application/json'} });
    }

    return new Response(JSON.stringify({ ok:true, notified:recipients.length, mail:mailData }), { headers:{'content-type':'application/json'} });
  } catch (error) {
    return new Response(JSON.stringify({ ok:false, error:String(error) }), { status:500, headers:{'content-type':'application/json'} });
  }
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// Adds survey-awareness and gap reasoning to Room Intelligence results.
(() => {
  'use strict';

  const cfg = window.LIMEWOOD_CONFIG || {};
  let db = null;
  let lastKey = '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function client(){
    if (db) return db;
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabasePublishableKey) return null;
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return db;
  }

  function roomNumber(name){
    const m = String(name || '').trim().match(/^Room\s+(\d{1,3})$/i);
    return m ? String(Number(m[1])) : '';
  }

  function statePill(label,state){
    const cls = state === 'recorded' ? 'riRecorded' : state === 'absent' ? 'riAbsent' : 'riUnknown';
    const text = state === 'recorded' ? 'Recorded' : state === 'absent' ? 'Confirmed absent' : 'Not yet recorded';
    return `<div class="riFact ${cls}"><span>${esc(label)}</span><b>${text}</b></div>`;
  }

  function addStyles(){
    if (document.getElementById('roomIntelligencePlusStyle')) return;
    const style = document.createElement('style');
    style.id = 'roomIntelligencePlusStyle';
    style.textContent = `
      .roomInsightPanel{margin:16px 0 6px;padding:14px;border:1px solid #dfe5df;border-radius:14px;background:#fff;text-align:left}
      .roomInsightPanel h3{margin:0 0 4px;color:#17372c;font:700 18px Georgia}
      .roomInsightPanel>p{margin:0 0 12px;color:#68736c;font-size:13px;line-height:1.45}
      .riFacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .riFact{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 11px;border-radius:10px;background:#f7f8f5;font-size:12px}
      .riFact span{color:#46544c}.riFact b{font-size:11px;text-align:right}
      .riRecorded b{color:#2d6b43}.riUnknown b{color:#996f13}.riAbsent b{color:#6d7370}
      .riCoverage{margin-top:11px;padding:11px;border-radius:10px;background:#fff8e6;border:1px solid #ecd89a;color:#5f511e;font-size:12px;line-height:1.45}
      .riCoverage.good{background:#eef7ef;border-color:#bed9c3;color:#315c39}
      .riCircuitList{margin:9px 0 0;padding-left:18px;color:#58665e;font-size:12px;line-height:1.45}
      @media(max-width:600px){.riFacts{grid-template-columns:1fr}.roomInsightPanel{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function genericPanel(room){
    return `<section class="roomInsightPanel" data-ri-plus="1">
      <h3>What the records actually tell us</h3>
      <p>This view shows what is recorded for ${esc(room)}. A missing category means <b>not yet recorded</b>, not that the equipment definitely does not exist.</p>
      <div class="riCoverage">Survey confidence is limited by the records linked to this location. Unrecorded sockets, lighting, valves or plant should be treated as unknown until surveyed.</div>
    </section>`;
  }

  async function mainHousePanel(room,n){
    const c = client();
    if (!c) return genericPanel(room);

    const dbCode = `MH-DB-${n}`;
    const dimmerCode = `MH-DR-${n}`;

    const [assetRes,circuitRes] = await Promise.all([
      c.from('electrical_assets')
        .select('asset_code,asset_name,category,upstream_supply,verification_status,notes')
        .in('asset_code',[dbCode,dimmerCode]),
      c.from('electrical_circuits')
        .select('board_asset_code,circuit_number,circuit_description,destination,status,notes')
        .eq('board_asset_code',dbCode)
    ]);

    const eAssets = assetRes.data || [];
    const circuits = circuitRes.data || [];
    const board = eAssets.find(x => String(x.asset_code).toUpperCase() === dbCode);
    const dimmer = eAssets.find(x => String(x.asset_code).toUpperCase() === dimmerCode);
    const text = circuits.map(x => `${x.circuit_description || ''} ${x.destination || ''}`.toLowerCase()).join(' ');

    const sockets = /socket|ring main|ring final|power outlet/.test(text);
    const dimmerCircuit = /dimmer/.test(text) || !!dimmer;
    const normalLighting = /light|lighting/.test(text.replace(/dimmer/g,''));

    const meaningfulCircuits = circuits.filter(x => !/^spare$/i.test(String(x.circuit_description || '').trim()));
    const incomplete = !board || meaningfulCircuits.length < 2;

    const circuitHtml = meaningfulCircuits.length
      ? `<ul class="riCircuitList">${meaningfulCircuits.map(x => `<li>${esc([x.circuit_number,x.circuit_description,x.destination].filter(Boolean).join(' · '))}</li>`).join('')}</ul>`
      : '';

    const coverage = incomplete
      ? `<div class="riCoverage"><b>Incomplete electrical survey.</b> ${board ? `The room distribution board is recorded, but only ${meaningfulCircuits.length} outgoing circuit${meaningfulCircuits.length===1?' is':'s are'} currently documented.` : 'No room distribution board is currently linked.'} Missing circuit types below are therefore unknown, not absent.</div>`
      : `<div class="riCoverage good"><b>Electrical records have useful circuit detail.</b> Missing categories still remain unknown unless explicitly confirmed absent.</div>`;

    return `<section class="roomInsightPanel" data-ri-plus="1">
      <h3>What the records actually tell us</h3>
      <p>Room ${esc(n)} is assessed from its recorded distribution board, dimmer control and outgoing circuit schedule. Missing data is kept separate from confirmed absence.</p>
      <div class="riFacts">
        ${statePill('Distribution board',board?'recorded':'unknown')}
        ${statePill('Dimmer-controlled lighting',dimmerCircuit?'recorded':'unknown')}
        ${statePill('Sockets / general power',sockets?'recorded':'unknown')}
        ${statePill('Non-dimmed lighting',normalLighting?'recorded':'unknown')}
      </div>
      ${coverage}
      ${board && board.upstream_supply ? `<div class="riCoverage good"><b>Recorded supply:</b> ${esc(board.upstream_supply)}</div>` : ''}
      ${circuitHtml}
    </section>`;
  }

  async function enhance(){
    const intelligence = document.querySelector('.roomIntelligence');
    if (!intelligence) return;
    const head = intelligence.querySelector('.roomIntelligenceHead');
    const title = head?.querySelector('h2');
    if (!head || !title || intelligence.querySelector('[data-ri-plus="1"]')) return;

    const room = title.textContent.trim();
    const n = roomNumber(room);
    const key = `${room}|${location.search}|${document.getElementById('globalSearch')?.value || ''}`;
    if (lastKey === key && intelligence.querySelector('[data-ri-plus="1"]')) return;
    lastKey = key;

    addStyles();
    let html;
    try {
      html = n ? await mainHousePanel(room,n) : genericPanel(room);
    } catch (err) {
      console.warn('Room intelligence reasoning unavailable',err);
      html = genericPanel(room);
    }
    head.insertAdjacentHTML('afterend',html);
  }

  const observer = new MutationObserver(() => { enhance(); });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',enhance);
  if (document.readyState !== 'loading') enhance();
})();

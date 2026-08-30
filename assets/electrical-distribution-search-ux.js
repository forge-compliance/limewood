(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const search=document.getElementById('search');
    if(!search)return;

    search.placeholder='Search asset, room, circuit or equipment…';
    search.setAttribute('autocomplete','off');
    search.setAttribute('aria-label','Search electrical assets and circuits');

    const normalise=value=>String(value||'')
      .toLowerCase()
      .replace(/\broom\s*(\d+)\b/g,'room $1')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    const includesQuery=(values,q)=>normalise(values.filter(Boolean).join(' ')).includes(q);

    function findAssetForCircuit(circuit){
      const board=String(circuit?.board_asset_code||'').trim().toLowerCase();
      if(!board)return null;
      return assets.find(a=>
        String(a.asset_code||'').trim().toLowerCase()===board ||
        String(a.asset_name||'').trim().toLowerCase()===board
      )||null;
    }

    function matchingCircuitText(circuit){
      const number=String(circuit.circuit_number||'').trim();
      const description=String(circuit.circuit_description||circuit.destination||'').trim();
      return [number,description].filter(Boolean).join(' · ');
    }

    renderSearch=function(){
      const raw=search.value.trim();
      const q=normalise(raw);
      const finder=$('finder');
      finder.classList.toggle('searching',!!q);

      if(!q){
        $('results').innerHTML='';
        $('resultsMeta').textContent='';
        return;
      }

      const matches=new Map();

      assets.forEach(asset=>{
        if(includesQuery([
          asset.asset_code,asset.asset_name,asset.plant_room,asset.category,
          asset.system_duty,asset.manufacturer,asset.model,asset.status,asset.notes
        ],q)){
          matches.set(asset.id,{asset,circuitMatches:[]});
        }
      });

      circuits.forEach(circuit=>{
        if(!includesQuery([
          circuit.board_asset_code,circuit.circuit_number,circuit.circuit_description,
          circuit.destination,circuit.phase,circuit.protective_device,circuit.device_rating,
          circuit.status,circuit.notes
        ],q))return;

        const asset=findAssetForCircuit(circuit);
        if(!asset)return;
        const existing=matches.get(asset.id)||{asset,circuitMatches:[]};
        existing.circuitMatches.push(circuit);
        matches.set(asset.id,existing);
      });

      const rows=[...matches.values()]
        .sort((a,b)=>String(a.asset.asset_code||'').localeCompare(String(b.asset.asset_code||''),undefined,{numeric:true}))
        .slice(0,80);

      const circuitHitCount=rows.reduce((n,row)=>n+row.circuitMatches.length,0);
      $('resultsMeta').textContent=rows.length
        ? `${rows.length} asset${rows.length===1?'':'s'}${circuitHitCount?` · ${circuitHitCount} circuit match${circuitHitCount===1?'':'es'}`:''}`
        : '0 matches';

      $('results').innerHTML=rows.length?rows.map(({asset:a,circuitMatches})=>{
        const circuitPreview=circuitMatches.slice(0,3).map(c=>
          `<div class="location" style="color:#8a7652">⚡ Circuit match: ${esc(matchingCircuitText(c)||'Matched circuit')}</div>`
        ).join('');
        const more=circuitMatches.length>3?`<div class="location">+ ${circuitMatches.length-3} more matching circuit${circuitMatches.length-3===1?'':'s'}</div>`:'';
        return `<div class="assetCard" data-id="${esc(a.id)}"><div><div class="code">${esc(a.asset_code)}</div><div class="name">${esc(a.asset_name)}</div><div class="location">📍 ${esc(a.plant_room||'Location to confirm')}</div>${circuitPreview}${more}<div class="meta"><span class="pill">${esc(a.category||'Uncategorised')}</span><span class="pill ${esc(String(a.criticality||'').toLowerCase())}">${esc(a.criticality||'Not set')}</span>${canCircuits(a)?`<span class="pill">⚡ ${circuitsFor(a).length}</span>`:''}</div></div><div class="go">›</div></div>`;
      }).join(''):'<div class="empty">No matching electrical assets or circuits.</div>';

      document.querySelectorAll('.assetCard[data-id]').forEach(el=>el.onclick=()=>{
        const asset=assets.find(x=>x.id===el.dataset.id);
        if(asset)openDetail(asset);
      });
    };

    // The page already has its original input listener. This second listener runs
    // afterwards so circuit/destination matches replace the simpler asset-only result.
    search.addEventListener('input',()=>requestAnimationFrame(renderSearch));

    if(search.value.trim())renderSearch();
  });
})();
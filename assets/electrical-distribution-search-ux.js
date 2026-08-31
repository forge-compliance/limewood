(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const search=document.getElementById('search');
    if(!search)return;

    search.placeholder='Search asset, room, circuit or equipment…';
    search.setAttribute('autocomplete','off');
    search.setAttribute('aria-label','Search electrical assets and circuits');\n\n    // SMART_SEARCH_URL_PREFILL_20260831\n    const requestedSearch=new URLSearchParams(location.search).get('search')||new URLSearchParams(location.search).get('asset')||'';\n    if(requestedSearch&&!search.value)search.value=requestedSearch;

    const normalise=value=>String(value||'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    const includesQuery=(values,q)=>normalise(values.filter(Boolean).join(' ')).includes(q);

    const roomNumberFromQuery=raw=>{
      const s=normalise(raw);
      let m=s.match(/\b(?:room|bedroom)\s*0*(\d{1,3})\b/);
      if(m)return String(Number(m[1]));
      m=s.match(/^mh\s*0*(\d{1,3})$/);
      return m?String(Number(m[1])):'';
    };

    const mainHouseGroupMatch=(asset,n)=>{
      if(!n)return false;
      const code=String(asset?.asset_code||'').trim().toUpperCase();
      const name=normalise(asset?.asset_name||'');
      const rx=new RegExp(`^MH-(?:DB|DIM)-0*${n}(?:[A-Z])?$`,'i');
      return rx.test(code) || name.includes(`mh${n}`) || name.includes(`dimmer ${n}`);
    };

    const circuitRoomMatch=(circuit,n)=>{
      if(!n)return false;
      const text=normalise([
        circuit?.circuit_description,circuit?.destination,circuit?.notes
      ].filter(Boolean).join(' '));
      return new RegExp(`\\b(?:room|bedroom)\\s*0*${n}\\b`,'i').test(text);
    };

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
      const roomNumber=roomNumberFromQuery(raw);
      const finder=$('finder');
      finder.classList.toggle('searching',!!q);

      if(!q){
        $('results').innerHTML='';
        $('resultsMeta').textContent='';
        return;
      }

      const matches=new Map();
      const add=(asset,reason='',circuit=null)=>{
        if(!asset)return;
        const existing=matches.get(asset.id)||{asset,circuitMatches:[],reasons:[]};
        if(circuit && !existing.circuitMatches.includes(circuit))existing.circuitMatches.push(circuit);
        if(reason && !existing.reasons.includes(reason))existing.reasons.push(reason);
        matches.set(asset.id,existing);
      };

      assets.forEach(asset=>{
        if(includesQuery([
          asset.asset_code,asset.asset_name,asset.plant_room,asset.category,
          asset.system_duty,asset.manufacturer,asset.model,asset.status,asset.notes
        ],q)) add(asset,'Direct match');

        if(roomNumber && mainHouseGroupMatch(asset,roomNumber)){
          add(asset,`Main House Room ${roomNumber} group`);
        }
      });

      circuits.forEach(circuit=>{
        const direct=includesQuery([
          circuit.board_asset_code,circuit.circuit_number,circuit.circuit_description,
          circuit.destination,circuit.phase,circuit.protective_device,circuit.device_rating,
          circuit.status,circuit.notes
        ],q);
        const roomHit=roomNumber && circuitRoomMatch(circuit,roomNumber);
        if(!direct && !roomHit)return;

        const asset=findAssetForCircuit(circuit);
        if(!asset)return;
        add(asset,roomHit?`Supplies Room ${roomNumber}`:'Circuit match',circuit);
      });

      if(roomNumber){
        circuits.forEach(circuit=>{
          const asset=findAssetForCircuit(circuit);
          if(asset && mainHouseGroupMatch(asset,roomNumber)) add(asset,`Main House Room ${roomNumber} group`,circuit);
        });
      }

      const rows=[...matches.values()]
        .sort((a,b)=>{
          const ar=a.reasons.some(r=>r.startsWith('Supplies'))?0:a.reasons.includes('Direct match')?1:a.reasons.some(r=>r.includes('group'))?2:3;
          const br=b.reasons.some(r=>r.startsWith('Supplies'))?0:b.reasons.includes('Direct match')?1:b.reasons.some(r=>r.includes('group'))?2:3;
          return ar-br || String(a.asset.asset_name||'').localeCompare(String(b.asset.asset_name||''),undefined,{numeric:true});
        })
        .slice(0,80);

      const circuitHitCount=rows.reduce((n,row)=>n+row.circuitMatches.length,0);
      $('resultsMeta').textContent=rows.length
        ? `${rows.length} result${rows.length===1?'':'s'}${circuitHitCount?` · ${circuitHitCount} related circuit${circuitHitCount===1?'':'s'}`:''}`
        : '0 matches';

      $('results').innerHTML=rows.length?rows.map(({asset:a,circuitMatches,reasons})=>{
        const reason=reasons.find(r=>r.startsWith('Supplies')) || reasons.find(r=>r.includes('group')) || (reasons.includes('Direct match')?'Direct match':'Circuit match');
        const reasonLine=reason && reason!=='Direct match'?`<div class="location" style="color:#9f8753;font-weight:700">⚡ ${esc(reason)}</div>`:'';
        const usefulCircuits=circuitMatches.filter(c=>normalise(c.circuit_description||c.destination)!=='spare');
        const circuitPreview=usefulCircuits.slice(0,3).map(c=>
          `<div class="location" style="color:#8a7652">↳ ${esc(matchingCircuitText(c)||'Matched circuit')}</div>`
        ).join('');
        const more=usefulCircuits.length>3?`<div class="location">+ ${usefulCircuits.length-3} more related circuit${usefulCircuits.length-3===1?'':'s'}</div>`:'';
        return `<div class="assetCard" data-id="${esc(a.id)}"><div><div class="name" style="font-size:15px">${esc(a.asset_name)}</div><div class="location">${esc(a.plant_room||'Location to confirm')}</div>${reasonLine}${circuitPreview}${more}<div class="meta"><span class="pill">${esc(a.category||'Uncategorised')}</span><span class="pill ${esc(String(a.criticality||'').toLowerCase())}">${esc(a.criticality||'Not set')}</span>${canCircuits(a)?`<span class="pill">⚡ ${circuitsFor(a).length}</span>`:''}</div></div><div class="go">›</div></div>`;
      }).join(''):'<div class="empty">No matching electrical assets or circuits.</div>';

      document.querySelectorAll('.assetCard[data-id]').forEach(el=>el.onclick=()=>{
        const asset=assets.find(x=>x.id===el.dataset.id);
        if(asset)openDetail(asset);
      });
    };

    search.addEventListener('input',()=>requestAnimationFrame(renderSearch));
    if(search.value.trim())renderSearch();
  });
})();
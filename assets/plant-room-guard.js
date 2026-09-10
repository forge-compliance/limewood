/* Limewood plant-room guard
   Keeps ordinary rooms/areas out of Plant Room counts and selectors.
   Plant rooms are now taken from the authoritative Supabase plant_rooms table,
   rather than inferred from asset locations. */
(() => {
  'use strict';

  const normalise = value => String(value || '').replace(/\s+/g, ' ').trim();
  const cfg = window.LIMEWOOD_CONFIG || {};
  let genuineRooms = new Set();
  let genuineCanonical = new Map();
  let observing = false;

  function canonicalRoom(value){
    const raw = normalise(value);
    if(!raw) return '';
    const key = raw.toLowerCase();

    if([
      'forest cottage plant room',
      'forest lodges plant room',
      'forest lodge plant room',
      'forest cottage & lodges plant room'
    ].includes(key)) return 'Forest Cottage & Lodges Plant Room';

    if(key === 'cresent plant room') return 'Crescent Plant Room';

    return raw;
  }

  function roomKey(value){
    return canonicalRoom(value).toLowerCase();
  }

  function roomNameFromButton(button){
    return button?.dataset?.selectPlantRoom ||
      button?.dataset?.hubRoom ||
      button?.dataset?.room ||
      '';
  }

  function setDatasetIfChanged(button, key, value){
    if(button.dataset[key] !== undefined && button.dataset[key] !== value){
      button.dataset[key] = value;
    }
  }

  function cleanPlantRoomButtons(){
    document.querySelectorAll('#plantRoomNav button, [data-select-plant-room]').forEach(button => {
      const name = roomNameFromButton(button);
      if(!name) return;
      const key = roomKey(name);
      if(!genuineRooms.has(key)) {
        button.remove();
        return;
      }

      const canonical = genuineCanonical.get(key) || canonicalRoom(name);
      if(button.dataset.selectPlantRoom !== undefined) setDatasetIfChanged(button, 'selectPlantRoom', canonical);
      if(button.dataset.hubRoom !== undefined) setDatasetIfChanged(button, 'hubRoom', canonical);
      if(button.dataset.room !== undefined) setDatasetIfChanged(button, 'room', canonical);

      const label = button.querySelector('b');
      const wantedLabel = canonical.replace(/ Plant Room$/i,'');
      if(label && label.textContent !== wantedLabel) label.textContent = wantedLabel;
    });
  }

  function cleanRoomSelect(){
    const select = document.getElementById('room');
    if(!select) return;

    [...select.options].forEach(option => {
      if(!option.value) return;
      const key = roomKey(option.value);
      if(!genuineRooms.has(key)) {
        option.remove();
        return;
      }
      const canonical = genuineCanonical.get(key) || canonicalRoom(option.value);
      if(option.value !== canonical) option.value = canonical;
      if(option.textContent !== canonical) option.textContent = canonical;
    });

    const seen = new Set();
    [...select.options].forEach(option => {
      if(!option.value) return;
      const key = roomKey(option.value);
      if(seen.has(key)) option.remove();
      else seen.add(key);
    });
  }

  function cleanOtherPlantRoomSelectors(){
    const selectorIds = [
      'ppmRoom','ppmAddRoom','valveRoom','vRoom','valveImportRoom',
      'dPlantRoom'
    ];

    selectorIds.forEach(id => {
      const select = document.getElementById(id);
      if(!select) return;

      [...select.options].forEach(option => {
        if(!option.value) return;
        const key = roomKey(option.value);
        if(!genuineRooms.has(key)) {
          option.remove();
        } else {
          const canonical = genuineCanonical.get(key) || canonicalRoom(option.value);
          if(option.value !== canonical) option.value = canonical;
          if(option.textContent !== canonical) option.textContent = canonical;
        }
      });
    });
  }

  function authoritativeCount(){
    return new Set([...genuineCanonical.values()].map(canonicalRoom).filter(Boolean)).size;
  }

  function fixCounts(){
    const count = authoritativeCount();
    if(!count) return;

    const metric = document.getElementById('metricPlantRoomCount');
    const quality = document.getElementById('roomsCount');
    const text = String(count);
    if(metric && metric.textContent !== text) metric.textContent = text;
    if(quality && quality.textContent !== text) quality.textContent = text;
  }

  function observe(){
    if(observing || !document.body) return;
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
    observing = true;
  }

  function enforce(){
    if(!genuineRooms.size) return;

    // The guard itself edits text/options. Disconnect while enforcing so those
    // edits do not trigger an endless MutationObserver feedback loop.
    if(observing){
      observer.disconnect();
      observing = false;
    }

    try {
      cleanRoomSelect();
      cleanOtherPlantRoomSelectors();
      cleanPlantRoomButtons();
      fixCounts();
    } finally {
      observe();
    }
  }

  let queued = false;
  function schedule(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enforce();
    });
  }

  const observer = new MutationObserver(schedule);

  async function loadAuthoritativeRooms(){
    try {
      if(!window.supabase || !cfg.supabaseUrl || !cfg.supabasePublishableKey) {
        throw new Error('Supabase configuration unavailable');
      }

      const client = window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabasePublishableKey,
        {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}
      );

      const {data,error} = await client
        .from('plant_rooms')
        .select('name')
        .order('name');

      if(error) throw error;

      genuineRooms = new Set();
      genuineCanonical = new Map();

      for(const row of data || []) {
        const canonical = canonicalRoom(row.name);
        const key = canonical.toLowerCase();
        if(!key) continue;
        genuineRooms.add(key);
        genuineCanonical.set(key, canonical);
      }

      /* Preserve historic aliases while mapping them to the one real room. */
      if(genuineRooms.has('forest cottage & lodges plant room')) {
        [
          'forest cottage plant room',
          'forest lodges plant room',
          'forest lodge plant room'
        ].forEach(alias => {
          genuineRooms.add(alias);
          genuineCanonical.set(alias, 'Forest Cottage & Lodges Plant Room');
        });
      }

      enforce();
    } catch(error) {
      console.warn('Plant-room guard could not load authoritative rooms:', error);
    }
  }

  function start(){
    observe();
    loadAuthoritativeRooms();
    setTimeout(enforce, 500);
    setTimeout(enforce, 1500);
    setTimeout(enforce, 3000);
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();

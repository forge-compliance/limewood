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

  function isGenuinePlantRoom(value){
    const key = roomKey(value);
    return Boolean(key && genuineRooms.has(key));
  }

  function roomNameFromButton(button){
    return button?.dataset?.selectPlantRoom ||
      button?.dataset?.hubRoom ||
      button?.dataset?.room ||
      '';
  }

  function discoveredRooms(){
    return [...genuineCanonical.values()].sort((a,b)=>a.localeCompare(b));
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

      const canonical = genuineCanonical.get(key);
      if(button.dataset.selectPlantRoom) button.dataset.selectPlantRoom = canonical;
      if(button.dataset.hubRoom) button.dataset.hubRoom = canonical;
      if('room' in button.dataset) button.dataset.room = canonical;

      const label = button.querySelector('b');
      if(label) label.textContent = canonical.replace(/ Plant Room$/i,'');
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
      const canonical = genuineCanonical.get(key);
      option.value = canonical;
      option.textContent = canonical;
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
        if(!genuineRooms.has(key)) option.remove();
        else {
          const canonical = genuineCanonical.get(key);
          option.value = canonical;
          option.textContent = canonical;
        }
      });
    });
  }

  function fixCounts(){
    const count = genuineRooms.size;
    if(!count) return;

    const metric = document.getElementById('metricPlantRoomCount');
    const quality = document.getElementById('roomsCount');
    if(metric) metric.textContent = String(count);
    if(quality) quality.textContent = String(count);
  }

  function enforce(){
    if(!genuineRooms.size) return;
    cleanRoomSelect();
    cleanOtherPlantRoomSelectors();
    cleanPlantRoomButtons();
    fixCounts();
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
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
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

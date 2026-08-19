/* Limewood plant-room guard
   Keeps ordinary rooms/areas out of Plant Room counts and selectors.
   The core app still owns the data; this only enforces the UI boundary. */
(() => {
  'use strict';

  const normalise = value => String(value || '').replace(/\s+/g, ' ').trim();

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

  function isGenuinePlantRoom(value){
    return /\bplant\s*room$/i.test(canonicalRoom(value));
  }

  function roomNameFromButton(button){
    return button?.dataset?.selectPlantRoom ||
      button?.dataset?.hubRoom ||
      button?.dataset?.room ||
      '';
  }

  function discoveredRooms(){
    const values = [];

    document.querySelectorAll('#room option').forEach(o => {
      if(o.value) values.push(o.value);
    });

    document.querySelectorAll('#plantRoomNav button, [data-select-plant-room]').forEach(b => {
      const name = roomNameFromButton(b);
      if(name) values.push(name);
    });

    return [...new Set(values
      .map(canonicalRoom)
      .filter(isGenuinePlantRoom))];
  }

  function cleanPlantRoomButtons(){
    document.querySelectorAll('#plantRoomNav button, [data-select-plant-room]').forEach(button => {
      const name = roomNameFromButton(button);
      if(name && !isGenuinePlantRoom(name)) button.remove();
    });
  }

  function cleanRoomSelect(){
    const select = document.getElementById('room');
    if(!select) return;

    [...select.options].forEach(option => {
      if(!option.value) return;
      if(!isGenuinePlantRoom(option.value)) option.remove();
    });

    const seen = new Set();
    [...select.options].forEach(option => {
      if(!option.value) return;
      const canonical = canonicalRoom(option.value);
      const key = canonical.toLowerCase();
      if(seen.has(key)) {
        option.remove();
      } else {
        seen.add(key);
        option.value = canonical;
        option.textContent = canonical;
      }
    });
  }

  function fixCounts(){
    const rooms = discoveredRooms();
    if(!rooms.length) return;

    const metric = document.getElementById('metricPlantRoomCount');
    const quality = document.getElementById('roomsCount');
    if(metric) metric.textContent = String(rooms.length);
    if(quality) quality.textContent = String(rooms.length);
  }

  function enforce(){
    cleanRoomSelect();
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

  function start(){
    enforce();
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
    setTimeout(enforce, 250);
    setTimeout(enforce, 1000);
    setTimeout(enforce, 2500);
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();

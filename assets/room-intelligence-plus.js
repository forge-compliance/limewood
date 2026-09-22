// Retired 2026-09-22. Remove the verbose room reasoning panels if an older cached loader still requests this file.
(() => {
  'use strict';
  function removePanels(){
    document.querySelectorAll('[data-ri-plus="1"], .roomInsightPanel').forEach(el => el.remove());
    const style = document.getElementById('roomIntelligencePlusStyle');
    if (style) style.remove();
  }
  removePanels();
  const observer = new MutationObserver(removePanels);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',removePanels);
})();

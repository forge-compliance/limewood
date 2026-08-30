(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const actions=document.querySelector('.actions');
    const signOut=document.getElementById('signOutBtn');
    const refreshTop=document.getElementById('refreshTop');
    const refreshBtn=document.getElementById('refreshBtn');
    const mode=document.querySelector('.mode');
    const room=document.getElementById('roomFilter');
    const cat=document.getElementById('categoryFilter');
    const pri=document.getElementById('priorityFilter');
    const assetPanel=document.getElementById('assetPanel');
    const circuitPanel=document.getElementById('circuitPanel');
    const search=document.getElementById('search');
    const resultCount=document.getElementById('resultCount');
    const panelHead=document.querySelector('.panelHead');

    signOut?.remove();
    refreshTop?.remove();
    refreshBtn?.remove();

    if(actions){
      const back=document.getElementById('backBtn');
      if(back && !actions.contains(back)) actions.prepend(back);
      actions.classList.add('friendlyActions');
    }
    document.querySelector('.topRow .backBtn')?.remove();

    room?.remove();
    cat?.remove();
    pri?.remove();
    mode?.remove();

    if(panelHead){
      const hint=document.createElement('div');
      hint.className='searchHint';
      hint.textContent='Start typing to find an asset';
      panelHead.appendChild(hint);
    }

    if(search){
      search.placeholder='Search by asset name, code or location…';
      search.setAttribute('autocomplete','off');
      search.setAttribute('aria-label','Search electrical assets');
    }

    const filters=document.querySelector('.filters');
    if(filters){
      filters.classList.add('searchOnly');
      const icon=document.createElement('span');
      icon.className='searchIcon';
      icon.textContent='⌕';
      filters.prepend(icon);
    }

    const hasQuery=()=>Boolean(search?.value.trim());
    const syncVisibility=()=>{
      const show=hasQuery();
      if(assetPanel) assetPanel.hidden=!show;
      if(circuitPanel) circuitPanel.hidden=true;
      document.body.classList.toggle('hasElectricalSearch',show);
      if(resultCount) resultCount.style.visibility=show?'visible':'hidden';
      document.querySelector('.searchHint')?.classList.toggle('hide',show);
    };

    search?.addEventListener('input',()=>requestAnimationFrame(syncVisibility));
    setTimeout(syncVisibility,0);
  });
})();
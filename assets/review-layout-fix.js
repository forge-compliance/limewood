(() => {
  'use strict';

  const css = document.createElement('style');
  css.textContent = `
    #grid.reviewCompactGrid{
      display:grid !important;
      grid-template-columns:repeat(auto-fill,minmax(210px,1fr)) !important;
      gap:10px !important;
      align-items:start;
    }
    #grid.reviewCompactGrid .card{
      min-height:0 !important;
      padding:0 !important;
      border-radius:12px !important;
      overflow:hidden;
      box-shadow:0 4px 12px rgba(23,55,44,.06) !important;
    }
    #grid.reviewCompactGrid .card > img{
      display:none !important;
    }
    #grid.reviewCompactGrid .cardBody{
      padding:11px 12px !important;
    }
    #grid.reviewCompactGrid .topline{
      margin-bottom:6px !important;
      gap:6px !important;
      align-items:center;
    }
    #grid.reviewCompactGrid .badge,
    #grid.reviewCompactGrid .status{
      font-size:10px !important;
      padding:4px 7px !important;
      line-height:1.1 !important;
    }
    #grid.reviewCompactGrid h4{
      margin:4px 0 5px !important;
      font-size:14px !important;
      line-height:1.25 !important;
    }
    #grid.reviewCompactGrid .meta{
      font-size:11px !important;
      line-height:1.25 !important;
      margin:0 !important;
    }
    @media (max-width:620px){
      #grid.reviewCompactGrid{
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        gap:8px !important;
      }
      #grid.reviewCompactGrid .cardBody{padding:9px 10px !important;}
      #grid.reviewCompactGrid h4{font-size:13px !important;}
    }
  `;
  document.head.appendChild(css);

  function setReviewMode(on){
    const grid=document.getElementById('grid');
    if(!grid) return;
    grid.classList.toggle('reviewCompactGrid', !!on);
  }

  function wire(){
    const review=document.getElementById('priorityReview');
    const grid=document.getElementById('grid');
    if(!review || !grid) return;

    review.addEventListener('click',()=>{
      requestAnimationFrame(()=>setReviewMode(true));
    });

    [
      'priorityMissing','priorityCritical','metricAssets','quickEstateRegister','quickPlantRooms'
    ].forEach(id=>{
      document.getElementById(id)?.addEventListener('click',()=>setReviewMode(false));
    });

    document.getElementById('drawerNav')?.addEventListener('click',()=>setReviewMode(false));
    document.getElementById('room')?.addEventListener('change',()=>setReviewMode(false));
    document.getElementById('category')?.addEventListener('change',()=>setReviewMode(false));
    document.getElementById('completeness')?.addEventListener('change',()=>setReviewMode(false));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
})();
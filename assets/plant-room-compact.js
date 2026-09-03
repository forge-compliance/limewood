/* Compact Plant Room Hub tiles for minimal scrolling, especially on mobile. */
(() => {
  const style = document.createElement('style');
  style.id = 'lw-plant-room-compact';
  style.textContent = `
    #plantRoomHubView .plantHubHero {
      padding-top: 16px;
      padding-bottom: 14px;
      margin-bottom: 10px;
    }
    #plantRoomHubView .plantHubHero h2 { margin: 4px 0 3px; }
    #plantRoomHubView .plantHubHero p { margin: 0 0 10px; }
    #plantRoomHubView .plantHubSearch { margin-top: 8px; }

    #plantRoomHubView .plantHubStats {
      gap: 8px;
      margin: 10px 0;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    #plantRoomHubView .plantHubStats article {
      min-height: 0;
      padding: 9px 8px;
    }
    #plantRoomHubView .plantHubStats article b { font-size: 1.25rem; }
    #plantRoomHubView .plantHubStats article span { font-size: .72rem; }

    #plantRoomHubView .plantHubGrid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    #plantRoomHubView .plantHubGrid button {
      min-height: 78px;
      padding: 9px 7px;
      gap: 2px;
      border-radius: 13px;
    }
    #plantRoomHubView .plantHubGrid button > span {
      font-size: 1.15rem;
      line-height: 1;
      margin-bottom: 2px;
    }
    #plantRoomHubView .plantHubGrid button > b {
      font-size: .82rem;
      line-height: 1.08;
    }
    #plantRoomHubView .plantHubGrid button > small {
      font-size: .64rem;
      line-height: 1.1;
      opacity: .78;
    }

    @media (max-width: 760px) {
      #plantRoomHubView .plantHubHero { padding: 12px 12px 10px; }
      #plantRoomHubView .plantHubHero .eyebrow,
      #plantRoomHubView .plantHubHero > p { display: none; }
      #plantRoomHubView .plantHubHero h2 { font-size: 1.35rem; }
      #plantRoomHubView .plantHubSearch { margin-top: 7px; }

      #plantRoomHubView .plantHubStats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 5px;
        margin: 7px 0;
      }
      #plantRoomHubView .plantHubStats article {
        padding: 7px 3px;
        border-radius: 11px;
      }
      #plantRoomHubView .plantHubStats article b { font-size: 1.05rem; }
      #plantRoomHubView .plantHubStats article span { font-size: .62rem; }

      #plantRoomHubView .plantHubGrid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 7px;
      }
      #plantRoomHubView .plantHubGrid button {
        min-height: 66px;
        padding: 7px 4px;
        border-radius: 11px;
      }
      #plantRoomHubView .plantHubGrid button > span { font-size: 1rem; }
      #plantRoomHubView .plantHubGrid button > b { font-size: .74rem; }
      #plantRoomHubView .plantHubGrid button > small { display: none; }
    }

    @media (max-width: 390px) {
      #plantRoomHubView .plantHubGrid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      #plantRoomHubView .plantHubGrid button {
        min-height: 62px;
      }
    }
  `;
  document.head.appendChild(style);
})();

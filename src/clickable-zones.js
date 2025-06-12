let lastVideoTitle = null;

function monitorMainPanelForPlayer() {
  const playerClassPrefix = 'live-stream-player_live-stream-player';
  const titleClassPrefix = 'live-stream-player_name';
  const clickableZonesPrefix = 'clickable-zones_clickable-zones';

  const attachVideoEvent = () => {  
    const video = document.getElementById('hls-stream-player');
    if (!video) return;

    // Avoid attaching multiple times
    if (video.dataset.listenerAttached) return;
    video.dataset.listenerAttached = 'true';

    video.addEventListener('playing', () => {
      const clickableZonesClass = getFullClassNameStartsWith(clickableZonesPrefix);
      if (clickableZonesClass) {
        const adminMessage = new CustomEvent("toastopen", {
          detail: JSON.stringify({
            message: "Clickable zone detected",
            header: "Fishtank Live Extended",
            duration: 5000,
            id: "ftl-ext-clickable-zone-"+Date.now()
          })
        });
        document.dispatchEvent(adminMessage);
      }
    });
  };

  const checkForPlayer = () => {
    const playerClass = getFullClassNameStartsWith(playerClassPrefix);
    const titleClass = getFullClassNameStartsWith(titleClassPrefix);

    // Check for grid return BEFORE exiting early
    if (!playerClass && lastVideoTitle !== null) {
      lastVideoTitle = null;

      if (SETTINGS.autoApplyChatFilters) {
        currentFilter = 'All';
        updateActiveClass();
        applyChatFilterToAll();
      }
      return;
    }

    if (!playerClass || !titleClass) return;

    const player = mainPanel.querySelector(`.${playerClass}`);

    const titleElement = player?.querySelector(`.${titleClass}`);
    const currentTitle = titleElement?.textContent?.trim();

    if (currentTitle && currentTitle !== lastVideoTitle) {
      lastVideoTitle = currentTitle;

      if (SETTINGS.autoApplyChatFilters) {
        currentFilter = currentTitle;
        appendGridNamesToDropdown(filterOptions);
        updateActiveClass();
        applyChatFilterToAll();
      }

      // Wait a little to allow DOM to catch up and video tag to appear
      setTimeout(attachVideoEvent, 500);
    }
  };

  const mainPanel = document.getElementById('main-panel');
  if (!mainPanel) {
    console.warn('❌ main-panel not found');
    return;
  }

  checkForPlayer();

  const observer = new MutationObserver(() => {
    checkForPlayer();
  });

  observer.observe(mainPanel, {
    childList: true,
    subtree: true,
  });
}

const waitForMainPanel = setInterval(() => {
  const panel = document.getElementById('main-panel');
  if (panel) {
    clearInterval(waitForMainPanel);
    monitorMainPanelForPlayer();
  }
}, 100);
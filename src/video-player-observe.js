let lastVideoTitle = null;

// Video player detected, wait for it to start playing then check for clickable zones
function attachVideoEvent(object) {  
  const video = object.getElementById('hls-stream-player');
  if (!video) return;

  // Avoid attaching multiple times
  if (video.dataset.listenerAttached) return;
  video.dataset.listenerAttached = 'true';

  video.addEventListener('playing', () => {
	if (SETTINGS.disableClickableZones) return;
    const clickableZone = getObjectFromClassNamePrefix('clickable-zones_clickable-zones', object);
    if (clickableZone) {
      const adminMessage = new CustomEvent("toastopen", {
        detail: JSON.stringify({
          message: "Clickable zone detected",
          header: "Fishtank Live Extended",
          duration: 5000,
          id: "ftl-ext-clickable-zone-"+Date.now()
        })
      });
      document.dispatchEvent(adminMessage);
	  
	  // Trigger resize event to re-draw clickable zones, which fixes zones with 0 values
	  window.dispatchEvent(new Event('resize'));
	  
	  // Add hover pointer to the clickable zone
	  clickableZone.style.cursor = 'pointer';
    }
  });
};

// If the video player is on screen, get the title of the stream, attachVideoEvent listener
function checkForPlayer(object) {
  const player = getObjectFromClassNamePrefix('live-stream-player_live-stream-player', object);
  const title = getObjectFromClassNamePrefix('live-stream-player_name', object);

  // User was watching video stream but now no longer is
  if (!player && lastVideoTitle !== null) {
    lastVideoTitle = null;

	// If setting is on, set the filter back to 'All' as no longer watching video
    if (SETTINGS.autoApplyChatFilters) {
      currentFilter = 'All';
      updateActiveClass();
      applyChatFilterToAll();
    }
    return;
  }

  if (!player || !title) return;

  const currentTitle = title?.textContent?.trim();

  if (currentTitle && currentTitle !== lastVideoTitle) {
    lastVideoTitle = currentTitle;

	// If setting is on, set the filter to current stream
    if (SETTINGS.autoApplyChatFilters) {
      currentFilter = currentTitle;
      appendGridNamesToDropdown(filterOptions);
      updateActiveClass();
      applyChatFilterToAll();
    }

    // Wait a little to allow DOM to catch up and video tag to appear
    setTimeout(attachVideoEvent(object), 500);
  }
};
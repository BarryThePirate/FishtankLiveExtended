let lastVideoTitle = null;

function checkClickableZones(clickableZones) {
  if (SETTINGS.disableUnhidingClickableZones) return;
  if (! clickableZones) return;
  const polygons = clickableZones.querySelectorAll('polygon');
  polygons.forEach(polygon => {
    if (polygon.classList.length === 0) {
  	  if (SETTINGS.clickableZoneUnhide) polygon.classList.add('ftl-ext-clickable-zone-hidden');
	  if (SETTINGS.clickableZoneAlerts) adminMessage("Hidden Clickable Zone Has Been Unhidden", 'Fishtank Live Extended', "ftl-ext-clickable-zone");
    }
	// Trigger resize event to re-draw clickable zones, which usually fixes zones with 0 values
	window.dispatchEvent(new Event('resize'));
  });
}

// If the video player is on screen, get the title of the stream, attachVideoEvent listener
function checkForPlayer(object) {
  // Fallback if somehow the video player wasn't passed into this function
  let player = null;
  if (object && object.classList.contains(getClassNameFromPrefix('live-stream-player_live-stream-player'))) {
    player = object;
  } else {
	player = getObjectFromClassNamePrefix('live-stream-player_live-stream-player');
  }
  
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
	observeObjectForTarget(player, 'clickable-zones_clickable-zones', checkClickableZones, false);
	
	const playerContainer = getObjectFromClassNamePrefix('live-stream-player_container');
	if (! playerContainer) return;
	observeObject(playerContainer, resizeVideo, false, true);
  }
};
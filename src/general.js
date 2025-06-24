function theatreModeCheck(object) {
  if (! SETTINGS.theatreModeImproved) return;
	
  if (getClassNameFromObjectWithPrefix('chat_cinema', object, false)) {
	if (DEBUGGING) console.log('Theatre mode detected');
    object.classList.add('ftl-ext-theatre-mode-chat-box');
  } else {
    object.classList.remove('ftl-ext-theatre-mode-chat-box');
  }
  resizeVideo();
  window.dispatchEvent(new Event('resize'));
}
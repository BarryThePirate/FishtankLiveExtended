/**
 * Load the settings
 * If no saved settings, use setting defaults
 */
function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
  let parsed = {};

  try {
    parsed = saved ? JSON.parse(saved) : {};
  } catch {
    console.warn("[⚠️] Failed to parse saved settings. Using defaults.");
  }

  const settings = {};
  for (const def of settingDefinitions) {
    settings[def.key] = parsed.hasOwnProperty(def.key)
      ? parsed[def.key]
      : def.defaultValue;
  }

  return settings;
}
SETTINGS = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(SETTINGS));
	if (DEBUGGING) console.log("💾 Settings saved");
  } catch (e) {
    console.error("[❌] Failed to save settings:", e);
  }
}

function updateSetting(key, value) {
  if (SETTINGS.hasOwnProperty(key)) {
    SETTINGS[key] = value;
    saveSettings();
	
	// Look up the setting definition to check for onChange
    const def = settingDefinitions.find(s => s.key === key);
    if (def?.onChange) {
      def.onChange(); // Call the function
    }
  } else {
    console.warn(`[⚠️] Tried to update unknown setting: ${key}`);
  }
}

/**
 * Check if we should be rendering for mobile
 */
if (screen.width < 800) MOBILE = true;

/**
 * Get crafting recipes
 * Make the crafting recipes base64: console.log(btoa(JSON.stringify([])));
 */
async function loadRecipesFromRemote(url) {
  try {
    const response = await fetch(url);
    const base64Text = await response.text();
	return JSON.parse(atob(base64Text));
  } catch (err) {
    console.error("Failed to load or decode recipes:", err);
	console.warn('Using offline version of recipes (may be outdated)');
	const base64Text = OFFLINE_CRAFTING_RECIPES;
	return JSON.parse(atob(base64Text));
  }
}

loadRecipesFromRemote(RECIPE_URL).then(data => {
  CRAFTING_RECIPES = data;
});

function recordUsername (object) {
  if (object.innerHTML !== '') {
    USERNAME = object.innerHTML;
	USER_ID = object.dataset.userId;
  }
}

/**
 * Handlers for when new chat message appears
 */
function chatMessagesMutationObserved(message) {
  applyAntiSpam(message);
  applyChatFilter(message);
  logStaffMessage(message);
  logPing(message);
  logTts(message);
  logSfx(message);
  contributors(message);
}

function observeChatMessages() {
  const object = document.getElementById('chat-messages');
  if (object) observeAddedElements(object, chatMessagesMutationObserved);
}

// Wait a couple of seconds for dom to render, then attach listener to chat box classes
setTimeout(() => {
  // TODO - think of way to put this into the below observers
  const chatBox = getObjectFromClassNamePrefix('chat_chat');
  if (chatBox) observeRootObjectClasses(chatBox, theatreModeCheck, true, true);
}, 2000);

/**
 * Run the observers to get the data we need and setup sub observers
 * Once all sub observers are setup, stop observing document.body for efficiency
 */
const watchingFor = [
  { 
    // Capture username
	parentPrefix: 'top-bar_top-bar',
	parentName: null,
	targetPrefix: 'top-bar-user_display-name',
	then: recordUsername,
	stopObservingWhenFound: false,
  },
  {
	// Add FTL Ext Settings button
	parentPrefix: 'top-bar_top-bar',
	parentName: null,
	targetPrefix: 'top-bar-user_dropdown',
	then: createCustomButton,
	stopObservingWhenFound: false,
  },
  {
	// Anti-spam & filtering on new chat messages
	parentPrefix: 'chat_chat',
	parentName: null,
	targetPrefix: 'chat-messages_chat-messages',
	then: observeChatMessages,
	stopObservingWhenFound: true,
  },
  {
	// Capture original chat dropdown options
	parentPrefix: 'chat-room-selector_chat-room-selector',
	parentName: null,
	targetPrefix: 'select_options',
	then: saveDropdownOptions,
	stopObservingWhenFound: true,
  },
  {
	// Observe chat dropdown opening
	parentPrefix: 'chat-room-selector_chat-room-selector',
	parentName: null,
	targetPrefix: 'select_options',
	then: observeDropdownOpen,
	stopObservingWhenFound: false,
  },
  {
	// Add stream names to chat dropdown for filtering
	parentPrefix: 'main-panel_main-panel',
	parentName: null,
	targetPrefix: 'live-streams_live-streams-grid',
	then: observeStreamGrid,
	stopObservingWhenFound: false,
  },
  {
	// Add stream names to chat dropdown for filtering
	parentPrefix: 'main-panel_main-panel',
	parentName: null,
	targetPrefix: 'live-stream-player_live-stream-player',
	then: checkForPlayer,
	stopObservingWhenFound: false,
  },
];

const mainObserver = new MutationObserver(() => {
  watchingFor.forEach(find => {
    if (!find.parentName) {
      find.parentName = getClassNameFromPrefix(find.parentPrefix);
	  const object = getObjectFromClassNamePrefix(find.parentPrefix);
	  if (object) {
		observeObjectForTarget(object, find.targetPrefix, find.then, find.stopObservingWhenFound);
	  }
    }
  });
 
  // Check if we have all the classes now
  if (watchingFor.every(find => find.parentName)) {
	if (DEBUGGING) console.log('Main observations seen -- disconnecting');
	mainObserver.disconnect();
	clearTimeout(observerTimeout);
  }
});

const observerTimeout = setTimeout(() => {
  if (mainObserver) {
    mainObserver.disconnect();
    console.warn("[⏱️] FTL EXT Main observer timed out after 30s. Some features may not be initialized.");
  }
}, 30000);

mainObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

/**
 * Apply unique styling to contributors in chat.
 * Wrap any matching contributor‐username in a pulser <span>.
 */
function contributors(message) {
  // find the <span class="..._user__..."> container
  const userContainer = getObjectFromClassNamePrefix('chat-message-default_user', message);
  if (!userContainer) return;

  // grab the raw text node (i.e. skip any <span class="..._clan__..."> inside)
  const textNode = Array.from(userContainer.childNodes)
    .find(n => n.nodeType === Node.TEXT_NODE);
  if (!textNode) return;

  const name = textNode.textContent.trim();
  // case‐insensitive match against your CONTRIBUTORS list
  const isContributor = CONTRIBUTORS
    .some(u => u.toLowerCase() === name.toLowerCase());
  if (!isContributor) return;

  // wrap the username in a span with pulser effect class
  const pulse = document.createElement('span');
  pulse.className = 'ftl-ext-text-pulser';
  pulse.textContent = name;

  userContainer.replaceChild(pulse, textNode);
}

/**
 * Setup event listeners
 */
const modalActions = [
  {
    modal: 'Craft Item',
	before: displayCraftingRecipesForCraftingItem,
    then: displayCraftingRecipesForCraftingItem,
	disconnectObserverDuringThen: true,
  },
  {
    modal: 'Use Fishtoy',
	before: displayCraftingRecipesForConsumeItem,
    then: displayCraftingRecipesForConsumeItem,
	disconnectObserverDuringThen: true,
  },
  {
    modal: 'Get Season Pass',
	closeModal: true,
  },
];

document.addEventListener("modalopen", (e) => {
  let parsed;
  try {
    parsed = typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail;
    if (DEBUGGING) console.log("[📦] Parsed detail:", parsed);
  } catch (err) {
    console.error("[❌] Failed to parse modal detail:", err);
    return;
  }

  const action = modalActions.find(a => a.modal === parsed.modal);
  if (!action) return;
  
  // Delay lookup until modal is actually rendered
  setTimeout(() => {
	if (action.closeModal) {
	  if (DEBUGGING) console.log('Closing modal: ' + action.modal);
	  if (! SETTINGS.autoCloseSeasonPassPopup && action.modal === 'Get Season Pass') return;
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  return;
	}
	  
    const object = document.getElementById('modal');
	if (!object) return;
	
	if (parsed.modal == 'Global Mission') {
	  const missionName = getObjectFromClassNamePrefix('global-mission-modal_name', object);
	  if (missionName?.textContent.trim() === 'Think Fast!') {
		if (SETTINGS.autoResolveThinkFastMission) {
		  const missionButtons = getAllObjectsFromClassNamePrefix('button_button', object);
		  missionButtons.forEach(missionButton => {
		    const txt = missionButton.textContent.replace(/\s+/g, ' ').trim();
		    if (txt === 'Gotcha!') {
			  missionButton.click();
			  adminMessage("'Think Fast!' Message Auto Solved");
		    }
		  });
		}
	  }
    }
	
	if (action.before) action.before(object);

	if (action.then) {
	  const observer = observeObject(object, action.then, true, action.disconnectObserverDuringThen);
	  CLASS_OBSERVER_MAP.set(object.getAttribute("class"), observer);
	}
  }, 100);
});

// Disconnect modal observer when closed
document.addEventListener("modalclose", () => {
  const modal = document.getElementById('modal');
  if (modal && CLASS_OBSERVER_MAP.has(modal.getAttribute("class"))) {
    const observer = CLASS_OBSERVER_MAP.get(modal.getAttribute("class"));
    observer.disconnect();
    CLASS_OBSERVER_MAP.delete(modal.getAttribute("class"));
    if (DEBUGGING) console.log("🧹 Modal observer cleaned up");
  }
});

// Listen for system messages from staff and automated alerts
document.addEventListener("toastopen", (e) => {
  let parsed;
  try {
    parsed = typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail;
    if (DEBUGGING) console.log("[📦] Parsed detail:", parsed);
  } catch (err) {
    console.error("[❌] Failed to parse modal detail:", err);
    return;
  }
  
  // Close the season pass toast after 100ms to give it a bit of time to be drawn
  if (parsed.id === "season-pass") {
	setTimeout(() => {
      const event = new CustomEvent("toastclose", {
        detail: JSON.stringify({
          "id": "season-pass"
        })
      });

      document.dispatchEvent(event);
    }, 100);
  }
  
  logAdminMessage(parsed.id, parsed.header, parsed.message, parsed.type);
});

// Keydown event listener for custom functionality
document.addEventListener("keydown", e => {
  // Skip if focus is in an input/textarea or if modifier keys are down
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
    return;
  }

  if (e.key === "f" || e.key === "F") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
    toggleVideoFullscreen();
  }
  
  if (e.key === "r" || e.key === "R") {
	// Remove mirror and colour blind visuals
    removeWartoyVisuals();
  }
  
  /*if (e.key === "d" || e.key === "D") {
    DEBUGGING = true;
  }*/
  
  if (e.key === "e" || e.key === "E") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
	
    // Open Fishtank Live Extended settings editor
    const ftlExtModelOpen = document.querySelector('.ftl-ext-settings-editor-container');
    if (ftlExtModelOpen) {
   	  document.dispatchEvent(new CustomEvent("modalclose"));
    } else {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  setTimeout(() => {
   	    openSettingsEditor();
	  }, 50);
    }
  }
  
  if (e.key === "p" || e.key === "P") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
	
	// Open profile modal
	const modalHeader = getObjectFromClassNamePrefix('modal_title');
	if (modalHeader && modalHeader?.innerText?.trim().toLowerCase() === 'settings') {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	} else {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  setTimeout(() => {
	    document.dispatchEvent(new CustomEvent("modalopen", {
	      detail: JSON.stringify({modal: "Settings", data: 'profile'})
	    }));
	  }, 50);
	}
	
  }
  
  if (e.key === "n" || e.key === "N") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
	
	// Open notifications modal
	const modalHeader = getObjectFromClassNamePrefix('modal_title');
	if (modalHeader && modalHeader?.innerText?.trim().toLowerCase() === 'notifications') {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	} else {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  setTimeout(() => {
	    document.dispatchEvent(new CustomEvent("modalopen", {
	      detail: JSON.stringify({modal: "Notifications"})
	    }));
	  }, 50);
	}
  }
  
  if (e.key === "b" || e.key === "B") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
	
	// Open blocked users modal
	const modalHeader = getObjectFromClassNamePrefix('modal_title');
	if (modalHeader && modalHeader?.innerText?.trim().toLowerCase() === 'settings') {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	} else {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  setTimeout(() => {
	    document.dispatchEvent(new CustomEvent("modalopen", {
	      detail: JSON.stringify({modal: "Settings", data: 'mutes'})
	    }));
	  }, 50);
	}
  }
  
  if (e.key === "s" || e.key === "S") {
	if (! SETTINGS.enableKeyboardShortcuts) return;
	
	// Open stox modal
	const modalHeader = getObjectFromClassNamePrefix('modal_title');
	if (modalHeader && modalHeader?.innerText?.trim().toLowerCase() === 'stox') {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	} else {
	  document.dispatchEvent(new CustomEvent("modalclose"));
	  setTimeout(() => {
	    document.dispatchEvent(new CustomEvent("modalopen", {
	      detail: JSON.stringify({modal: "Stox"})
	    }));
	  }, 50);
	}
  }
});

window.addEventListener('resize', () => {
  // Apply our custom resizing
  resizeVideo();
});

const cssMap = buildCssModuleMap();
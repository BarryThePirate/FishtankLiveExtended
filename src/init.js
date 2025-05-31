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
 * Get crafting recipes
 */
async function loadRecipesFromRemote(url) {
  try {
    const response = await fetch(url);
    const base64Text = await response.text();
	return JSON.parse(atob(base64Text));
  } catch (err) {
    console.error("Failed to load or decode recipes:", err);
    return;
  }
}

loadRecipesFromRemote(RECIPE_URL).then(data => {
  CRAFTING_RECIPES = data;
});

/**
 * Handlers for when new chat message appears
 */
function chatMessagesMutationObserved(message) {
  applyAntiSpam(message);
  applyChatFilter(message);
  logStaffMessage(message);
}

function observeChatMessages() {
	const object = document.getElementById('chat-messages');
	if (object) observeAddedElements(object, chatMessagesMutationObserved);
}

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
	stopObservingWhenFound: false
  },
  {
	// Add FTL Ext Settings button
	parentPrefix: 'top-bar_top-bar',
	parentName: null,
	targetPrefix: 'top-bar-user_dropdown',
	then: createCustomButton,
	stopObservingWhenFound: true
  },
  {
	// Anti-spam & filtering on new chat messages
	parentPrefix: 'chat_chat',
	parentName: null,
	targetPrefix: 'chat-messages_chat-messages',
	then: observeChatMessages,
	stopObservingWhenFound: true
  },
  {
	// Capture original chat dropdown options
	parentPrefix: 'chat-room-selector_chat-room-selector',
	parentName: null,
	targetPrefix: 'select_options',
	then: saveDropdownOptions,
	stopObservingWhenFound: true
  },
  {
	// Observe chat dropdown opening
	parentPrefix: 'chat-room-selector_chat-room-selector',
	parentName: null,
	targetPrefix: 'select_options',
	then: observeDropdownOpen,
	stopObservingWhenFound: false
  },
  {
	// Add stream names to chat dropdown for filtering
	parentPrefix: 'main-panel_main-panel',
	parentName: null,
	targetPrefix: 'live-streams_live-streams-grid',
	then: observeStreamGrid,
	stopObservingWhenFound: false
  },
  {
	// Add stream names to chat dropdown for filtering
	parentPrefix: 'main-panel_main-panel',
	parentName: null,
	targetPrefix: 'live-stream-player_live-stream-player',
	then: checkForPlayer,
	stopObservingWhenFound: false
  },
];

function recordUsername (object) {
	if (object.innerHTML !== '') {
		USERNAME = object.innerHTML;
		USER_ID = object.dataset.userId;
	}
}

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
 * Setup event listeners
 */
const modalActions = [
  {
    modal: 'Craft Item',
	before: displayCraftingRecipesForItem,
    then: displayCraftingRecipesForItem,
	disconnectObserverDuringThen: true
  }
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
    const object = document.getElementById('modal');
	if (!object) return;
	
	if (action.before) action.before(object);

	const observer = observeObject(object, action.then, true, action.disconnectObserverDuringThen);
	OBJECT_OBSERVER_MAP.set(object, observer);
  }, 100);
});

// Disconnect modal observer when closed
document.addEventListener("modalclose", () => {
  const modal = document.getElementById('modal');
  if (modal && OBJECT_OBSERVER_MAP.has(modal)) {
    const observer = OBJECT_OBSERVER_MAP.get(modal);
    observer.disconnect();
    OBJECT_OBSERVER_MAP.delete(modal);
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
  
  logAdminMessage(parsed.id, parsed.header, parsed.message, parsed.type);
});
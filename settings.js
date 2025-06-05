// Globals
const SETTINGS_STORAGE_KEY = "ftl-ext-plugin-settings";
const ADMIN_MESSAGE_LOG_KEY = "ftl-ext-admin-message-log";
const STAFF_MESSAGE_LOG_KEY = "ftl-ext-staff-message-log";
const PINGS_LOG_KEY = "ftl-ext-pings-log";
const TTS_LOG_KEY = "ftl-ext-tts-log";
const RECIPE_URL = "https://gist.githubusercontent.com/BarryThePirate/42e69725c5d8ab70c85bc99ac010263a/raw/recipes.b64?nocache=" + Date.now();
let USERNAME;
let USER_ID;
let CRAFTING_RECIPES;
let SETTINGS;
let CLASSES = {};
const OBJECT_OBSERVER_MAP = new Map();
const DEBUGGING = false;

const settingDefinitions = [
 /**
  * Anti-Spam Settings
  */
  {
    key: "disableAntiSpam",
    group: "Anti-Spam",
    displayName: "Disable All Anti-Spam",
    type: "boolean",
    defaultValue: false,
	onChange: () => resetAntiSpam(),
	groupToggler: true
  },
  {
    key: "hideChatMessageLength",
    group: "Anti-Spam",
    displayName: "Hide Messages Over Length (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 200,
    onChange: () => resetAntiSpam()
  },
  {
    key: "filterChatMessagesContaining",
    group: "Anti-Spam",
    displayName: "Hide Messages Containing",
    type: "text-array",
    defaultValue: [],
    onChange: () => resetAntiSpam()
  },
  {
    key: "filterChatMessagesExact",
    group: "Anti-Spam",
    displayName: "Hide Messages Exactly Matching",
    type: "text-array",
    defaultValue: [],
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideItemConsumption",
    group: "Anti-Spam",
    displayName: "Hide Item Consumption",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideGrenades",
    group: "Anti-Spam",
    displayName: "Hide Grenades (Doesn't Mute Audio)",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideEmotes",
    group: "Anti-Spam",
    displayName: "Hide Emotes",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideStocks",
    group: "Anti-Spam",
    displayName: "Hide Stox and Shores",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideSfx",
    group: "Anti-Spam",
    displayName: "Hide SFX",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideTts",
    group: "Anti-Spam",
    displayName: "Hide TTS",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hidePoors",
    group: "Anti-Spam",
    displayName: "Hide Poors (Grey Texters)",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },
  {
    key: "hideClans",
    group: "Anti-Spam",
    displayName: "Hide Clan Notifications",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam()
  },

 /**
  * Chat Filter Settings
  */
  {
    key: "disableFiltering",
    group: "Chat Filters",
    displayName: "Disable All Chat Filtering (Requires Refresh)",
    type: "boolean",
    defaultValue: false,
	groupToggler: true
  },
  {
    key: "autoApplyChatFilters",
    group: "Chat Filters",
    displayName: "Auto Apply Chat Filters When Viewing Streams (EXPERIMENTAL FEATURE)",
    type: "boolean",
    defaultValue: false
  },
  {
    key: "enableChatDropdownIfDisabled",
    group: "Chat Filters",
    displayName: "Re-enable Dropdown if Disabled (EXPERIMENTAL FEATURE)",
    type: "boolean",
    defaultValue: false
  },
  {
    key: "allowPings",
    group: "Chat Filters",
    displayName: "Always Show When You're @'ed (Doesn't Mute Audio)",
    type: "boolean",
    defaultValue: true,
	onChange: () => resetChatFilter()
  },
  {
    key: "filterSfx",
    group: "Chat Filters",
    displayName: "Apply Filter to SFX Chat Messages",
    type: "boolean",
    defaultValue: false,
	onChange: () => resetChatFilter()
  },
  {
    key: "filterTts",
    group: "Chat Filters",
    displayName: "Apply Filter to TTS Chat Messages",
    type: "boolean",
    defaultValue: false,
	onChange: () => resetChatFilter()
  },
  
 /**
  * Item Crafting
  */
  {
    key: "displayRecipesInCraftModal",
    group: "Crafting",
    displayName: "Show Recipes When Crafting",
    type: "boolean",
    defaultValue: true,
	groupToggler: true
  },
  
 /**
  * Logging
  */
  
  // Admin Message Logging
  {
    key: "disableAdminMessageLogging",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Disable Admin Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true
  },
  {
    key: "logAdminMessagesLevelUpsMissionsMedals",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'Level Up'/'Mission'/'Medal Earned' Messages",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesFoundItem",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'Found an Item' Messages",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesNewPollStarted",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'New Poll Started' Messages",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesGiftedSeasonPasses",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Gifted Season Passes",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesTips",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Tips Sent/Received",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesError",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Error Messages",
    type: "boolean",
    defaultValue: true
  },
  {
    key: "logAdminMessagesNumber",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Admin Message Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50
  },
  
  // Staff Message Logging
  {
    key: "disableStaffMessageLogging",
    group: "Logging",
	subGroup: "Staff Messages",
    displayName: "Disable Staff Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true
  },
  {
    key: "logStaffMessagesNumber",
    group: "Logging",
	subGroup: "Staff Messages",
    displayName: "Staff Message Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50
  },
  
  // Pings Logging
  {
    key: "disablePingsLogging",
    group: "Logging",
	subGroup: "Pings",
    displayName: "Disable Pings Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true
  },
  {
    key: "logPingsNumber",
    group: "Logging",
	subGroup: "Pings",
    displayName: "Pings Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50
  },
  
  // TTS Logging
  {
    key: "disableTtsLogging",
    group: "Logging",
	subGroup: "TTS",
    displayName: "Disable TTS Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true
  },
  {
    key: "logTtsNumber",
    group: "Logging",
	subGroup: "TTS",
    displayName: "TTS Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50
  },
  
 /**
  * Clickable Zones
  */
  {
    key: "disableClickableZones",
    group: "Clickable Zones",
    displayName: "Disable Clickable Zones Alerts (EXPERIMENTAL FEATURE)",
    type: "boolean",
    defaultValue: true,
	groupToggler: true
  },
];
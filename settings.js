/**
  * Globals
  */
let DEBUGGING = false;
let MOBILE = false;
const SETTINGS_STORAGE_KEY = "ftl-ext-plugin-settings";
const ADMIN_MESSAGE_LOG_KEY = "ftl-ext-admin-message-log";
const STAFF_MESSAGE_LOG_KEY = "ftl-ext-staff-message-log";
const PINGS_LOG_KEY = "ftl-ext-pings-log";
const TTS_LOG_KEY = "ftl-ext-tts-log";
const SFX_LOG_KEY = "ftl-ext-sfx-log";
const RECIPE_URL = "https://barrythepirate.github.io/recipes.b64?nocache=" + Date.now();
let USERNAME;
let USER_ID;
let CRAFTING_RECIPES;
let SETTINGS;
let CLASSES = {};
const CLASS_OBSERVER_MAP = new Map();
let CSS_MAP;
const CONTRIBUTORS = ["BarryThePirate"];

/**
  * SVGs
  */
// Reference square -- use this as a template when making SVGs
const SVG_REFERENCE_SQUARE = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <rect x="0" y="0" width="24" height="1"></rect>
  <rect x="0" y="23" width="24" height="1"></rect>
  <rect x="0" y="0" width="1" height="24"></rect>
  <rect x="23" y="0" width="1" height="24"></rect>
</svg>
`;

// Skull and crossbones
const SVG_SKULL_AND_CROSSBONES = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <!-- Skull -->
  <rect x="7" y="6" width="10" height="2"></rect>
  <rect x="6" y="8" width="12" height="2"></rect>
  <rect x="6" y="10" width="2" height="2"></rect>
  <rect x="11" y="10" width="2" height="2"></rect>
  <rect x="16" y="10" width="2" height="2"></rect>
  <rect x="13" y="12" width="3" height="2"></rect>
  <rect x="8" y="12" width="3" height="2"></rect>
  <rect x="9" y="14" width="6" height="1"></rect>
  <rect x="10" y="17" width="4" height="1"></rect>
  <rect x="11" y="15" width="1" height="1"></rect>
  <rect x="13" y="15" width="1" height="1"></rect>
  <rect x="12" y="16" width="1" height="1"></rect>
  <rect x="10" y="16" width="1" height="1"></rect>
  
  <!-- Crossbones -->
  
  <!-- Top Left -->
  <rect x="2" y="0" width="2" height="2"></rect>
  <rect x="0" y="2" width="4" height="2"></rect>
  <rect x="4" y="4" width="2" height="2"></rect>
  
  <!-- Top Right -->
  <rect x="20" y="0" width="2" height="2"></rect>
  <rect x="20" y="2" width="4" height="2"></rect>
  <rect x="18" y="4" width="2" height="2"></rect>
  
  <!-- Bottom Left -->
  <rect x="0" y="20" width="4" height="2"></rect>
  <rect x="2" y="22" width="2" height="2"></rect>
  <rect x="4" y="18" width="2" height="2"></rect>
  <rect x="6" y="16" width="2" height="2"></rect>
  
  <!-- Bottom Right -->
  <rect x="20" y="20" width="4" height="2"></rect>
  <rect x="20" y="22" width="2" height="2"></rect>
  <rect x="18" y="18" width="2" height="2"></rect>
  <rect x="16" y="16" width="2" height="2"></rect>
</svg>
`;
  
// Garbage Can
const SVG_GARBAGE_CAN = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <!-- Lid -->
  <rect x="9" y="0" width="6" height="2"></rect>
  <rect x="7" y="2" width="2" height="2"></rect>
  <rect x="15" y="2" width="2" height="2"></rect>
  <rect x="2" y="4" width="20" height="2"></rect>
  
  <!-- Can -->
  <rect x="4" y="6" width="2" height="22"></rect>
  <rect x="18" y="6" width="2" height="22"></rect>
  <rect x="4" y="22" width="14" height="2"></rect>
  <rect x="9" y="8" width="1" height="12"></rect>
  <rect x="14" y="8" width="1" height="12"></rect>
</svg>
`;

// Down arrow
const SVG_DOWN_ARROW = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <rect x="11" y="22" width="2" height="2"></rect>
  <rect x="9" y="20" width="2" height="2"></rect>
  <rect x="7" y="18" width="2" height="2"></rect>
  <rect x="13" y="20" width="2" height="2"></rect>
  <rect x="15" y="18" width="2" height="2"></rect>
  
  <rect x="11" y="16" width="2" height="2"></rect>
  <rect x="11" y="12" width="2" height="2"></rect>
  <rect x="11" y="8" width="2" height="2"></rect>
  <rect x="11" y="4" width="2" height="2"></rect>
  <rect x="11" y="0" width="2" height="2"></rect>
</svg>
`;

// Up arrow
const SVG_UP_ARROW = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <rect x="11" y="0" width="2" height="2"></rect>
  <rect x="9" y="2" width="2" height="2"></rect>
  <rect x="7" y="4" width="2" height="2"></rect>
  <rect x="13" y="2" width="2" height="2"></rect>
  <rect x="15" y="4" width="2" height="2"></rect>
  
  <rect x="11" y="6" width="2" height="2"></rect>
  <rect x="11" y="10" width="2" height="2"></rect>
  <rect x="11" y="14" width="2" height="2"></rect>
  <rect x="11" y="18" width="2" height="2"></rect>
  <rect x="11" y="22" width="2" height="2"></rect>
</svg>
`;

// ^
const SVG_UP_ARROW_MINI = `
<svg viewBox="0 0 8 12" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="12" height="8">
  <rect x="4" y="0" width="2" height="2"></rect>
  <rect x="2" y="2" width="2" height="2"></rect>
  <rect x="0" y="4" width="2" height="2"></rect>
  <rect x="6" y="2" width="2" height="2"></rect>
  <rect x="8" y="4" width="2" height="2"></rect>
</svg>
`;

// v
const SVG_DOWN_ARROW_MINI = `
<svg viewBox="0 0 8 12" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="12" height="8">
  <rect x="4" y="4" width="2" height="2"></rect>
  <rect x="2" y="2" width="2" height="2"></rect>
  <rect x="0" y="0" width="2" height="2"></rect>
  <rect x="6" y="2" width="2" height="2"></rect>
  <rect x="8" y="0" width="2" height="2"></rect>
</svg>
`;

const SVG_CLOSE_CHAT = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <rect x="16" y="2" width="6" height="2"></rect>
  <rect x="16" y="2" width="2" height="18"></rect>
  <rect x="16" y="20" width="6" height="2"></rect>
  
  <rect x="2" y="10" width="2" height="2"></rect>
  <rect x="6" y="10" width="2" height="2"></rect>
  <rect x="12" y="10" width="2" height="2"></rect>
  
  <rect x="8" y="6" width="2" height="2"></rect>
  <rect x="10" y="8" width="2" height="2"></rect>
  <rect x="10" y="12" width="2" height="2"></rect>
  <rect x="8" y="14" width="2" height="2"></rect>
</svg>
`;

const SVG_OPEN_CHAT = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F8EC94" width="24" height="24">
  <rect x="16" y="2" width="6" height="2"></rect>
  <rect x="16" y="2" width="2" height="18"></rect>
  <rect x="16" y="20" width="6" height="2"></rect>
  
  <rect x="12" y="10" width="2" height="2"></rect>
  <rect x="8" y="10" width="2" height="2"></rect>
  <rect x="2" y="10" width="2" height="2"></rect>
  
  <rect x="6" y="6" width="2" height="2"></rect>
  <rect x="4" y="8" width="2" height="2"></rect>
  <rect x="4" y="12" width="2" height="2"></rect>
  <rect x="6" y="14" width="2" height="2"></rect>
</svg>
`;

const settingDefinitions = [
 /**
  * General
  */
  {
    key: "autoResolveThinkFastMission",
    group: "General",
    displayName: "Auto Resolve 'Think Fast!' Mission",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "autoCloseSeasonPassPopup",
    group: "General",
    displayName: "Auto Close Season Pass Popup",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "theatreModeImproved",
    group: "General",
    displayName: "Improved Theatre Mode",
    type: "boolean",
	onChange: () => resizeVideo(),
    defaultValue: true,
  },
  {
    key: "theatreModeFtlExtButton",
    group: "General",
    displayName: "FTL Extended Settings Button in Theatre Mode",
    type: "boolean",
	onChange: () => resizeVideo(),
    defaultValue: true,
  },
  {
    key: "alwaysShowFullscreenButton",
    group: "General",
    displayName: "Always Show Fullscreen Button",
    type: "boolean",
	onChange: () => resizeVideo(),
    defaultValue: true,
  },
  {
    key: "enableKeyboardShortcuts",
    group: "General",
    displayName: "Enable Keyboard Shortcuts [F, E, N, P, B, S]",
    type: "boolean",
    defaultValue: true,
  },
 
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
	groupToggler: true,
  },
  {
    key: "hideChatMessageLength",
    group: "Anti-Spam",
    displayName: "Hide Messages Over Length (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 200,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "filterChatMessagesContaining",
    group: "Anti-Spam",
    displayName: "Hide Messages Containing",
    type: "text-array",
    defaultValue: [],
    onChange: () => resetAntiSpam(),
  },
  {
    key: "filterChatMessagesExact",
    group: "Anti-Spam",
    displayName: "Hide Messages Exactly Matching",
    type: "text-array",
    defaultValue: [],
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideItemConsumption",
    group: "Anti-Spam",
    displayName: "Hide Item Consumption",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideGrenades",
    group: "Anti-Spam",
    displayName: "Hide Grenades (Doesn't Mute Audio)",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideEmotes",
    group: "Anti-Spam",
    displayName: "Hide Emotes",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideStocks",
    group: "Anti-Spam",
    displayName: "Hide Stox",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideSfx",
    group: "Anti-Spam",
    displayName: "Hide SFX",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideTts",
    group: "Anti-Spam",
    displayName: "Hide TTS",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hidePoors",
    group: "Anti-Spam",
    displayName: "Hide Poors (Grey Texters)",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
  },
  {
    key: "hideClans",
    group: "Anti-Spam",
    displayName: "Hide Clan Notifications",
    type: "boolean",
    defaultValue: false,
    onChange: () => resetAntiSpam(),
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
	groupToggler: true,
  },
  {
    key: "autoApplyChatFilters",
    group: "Chat Filters",
    displayName: "Auto Apply Chat Filters When Viewing Streams",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "enableChatDropdownIfDisabled",
    group: "Chat Filters",
    displayName: "Re-enable Dropdown if Disabled (EXPERIMENTAL FEATURE, Requires Refresh)",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "allowPings",
    group: "Chat Filters",
    displayName: "Always Show When You're @'ed (Doesn't Mute Audio)",
    type: "boolean",
    defaultValue: true,
	onChange: () => resetChatFilter(),
  },
  {
    key: "filterSfx",
    group: "Chat Filters",
    displayName: "Apply Filter to SFX Chat Messages",
    type: "boolean",
    defaultValue: false,
	onChange: () => resetChatFilter(),
  },
  {
    key: "filterTts",
    group: "Chat Filters",
    displayName: "Apply Filter to TTS Chat Messages",
    type: "boolean",
    defaultValue: false,
	onChange: () => resetChatFilter(),
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
  },
  {
    key: "displayRecipesInConsumeModal",
    group: "Crafting",
    displayName: "Show Recipes When Consuming",
    type: "boolean",
    defaultValue: true,
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
	groupToggler: true,
  },
  {
    key: "logAdminMessagesLevelUpsMissionsMedals",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'Level Up'/'Mission'/'Medal Earned' Messages",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesFoundItem",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'Found an Item' Messages",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesNewPollStarted",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log 'New Poll Started' Messages",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesGiftedSeasonPasses",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Gifted Season Passes",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesTips",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Tips Sent/Received",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesFishToy",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Log Fish Toy Messages",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "logAdminMessagesNumber",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "Admin Message Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50,
  },
  {
    key: "logAdminMessagesOrderAsc",
    group: "Logging",
	subGroup: "Admin Messages",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  
  // Staff Message Logging
  {
    key: "disableStaffMessageLogging",
    group: "Logging",
	subGroup: "Staff Messages",
    displayName: "Disable Staff Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logStaffMessagesNumber",
    group: "Logging",
	subGroup: "Staff Messages",
    displayName: "Staff Message Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50,
  },
  {
    key: "logStaffMessagesOrderAsc",
    group: "Logging",
	subGroup: "Staff Messages",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  // Pings Logging
  {
    key: "disablePingsLogging",
    group: "Logging",
	subGroup: "Pings",
    displayName: "Disable Pings Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logPingsNumber",
    group: "Logging",
	subGroup: "Pings",
    displayName: "Pings Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50,
  },
  {
    key: "logPingsOrderAsc",
    group: "Logging",
	subGroup: "Pings",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  // TTS Logging
  {
    key: "disableTtsLogging",
    group: "Logging",
	subGroup: "TTS",
    displayName: "Disable TTS Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logTtsNumber",
    group: "Logging",
	subGroup: "TTS",
    displayName: "TTS Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50,
  },
  {
    key: "logTtsOrderAsc",
    group: "Logging",
	subGroup: "TTS",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  // SFX Logging
  {
    key: "disableSfxLogging",
    group: "Logging",
	subGroup: "SFX",
    displayName: "Disable SFX Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logSfxNumber",
    group: "Logging",
	subGroup: "SFX",
    displayName: "SFX Log Size (Max 200)",
    type: "number",
	min: 1,
	max: 200,
    defaultValue: 50,
  },
  {
    key: "logSfxOrderAsc",
    group: "Logging",
	subGroup: "SFX",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
 /**
  * Clickable Zones
  */
  {
    key: "disableUnhidingClickableZones",
    group: "Clickable Zones",
    displayName: "Disable Un-hiding Clickable Zones & Alerts",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "clickableZoneAlerts",
    group: "Clickable Zones",
    displayName: "Hiden Clickable Zone Alerts",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "clickableZoneUnhide",
    group: "Clickable Zones",
    displayName: "Un-hide Clickable Zones",
    type: "boolean",
    defaultValue: true,
  },
];
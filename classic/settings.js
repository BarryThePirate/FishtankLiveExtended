/**
  * Globals
  */
let DEBUGGING = false;
let MOBILE = false;
let IRC_MODE = false;
const SETTINGS_STORAGE_KEY = "ftl-ext-plugin-settings";
const ADMIN_MESSAGE_LOG_KEY = "ftl-ext-admin-message-log";
const STAFF_MESSAGE_LOG_KEY = "ftl-ext-staff-message-log";
const FISH_MESSAGE_LOG_KEY = "ftl-ext-fish-message-log";
const MOD_MESSAGE_LOG_KEY = "ftl-ext-mod-message-log";
const PINGS_LOG_KEY = "ftl-ext-pings-log";
const TTS_LOG_KEY = "ftl-ext-tts-log";
const SFX_LOG_KEY = "ftl-ext-sfx-log";
const RECIPE_URL = "https://fishtank.guru/resources/recipes.json";
let USERNAME;
let USER_ID;
let CRAFTING_RECIPES;
let SETTINGS;
let CLASSES = {};
const CLASS_OBSERVER_MAP = new Map();
let CSS_MAP;
const CONTRIBUTORS = [];

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
	subGroup: "Admin",
    displayName: "Disable Admin Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logAdminMessagesWordFilter",
    group: "Logging",
    displayName: "Don't Log Admin Messages Containing",
    type: "text-array",
    defaultValue: [],
    onChange: () => resetAntiSpam(),
  },
  {
    key: "logAdminMessagesNumber",
    group: "Logging",
	subGroup: "Admin",
    displayName: "Admin Message Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
  },
  {
    key: "logAdminMessagesOrderAsc",
    group: "Logging",
	subGroup: "Admin",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  // Fish Message Logging
  {
    key: "disableFishMessageLogging",
    group: "Logging",
	subGroup: "Fish",
    displayName: "Disable Fish Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logFishMessagesNumber",
    group: "Logging",
	subGroup: "Fish",
    displayName: "Fish Message Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
  },
  {
    key: "logFishMessagesOrderAsc",
    group: "Logging",
	subGroup: "Fish",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  // Mod Message Logging
  {
    key: "disableModMessageLogging",
    group: "Logging",
	subGroup: "Mod",
    displayName: "Disable Mod Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logModMessagesNumber",
    group: "Logging",
	subGroup: "Mod",
    displayName: "Mod Message Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
  },
  {
    key: "logModMessagesOrderAsc",
    group: "Logging",
	subGroup: "Mod",
    displayName: "",
    type: "order",
    defaultValue: false,
  },
  
  
  // Staff Message Logging
  {
    key: "disableStaffMessageLogging",
    group: "Logging",
	subGroup: "Staff",
    displayName: "Disable Staff Message Logging",
    type: "boolean",
    defaultValue: false,
	groupToggler: true,
  },
  {
    key: "logStaffMessagesNumber",
    group: "Logging",
	subGroup: "Staff",
    displayName: "Staff Message Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
  },
  {
    key: "logStaffMessagesOrderAsc",
    group: "Logging",
	subGroup: "Staff",
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
    displayName: "Pings Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
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
    displayName: "TTS Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
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
    displayName: "SFX Log Size (Max 1000)",
    type: "number",
	min: 1,
	max: 1000,
    defaultValue: 200,
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
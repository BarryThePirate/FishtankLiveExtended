import * as storage from '../../ftl-ext-sdk/src/core/storage.js';

const SETTINGS_KEY = 'settings';

const DEFAULTS = {
    autoCloseSeasonPassPopup: true,
    enableKeyboardShortcuts: true,
    showRecipesWhenCrafting: true,
    showRecipeWhenConsuming: true,
    revealHiddenZones: true,
    enhancedTheatreMode: true,
    enableInventorySearch: true,
    sortInventoryByRarity: false, // CSS-order inventory tiles rarest first
    enablePingIndicator: true,
    // Season Pass monitoring disabled — these don't work reliably and
    // cause problems, so the settings are turned off and hidden for all
    // users. Left commented rather than deleted in case they're revived.
    // monitorSeasonPass: true,
    // monitorSeasonPassXL: true,
    videoStutterImprover: true,
    archiveGridSaver: true,
    // Re-run mode — personal "as live" archive playback
    rerunEnabled: false,
    rerunSeason: 's03',
    rerunAnchorVirtual: null,  // ms, show-time frame (see SDK archives module)
    rerunAnchorReal: null,     // epoch ms when the anchor was set
    rerunTickWhileAway: true,  // clock advances even when off the site
    rerunClickableZones: true, // door zones in the re-run player
    rerunClock12h: false,      // show the re-run clock as 12-hour AM/PM
    rerunSidebarPanel: true,   // Re-run status panel in the site's left sidebar
    rerunPaused: false,
    rerunPausedAtVirtual: null,
    smartAntiSpam: false,
    hideTTSMessages: false,
    hideSFXMessages: false,
    hideStoxMessages: false,
    chatWordFilters: [],
    adminLogSize: 200,
    staffLogSize: 200,
    modLogSize: 200,
    fishLogSize: 200,
    pingsLogSize: 200,
    ttsLogSize: 200,
    sfxLogSize: 200,
};

let settings = { ...DEFAULTS };

export function loadSettings() {
    const saved = storage.get(SETTINGS_KEY, null);
    if (saved) {
        settings = { ...DEFAULTS, ...saved };
    }
    return settings;
}

export function getSetting(key) {
    return settings[key];
}

export function updateSetting(key, value) {
    settings[key] = value;
    // Merge the changed key onto what's CURRENTLY stored rather than
    // dumping this tab's whole snapshot — another tab (or a newer
    // build) may have written keys this tab's in-memory copy never
    // knew about, and a stale snapshot would wipe them.
    const stored = storage.get(SETTINGS_KEY, null);
    storage.set(SETTINGS_KEY, { ...(stored || {}), [key]: value });
}

export function getSettings() {
    return settings;
}
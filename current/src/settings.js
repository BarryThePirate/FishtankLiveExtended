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
    enablePingIndicator: true,
    monitorSeasonPass: true,
    monitorSeasonPassXL: true,
    videoStutterImprover: true,
    smartAntiSpam: false,
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
    storage.set(SETTINGS_KEY, settings);
}

export function getSettings() {
    return settings;
}
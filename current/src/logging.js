/**
 * logging.js — Message log state and storage
 *
 * Manages all log arrays (TTS, SFX, pings, staff, mod, fish, admin),
 * handles persistence to localStorage via the SDK, and provides
 * live-update functions that prepend new entries to the visible
 * log panel if it's open.
 */

import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import { getSetting } from './settings.js';
import {
    buildTtsRow, buildSfxRow, buildPingsRow, buildRoleRow, buildAdminRow,
    renderTtsLog, renderSfxLog, renderPingsLog, renderRoleLog, renderAdminLog,
} from './ui-helpers.js';

// ── Storage keys ────────────────────────────────────────────────────

const KEYS = {
    tts:    'tts-log',
    sfx:    'sfx-log',
    pings:  'pings-log',
    staff:  'staff-log',
    mod:    'mod-log',
    fish:   'fish-log',
    admin:  'admin-log',
    filter: 'admin-filter',
};

// ── Log arrays ──────────────────────────────────────────────────────

let ttsLog     = [];
let sfxLog     = [];
let pingsLog   = [];
let staffLog   = [];
let modLog     = [];
let fishLog    = [];
let adminLog   = [];
let adminFilter = [];

// ── Initialise (load from storage) ──────────────────────────────────

export function loadLogs() {
    ttsLog      = storage.get(KEYS.tts)    || [];
    sfxLog      = storage.get(KEYS.sfx)    || [];
    pingsLog    = storage.get(KEYS.pings)  || [];
    staffLog    = storage.get(KEYS.staff)  || [];
    modLog      = storage.get(KEYS.mod)    || [];
    fishLog     = storage.get(KEYS.fish)   || [];
    adminLog    = storage.get(KEYS.admin)  || [];
    adminFilter = storage.get(KEYS.filter) || [];
}

// ── Getters ─────────────────────────────────────────────────────────

export function getLog(type) {
    switch (type) {
        case 'tts':   return ttsLog;
        case 'sfx':   return sfxLog;
        case 'pings': return pingsLog;
        case 'staff': return staffLog;
        case 'mod':   return modLog;
        case 'fish':  return fishLog;
        case 'admin': return adminLog;
        default:      return [];
    }
}

export function getAdminFilter() { return adminFilter; }

// ── Size key mapping ────────────────────────────────────────────────

function sizeSettingKey(type) {
    const map = {
        tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
        staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
        admin: 'adminLogSize',
    };
    return map[type] || 'adminLogSize';
}

function storageKey(type) {
    return KEYS[type] || KEYS.admin;
}

function getMaxSize(type) {
    return Math.max(1, Math.min(1000, getSetting(sizeSettingKey(type)) || 200));
}

// ── Generic push + trim + save ──────────────────────────────────────

function pushEntry(arr, entry, type) {
    arr.push(entry);
    const max = getMaxSize(type);
    if (arr.length > max) arr.splice(0, arr.length - max);
    storage.set(storageKey(type), arr);
}

// ── Live update helper ──────────────────────────────────────────────
// Checks if the log panel is open and the given log type is active.
// If so, prepends the new row with a flash animation.

function liveUpdate(type, rowElement) {
    const logPanel   = document.querySelector('[data-ftl-panel="logging"]');
    const activeBtn  = document.querySelector(`[data-ftl-log="${type}"]`);
    const logContent = document.querySelector('[data-ftl-log-content]');

    const visible = logPanel && !logPanel.classList.contains('hidden')
        && activeBtn && activeBtn.classList.contains('brightness-125')
        && logContent;

    if (!visible) return;

    const empty = logContent.querySelector('.italic');
    if (empty) empty.remove();

    rowElement.classList.add('ftl-flash');
    logContent.prepend(rowElement);

    const max = getMaxSize(type);
    while (logContent.children.length > max) {
        logContent.removeChild(logContent.lastChild);
    }
}

// ── Public logging functions ────────────────────────────────────────

export function logTts(msg) {
    const entry = {
        displayName: msg.username || '???',
        message: msg.message,
        voice: msg.voice || '?',
        room: msg.room || '?',
        audioId: msg.audioId || null,
        clan: msg.clanTag || null,
        timestamp: Date.now(),
    };
    pushEntry(ttsLog, entry, 'tts');
    liveUpdate('tts', buildTtsRow(entry));
}

export function logSfx(msg) {
    const entry = {
        displayName: msg.username || '???',
        message: msg.message,
        room: msg.room || '?',
        audioFile: msg.audioFile || null,
        clan: msg.clanTag || null,
        timestamp: Date.now(),
    };
    pushEntry(sfxLog, entry, 'sfx');
    liveUpdate('sfx', buildSfxRow(entry));
}

export function logPing(msg) {
    const entry = {
        displayName: msg.username || '???',
        message: msg.message,
        colour: msg.colour || null,
        avatar: msg.avatar || null,
        endorsement: msg.endorsement || null,
        role: msg.role || null,
        timestamp: Date.now(),
    };
    pushEntry(pingsLog, entry, 'pings');
    liveUpdate('pings', buildPingsRow(entry));
}

export function logRoleMessage(msg) {
    const role = msg.role; // 'staff' | 'mod' | 'fish'
    const arr = role === 'staff' ? staffLog : role === 'mod' ? modLog : fishLog;
    const type = role;

    const entry = {
        displayName: msg.username || '???',
        message: msg.message,
        colour: msg.colour || null,
        avatar: msg.avatar || null,
        clan: msg.clan || null,
        endorsement: msg.endorsement || null,
        role,
        timestamp: Date.now(),
    };
    pushEntry(arr, entry, type);
    liveUpdate(type, buildRoleRow(entry));
}

export function logAdminToast(toast) {
    const entry = {
        title:       toast.title,
        description: toast.description || null,
        imageUrl:    toast.imageUrl || null,
        imageAlt:    toast.imageAlt || null,
        timestamp:   Date.now(),
    };

    // Check admin filter
    if (adminFilter.length > 0) {
        const combined = `${entry.title || ''} ${entry.description || ''}`.toLowerCase();
        if (adminFilter.some(term => combined.includes(term.toLowerCase()))) return;
    }

    pushEntry(adminLog, entry, 'admin');
    liveUpdate('admin', buildAdminRow(entry));
}

// ── Clear / resize ──────────────────────────────────────────────────

export function clearLog(type) {
    const arr = getLog(type);
    arr.length = 0;
    storage.set(storageKey(type), arr);
}

export function resizeLog(type, newSize) {
    const arr = getLog(type);
    if (arr.length > newSize) {
        arr.splice(0, arr.length - newSize);
        storage.set(storageKey(type), arr);
    }
}

// ── Render a log type into a container ──────────────────────────────

export function renderLog(type, container, currentUsername) {
    switch (type) {
        case 'tts':   renderTtsLog(container, ttsLog); break;
        case 'sfx':   renderSfxLog(container, sfxLog); break;
        case 'pings': renderPingsLog(container, pingsLog, currentUsername); break;
        case 'staff': renderRoleLog(container, staffLog, 'No staff messages logged yet'); break;
        case 'mod':   renderRoleLog(container, modLog, 'No mod messages logged yet'); break;
        case 'fish':  renderRoleLog(container, fishLog, 'No fish messages logged yet'); break;
        case 'admin': renderAdminLog(container, adminLog); break;
    }
}

// ── Admin filter management ─────────────────────────────────────────

export function addFilterTerm(term) {
    if (!term || adminFilter.includes(term)) return false;
    adminFilter.push(term);
    storage.set(KEYS.filter, adminFilter);
    return true;
}

export function removeFilterTerm(index) {
    adminFilter.splice(index, 1);
    storage.set(KEYS.filter, adminFilter);
}

/**
 * index.js — FTL Extended entry point (current site)
 *
 * This file is the orchestrator. It wires up the SDK, registers
 * callbacks, and delegates to feature modules. It should stay slim.
 *
 * DATA CAPTURE STRATEGY:
 * - Chat messages, TTS, SFX → Socket.IO (reliable, never misses messages)
 * - Toast notifications → DOM observer on Sonner container (no socket event for all toast types)
 * - Modal detection → CustomEvent listener (modalOpen/modalClose)
 * - Dropdown injection → click listener
 *
 * PERFORMANCE RULES:
 * - ZERO persistent MutationObservers on document.body
 * - Only one targeted DOM observer: Sonner toast container
 * - Socket.IO is an independent connection, no monkey-patching
 */

import { site, ui, socket, player } from '../../ftl-ext-sdk/src/index.js';
import { io } from 'socket.io-client';
import * as msgpackParser from 'socket.io-msgpack-parser';
import { loadSettings, getSetting } from './settings.js';
import { loadLogs, logTts, logSfx, logPing, logRoleMessage, logAdminToast } from './logging.js';
import { loadRecipesFromCache, fetchRecipes, initCraftingHints, initUseItemHints } from './crafting.js';
import { openSettingsModal, openModal, tryInjectDropdownButton, setCurrentUsername } from './modals.js';
import { initZoneDetection } from './zones.js';
import { toggleTheatre, enterTheatre, exitTheatre, isTheatreActive, initTheatreButtonIntercept } from './theatre.js';

const DEBUG = false;
const log = (...args) => DEBUG && console.log('[FTL Extended]', ...args);

// ── Pre-ready setup (must not miss early events) ────────────────────

loadSettings();

// Detect username via SDK polling (no body observer)
let currentUsername = null;
site.onUserDetected((username) => {
    currentUsername = username;
    setCurrentUsername(username);
    log('Username detected:', username);
});

// Listen for modal events via CustomEvent (no body observer needed)
document.addEventListener('modalOpen', (e) => {
    // Firefox content scripts can't access e.detail from page-context CustomEvents
    // Clone it to avoid "Permission denied to access property" errors
    let detail;
    try {
        detail = e.detail ? JSON.parse(JSON.stringify(e.detail)) : {};
    } catch {
        detail = {};
    }

    // Log modal info if debug is on
    log('[MODAL]', detail?.modal, detail);

    // Clean up any injected extension content when any modal opens
    document.querySelector('[data-ftl-sdk="settings"]')?.remove();

    const modalName = detail?.modal;

    // Auto-close season pass popup
    if (modalName === 'seasonPass' && getSetting('autoCloseSeasonPassPopup')) {
        setTimeout(() => document.dispatchEvent(new CustomEvent('modalClose')), 0);
    }

    // Inject crafting hints when craft modal opens
    if (modalName === 'craftItem') {
        initCraftingHints();
    }

    // Inject use-item hints when use modal opens
    if (modalName === 'useItem') {
        initUseItemHints();
    }
});

// Inject flash animation CSS
const flashStyle = document.createElement('style');
flashStyle.textContent = `
    @keyframes ftl-flash {
        0%   { background-color: rgba(255, 255, 255, 0.15); }
        100% { background-color: transparent; }
    }
    .ftl-flash {
        animation: ftl-flash 1.5s ease-out forwards;
    }
`;
document.head.appendChild(flashStyle);

// ── Site ready ──────────────────────────────────────────────────────

site.whenReady(async () => {
    log('Site is ready!');

    // Load cached data
    loadLogs();
    loadRecipesFromCache();
    fetchRecipes();
    player.streams.fetchRoomNames();

    // ── Socket.IO connection (primary data source) ──────────────────
    // Connects to wss://ws.fishtank.live with msgpack encoding.
    // Uses token: null for anonymous access (global chat).
    // This is a separate connection from the site's own socket.

    try {
        const connectTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('connection timeout')), 10000)
        );
        await Promise.race([
            socket.connect(io, msgpackParser, { token: null }),
            connectTimeout,
        ]);
        log('Socket connected');
    } catch (err) {
        console.warn('[FTL Extended] Socket connection failed:', err.message);
        console.warn('[FTL Extended] Chat/TTS/SFX logging will not work this session');
    }

    // ── Chat messages via Socket.IO ─────────────────────────────────

    socket.on('chat:message', (data) => {
        // Socket delivers messages wrapped in an array
        const raw = Array.isArray(data) ? data[0] : data;
        if (!raw) return;

        // Extract avatar filename from full URL
        // "https://cdn.fishtank.live/avatars/rchl.png" → "rchl.png"
        const photoURL = raw.user?.photoURL || '';
        const avatar = photoURL.split('/').pop() || null;

        // Normalise socket data to the format logging.js expects
        // Role priority: staff > mod > fish > epic > grandMarshal > normal
        const msg = {
            username: raw.user?.displayName || '???',
            message: raw.message || '',
            mentions: raw.mentions || [],
            colour: raw.user?.customUsernameColor || null,
            avatar,
            clan: raw.user?.clan || null,
            endorsement: raw.user?.endorsement || null,
            role: raw.metadata?.isAdmin ? 'staff'
                : raw.metadata?.isMod ? 'mod'
                    : raw.metadata?.isFish ? 'fish'
                        : raw.metadata?.isGrandMarshall ? 'grandMarshal'
                            : raw.metadata?.isEpic ? 'epic'
                                : null,
        };

        log('[CHAT]', msg.username, msg.message);

        // Pings — chat messages that mention the current user
        if (currentUsername && msg.mentions.length > 0) {
            const lower = currentUsername.toLowerCase();
            if (msg.mentions.some(m => {
                // Mentions from socket are objects: {displayName, userId}
                const name = typeof m === 'string' ? m : m.displayName || '';
                return name.toLowerCase() === lower;
            })) {
                logPing(msg);
            }
        }

        // Staff / Mod / Fish messages (logged to dedicated role logs)
        // Epic and Grand Marshal are visual styling only, not separate log categories
        if (msg.role === 'staff' || msg.role === 'mod' || msg.role === 'fish') {
            logRoleMessage(msg);
        }
    });

    // ── TTS via Socket.IO ───────────────────────────────────────────

    socket.on('tts:update', (data) => {
        // Only log approved TTS (skip pending/rejected)
        if (data.status && data.status !== 'approved') return;

        const msg = {
            username: data.displayName || '???',
            message: data.message || '',
            voice: data.voice || '?',
            room: data.room || '?',
            audioId: data.id || null,
            clanTag: data.clanTag || null,
        };

        log('[TTS]', msg.username, msg.message, msg.voice, msg.room);
        logTts(msg);
    });

    // ── SFX via Socket.IO ───────────────────────────────────────────

    socket.on('sfx:insert', (data) => {
        // Extract audio filename from URL for slim storage
        // "https://cdn.fishtank.live/sfx/Call%20To%20Prayer-1773959715236.mp3" → "Call%20To%20Prayer-1773959715236.mp3"
        const sfxUrl = data.url || '';
        const audioFile = sfxUrl.split('/').pop() || null;

        const msg = {
            username: data.displayName || '???',
            message: data.sound || data.message || '???',
            room: data.room || '?',
            audioFile,
            clanTag: data.clanTag || null,
        };

        log('[SFX]', msg.username, msg.message, msg.room);
        logSfx(msg);
    });

    // ── Socket health monitor ───────────────────────────────────────
    // Global chat is very active — if we haven't received ANY event
    // in 60 seconds, something is wrong. Force a reconnect.

    let lastSocketEvent = Date.now();

    // Update the timestamp on any socket event
    socket.on('chat:message', () => { lastSocketEvent = Date.now(); });
    socket.on('tts:update',   () => { lastSocketEvent = Date.now(); });
    socket.on('sfx:insert',   () => { lastSocketEvent = Date.now(); });
    socket.on('chat:presence', () => { lastSocketEvent = Date.now(); });
    socket.on('presence',      () => { lastSocketEvent = Date.now(); });

    setInterval(() => {
        const silenceMs = Date.now() - lastSocketEvent;
        if (silenceMs > 60000 && socket.isConnected()) {
            console.warn(`[FTL Extended] No socket events for ${Math.round(silenceMs / 1000)}s — forcing reconnect`);
            socket.forceReconnect();
            lastSocketEvent = Date.now(); // Reset so we don't spam reconnects
        }
    }, 15000);

    // ── Toast observer (DOM-based, for admin notifications) ─────────
    // Toasts include item drops, crafting alerts, season pass gifts,
    // and admin announcements. Not all of these have socket events,
    // so we keep the DOM observer for toasts.

    const toastStarted = await ui.toastObserver.waitAndObserve();
    log('Toast observer started:', toastStarted);

    ui.toastObserver.onToast((toast) => {
        logAdminToast(toast);
    });

    // ── Keyboard shortcuts ──────────────────────────────────────────

    // E always opens FTL Extended settings
    ui.keyboard.register('ftl-settings', { key: 'e' }, openSettingsModal);

    // Togglable shortcuts
    const shortcutIf = (fn) => () => { if (getSetting('enableKeyboardShortcuts')) fn(); };

    ui.keyboard.register('open-settings',     { key: 'q' }, shortcutIf(() => openModal('settings')));
    ui.keyboard.register('open-edit-profile', { key: 'p' }, shortcutIf(() => openModal('editProfile')));
    ui.keyboard.register('open-help',         { key: 'h' }, shortcutIf(() => openModal('help')));
    ui.keyboard.register('open-season-pass',  { key: 'x' }, shortcutIf(() => openModal('seasonPass')));
    ui.keyboard.register('theatre-mode',      { key: 't' }, (e) => {
        if (getSetting('enhancedTheatreMode')) {
            // Block the site's own theatre mode handler
            e.stopImmediatePropagation();
            toggleTheatre();
        }
        // When setting is off, do nothing — let the event reach the site's handler
    });
    ui.keyboard.register('theatre-fullscreen', { key: 'f', preventDefault: false }, (e) => {
        if (getSetting('enhancedTheatreMode')) {
            e.stopImmediatePropagation();
            if (document.fullscreenElement) {
                // Already fullscreen — just exit fullscreen
                document.exitFullscreen();
                // If theatre mode is active, exit that too
                if (isTheatreActive()) exitTheatre();
            } else {
                // Enter our theatre mode first, then fullscreen
                if (!isTheatreActive()) enterTheatre();
                document.documentElement.requestFullscreen();
            }
        }
    });
    ui.keyboard.register('theatre-exit',      { key: 'escape', preventDefault: false }, () => {
        if (isTheatreActive()) exitTheatre();
    });
    ui.keyboard.register('open-craft',        { key: 'c' }, shortcutIf(() => openModal('craftItem')));
    ui.keyboard.register('open-item-market',  { key: 'm' }, shortcutIf(() => openModal('itemMarket')));
    ui.keyboard.register('open-stox',         { key: 's' }, shortcutIf(() => {
        if (document.getElementById('modal')) {
            document.dispatchEvent(new CustomEvent('modalClose'));
            setTimeout(() => {
                const stoxBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Stox');
                if (stoxBtn) stoxBtn.click();
            }, 50);
        } else {
            const stoxBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Stox');
            if (stoxBtn) stoxBtn.click();
        }
    }));

    // ── Dropdown button injection (click listener, NOT body observer) ─

    document.addEventListener('click', () => {
        setTimeout(tryInjectDropdownButton, 100);
    });

    // ── Hidden clickable zone detection ────────────────────────────────

    initZoneDetection();

    // ── Theatre mode button intercept ───────────────────────────────

    initTheatreButtonIntercept();

    // ── Startup toast ───────────────────────────────────────────────

    ui.toasts.notify('FTL Extended loaded!', {
        description: 'v2.0.1',
        type: 'success',
        duration: 3000,
    });
});
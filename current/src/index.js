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

import { site, ui, socket, player, chat, transport, debug } from '../../ftl-ext-sdk/src/index.js';
import { io } from 'socket.io-client';
import * as msgpackParser from 'socket.io-msgpack-parser';
import { loadSettings, getSetting } from './settings.js';
import { loadLogs, logTts, logSfx, logPing, logRoleMessage, logAdminToast, setOnPingCountChange } from './logging.js';
import { loadRecipesFromCache, fetchRecipes, initCraftingHints, initUseItemHints } from './crafting.js';
import { openSettingsModal, openModal, tryInjectDropdownButton, tryInjectPingButton, tryInjectIrcButton, toggleIrcMode, isIrcActive, updatePingBadge, setCurrentUsername, setActiveModal, setUserPasses } from './modals.js';
import { initZoneDetection } from './zones.js';
import { toggleTheatre, enterTheatre, exitTheatre, isTheatreActive, initTheatreButtonIntercept, tryInjectVodControls } from './theatre.js';
import { tryInjectInventorySearch, tryInjectCraftingItemSearch, tryInjectSidebarInventorySearch, initTradeSearch, tryApplyInventorySort } from './inventory.js';
import { initArchiveGridSaver } from './archive-grid.js';
import { initClockPersistence, isRerunActive } from './rerun.js';
import { handleRerunEscape, openRerunOverlay, watchShareCode } from './rerun-ui.js';
import { handleZonesEscape } from './rerun-zones.js';
import { tryInjectSiteZones } from './site-zones.js';
import { tryInjectRerunPanel } from './rerun-panel.js';

const DEBUG = false;

// Mirror the DEBUG flag into the SDK so its lifecycle logs
// (connect, disconnect, subscribe, etc.) match the extension's
// verbosity. When DEBUG is false both go quiet.
if (DEBUG) debug.enable();
const log = (...args) => DEBUG && console.log('[FTL Extended]', ...args);

// ── Pre-ready setup (must not miss early events) ────────────────────

loadSettings();

// Archive grid saver must install its play() patch BEFORE any grid tile
// renders and calls play(), so it runs here in pre-ready, not whenReady.
// The patch is a harmless prototype swap that no-ops while disabled.
initArchiveGridSaver();



// Register the SDK's cross-origin transport. The SDK calls this
// whenever it needs to fetch something the page can't (e.g. audio
// file downloads). We proxy through the background service worker
// which runs with host_permissions and isn't bound by CORS.
transport.register(async (url) => {
    const response = await chrome.runtime.sendMessage({
        type: 'ftl-sdk-fetch',
        url,
    });
    if (!response?.ok) {
        throw new Error(response?.error || 'Background fetch failed');
    }
    return new Uint8Array(response.data);
});

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
    setActiveModal(modalName || null);

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

    // Inject item search when trade modal opens
    if (modalName === 'tradeItem') {
        initTradeSearch();
    }
});

document.addEventListener('modalClose', () => {
    setActiveModal(null);
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

    // Re-run mode: apply away-time handling to the virtual clock and
    // start the presence heartbeat. If a re-run is active, open the
    // player automatically — the whole point is that coming back to
    // the site drops you straight back into "live".
    initClockPersistence();
    if (isRerunActive()) {
        openRerunOverlay();
    }

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

    // ── Room setup and reconnect handling ───────────────────────────
    //
    // The backend tracks "current room" per user. Any authenticated
    // socket that connects with a room subscription updates the user's
    // current room on the server, which then gets pushed back to the
    // site's own chat socket — causing the site's chat to switch rooms
    // unexpectedly.
    //
    // To avoid this:
    //   1. Room sockets have auto-reconnect disabled (see SDK).
    //   2. On primary socket disconnect, we tear down all room sockets.
    //   3. On primary reconnect, we wait 3 seconds for the site's own
    //      socket to stabilise, then:
    //        a. Emit chat:room: <snapshotted room> on our primary socket
    //        b. Re-subscribe to each monitored room
    //        c. After each subscription, re-emit chat:room: <snapshot>
    //           again to reset the server's view of current room
    //
    // The snapshot comes from chat-filter.js which watches the store.

    // Rooms we want to monitor — populated from the profile fetch.
    let monitoredRooms = [];
    // Generation counter — incremented on every disconnect. Used to
    // cancel in-flight reconnect flows when a new disconnect happens
    // before the previous restore completed.
    let reconnectGeneration = 0;

    async function reestablishRooms(generation) {
        for (const room of monitoredRooms) {
            // Bail if a newer disconnect has happened
            if (generation !== reconnectGeneration) {
                log('Reconnect flow cancelled mid-flight, bailing out');
                return;
            }
            const ok = await chat.rooms.subscribe(room);
            if (ok) log('Re-subscribed to room:', room);
        }
    }

    {
        const raw = socket.getSocket();
        if (raw) {
            raw.on('disconnect', () => {
                reconnectGeneration++;

                // Tear down all room sockets. They can't auto-reconnect
                // any more (we disabled it), so we control re-establishment.
                chat.rooms.unsubscribeAll();
                window.postMessage({ type: 'ftl-socket-disconnected' }, '*');
            });
            raw.on('connect', async () => {
                // Tell chat-filter.js we're back — it'll watch the
                // store for corruption and call changeChatRoom to fix
                // it immediately if it happens.
                window.postMessage({ type: 'ftl-socket-reconnected' }, '*');

                // Re-subscribe to monitored rooms. chat-filter is
                // already watching and will correct any room flip
                // this triggers.
                const myGeneration = reconnectGeneration;
                await reestablishRooms(myGeneration);
            });
        }
    }

    // ── Post-login sidebar injection watcher ────────────────────────
    // Logged out, the left sidebar holds only the Events panel; logging
    // in makes the site render Missions + Inventory — the anchors our
    // sidebar injections need. Render timing varies wildly (slow while
    // a season is live), so rather than guessing with timeouts we watch
    // the sidebar container for panels appearing — element-scoped like
    // the trade modal's grid observer, debounced, and torn down the
    // moment the work is done. Never observes document/body. React can
    // also swap the whole sidebar node on login, so a disconnected
    // target triggers one re-find rather than a dead observer.
    let sidebarWatchActive = false;

    function watchSidebarForInjection() {
        if (sidebarWatchActive) return;
        if (!getSetting('enableInventorySearch') && !getSetting('rerunSidebarPanel')) return;

        sidebarWatchActive = true;
        const deadline = Date.now() + 120000; // hard cap; click pass backstops after
        let observer = null;
        let findTimer = null;
        let debounce = null;

        const stop = () => {
            sidebarWatchActive = false;
            if (observer) observer.disconnect();
            if (findTimer) clearInterval(findTimer);
            if (debounce) clearTimeout(debounce);
            observer = null; findTimer = null; debounce = null;
        };

        // The sidebar exists even logged out (Events only) — climb from
        // any panel title to its fixed left-edge container.
        const findSidebar = () => {
            const title = [...document.querySelectorAll('span.font-bold')].find(
                t => t.closest('.shadow-panel')?.closest('div.fixed')?.classList.contains('left-0'));
            return title?.closest('div.fixed') ?? null;
        };

        // Returns true when there's nothing left for the watcher to do
        // (each injection either succeeded or is disabled in settings).
        const attempt = (sidebar) => {
            tryInjectSidebarInventorySearch();
            tryInjectRerunPanel();
            tryApplyInventorySort();
            const searchDone = !getSetting('enableInventorySearch')
                || !!sidebar.querySelector('[data-ftl-sdk="item-search"]');
            const panelDone = !getSetting('rerunSidebarPanel')
                || !!sidebar.querySelector('[data-ftl-sdk="rerun-panel"]');
            return searchDone && panelDone;
        };

        const observe = (sidebar) => {
            observer = new MutationObserver(() => {
                if (debounce) return;
                debounce = setTimeout(() => {
                    debounce = null;
                    if (Date.now() > deadline) { stop(); return; }
                    if (!sidebar.isConnected) {
                        observer.disconnect(); observer = null;
                        start();
                        return;
                    }
                    if (attempt(sidebar)) stop();
                }, 150);
            });
            observer.observe(sidebar, { childList: true, subtree: true });
        };

        const start = () => {
            const sidebar = findSidebar();
            if (sidebar) {
                if (attempt(sidebar)) { stop(); return; }
                observe(sidebar);
                return;
            }
            // Sidebar not rendered at all yet — cheap re-check until it
            // is, then hand over to the observer.
            findTimer = setInterval(() => {
                if (Date.now() > deadline) { stop(); return; }
                const el = findSidebar();
                if (!el) return;
                clearInterval(findTimer); findTimer = null;
                if (attempt(el)) { stop(); return; }
                observe(el);
            }, 500);
        };

        start();
    }

    // ── Season Pass room auto-detection ─────────────────────────────
    // Wait for the user's auth cookie to appear, extract their UUID,
    // fetch their profile to check Season Pass status, then subscribe
    // to additional rooms if they have access and haven't turned it off.

    site.onUserIdDetected((userId) => {
        log('User ID detected:', userId);

        // Logging in makes the site render the left sidebar's Missions/
        // Inventory panels (logged out it holds only Events) — watch for
        // them appearing rather than guessing at render timing.
        watchSidebarForInjection();

        fetch(`https://api.fishtank.live/v1/profile/${userId}`)
            .then(r => r.json())
            .then(async (data) => {
                const profile = data?.profile;
                if (!profile) return;

                // Update pass status for settings UI
                setUserPasses({
                    seasonPass: !!profile.seasonPass,
                    seasonPassXL: !!profile.seasonPassXL,
                });

                // Build the list of rooms we want to monitor
                monitoredRooms = [];
                // Season Pass monitoring disabled (broken) — never add these
                // rooms so the settings are effectively off for all users.
                // if (profile.seasonPass && getSetting('monitorSeasonPass')) {
                //     monitoredRooms.push('Season Pass');
                // }
                // if (profile.seasonPassXL && getSetting('monitorSeasonPassXL')) {
                //     monitoredRooms.push('Season Pass XL');
                // }

                // Initial subscription — uses the same flow as reconnect
                const subscribed = ['Global'];
                for (const room of monitoredRooms) {
                    const ok = await chat.rooms.subscribe(room);
                    if (ok) {
                        subscribed.push(room);
                        log('Subscribed to room:', room);
                    }
                }

                // One-time startup announcement — always visible so
                // users can confirm the extension is running and see
                // which rooms are being monitored. Lifecycle churn
                // on reconnects stays gated behind DEBUG.
                console.log(`[FTL Extended] Ready — monitoring ${subscribed.join(', ')}`);

                // After initial subscription, reset the server's view
                // of current room back to Global so the site defaults
                // correctly on refresh.
                if (monitoredRooms.length > 0) {
                    const raw = socket.getSocket();
                    if (raw) raw.emit('chat:room', 'Global');
                }
            })
            .catch(err => {
                log('Profile fetch failed:', err.message);
                console.log('[FTL Extended] Ready — monitoring Global (profile fetch failed, Season Pass rooms unavailable)');
            });
    });

    // ── Chat messages via SDK (normalised + structured) ────────────────
    //
    // Two parallel capture paths feed the same handler:
    //   1. chat.messages.onMessage — Socket.IO, structured data, multi-room
    //   2. window.postMessage from chat-filter.js — Zustand store, Global only
    //
    // The store path is a backup for messages the monitoring sockets miss.
    // Dedup happens at the log layer via msg.raw.id, so duplicates are
    // dropped automatically.

    function handleChatMessage(msg, source) {
        log(`[CHAT/${source}]`, msg.username, msg.message);

        // Pings — chat messages that mention the current user
        if (currentUsername && msg.mentions.length > 0) {
            const lower = currentUsername.toLowerCase();
            if (msg.mentions.some(m => m.displayName.toLowerCase() === lower)) {
                logPing(msg);
            }
        }

        // Staff / Mod / Fish messages (logged to dedicated role logs)
        // Epic and Grand Marshal are visual styling only, not separate log categories
        if (msg.role === 'staff' || msg.role === 'mod' || msg.role === 'fish') {
            logRoleMessage(msg);
        }
    }

    chat.messages.onMessage((msg) => handleChatMessage(msg, 'socket'));

    // Backup capture from chat-filter.js (page-realm Zustand store)
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        if (e.data?.type !== 'ftl-chat-store-message') return;
        if (!e.data.message) return;
        handleChatMessage(e.data.message, 'store');
    });

    // ── TTS via SDK (normalised + deduplicated) ─────────────────────

    chat.messages.onTTS((msg) => {
        log('[TTS]', msg.username, msg.message, msg.voice, msg.room);
        logTts(msg);
    });

    // ── SFX via SDK (normalised + deduplicated) ─────────────────────

    chat.messages.onSFX((msg) => {
        log('[SFX]', msg.username, msg.message, msg.room);
        logSfx(msg);
    });

    // ── Socket health monitor ───────────────────────────────────────
    // Global chat is very active — if we haven't received ANY event
    // in 60 seconds, something is wrong. Force a reconnect.

    let lastSocketEvent = Date.now();

    // Update the timestamp on any socket event
    socket.on('chat:message', () => { lastSocketEvent = Date.now(); });
    socket.on('tts:insert',   () => { lastSocketEvent = Date.now(); });
    socket.on('tts:update',   () => { lastSocketEvent = Date.now(); });
    socket.on('sfx:insert',   () => { lastSocketEvent = Date.now(); });
    socket.on('sfx:update',   () => { lastSocketEvent = Date.now(); });
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
        // Theatre first: when theatre is applied to the re-run player,
        // ESC should peel back one layer at a time (theatre → grid → close).
        if (isTheatreActive()) { exitTheatre(); return; }
        if (handleRerunEscape()) return;
        // Zone editor on the site's own archive player (the personal
        // re-run overlay handles its own zones inside handleRerunEscape)
        if (handleZonesEscape()) return;
        if (isIrcActive()) toggleIrcMode();
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
        setTimeout(tryInjectInventorySearch, 100);
        setTimeout(tryInjectSidebarInventorySearch, 100);
        setTimeout(tryInjectRerunPanel, 100);
        setTimeout(tryApplyInventorySort, 100);
        setTimeout(tryInjectCraftingItemSearch, 100);
        // VOD player appears after clicking a grid tile — its React
        // render can lag the click, so check twice.
        setTimeout(tryInjectVodControls, 150);
        setTimeout(tryInjectVodControls, 600);
        // Site archive-live player — attach clickable room zones
        setTimeout(tryInjectSiteZones, 150);
        setTimeout(tryInjectSiteZones, 600);
    });

    // ── Hidden clickable zone detection ────────────────────────────────

    initZoneDetection();

    // Sidebar injections are driven by login detection (see
    // watchSidebarForInjection) plus the click pass as a backstop.

    // ── Re-run share links ─────────────────────────────────────────────
    // fishtank.live/#FTL1-s03-D11-181745-kitchen opens that moment as a
    // preview (the user's own re-run position is never touched).

    const shareHash = location.hash.match(/^#(FTL1-[A-Za-z0-9-]+)$/i)?.[1];
    if (shareHash) {
        history.replaceState(null, '', location.pathname + location.search);
        setTimeout(async () => {
            const err = await watchShareCode(shareHash);
            if (err) {
                ui.toasts.notify('Couldn\'t open share link', {
                    description: err, type: 'info', duration: 6000,
                });
            }
        }, 1200);
    }

    // ── Ping & IRC buttons in chat header ─────────────────────────────

    tryInjectPingButton();
    tryInjectIrcButton();
    setOnPingCountChange(updatePingBadge);

    // ── Theatre mode button intercept ───────────────────────────────

    initTheatreButtonIntercept();

    // ── Video stutter fix ───────────────────────────────────────────
    // The site's HLS player falls behind the live edge and attempts a
    // gradual 1.1x catch-up that causes frame drops and freezing.
    // This fix monitors the video element and snaps to the live edge
    // when playback falls more than 3 seconds behind. It also resets
    // the playback rate to 1x to prevent the decoder from struggling.

    // Setting key is videoStutterImprover (was checking a non-existent
    // 'videoStutterFix' key, so this never ran). Live-edge snapping only
    // makes sense for the HLS player — scope the lookup to it so VOD and
    // re-run playback are never yanked forward.
    if (getSetting('videoStutterImprover')) {
        setInterval(() => {
            const video = document.getElementById('live-stream-player')?.querySelector('video');
            if (!video || !video.buffered.length) return;
            if (video.playbackRate !== 1) video.playbackRate = 1;
            const edge = video.buffered.end(video.buffered.length - 1);
            const behind = edge - video.currentTime;
            if (behind > 3) {
                video.currentTime = edge - 0.5;
                log('Video stutter fix: snapped to live edge, was', behind.toFixed(1) + 's behind');
            }
        }, 3000);
    }

    // ── Chat filter (page-level script injection) ────────────────────
    // Injects a script into the page realm to access the React/Zustand
    // chat store directly. This bypasses the content script cross-realm
    // limitation.

    let detectedUserId = null;
    const chatFilterKeys = ['smartAntiSpam', 'hideTTSMessages', 'hideSFXMessages', 'hideStoxMessages'];

    function sendChatFilterSettings() {
        const s = Object.fromEntries(chatFilterKeys.map(k => [k, getSetting(k)]));
        s.wordFilters = getSetting('chatWordFilters') || [];
        window.postMessage({ type: 'ftl-chat-filter-settings', settings: s }, '*');
    }

    // Track user ID and keep sending it until the page script confirms receipt
    site.onUserIdDetected((userId) => {
        detectedUserId = userId;
    });

    // Retry sending user ID and settings every second until confirmed
    const userIdInterval = setInterval(() => {
        if (detectedUserId) {
            window.postMessage({ type: 'ftl-chat-filter-userid', userId: detectedUserId }, '*');
        }
        sendChatFilterSettings();
    }, 1000);

    // Stop retrying user ID once the page script confirms
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ftl-chat-filter-userid-ack') {
            clearInterval(userIdInterval);
            sendChatFilterSettings();
        }
    });

    const chatFilterScript = document.createElement('script');
    chatFilterScript.src = chrome.runtime.getURL('current/chat-filter.js');
    document.documentElement.appendChild(chatFilterScript);
    chatFilterScript.onload = () => chatFilterScript.remove();

    // ── Startup toast ───────────────────────────────────────────────

    ui.toasts.notify('FTL Extended loaded!', {
        description: '__BUILD_VERSION__',
        type: 'success',
        duration: 3000,
    });
});
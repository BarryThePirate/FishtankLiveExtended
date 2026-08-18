/**
 * rerun-ui.js — Re-run mode: grid + player UI
 *
 * Renders the personal re-run experience: a full-area overlay with a
 * clickable grid of room tiles (with No Signal countdowns), and a
 * focused player that replaces the grid when a room is clicked —
 * mirroring how the site's own archive-live grid behaves.
 *
 * The overlay is docked inside the site's page wrapper, absolutely
 * positioned over the stream grid's box only — header, chat, tickers
 * and modals all keep their normal place and stacking. If the grid
 * container can't be found, it falls back to a fixed full-viewport
 * overlay that stops at the chat's left edge (legacy behaviour).
 *
 * All state/data comes from rerun.js; this module is DOM only.
 *
 * PLAYBACK ENGINE (focused room):
 * - Resolve chunk + offset for virtualNow(), fetch signed URL, play
 * - Validate offset against real duration (gap → No Signal + countdown)
 * - Drift resync (>2s) on a 30s check and on visibilitychange
 * - onEnded/countdown-expiry → re-resolve; next chunk URL prefetched
 *   ~45s before the current chunk ends for a near-gapless handover
 * - onError → re-request signed URL (expired token), then back off
 */

import { archives } from '../../ftl-ext-sdk/src/index.js';
import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import { getSetting } from './settings.js';
import {
    loadSeasonData, getSeasonRooms, virtualNow, virtualMsToDayNumber,
    isPaused, pause, resume, nudge, isPastSeasonEnd, getRoomStateAt, getChunkUrl,
    formatClock,
} from './rerun.js';
import { initZones, setZonesRoom, handleZonesEscape, updateZoneStatuses } from './rerun-zones.js';
import {
    isTheatreActive, exitTheatre, toggleTheatre,
    siteIconButton, siteTextButton, THEATRE_ICON_SVG, EXPAND_ICON_SVG,
} from './theatre.js';

const OVERLAY_ID = 'ftl-rerun-overlay';
const STYLE_ID = 'ftl-rerun-styles';
const VOLUME_KEY = 'rerun-volume';

const DRIFT_TOLERANCE_S = 2;
const SYNC_CHECK_MS = 30000;
const TILE_REFRESH_MS = 30000;
const PREFETCH_LEAD_S = 45;

// ── State ───────────────────────────────────────────────────────────

let overlay = null;
let gridEl = null;
let playerEl = null;
let videoEl = null;
let clockEls = [];          // elements showing "Day N  HH:MM:SS"
let playerClockDay = null;  // player clock "Day N" span
let playerClockTime = null; // player clock "HH:MM:SS" span
let focusedRoom = null;
let currentChunk = null;    // chunk object currently loaded in the video
let endedChunk = null;      // { fileName, duration } — real footage exhausted
let prefetched = null;      // { fileName, url }
let tileStates = new Map(); // room → { status, nextStartsAtMs }
let intervals = [];
let resyncTimeout = null;
let errorRetries = 0;
let savedChatZ = null;
let dockedGrid = null;      // the site grid element we're docked over
let dockResize = null;      // ResizeObserver tracking the site grid's box

// ── Styles ──────────────────────────────────────────────────────────

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} {
            position: absolute;
            /* colour + texture come from the site's own bg-background
               classes (added on the element); fixed attachment keeps
               the texture tiles aligned with the page's fixed layer */
            background-attachment: fixed;
            z-index: 4;
            display: flex;
            flex-direction: column;
            font-family: inherit;
            color: #eee;
            border-radius: 6px;
        }
        #${OVERLAY_ID}.ftl-rerun-fixed {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 50;
            border-radius: 0;
        }
        #${OVERLAY_ID} .ftl-rerun-header {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 10px 16px;
            flex: 0 0 auto;
            border-radius: 6px 6px 0 0;
        }
        #${OVERLAY_ID} .ftl-rerun-title {
            font-weight: bold;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        #${OVERLAY_ID} .ftl-rerun-clock {
            font-variant-numeric: tabular-nums;
            font-size: 14px;
        }
        #${OVERLAY_ID} .ftl-rerun-paused-badge {
            font-size: 11px;
            text-transform: uppercase;
            border: 1px solid currentColor;
            border-radius: 4px;
            padding: 2px 6px;
            display: none;
        }
        #${OVERLAY_ID}.ftl-rerun-is-paused .ftl-rerun-paused-badge { display: inline-block; }
        #${OVERLAY_ID} .ftl-rerun-spacer { flex: 1; }
        #${OVERLAY_ID} .ftl-rerun-nudges { display: flex; gap: 4px; }
        #${OVERLAY_ID} .ftl-rerun-btn {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 6px;
            color: rgba(255,255,255,0.85);
            cursor: pointer;
            padding: 6px 12px;
            font-size: 13px;
            line-height: 1;
            transition: background 0.15s;
        }
        #${OVERLAY_ID} .ftl-rerun-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }
        /* Grid layout mirrors the site's stream grid: 2 cols (gap-5),
           6 cols + gap-10 at lg, rows squeezed to fit in desktop
           landscape. Tile visuals use the site's own utility classes. */
        #${OVERLAY_ID} .ftl-rerun-grid {
            flex: 1;
            min-height: 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
            overflow-y: auto;
            align-content: start;
            padding: 8px;
            margin: -8px;   /* room for tile hover outlines at the edges */
        }
        #${OVERLAY_ID} .ftl-rerun-cell {
            position: relative;
            aspect-ratio: 3 / 2;
        }
        @media (min-width: 1024px) {
            #${OVERLAY_ID} .ftl-rerun-grid {
                grid-template-columns: repeat(var(--ftl-rerun-cols, 6), minmax(0, 1fr));
                gap: 40px;
            }
        }
        @media (min-width: 1024px) and (orientation: landscape) {
            #${OVERLAY_ID} .ftl-rerun-grid {
                grid-template-rows: repeat(var(--ftl-rerun-rows, 4), minmax(0, 1fr));
                align-content: stretch;
            }
            #${OVERLAY_ID} .ftl-rerun-cell { aspect-ratio: auto; }
        }
        #${OVERLAY_ID} .ftl-rerun-tile-status.on-air { color: #4ade80; }
        #${OVERLAY_ID} .ftl-rerun-zone-status.on-air { color: #4ade80; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-on-air .ftl-rerun-tile-noise { display: none; }
        /* Live thumbnail: shown once loaded; hides the centred status */
        #${OVERLAY_ID} .ftl-rerun-tile-thumb { display: none; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-has-thumb .ftl-rerun-tile-thumb { display: block; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-has-thumb .ftl-rerun-tile-center { display: none; }
        #${OVERLAY_ID} .ftl-rerun-player {
            position: relative;
            flex: 1;
            display: none;
            background: #000;
            overflow: hidden;
            border-radius: 0 0 6px 6px;
        }
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-grid { display: none; }
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-player { display: block; }
        /* Controls fade out while idle (see buildPlayer's idle timer) */
        #${OVERLAY_ID} .ftl-rerun-player-bar,
        #${OVERLAY_ID} .ftl-rerun-player-clock,
        #${OVERLAY_ID} .ftl-rerun-close-btn { transition: opacity 0.3s ease; }
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-player-bar,
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-player-clock,
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-close-btn {
            opacity: 0;
            pointer-events: none;
        }
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle { cursor: none; }
        /* ── Mobile (below the site's lg breakpoint) ─────────────────
           The site's chat becomes a fixed bottom panel (z-2 inside a
           z-1 wrapper) overlaying the page. Drop the overlay beneath it
           — DOM order still paints us above the grid tiles we cover —
           and pin the focused player to the top 55% of the viewport,
           exactly like the site's own mobile camera player. */
        @media (max-width: 1023px) {
            #${OVERLAY_ID}:not(.ftl-rerun-fixed) { z-index: 0; }
            #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-player {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: calc(var(--vh, 1vh) * 55);
                border-radius: 0;
            }
        }
        #${OVERLAY_ID} .ftl-rerun-player video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        #${OVERLAY_ID} .ftl-rerun-room-label {
            position: absolute;
            top: 0;
            left: 0;
            margin: 12px;
            font-size: 18px;
            font-weight: bold;
            color: #fff;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
            z-index: 3;
        }
        /* Focused player controls mimic the site's player: X top-right,
           volume bottom-left, Day+clock bottom-right. Our header only
           shows on the grid view. */
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-header { display: none; }
        #${OVERLAY_ID} .ftl-rerun-player-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 12px;
            z-index: 3;
        }
        #${OVERLAY_ID} .ftl-rerun-player-clock {
            position: absolute;
            bottom: 0;
            right: 0;
            margin: 14px 12px;
            z-index: 3;
        }
        #${OVERLAY_ID} .ftl-rerun-volume-btn {
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal {
            position: absolute;
            inset: 0;
            z-index: 2;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px),
                #101010;
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal.visible { display: flex; }
        #${OVERLAY_ID} .ftl-rerun-nosignal-label {
            font-size: 22px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255,255,255,0.8);
            text-shadow: 2px 2px 0 rgba(0,0,0,0.6);
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal-countdown {
            font-size: 15px;
            color: rgba(255,255,255,0.45);
            font-variant-numeric: tabular-nums;
            text-transform: uppercase;
        }
        #${OVERLAY_ID} .ftl-rerun-message {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px;
            color: rgba(255,255,255,0.7);
            font-size: 15px;
            line-height: 1.5;
        }
        /* Fixed fallback only: keep site modals above the overlay */
        body.ftl-rerun-fixed-open #modal { z-index: 52 !important; }
    `;
    document.head.appendChild(style);
}

// ── Mounting ────────────────────────────────────────────────────────
//
// Preferred: dock inside the home page wrapper (div.pb-10 > div.relative,
// the same persistent anchor archive-grid.js uses), absolutely positioned
// over the stream grid element. The grid's own responsive margins already
// keep it clear of the chat panel, so no z-index juggling is needed.
// Fallback: fixed full-viewport overlay with the chat raised above it.

function findSiteGrid() {
    const wrapper = document.querySelector('div.pb-10 > div.relative');
    if (!wrapper) return null;
    const grid = [...wrapper.children].find(el => el.classList.contains('grid'));
    return grid ? { wrapper, grid } : null;
}

function positionOverlay() {
    if (!overlay || !dockedGrid) return;
    // Theatre mode owns the overlay's geometry while active.
    if (document.body.classList.contains('ftl-theatre-mode')) return;
    // Cover the grid's CONTENT box, not its border box — the site grid's
    // horizontal padding (pl-5 / lg:pr-10) extends under the chat panel's
    // margin, and painting over it would clip the chat's edge.
    const cs = getComputedStyle(dockedGrid);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    overlay.style.top = `${dockedGrid.offsetTop}px`;
    overlay.style.left = `${dockedGrid.offsetLeft + padL}px`;
    overlay.style.width = `${dockedGrid.clientWidth - padL - padR}px`;
    // On mobile the site's chat is a fixed panel covering the bottom
    // ~40vh (+48px nav). The site's own grid hides its last rows under
    // it; we do better by extending the overlay with empty clearance so
    // every row can scroll up past the chat. Our header makes our grid
    // run taller than the site's, so measure clearance from our own
    // last tile rather than the site grid's bottom.
    let height = dockedGrid.offsetHeight;
    if (window.matchMedia('(max-width: 1023px)').matches) {
        const cells = overlay.querySelectorAll('.ftl-rerun-cell');
        const last = cells[cells.length - 1];
        const contentBottom = last ? last.offsetTop + last.offsetHeight : height;
        height = Math.max(height, contentBottom)
            + Math.round(window.innerHeight * 0.4) + 64;
    }
    overlay.style.height = `${height}px`;
}

function mountDocked() {
    const found = findSiteGrid();
    if (!found) return false;
    dockedGrid = found.grid;
    overlay.style.right = '';
    found.wrapper.appendChild(overlay);
    positionOverlay();
    dockResize = new ResizeObserver(positionOverlay);
    dockResize.observe(dockedGrid);
    window.addEventListener('resize', positionOverlay);
    return true;
}

function mountFixed() {
    overlay.classList.add('ftl-rerun-fixed');
    overlay.style.top = overlay.style.left = overlay.style.width = overlay.style.height = '';
    document.body.classList.add('ftl-rerun-fixed-open');
    document.body.appendChild(overlay);
    layoutAroundChat();
    window.addEventListener('resize', layoutAroundChat);
}

function unmountListeners() {
    dockResize?.disconnect();
    dockResize = null;
    dockedGrid = null;
    window.removeEventListener('resize', positionOverlay);
    window.removeEventListener('resize', layoutAroundChat);
}

/**
 * Called on the 1s tick: re-dock if a site re-render detached us, or
 * upgrade from the fixed fallback once the grid container appears.
 */
function ensureMounted() {
    if (!overlay) return;
    const fixedMode = overlay.classList.contains('ftl-rerun-fixed');
    if (overlay.isConnected && !fixedMode) return;
    if (overlay.isConnected && fixedMode && !findSiteGrid()) return;
    unmountListeners();
    restoreChatZ();
    overlay.classList.remove('ftl-rerun-fixed');
    document.body.classList.remove('ftl-rerun-fixed-open');
    if (!mountDocked()) mountFixed();
}

// ── Chat panel coexistence (fixed fallback only) ────────────────────

function findChatContainer() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return null;
    let el = chatInput.parentElement;
    while (el && el !== document.body) {
        if (el.classList.contains('fixed') || el.style.position === 'fixed') return el;
        el = el.parentElement;
    }
    return null;
}

/**
 * Size the overlay to stop at the chat panel's left edge (or span the
 * full viewport when no chat is present), and raise the chat above it.
 */
function layoutAroundChat() {
    if (!overlay) return;
    const chat = findChatContainer();
    if (chat) {
        const rect = chat.getBoundingClientRect();
        const chatWidth = Math.max(0, window.innerWidth - rect.left);
        overlay.style.right = (rect.width > 40 && chatWidth < window.innerWidth / 2)
            ? `${chatWidth}px`
            : '0';
        if (savedChatZ === null) {
            savedChatZ = { el: chat, z: chat.style.zIndex, parentZ: chat.parentElement?.style.zIndex ?? '' };
            chat.style.zIndex = '51';
            if (chat.parentElement) chat.parentElement.style.zIndex = '51';
        }
    } else {
        overlay.style.right = '0';
    }
}

function restoreChatZ() {
    if (savedChatZ) {
        savedChatZ.el.style.zIndex = savedChatZ.z;
        if (savedChatZ.el.parentElement) savedChatZ.el.parentElement.style.zIndex = savedChatZ.parentZ;
        savedChatZ = null;
    }
}

// ── Formatting ──────────────────────────────────────────────────────

function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function clockText() {
    const now = virtualNow();
    if (now == null) return '';
    const day = virtualMsToDayNumber(now);
    return `${day != null ? `Day ${day}` : ''}  ${formatClock(now)}`;
}

// ── Overlay lifecycle ───────────────────────────────────────────────

export function isRerunUiOpen() {
    return !!overlay;
}

/**
 * ESC handling hook for index.js: focused → back to grid; grid → close.
 * Returns true if the event was consumed.
 */
export function handleRerunEscape() {
    if (!overlay) return false;
    if (document.fullscreenElement) return false; // browser handles fullscreen exit
    if (handleZonesEscape()) return true; // cancel trace / exit zone editor first
    if (focusedRoom) {
        exitFocused();
    } else {
        closeRerunOverlay();
    }
    return true;
}

export async function openRerunOverlay() {
    if (overlay) return;
    injectStyles();

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('data-ftl-sdk', 'rerun');
    // Match the page background exactly: the site paints it on a fixed
    // layer behind everything (bg-background colour + texture image),
    // so the overlay borrows the same classes rather than a colour.
    overlay.classList.add('bg-background', '[background-image:var(--texture-background)]');
    document.body.classList.add('ftl-rerun-open');
    if (!mountDocked()) mountFixed();

    buildHeader();
    intervals.push(setInterval(renderClocks, 1000));

    const ok = await loadSeasonData();
    if (!overlay) return; // closed while loading
    if (!ok) {
        showMessage('Couldn\'t load archive data. Watching the archives requires being logged in to fishtank.live with a season pass — check that, then try again.');
        return;
    }
    if (virtualNow() == null) {
        showMessage('No re-run start point set. Open FTL Extended settings (E) → Re-run tab and pick a day and time.');
        return;
    }
    if (isPastSeasonEnd()) {
        showMessage('Your re-run has reached the end of the season. Pick a new start point in the Re-run settings tab.');
        return;
    }

    buildGrid();
    buildPlayer();
    refreshTiles();

    intervals.push(setInterval(refreshTiles, TILE_REFRESH_MS));
    intervals.push(setInterval(() => { if (focusedRoom) syncPlayback(false); }, SYNC_CHECK_MS));
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onNudgeKeys);
}

export function closeRerunOverlay() {
    if (!overlay) return;
    exitFocused();
    intervals.forEach(clearInterval);
    intervals = [];
    if (resyncTimeout) { clearTimeout(resyncTimeout); resyncTimeout = null; }
    unmountListeners();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('keydown', onNudgeKeys);
    restoreChatZ();
    document.body.classList.remove('ftl-rerun-open');
    document.body.classList.remove('ftl-rerun-fixed-open');
    overlay.remove();
    overlay = null;
    gridEl = null;
    playerEl = null;
    videoEl = null;
    clockEls = [];
    playerClockDay = null;
    playerClockTime = null;
    tileStates = new Map();
}

function onVisibilityChange() {
    if (document.visibilityState === 'visible' && focusedRoom) syncPlayback(false);
}

function showMessage(text) {
    if (!overlay) return;
    overlay.querySelector('.ftl-rerun-message')?.remove();
    const msg = document.createElement('div');
    msg.className = 'ftl-rerun-message';
    msg.textContent = text;
    overlay.appendChild(msg);
}

// ── Header ──────────────────────────────────────────────────────────

function buildHeader() {
    // Styled as one of the site's light textured panels (same treatment
    // as the chat box / ticker frames), so it stands out against the
    // dark grid the way the site's own bars do.
    const header = document.createElement('div');
    header.className = 'ftl-rerun-header bg-light text-dark-text [background-image:var(--texture-panel)]'
        + ' border-t-2 border-t-light-300/75 border-b-3 border-b-light-700/50'
        + ' border-l-2 border-l-light-300/75 border-r-2 border-r-light-700/75 shadow-panel';

    const title = document.createElement('span');
    title.className = 'ftl-rerun-title';
    const season = getSetting('rerunSeason');
    title.textContent = `Re-run — Season ${parseInt(String(season).replace(/^s/, ''), 10) || ''}`;

    const clock = document.createElement('span');
    clock.className = 'ftl-rerun-clock text-dark-text-400';
    clockEls.push(clock);

    const nudges = makeNudgeButtons();

    const pausedBadge = document.createElement('span');
    pausedBadge.className = 'ftl-rerun-paused-badge text-primary-400';
    pausedBadge.textContent = 'Paused';

    const spacer = document.createElement('div');
    spacer.className = 'ftl-rerun-spacer';

    const pauseBtn = makePauseButton();

    const closeBtn = siteTextButton(
        'Close re-run and return to the live site',
        'Exit Re-run',
        closeRerunOverlay,
        'primary'
    );

    header.append(title, clock, nudges, pausedBadge, spacer, pauseBtn, closeBtn);
    overlay.appendChild(header);
    overlay.classList.toggle('ftl-rerun-is-paused', isPaused());
    renderClocks();
}

// Site react-icons path (IoClose), matching the site player's X button.
const CLOSE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49z"></path></svg>';

// Site react-icons paths (IoPause / IoPlay), matching the player buttons.
const PAUSE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16zm144 0h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"></path></svg>';
const PLAY_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"></path></svg>';

function makePauseButton() {
    const btn = siteIconButton(
        isPaused() ? 'Resume re-run clock' : 'Pause re-run clock',
        isPaused() ? PLAY_ICON_SVG : PAUSE_ICON_SVG,
        togglePause,
    );
    btn.classList.add('ftl-rerun-pause-btn');
    return btn;
}

/**
 * Time nudge buttons — jump the re-run clock without re-picking a
 * start point. Ordered as a number line: back on the left. Used in
 * both the header bar and the focused player's control bar.
 */
function makeNudgeButtons() {
    const nudges = document.createElement('div');
    nudges.className = 'ftl-rerun-nudges';
    for (const [label, ms] of [
        ['-1h', -3600000], ['-5m', -300000], ['-1m', -60000],
        ['+1m', 60000], ['+5m', 300000], ['+1h', 3600000],
    ]) {
        const back = ms < 0;
        nudges.appendChild(siteTextButton(
            `Jump ${back ? 'back' : 'forward'} ${label.slice(1)}`,
            label,
            () => nudgeClock(ms),
            back ? 'primary' : 'secondary'
        ));
    }
    return nudges;
}

/**
 * Arrow-key nudging: ←/→ = ±1m, Shift = ±5m, Ctrl = ±1h. Works in
 * fullscreen and theatre with zero on-screen chrome.
 */
function onNudgeKeys(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!overlay) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const ms = (e.ctrlKey || e.metaKey) ? 3600000 : e.shiftKey ? 300000 : 60000;
    e.preventDefault();
    nudgeClock(dir * ms);
}

function nudgeClock(deltaMs) {
    nudge(deltaMs);
    renderClocks();
    refreshTiles();
    // syncPlayback no-ops while paused (frame stays frozen); the nudged
    // moment takes effect on resume, which re-anchors and syncs.
    if (focusedRoom) syncPlayback(true);
}

function togglePause() {
    if (isPaused()) {
        resume();
        if (focusedRoom) syncPlayback(true);
    } else {
        pause();
        videoEl?.pause();
    }
    updatePauseUi();
}

function updatePauseUi() {
    if (!overlay) return;
    const paused = isPaused();
    overlay.querySelectorAll('.ftl-rerun-pause-btn').forEach(b => {
        const inner = b.firstElementChild;
        if (inner) inner.innerHTML = paused ? PLAY_ICON_SVG : PAUSE_ICON_SVG;
        b.title = paused ? 'Resume re-run clock' : 'Pause re-run clock';
    });
    overlay.classList.toggle('ftl-rerun-is-paused', paused);
}

function renderClocks() {
    ensureMounted();
    const text = clockText();
    for (const el of clockEls) el.textContent = text;
    if (playerClockDay) {
        const now = virtualNow();
        if (now != null) {
            const day = virtualMsToDayNumber(now);
            playerClockDay.textContent = day != null ? `Day ${day}` : '';
            playerClockTime.textContent = formatClock(now);
        }
    }
    renderTileCountdowns();
    renderPlayerCountdown();
    updateZoneStatuses();
}

// ── Grid ────────────────────────────────────────────────────────────

// Same static-noise SVG the site's archive tiles use.
const NOISE_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)'/%3E%3C/svg%3E`;

function buildGrid() {
    gridEl = document.createElement('div');
    gridEl.className = 'ftl-rerun-grid';
    const rooms = getSeasonRooms();

    // Mirror the site's archive grid sizing: 6 desktop columns for big
    // seasons, 4 for small ones; pad the last row with empty tiles and
    // squeeze rows (max 6) so cells stay close to square.
    const total = rooms.length;
    const cols = total > 16 ? 6 : 4;
    const fillers = (cols - (total % cols)) % cols;
    const rows = Math.min((total + fillers) / cols, 6);
    gridEl.style.setProperty('--ftl-rerun-cols', String(cols));
    gridEl.style.setProperty('--ftl-rerun-rows', String(rows));

    for (const room of rooms) {
        const cell = document.createElement('div');
        cell.className = 'ftl-rerun-cell';

        // Tile styling reuses the site's own utility classes so it matches
        // the native stream grid exactly.
        const tile = document.createElement('button');
        tile.className = 'ftl-rerun-tile group relative overflow-hidden w-full h-full isolate cursor-pointer'
            + ' bg-gradient-to-t from-dark-500 via-dark-600 to-dark-600 shadow-panel rounded-md'
            + ' transition-all duration-100 hover:outline-2 hover:outline-tertiary-400 hover:outline-offset-4'
            + ' hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-tertiary-400'
            + ' focus-visible:outline-offset-4 focus-visible:scale-[1.02] active:scale-[0.98]';
        tile.dataset.room = room;
        tile.innerHTML = `
            <div class="relative w-full h-full bg-dark-800">
                <img class="ftl-rerun-tile-thumb absolute inset-0 z-[1] w-full h-full object-cover" alt="">
                <div class="ftl-rerun-tile-name absolute left-0 z-[3] text-light-text text-shadow-lg font-bold top-0 p-2 text-lg leading-none group-hover:text-link group-focus-visible:text-link"></div>
                <div class="ftl-rerun-tile-noise absolute inset-0 z-[2] overflow-hidden bg-dark-800 pointer-events-none">
                    <div class="absolute -top-32 -left-32 right-0 bottom-0 opacity-30 animate-archive-live-static" style="background-image: url(&quot;${NOISE_SVG}&quot;); background-size: 128px 128px;"></div>
                    <div class="absolute inset-0 bg-dark-900/40"></div>
                </div>
                <div class="ftl-rerun-tile-center absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 px-2 text-center pointer-events-none">
                    <div class="ftl-rerun-tile-status font-secondary uppercase tabular-nums text-light-text/50 text-shadow-md text-[clamp(9px,1.1vw,13px)]">…</div>
                </div>
            </div>`;
        tile.querySelector('.ftl-rerun-tile-name').textContent = archives.formatRoomLabel(room);
        const thumb = tile.querySelector('.ftl-rerun-tile-thumb');
        thumb.addEventListener('load', () => tile.classList.add('ftl-rerun-has-thumb'));
        thumb.addEventListener('error', () => {
            // No thumbnail for this chunk — fall back to the status look.
            tile.classList.remove('ftl-rerun-has-thumb');
            thumb.removeAttribute('src');
        });
        tile.addEventListener('click', () => focusRoom(room));
        cell.appendChild(tile);
        gridEl.appendChild(cell);
    }
    for (let i = 0; i < fillers; i++) {
        const filler = document.createElement('div');
        filler.className = 'ftl-rerun-cell hidden lg:block';
        filler.innerHTML = '<div class="relative w-full h-full bg-gradient-to-t from-dark-500 via-dark-600 to-dark-600 shadow-panel rounded-md"></div>';
        gridEl.appendChild(filler);
    }
    overlay.appendChild(gridEl);
}

async function refreshTiles() {
    if (!gridEl) return;
    const now = virtualNow();
    if (now == null) return;
    const rooms = getSeasonRooms();
    await Promise.all(rooms.map(async (room) => {
        try {
            const state = await getRoomStateAt(room, now);
            tileStates.set(room, state);
        } catch {
            tileStates.set(room, { status: 'unknown' });
        }
    }));
    renderTileCountdowns();
    refreshTileThumbs();
}

/**
 * Point each on-air tile's thumbnail at the frame for the current
 * virtual moment. Runs on the tile refresh cadence (~30s) — the site's
 * own grid refreshes previews at a similar rate. Missing thumbnails
 * fall back to the status look via the img error handler.
 */
function refreshTileThumbs() {
    if (!gridEl) return;
    const now = virtualNow();
    if (now == null) return;
    for (const tile of gridEl.querySelectorAll('.ftl-rerun-tile')) {
        const img = tile.querySelector('.ftl-rerun-tile-thumb');
        if (!img) continue;
        const state = tileStates.get(tile.dataset.room);
        const onAir = state?.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
        if (!onAir || !state.chunk) {
            tile.classList.remove('ftl-rerun-has-thumb');
            img.removeAttribute('src');
            continue;
        }
        const startMs = archives.parseShowTime(state.chunk.startsAt);
        const url = archives.thumbnailUrl(state.chunk.fileName, (now - startMs) / 1000);
        if (url && img.getAttribute('src') !== url) img.src = url;
    }
}

/**
 * Status line for a zone's hover label — same logic as the grid tiles.
 */
function zoneStatusText(room) {
    const state = tileStates.get(room);
    const now = virtualNow();
    if (!state || state.status === 'unknown' || now == null) return '';
    const onAir = state.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
    if (onAir) return '● On Air';
    return state.nextStartsAtMs != null && state.nextStartsAtMs > now
        ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
        : 'No Signal';
}

function renderTileCountdowns() {
    if (!gridEl) return;
    const now = virtualNow();
    if (now == null) return;
    for (const tile of gridEl.querySelectorAll('.ftl-rerun-tile')) {
        const state = tileStates.get(tile.dataset.room);
        const statusEl = tile.querySelector('.ftl-rerun-tile-status');
        const onAir = state?.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
        tile.classList.toggle('ftl-rerun-on-air', onAir);
        if (!onAir) tile.classList.remove('ftl-rerun-has-thumb');
        if (!state || state.status === 'unknown') {
            statusEl.textContent = '…';
            statusEl.classList.remove('on-air');
        } else if (onAir) {
            statusEl.textContent = '● On Air';
            statusEl.classList.add('on-air');
        } else if (state.status === 'on-air') {
            // Cached on-air state has aged past the chunk's nominal end —
            // show as off-air with a countdown until the next refresh
            // re-resolves it properly.
            statusEl.classList.remove('on-air');
            statusEl.textContent = state.nextStartsAtMs != null && state.nextStartsAtMs > now
                ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
                : 'No Signal';
        } else {
            statusEl.classList.remove('on-air');
            statusEl.textContent = state.nextStartsAtMs != null
                ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
                : 'No Signal';
        }
    }
}

// ── Focused player ──────────────────────────────────────────────────

function buildPlayer() {
    playerEl = document.createElement('div');
    playerEl.className = 'ftl-rerun-player';

    videoEl = document.createElement('video');
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.volume = storage.get(VOLUME_KEY, 1);
    videoEl.addEventListener('ended', () => {
        if (currentChunk && videoEl.duration && videoEl.duration !== Infinity) {
            endedChunk = { fileName: currentChunk.fileName, duration: videoEl.duration };
        }
        syncPlayback(true);
    });
    videoEl.addEventListener('error', onVideoError);
    videoEl.addEventListener('loadedmetadata', () => applySeek());

    const roomLabel = document.createElement('div');
    roomLabel.className = 'ftl-rerun-room-label';

    const noSignal = document.createElement('div');
    noSignal.className = 'ftl-rerun-nosignal';
    const nsLabel = document.createElement('div');
    nsLabel.className = 'ftl-rerun-nosignal-label';
    nsLabel.textContent = 'No Signal';
    const nsCountdown = document.createElement('div');
    nsCountdown.className = 'ftl-rerun-nosignal-countdown';
    noSignal.append(nsLabel, nsCountdown);

    // Site-style close button (top right) — returns to the grid.
    const closeBtn = siteIconButton('Back to grid', CLOSE_ICON_SVG, exitFocused, 'primary');
    closeBtn.classList.add('ftl-rerun-close-btn', 'absolute', 'top-0', 'right-0', 'm-2', 'z-5');

    // Bottom-left cluster: mute button + volume slider (site style),
    // plus our extras (Pause, Zones — inserted by the zones module —
    // and Fullscreen).
    const bar = document.createElement('div');
    bar.className = 'ftl-rerun-player-bar';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'ftl-rerun-volume-btn';
    muteBtn.title = 'Mute';
    muteBtn.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
        updateVolumeIcon(muteBtn);
    });

    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.01';
    volume.value = String(videoEl.volume);
    volume.className = 'w-[128px] accent-primary bg-transparent rounded-md cursor-pointer';
    volume.addEventListener('input', () => {
        videoEl.volume = Number(volume.value);
        videoEl.muted = false;
        storage.set(VOLUME_KEY, videoEl.volume);
        updateVolumeIcon(muteBtn);
    });
    updateVolumeIcon(muteBtn);

    const pauseBtn = makePauseButton();

    bar.append(muteBtn, volume, pauseBtn, makeNudgeButtons());
    if (getSetting('enhancedTheatreMode')) {
        bar.appendChild(siteIconButton('Theater Mode (T)', THEATRE_ICON_SVG, () => toggleTheatre()));
    }
    bar.appendChild(siteIconButton('Fullscreen (F)', EXPAND_ICON_SVG, () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else playerEl.requestFullscreen();
    }));

    // Bottom-right: Day + show-time clock, styled like the site's.
    const clockWrap = document.createElement('div');
    clockWrap.className = 'ftl-rerun-player-clock flex items-center gap-3 font-secondary text-light-text text-shadow-md text-sm leading-none pointer-events-none';
    playerClockDay = document.createElement('span');
    playerClockTime = document.createElement('span');
    clockWrap.append(playerClockDay, playerClockTime);

    playerEl.append(videoEl, roomLabel, noSignal, bar, clockWrap, closeBtn);
    overlay.appendChild(playerEl);

    // Auto-hide the controls after idle, like a native video player —
    // keeps the bar (and fullscreen) clean while just watching.
    let idleTimer = null;
    const goIdle = () => {
        if (!playerEl) return;
        // Don't hide while the pointer is resting on the controls
        if (playerEl.querySelector('.ftl-rerun-player-bar:hover')) {
            idleTimer = setTimeout(goIdle, 1000);
            return;
        }
        playerEl.classList.add('ftl-rerun-idle');
    };
    const wake = () => {
        if (!playerEl) return;
        playerEl.classList.remove('ftl-rerun-idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(goIdle, 2500);
    };
    playerEl.addEventListener('mousemove', wake);
    playerEl.addEventListener('pointerdown', wake);
    wake();

    // Clickable door zones — clicking a doorway switches rooms; hover
    // labels carry the same on-air/countdown status as the grid tiles
    initZones(playerEl, videoEl, (room) => focusRoom(room), {
        getRoomStatus: zoneStatusText,
    });
}

// Speaker icons matching the site's player (muted / low / medium / high).
const VOLUME_ICONS = {
    mute: '<path fill="none" stroke-linecap="square" stroke-miterlimit="10" stroke-width="32" d="M416 432 64 80"></path><path d="M352 256c0-24.56-5.81-47.88-17.75-71.27L327 170.47 298.48 185l7.27 14.25C315.34 218.06 320 236.62 320 256a112.91 112.91 0 0 1-.63 11.74l27.32 27.32A148.8 148.8 0 0 0 352 256zm64 0c0-51.19-13.08-83.89-34.18-120.06l-8.06-13.82-27.64 16.12 8.06 13.82C373.07 184.44 384 211.83 384 256c0 25.93-3.89 46.21-11 65.33l24.5 24.51C409.19 319.68 416 292.42 416 256z"></path><path d="M480 256c0-74.26-20.19-121.11-50.51-168.61l-8.61-13.49-27 17.22 8.61 13.49C429.82 147.38 448 189.5 448 256c0 48.76-9.4 84-24.82 115.55l23.7 23.7C470.16 351.39 480 309 480 256zM256 72l-73.6 58.78 73.6 73.59V72zM32 176.1v159.8h93.65L256 440V339.63L92.47 176.1H32z"></path>',
    low: '<path d="m391.12 341.48-28.6-14.36 7.18-14.3c9.49-18.9 14.3-38 14.3-56.82 0-19.36-4.66-37.92-14.25-56.73L362.48 185 391 170.48l7.26 14.25C410.2 208.16 416 231.47 416 256c0 23.83-6 47.78-17.7 71.18zM189.65 176.1H96v159.8h93.65L320 440V72L189.65 176.1z"></path>',
    med: '<path d="M157.65 176.1H64v159.8h93.65L288 440V72L157.65 176.1z"></path><path fill="none" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M352 320c9.74-19.41 16-40.81 16-64 0-23.51-6-44.4-16-64m48 176c19.48-34 32-64 32-112s-12-77.7-32-112"></path>',
    high: '<path fill="none" stroke-linecap="square" stroke-miterlimit="10" stroke-width="32" d="M320 320c9.74-19.38 16-40.84 16-64 0-23.48-6-44.42-16-64m48 176c19.48-33.92 32-64.06 32-112s-12-77.74-32-112m48 272c30-46 48-91.43 48-160s-18-113-48-160"></path><path d="M125.65 176.1H32v159.8h93.65L256 440V72L125.65 176.1z"></path>',
};

function updateVolumeIcon(btn) {
    if (!videoEl) return;
    const v = videoEl.volume;
    const key = (videoEl.muted || v === 0) ? 'mute' : v < 0.34 ? 'low' : v < 0.67 ? 'med' : 'high';
    btn.title = key === 'mute' ? 'Unmute' : 'Mute';
    btn.innerHTML = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512"'
        + ' class="text-light-text drop-shadow-[1px_1px_0_#00000075]" height="18" width="18"'
        + ` xmlns="http://www.w3.org/2000/svg">${VOLUME_ICONS[key]}</svg>`;
}

function focusRoom(room) {
    focusedRoom = room;
    currentChunk = null;
    endedChunk = null;
    prefetched = null;
    playerNextStartsAtMs = null;
    errorRetries = 0;
    overlay.classList.add('ftl-rerun-focused');
    playerEl.querySelector('.ftl-rerun-room-label').textContent = archives.formatRoomLabel(room);
    setZonesRoom(room);
    syncPlayback(true);
}

function exitFocused() {
    if (!focusedRoom) return;
    // Theatre was applied to the focused player — leave it before the
    // overlay reverts to the grid, or the grid inherits theatre layout.
    if (isTheatreActive()) exitTheatre();
    focusedRoom = null;
    currentChunk = null;
    endedChunk = null;
    prefetched = null;
    playerNextStartsAtMs = null;
    if (resyncTimeout) { clearTimeout(resyncTimeout); resyncTimeout = null; }
    if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
    }
    setZonesRoom(null);
    overlay?.classList.remove('ftl-rerun-focused');
    refreshTiles();
}

function setNoSignal(visible) {
    playerEl?.querySelector('.ftl-rerun-nosignal')?.classList.toggle('visible', visible);
}

let playerNextStartsAtMs = null;

function renderPlayerCountdown() {
    if (!playerEl || !focusedRoom) return;
    const el = playerEl.querySelector('.ftl-rerun-nosignal-countdown');
    const now = virtualNow();
    if (playerNextStartsAtMs != null && now != null) {
        const remaining = playerNextStartsAtMs - now;
        el.textContent = remaining > 0 ? `Resumes in ${formatCountdown(remaining)}` : '';
        // Countdown expired — footage should be back
        if (remaining <= 0 && !isPaused()) {
            playerNextStartsAtMs = null;
            syncPlayback(true);
        }
    } else {
        el.textContent = '';
    }
    maybePrefetchNext();
}

/**
 * Core sync: make the video element reflect the virtual clock.
 * force=true re-resolves the chunk even if one is already loaded.
 */
let syncing = false;
async function syncPlayback(force) {
    if (!focusedRoom || !videoEl || syncing) return;
    if (isPaused()) { videoEl.pause(); return; }
    syncing = true;
    const room = focusedRoom;
    try {
        const now = virtualNow();
        if (now == null) return;

        // Same chunk already loaded — just correct drift
        if (!force && currentChunk) {
            const startMs = archives.parseShowTime(currentChunk.startsAt);
            const offset = (now - startMs) / 1000;
            if (videoEl.duration && offset >= 0 && offset < videoEl.duration) {
                if (Math.abs(videoEl.currentTime - offset) > DRIFT_TOLERANCE_S) {
                    videoEl.currentTime = offset;
                }
                if (videoEl.paused) tryPlay();
                return;
            }
            // Fallthrough: clock has left the loaded chunk
        }

        const state = await getRoomStateAt(room, virtualNow());
        if (focusedRoom !== room || !videoEl) return;

        if (state.status === 'on-air') {
            // The nominal window can outlast the chunk's real footage
            // (the ~1s seam between chunks, or a short gap). If we've
            // already played this chunk to its end, bridge with No
            // Signal until the next chunk actually starts.
            if (endedChunk && state.chunk.fileName === endedChunk.fileName
                && state.offsetSeconds >= endedChunk.duration) {
                currentChunk = null;
                videoEl.pause();
                playerNextStartsAtMs = state.nextStartsAtMs ?? null;
                setNoSignal(true);
                scheduleResync(state.nextStartsAtMs);
                return;
            }
            if (endedChunk && state.chunk.fileName !== endedChunk.fileName) {
                endedChunk = null;
            }
            playerNextStartsAtMs = null;
            await loadChunk(state.chunk);
        } else {
            currentChunk = null;
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
            playerNextStartsAtMs = state.nextStartsAtMs ?? null;
            setNoSignal(true);
            scheduleResync(state.nextStartsAtMs);
        }
    } finally {
        syncing = false;
    }
}

async function loadChunk(chunk) {
    const room = focusedRoom;
    let url = (prefetched && prefetched.fileName === chunk.fileName) ? prefetched.url : null;
    prefetched = null;
    if (!url) url = await getChunkUrl(chunk);
    if (focusedRoom !== room || !videoEl) return;
    if (!url) {
        // Signed URL fetch failed (logged out / API error) — treat as
        // No Signal and retry in 30s.
        setNoSignal(true);
        scheduleResync(null);
        return;
    }
    currentChunk = chunk;
    errorRetries = 0;
    setNoSignal(false);
    // Poster shows the correct moment's frame while the video loads
    // (same trick as the site's player; harmless if the thumb 404s).
    const startMs = archives.parseShowTime(chunk.startsAt);
    const poster = archives.thumbnailUrl(chunk.fileName, (virtualNow() - startMs) / 1000);
    if (poster) videoEl.poster = poster;
    videoEl.src = url;
    // applySeek() runs on loadedmetadata
}

/**
 * Seek to the virtual offset once metadata is available. If the
 * offset overshoots the chunk's real duration, the moment falls in a
 * gap → No Signal until the next chunk.
 */
function applySeek() {
    if (!videoEl || !currentChunk || isPaused()) return;
    const now = virtualNow();
    const startMs = archives.parseShowTime(currentChunk.startsAt);
    const offset = (now - startMs) / 1000;
    if (Number.isNaN(videoEl.duration) || videoEl.duration === Infinity) return;
    if (offset < 0 || offset >= videoEl.duration) {
        if (offset >= videoEl.duration) {
            endedChunk = { fileName: currentChunk.fileName, duration: videoEl.duration };
        }
        currentChunk = null;
        videoEl.pause();
        setNoSignal(true);
        syncPlayback(true); // resolve the actual next chunk / countdown
        return;
    }
    videoEl.currentTime = offset;
    setNoSignal(false);
    tryPlay();
}

function tryPlay() {
    videoEl.play().catch(() => {
        // Autoplay blocked — resume on first interaction
        document.addEventListener('pointerdown', () => {
            if (focusedRoom && videoEl && !isPaused()) videoEl.play().catch(() => {});
        }, { once: true });
    });
}

function scheduleResync(nextStartsAtMs) {
    if (resyncTimeout) clearTimeout(resyncTimeout);
    const now = virtualNow();
    let delay = 30000; // default retry
    if (nextStartsAtMs != null && now != null) {
        delay = Math.max(1000, nextStartsAtMs - now + 1000);
    }
    resyncTimeout = setTimeout(() => syncPlayback(true), delay);
}

function onVideoError() {
    if (!focusedRoom || !currentChunk) return;
    // Most likely an expired signed URL — re-request once, then back off
    const chunk = currentChunk;
    currentChunk = null;
    prefetched = null;
    if (errorRetries < 2) {
        errorRetries++;
        setTimeout(() => {
            if (focusedRoom) loadChunk(chunk);
        }, errorRetries === 1 ? 1000 : 5000);
    } else {
        setNoSignal(true);
        scheduleResync(null);
    }
}

/**
 * Prefetch the next chunk's signed URL shortly before the current one
 * ends, for a near-gapless handover.
 */
let prefetching = false;
async function maybePrefetchNext() {
    if (!focusedRoom || !videoEl || !currentChunk || prefetching || isPaused()) return;
    if (!videoEl.duration || videoEl.duration === Infinity) return;
    const remaining = videoEl.duration - videoEl.currentTime;
    if (remaining > PREFETCH_LEAD_S || remaining <= 0) return;
    const room = focusedRoom;
    prefetching = true;
    try {
        const chunkEndMs = archives.parseShowTime(currentChunk.startsAt) + videoEl.duration * 1000;
        const state = await getRoomStateAt(room, chunkEndMs + 2000);
        if (focusedRoom !== room) return;
        if (state.status === 'on-air' && state.chunk.fileName !== currentChunk?.fileName
            && prefetched?.fileName !== state.chunk.fileName) {
            const url = await getChunkUrl(state.chunk);
            if (url && focusedRoom === room) {
                prefetched = { fileName: state.chunk.fileName, url };
            }
        }
    } catch { /* prefetch is best-effort */ }
    finally { prefetching = false; }
}

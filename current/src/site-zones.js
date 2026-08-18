/**
 * site-zones.js — Clickable room zones on the site's own re-run player
 *
 * When the site runs its "archive live" re-run, the home grid shows
 * archive cameras and clicking one promotes it to a fixed full-area
 * player. This module detects that player, works out the season and
 * room from the video URL, and attaches the same clickable door zones
 * (and zone editor) used by the extension's personal re-run mode.
 * Navigating clicks the target room's grid tile, so the site's own
 * player does the actual switching.
 *
 * Everything is best-effort and fail-silent: if the site changes its
 * markup, or no re-run is running, detection finds nothing and nothing
 * happens. New seasons work automatically — no baked zones means users
 * start from the editor.
 */

import { getSetting } from './settings.js';
import { archives } from '../../ftl-ext-sdk/src/index.js';
import { initZones, setZonesRoom } from './rerun-zones.js';

const THUMB_PATH = '/archive-thumbnails/primary/';

// Season room listing for the editor's target picker (needs login;
// fail-silent to an empty list, which just skips target filtering).
let roomsSeason = null;
let roomsCache = [];

// The player root the zones module is currently bound to. The dataset
// marker alone isn't enough: it survives unfocusing, and the zones
// module may have been re-bound elsewhere in the meantime.
let boundRoot = null;

function ensureRooms(season) {
    if (roomsSeason === season) return;
    roomsSeason = season;
    roomsCache = [];
    archives.getRooms(season).then((rooms) => {
        if (roomsSeason === season) roomsCache = rooms || [];
    });
}

// Archive video URLs are /{season}/{room}/{day}/{file}?token=...
function parseVideoSrc(src) {
    const m = (src || '').match(/fishtank-archives\.b-cdn\.net\/([^/]+)\/([^/]+)\//);
    return m ? { season: m[1], room: m[2] } : null;
}

/**
 * The focused site camera: its content root (a bg-dark-800 div — the
 * same element the video letterboxes inside) promoted into the site's
 * fixed player wrapper. Unfocused grid tiles share the markup but stay
 * in the grid, so requiring a .fixed ancestor isolates the player.
 */
function findFocusedCamera() {
    for (const root of document.querySelectorAll('div.bg-dark-800')) {
        if (root.closest('[data-ftl-sdk]')) continue;
        if (!root.closest('div.fixed')) continue;
        return { root, video: root.querySelector('video') };
    }
    return null;
}

function detectSeasonRoom(cam) {
    const fromSrc = parseVideoSrc(cam.video?.currentSrc || cam.video?.src);
    if (fromSrc) return fromSrc;
    // A No Signal room renders no <video> — fall back to the player's
    // room label, and take the season from any grid thumbnail's video
    // id (thumbnail paths have no season segment, but ids are s03_...).
    const label = cam.root.querySelector('div.text-shadow-lg.font-bold')?.textContent?.trim();
    if (!label) return null;
    const room = label.toLowerCase().replace(/\s+/g, '-');
    for (const img of document.querySelectorAll(`img[src*="${THUMB_PATH}"]`)) {
        const m = img.src.match(/\/(s\d{2})_/);
        if (m) return { season: m[1], room };
    }
    return null;
}

/**
 * The grid tile button for a room. The tile's thumbnail URL embeds the
 * room code; No Signal tiles (no thumbnail) match by label text. The
 * grid is invisible while a camera is focused, but programmatic clicks
 * still reach the site's handlers.
 */
function findTileButton(room) {
    for (const img of document.querySelectorAll(`img[src*="${THUMB_PATH}${room}/"]`)) {
        const btn = img.closest('button');
        if (btn && !btn.closest('div.fixed')) return btn;
    }
    const label = archives.formatRoomLabel(room);
    for (const div of document.querySelectorAll('button div.font-bold')) {
        if (div.textContent.trim() !== label) continue;
        const btn = div.closest('button');
        if (btn && !btn.closest('div.fixed')) return btn;
    }
    return null;
}

function navigate(room) {
    const btn = findTileButton(room);
    if (!btn) return;
    btn.click();
    // The newly focused camera renders after React state settles.
    setTimeout(tryInjectSiteZones, 150);
    setTimeout(tryInjectSiteZones, 600);
}

/**
 * Mount point for the Zones editor button: the volume flex row in the
 * site player's controls overlay (a separate fixed layer).
 */
function findControlsMount() {
    for (const input of document.querySelectorAll('div.fixed input[type="range"]')) {
        if (input.closest('[data-ftl-sdk]')) continue;
        return input.parentElement;
    }
    return null;
}

/**
 * Injection pass — call from click-injection hooks. Idempotent: the
 * player root is marked with the room it's wired for ('v' = with
 * video, 'n' = No Signal, upgraded to 'v' if the video appears later).
 */
export function tryInjectSiteZones() {
    if (!getSetting('rerunClickableZones')) return;
    // The personal re-run overlay owns the zones module while open.
    if (document.getElementById('ftl-rerun-overlay')) return;
    const cam = findFocusedCamera();
    if (!cam) return;
    const info = detectSeasonRoom(cam);
    if (!info) return;
    const state = `${info.room}:${cam.video ? 'v' : 'n'}`;
    if (boundRoot === cam.root
        && (cam.root.dataset.ftlZones === state
            || cam.root.dataset.ftlZones === `${info.room}:v`)) return;
    cam.root.dataset.ftlZones = state;
    boundRoot = cam.root;
    ensureRooms(info.season);
    initZones(cam.root, cam.video, navigate, {
        getSeason: () => info.season,
        getRooms: () => (roomsSeason === info.season ? roomsCache : []),
        buttonMount: findControlsMount(),
    });
    setZonesRoom(info.room);
}

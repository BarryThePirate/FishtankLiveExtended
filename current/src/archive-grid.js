/**
 * archive-grid.js — Archive Grid Bandwidth Saver
 *
 * PROBLEM
 * -------
 * The home page renders a grid of ~10 camera tiles, each a full
 * progressive MP4 (150MB–1GB) with preload="auto". preload="auto"
 * makes the browser fetch the ENTIRE file regardless of play/pause
 * state, so all ten download at once — gigabytes of concurrent
 * traffic. Pausing does nothing (the download isn't driven by
 * playback) and setting preload="none" after the fact doesn't abort
 * an in-flight fetch; React also re-asserts preload="auto" on every
 * render.
 *
 * APPROACH (Plan A — posters only)
 * --------------------------------
 * The only reliable way to stop a progressive download is to remove
 * the source. For each grid tile we stash its src in a data attribute,
 * remove the src attribute, and call load() to abort any active fetch.
 * The poster remains, so the grid still shows thumbnails. Clicking a
 * tile is left entirely native: the site promotes that one <video> to
 * the fullscreen slot and plays it there — which we leave untouched.
 *
 * WHY AN OBSERVER (matches zones.js)
 * ----------------------------------
 * React re-adds src on re-render, the thumbnail refresh swaps tiles,
 * and the grid toggles visible/invisible on click. A one-shot pass
 * loses to all three. We observe the persistent page wrapper (never
 * document.body) and re-strip on every mutation, exactly like
 * zones.js watches the player container. A short bounded poll bridges
 * the gap before the wrapper exists on first load, then clears itself.
 *
 * GRID vs FULLSCREEN
 * ------------------
 * When a tile is clicked the site moves that <video> into a fixed,
 * full-width slot and switches it from object-cover to object-contain.
 * We must NOT strip that one. Distinguisher: a tile we should kill is
 * an archive-host <video> with object-cover that is NOT inside the
 * promoted fullscreen button. We treat object-contain (or living in
 * the fixed fullscreen wrapper) as "leave alone".
 */

import { getSetting } from './settings.js';

// Archive CDN hosts. A <video> pointing here is a camera tile.
// (The live HLS player uses a different host and is never touched.)
const ARCHIVE_HOST_RE = /(?:fishtank-archives|fishtank-cameras)\.b-cdn\.net/i;

// Data attributes for our bookkeeping.
const STASH_ATTR = 'data-ftl-grid-src';      // where we park the removed src
const MARK_ATTR = 'data-ftl-grid-stripped';  // marks a tile we've neutralised

let active = false;
let observer = null;
let anchor = null;
let pollTimer = null;

/**
 * Is this <video> an archive camera source?
 */
function isArchiveVideo(video) {
    const src = video.getAttribute('src') || video.getAttribute(STASH_ATTR) || '';
    return ARCHIVE_HOST_RE.test(src);
}

/**
 * Should this tile be left playing? True for the promoted fullscreen
 * video. The site switches the clicked tile to object-contain and
 * relocates it into a fixed full-width button; grid tiles stay
 * object-cover. Either signal means "leave alone".
 */
function isPromotedFullscreen(video) {
    if (video.classList.contains('object-contain')) return true;
    // The fullscreen button is position:fixed and spans most of the
    // viewport; grid tile buttons are not fixed.
    const btn = video.closest('button');
    if (btn && btn.classList.contains('fixed')) return true;
    return false;
}

/**
 * Neutralise one grid tile: stash its src, remove it, abort the fetch.
 */
function stripVideo(video) {
    // Leave the promoted/fullscreen video alone, and restore its src
    // if we'd previously stripped it (e.g. it just got promoted). When
    // promoting we also resume playback, since we'd called load() which
    // leaves it paused and the site's own play() fired before restore.
    if (isPromotedFullscreen(video)) {
        restoreVideo(video, { resume: true });
        return;
    }

    const liveSrc = video.getAttribute('src');
    if (liveSrc) {
        // Park the current src so we can restore on disable / promotion.
        video.setAttribute(STASH_ATTR, liveSrc);
        video.removeAttribute('src');
        video.setAttribute(MARK_ATTR, '1');
        try {
            video.preload = 'none';
            video.load(); // abort any in-flight progressive download
        } catch {}
    } else if (!video.hasAttribute(MARK_ATTR) && video.hasAttribute(STASH_ATTR)) {
        // Already stripped earlier and React hasn't re-added src — keep marked.
        video.setAttribute(MARK_ATTR, '1');
    }
}

/**
 * Restore a tile's src. Used on teardown, or when a tile is promoted to
 * fullscreen so the site can play it.
 *
 * With { resume: true } we also restore preload, call load() to pick up
 * the re-added src, and play() — because stripping left the element
 * paused with no source, and the site's click-time play() already fired
 * and failed before we restored.
 */
function restoreVideo(video, { resume = false } = {}) {
    const stashed = video.getAttribute(STASH_ATTR);
    const needsSrc = stashed && !video.getAttribute('src');
    if (needsSrc) {
        video.setAttribute('src', stashed);
    }
    video.removeAttribute(STASH_ATTR);
    video.removeAttribute(MARK_ATTR);

    if (resume && stashed) {
        try {
            video.preload = 'auto';
            video.load();
            const p = video.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
    }
}

/**
 * Scan the anchor for archive videos and strip every grid tile.
 */
function scan() {
    if (!active || !anchor || !observer) return;

    // Pause our own observer while we mutate tile attributes. Stripping
    // sets/removes src + preload, which would otherwise re-fire this
    // callback in a churn loop — and that churn lands right when the site
    // is rendering the "next camera" countdown placeholder tiles,
    // disturbing them. Disconnect, mutate, then reconnect.
    observer.disconnect();
    try {
        const videos = anchor.querySelectorAll('video');
        for (const v of videos) {
            if (isArchiveVideo(v)) stripVideo(v);
        }
    } finally {
        observer.observe(anchor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class'],
        });
    }
}

/**
 * Find the persistent page wrapper the grid renders inside.
 * The home page content lives under <div class="pb-10 ..."> which is
 * present from load and survives the grid re-rendering. We use it as
 * the observer target (never document.body).
 */
function findAnchor() {
    // Prefer the wrapper that actually contains an archive video.
    const anyTile = [...document.querySelectorAll('video')]
        .find(v => ARCHIVE_HOST_RE.test(v.getAttribute('src') || v.getAttribute(STASH_ATTR) || ''));
    if (anyTile) {
        // Walk up to the pb-10 wrapper if present, else the grid's parent.
        const wrapper = anyTile.closest('div.pb-10') || anyTile.closest('div.grid')?.parentElement;
        if (wrapper) return wrapper;
    }
    // Fall back to the pb-10 wrapper even before tiles exist.
    return document.querySelector('div.pb-10');
}

/**
 * Attach the observer to the anchor. Returns true if attached.
 */
function startObserving() {
    const found = findAnchor();
    if (!found) return false;

    // Re-attach if the anchor changed (React replaced the subtree).
    if (observer && anchor === found) return true;
    if (observer) observer.disconnect();

    anchor = found;
    observer = new MutationObserver(() => scan());
    observer.observe(anchor, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'class'],
    });

    // Initial pass for tiles already present. (scan() pauses/resumes the
    // observer itself, so it must already be connected here.)
    scan();
    return true;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Enable the saver: attach the observer (or bridge with a short poll
 * until the wrapper exists) and strip current tiles.
 */
export function enableArchiveGridSaver() {
    if (active) return;
    active = true;

    if (!startObserving()) {
        // Wrapper not in the DOM yet on first load — bounded poll,
        // same pattern as zones.js. Clears itself once attached.
        let attempts = 0;
        pollTimer = setInterval(() => {
            attempts++;
            if (startObserving() || attempts > 40 || !active) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }, 250);
    }
}

/**
 * Disable the saver and restore every stripped tile to stock behaviour.
 */
export function disableArchiveGridSaver() {
    if (!active) return;
    active = false;

    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    anchor = null;

    // Restore any tiles we stripped.
    document.querySelectorAll(`video[${STASH_ATTR}]`).forEach(v => restoreVideo(v));
}

/**
 * Wire the saver to its setting. Called once from index.js pre-ready so
 * the observer is in place before the grid finishes rendering.
 */
export function initArchiveGridSaver() {
    if (getSetting('archiveGridSaver')) {
        enableArchiveGridSaver();
    }
}

export function isArchiveGridSaverActive() {
    return active;
}
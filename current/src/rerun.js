/**
 * rerun.js — Re-run mode: virtual clock + schedule state
 *
 * Personal "as live" archive playback. The user anchors a virtual
 * clock to a moment in a past season (day + time, show-time frame);
 * this module keeps that clock ticking in real time, persists it
 * across sessions, and resolves what's "on air" per room at the
 * current virtual moment using the SDK archives module.
 *
 * All timestamps are epoch ms in the show-time frame (parsed with the
 * SDK's fixed -04:00 convention). The UI layer (rerun-ui.js) owns all
 * DOM; this module owns state and data.
 *
 * CLOCK MODEL:
 * - anchorVirtual/anchorReal pair: virtualNow = anchorVirtual + (now - anchorReal)
 * - Pause freezes the clock at pausedAtVirtual; resume re-derives the
 *   anchor pair so the clock continues from where it was frozen.
 * - "Tick while away" (default on): live-TV simulation — time passes
 *   even when the site is closed. When off, a heartbeat persists a
 *   last-seen timestamp and on startup the anchor is shifted forward
 *   by the time spent away, so the clock only advances while on site.
 */

import { archives } from '../../ftl-ext-sdk/src/index.js';
import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import { getSetting, updateSetting } from './settings.js';

const LAST_SEEN_KEY = 'rerun-last-seen';
const HEARTBEAT_MS = 15000;

// Fallback chunk length for on-air heuristics before video metadata
// is available (s03 chunks are ~15 min; give a little slack).
export const NOMINAL_CHUNK_MS = 16 * 60 * 1000;

/**
 * Analyse a day's listing: typical chunk length (median spacing
 * between consecutive chunks — season chunking varies) and the
 * stream's typical byte rate (from full-length chunks). The byte
 * rate lets us spot chunks whose footage is much shorter than their
 * schedule slot (camera died mid-chunk) — start times alone can't
 * reveal that, but the file being far smaller than its neighbours can.
 */
function analyzeListing(videos) {
    const result = { nominalChunkMs: NOMINAL_CHUNK_MS, bytesPerMs: null };
    if (!Array.isArray(videos) || videos.length < 2) return result;
    const diffs = [];
    for (let i = 1; i < videos.length; i++) {
        diffs.push(archives.parseShowTime(videos[i].startsAt)
            - archives.parseShowTime(videos[i - 1].startsAt));
    }
    const sorted = diffs.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // Median spacing ≈ chunk duration + ~1s seam. Keep slack tight
    // (a few seconds) so tiles flip to No Signal promptly; the
    // focused player refines against real duration anyway. Capped so
    // a gappy day can't inflate the estimate absurdly.
    result.nominalChunkMs = Math.min(median + 5000, 2 * 3600000);

    // Byte rate estimate. size/spacing equals the true byte rate only
    // when a chunk is immediately followed by the next (back-to-back);
    // any dead air between chunks makes the ratio undershoot. So take
    // a high percentile of the ratios — on s03's uniform grid every
    // pair is back-to-back and this converges on the real bitrate; on
    // s01's motion-triggered clips the tight pairs reveal it.
    const ratios = [];
    for (let i = 1; i < videos.length; i++) {
        const size = videos[i - 1].size;
        if (size && diffs[i - 1] >= 45000) {
            ratios.push(size / diffs[i - 1]);
        }
    }
    if (ratios.length) {
        ratios.sort((a, b) => a - b);
        result.bytesPerMs = ratios[Math.floor((ratios.length - 1) * 0.9)];
    }
    return result;
}

// ── Season data (cached per loaded season) ──────────────────────────

/**
 * Seasons the re-run supports. Extend as the site adds archives.
 */
export const AVAILABLE_SEASONS = [
    { value: 's01', label: 'Season 1' },
    { value: 's03', label: 'Season 3' },
];

let seasonRooms = [];   // room codes from the API
let seasonDays = [];    // ISO dates, contiguous, index 0 = Day 1
let loadedSeason = null; // which season the above belong to

/**
 * Load rooms + days for the configured season. Safe to call
 * repeatedly — refetches only when the season setting has changed
 * since the last successful load (SDK memoizes the underlying
 * requests too). Returns true when data is available.
 */
export async function loadSeasonData() {
    const season = getSetting('rerunSeason');
    if (loadedSeason === season) return true;
    const rooms = await archives.getRooms(season);
    if (!rooms.length) return false;

    // Day range comes from a reference room's listing. Use the first
    // room that returns days (rooms should all share the season range).
    let days = [];
    for (const room of rooms) {
        days = await archives.getDays(season, room);
        if (days.length) break;
    }
    if (!days.length) return false;

    seasonRooms = rooms;
    seasonDays = days;
    loadedSeason = season;
    return true;
}

/**
 * Switch to a different season. Clears the anchor (day/time positions
 * are meaningless across seasons) and any paused state; the caller
 * should reload season data and prompt for a new start point.
 */
export function changeSeason(season) {
    if (season === getSetting('rerunSeason')) return;
    updateSetting('rerunSeason', season);
    updateSetting('rerunAnchorVirtual', null);
    updateSetting('rerunAnchorReal', null);
    updateSetting('rerunPaused', false);
    updateSetting('rerunPausedAtVirtual', null);
}

export function getSeasonRooms() { return seasonRooms; }
export function getSeasonDays() { return seasonDays; }

/**
 * Season bounds in epoch ms: [house-local midnight of the first day,
 * house-local midnight after the last day). Day numbers, the picker,
 * and the clock all live in HOUSE time (real America/New_York local,
 * DST-aware) — the archive's UTC stamps are an internal detail.
 */
export function getSeasonBounds() {
    if (!seasonDays.length) return null;
    const start = archives.parseHouseTime(`${seasonDays[0]}T00:00:00`);
    const end = archives.parseHouseTime(`${seasonDays[seasonDays.length - 1]}T00:00:00`) + 86400000;
    return { start, end };
}

/**
 * Convert a season day number (1-based) + 'HH:MM' or 'HH:MM:SS'
 * HOUSE-local time string to epoch ms. Returns null if out of range
 * or unparseable.
 */
export function dayTimeToVirtualMs(dayNumber, timeStr) {
    const day = seasonDays[dayNumber - 1];
    if (!day || !/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return null;
    const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const ms = archives.parseHouseTime(`${day}T${time}`);
    return Number.isNaN(ms) ? null : ms;
}

/**
 * Day number (1-based) for a virtual moment, by HOUSE-local date —
 * the day rolls over at real local midnight, not stamp midnight.
 */
export function virtualMsToDayNumber(ms) {
    const date = archives.formatHouseDate(ms);
    const idx = seasonDays.indexOf(date);
    return idx === -1 ? null : idx + 1;
}

// ── Virtual clock ───────────────────────────────────────────────────

/**
 * Format a virtual moment as the house-local clock, honouring the
 * user's 12/24-hour preference. Use for all human-facing clocks.
 */
export function formatClock(ms) {
    return archives.formatHouseClock(ms, !!getSetting('rerunClock12h'));
}

// ── Shared-moment preview ───────────────────────────────────────────
// A share code opens as a PREVIEW: an in-memory anchor that overrides
// the stored one while active. The user's own re-run is a pure
// function of wall clock + stored anchor, so it keeps "airing"
// untouched underneath — discarding the preview returns to it exactly
// where it would have been. Nothing here is persisted: a refresh
// always lands back on the user's own re-run.

let preview = null; // { anchorVirtual, anchorReal, paused, pausedAtVirtual }

export function isPreviewActive() {
    return !!preview;
}

/**
 * Start previewing a virtual moment (lands playing).
 */
export function startPreview(virtualMs) {
    preview = { anchorVirtual: virtualMs, anchorReal: Date.now(), paused: false, pausedAtVirtual: null };
}

/**
 * Discard the preview — the stored re-run takes over again.
 */
export function endPreview() {
    preview = null;
}

/**
 * Make the previewed moment the user's real re-run. The only preview
 * path that writes to storage.
 */
export function adoptPreview() {
    if (!preview) return;
    const now = virtualNow();
    preview = null;
    if (now != null) setAnchor(now);
}

/**
 * Whether re-run mode is enabled AND has a usable anchor.
 */
export function isRerunActive() {
    if (preview) return true;
    return !!(getSetting('rerunEnabled')
        && getSetting('rerunAnchorVirtual') != null
        && getSetting('rerunAnchorReal') != null);
}

/**
 * Current virtual moment (show-time epoch ms), or null if no anchor.
 */
export function virtualNow() {
    if (preview) {
        return preview.paused
            ? preview.pausedAtVirtual
            : preview.anchorVirtual + (Date.now() - preview.anchorReal);
    }
    if (getSetting('rerunPaused') && getSetting('rerunPausedAtVirtual') != null) {
        return getSetting('rerunPausedAtVirtual');
    }
    const anchorVirtual = getSetting('rerunAnchorVirtual');
    const anchorReal = getSetting('rerunAnchorReal');
    if (anchorVirtual == null || anchorReal == null) return null;
    return anchorVirtual + (Date.now() - anchorReal);
}

/**
 * Set the anchor to a virtual moment, starting the clock from it now.
 * Clears any paused state.
 */
export function setAnchor(virtualMs) {
    updateSetting('rerunAnchorVirtual', virtualMs);
    updateSetting('rerunAnchorReal', Date.now());
    updateSetting('rerunPaused', false);
    updateSetting('rerunPausedAtVirtual', null);
}

/**
 * Clear the start point entirely — re-run is inactive until a new
 * anchor is set.
 */
export function clearAnchor() {
    preview = null;
    updateSetting('rerunAnchorVirtual', null);
    updateSetting('rerunAnchorReal', null);
    updateSetting('rerunPaused', false);
    updateSetting('rerunPausedAtVirtual', null);
}

export function isPaused() {
    if (preview) return preview.paused;
    return !!getSetting('rerunPaused');
}

/**
 * Freeze the virtual clock at its current moment.
 */
export function pause() {
    const now = virtualNow();
    if (now == null) return;
    if (preview) {
        preview.pausedAtVirtual = now;
        preview.paused = true;
        return;
    }
    updateSetting('rerunPausedAtVirtual', now);
    updateSetting('rerunPaused', true);
}

/**
 * Shift the virtual clock by deltaMs (negative = backwards), clamped
 * to the season bounds. Preserves paused state — a paused clock stays
 * paused at the nudged moment.
 */
export function nudge(deltaMs) {
    const now = virtualNow();
    if (now == null) return;
    let target = now + deltaMs;
    const bounds = getSeasonBounds();
    if (bounds) target = Math.min(Math.max(target, bounds.start), bounds.end - 1000);
    if (preview) {
        if (preview.paused) preview.pausedAtVirtual = target;
        else startPreview(target);
        return;
    }
    if (isPaused()) {
        updateSetting('rerunPausedAtVirtual', target);
    } else {
        setAnchor(target);
    }
}

/**
 * Resume a paused clock from where it was frozen.
 */
export function resume() {
    if (preview) {
        if (preview.pausedAtVirtual != null) startPreview(preview.pausedAtVirtual);
        return;
    }
    const frozenAt = getSetting('rerunPausedAtVirtual');
    if (frozenAt == null) return;
    setAnchor(frozenAt);
}

/**
 * True when the virtual clock has run past the end of the season.
 */
export function isPastSeasonEnd() {
    const bounds = getSeasonBounds();
    const now = virtualNow();
    return !!(bounds && now != null && now >= bounds.end);
}

// ── Away-time handling (tick-while-away off) ────────────────────────

let heartbeatInterval = null;

/**
 * Call once on startup, BEFORE the UI reads the clock. If the user
 * has "tick while away" disabled, shift the anchor forward by the
 * time spent away so the clock effectively froze while off-site.
 * Then start the heartbeat that records presence.
 */
export function initClockPersistence() {
    if (isRerunActive() && !getSetting('rerunTickWhileAway') && !isPaused()) {
        const lastSeen = storage.get(LAST_SEEN_KEY, null);
        if (lastSeen) {
            const awayMs = Date.now() - lastSeen;
            if (awayMs > 0) {
                updateSetting('rerunAnchorReal', getSetting('rerunAnchorReal') + awayMs);
            }
        }
    }

    // Heartbeat runs whenever re-run mode is enabled so that toggling
    // "tick while away" later still has a recent last-seen to work with.
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            if (getSetting('rerunEnabled')) storage.set(LAST_SEEN_KEY, Date.now());
        }, HEARTBEAT_MS);
        if (getSetting('rerunEnabled')) storage.set(LAST_SEEN_KEY, Date.now());
    }
}

// ── Schedule resolution ─────────────────────────────────────────────

/**
 * Resolve a room's state at a virtual moment.
 *
 * Returns one of:
 *   { status: 'on-air', chunk, offsetSeconds, nextStartsAtMs }
 *     — a chunk nominally covers this moment. The player must still
 *       validate offsetSeconds against real video duration.
 *   { status: 'no-signal', nextStartsAtMs }
 *     — downtime; nextStartsAtMs is when footage resumes (may be on
 *       the next day), or null if nothing follows this season.
 *   { status: 'unknown' }
 *     — listings unavailable (API failure / logged out).
 *
 * The on-air decision here is a heuristic (offset within the nominal
 * chunk window); the focused player refines it with real metadata.
 */
export async function getRoomStateAt(room, timeMs) {
    const season = getSetting('rerunSeason');
    const day = archives.formatShowDate(timeMs);

    // Outside the season's day range entirely
    if (!seasonDays.includes(day)) {
        const bounds = getSeasonBounds();
        if (bounds && timeMs < bounds.start) {
            const first = await firstChunkOnOrAfter(room, timeMs);
            return { status: 'no-signal', nextStartsAtMs: first };
        }
        return { status: 'no-signal', nextStartsAtMs: null };
    }

    const videos = await archives.getVideos(season, room, day);
    if (!videos.length) {
        // No footage this day for this room (or fetch failed — the SDK
        // returns [] for both). Look ahead for a countdown target.
        const next = await firstChunkOnOrAfter(room, timeMs);
        return { status: 'no-signal', nextStartsAtMs: next };
    }

    const chunk = archives.findChunkAt(videos, timeMs);
    if (chunk) {
        const { nominalChunkMs, bytesPerMs } = analyzeListing(videos);
        const startMs = archives.parseShowTime(chunk.video.startsAt);
        // Footage length estimated from file size and the listing's
        // byte rate — the only way to see mid-slot dead air, and
        // essential on seasons with motion-triggered clips (s01) where
        // chunk spacing is mostly dead air. 20% + 5s slack absorbs VBR
        // noise; the next chunk's start always caps it. Falls back to
        // typical spacing when sizes are unavailable.
        let nominalEnd;
        if (bytesPerMs && chunk.video.size) {
            nominalEnd = startMs + (chunk.video.size / bytesPerMs) * 1.2 + 5000;
        } else {
            nominalEnd = startMs + nominalChunkMs;
        }
        if (chunk.nextStartsAtMs != null) {
            nominalEnd = Math.min(nominalEnd, chunk.nextStartsAtMs);
        }
        if (timeMs < nominalEnd) {
            return {
                status: 'on-air',
                chunk: chunk.video,
                offsetSeconds: chunk.offsetSeconds,
                nextStartsAtMs: chunk.nextStartsAtMs,
                nominalEndMs: nominalEnd,
            };
        }
        // In a gap after this chunk
        if (chunk.nextStartsAtMs != null) {
            return { status: 'no-signal', nextStartsAtMs: chunk.nextStartsAtMs };
        }
    }

    // Before the first chunk of the day, or after the last — find the
    // next chunk today or on a following day.
    const nextToday = archives.nextChunkAfter(videos, timeMs);
    if (nextToday) {
        return { status: 'no-signal', nextStartsAtMs: archives.parseShowTime(nextToday.startsAt) };
    }
    const nextLater = await firstChunkOnOrAfter(room, timeMs, day);
    return { status: 'no-signal', nextStartsAtMs: nextLater };
}

/**
 * Find the start (show-time ms) of the first chunk for a room at or
 * after timeMs, scanning forward through the season's days. Skips
 * days at or before afterDay if given. Returns null if none.
 *
 * Bounded to a few days of lookahead to avoid hammering the API for
 * rooms with long dark periods — beyond that the countdown just
 * isn't shown until the clock gets closer.
 */
const LOOKAHEAD_DAYS = 3;
async function firstChunkOnOrAfter(room, timeMs, afterDay = null) {
    const season = getSetting('rerunSeason');
    let startIdx = 0;
    if (afterDay) {
        startIdx = seasonDays.indexOf(afterDay) + 1;
    } else {
        const date = archives.formatShowDate(timeMs);
        startIdx = seasonDays.findIndex(d => d >= date);
        if (startIdx === -1) return null;
    }
    const endIdx = Math.min(startIdx + LOOKAHEAD_DAYS, seasonDays.length);
    for (let i = startIdx; i < endIdx; i++) {
        const videos = await archives.getVideos(season, room, seasonDays[i]);
        const next = archives.nextChunkAfter(videos, timeMs);
        if (next) return archives.parseShowTime(next.startsAt);
    }
    return null;
}

/**
 * Fetch a signed playback URL for a chunk. Thin passthrough — the
 * URL is signed per-file and must not be cached long-term.
 */
export function getChunkUrl(chunk) {
    const parsed = archives.parseVideoId(chunk.fileName);
    if (!parsed) return Promise.resolve(null);
    return archives.getWatchUrl(parsed.season, parsed.room, parsed.day, parsed.fileName);
}

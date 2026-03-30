/**
 * zones.js — Hidden clickable zone detection
 *
 * Detects hidden clickable zones in the video player's SVG overlay,
 * makes them visible with a distinct hover colour, and notifies the
 * user via toast.
 *
 * The SVG overlay sits inside the video player container. Polygons
 * with `pointer-events-visible` but WITHOUT `cursor-pointer` are
 * hidden zones (easter eggs that give items when clicked).
 *
 * Detection strategy:
 * - Observe #live-stream-player for SVG changes (targeted, NOT body)
 * - When polygons appear, scan for hidden ones
 * - Unhide by adding cursor-pointer + our custom hover class
 * - Toast notification with count
 * - Re-scan when SVG changes (camera switch)
 *
 * The observer is on the player container, which is a stable element.
 * It disconnects if the player is removed, and reconnects when it
 * reappears.
 */

import { ui } from '../../ftl-ext-sdk/src/index.js';
import { getSetting } from './settings.js';

const HIDDEN_ZONE_CLASS = 'ftl-ext-hidden-zone';
let playerObserver = null;
let cssInjected = false;

/**
 * Inject the CSS for hidden zone highlighting.
 * Uses inline <style> since Tailwind classes may not exist.
 */
function injectCSS() {
    if (cssInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .${HIDDEN_ZONE_CLASS} {
            cursor: pointer !important;
        }
        .${HIDDEN_ZONE_CLASS}:hover {
            fill: #F8EC9426 !important;
        }
    `;
    document.head.appendChild(style);
    cssInjected = true;
}

/**
 * Scan an SVG element for hidden clickable zones and unhide them.
 * Returns the number of hidden zones found.
 */
function scanAndUnhide(svg) {
    const polygons = svg.querySelectorAll('polygon.pointer-events-visible');
    let hiddenCount = 0;

    for (const polygon of polygons) {
        // Already processed by us
        if (polygon.classList.contains(HIDDEN_ZONE_CLASS)) continue;

        // Hidden zones have pointer-events-visible but lack cursor-pointer
        if (!polygon.classList.contains('cursor-pointer')) {
            polygon.classList.add(HIDDEN_ZONE_CLASS);
            hiddenCount++;
        }
    }

    return hiddenCount;
}

/**
 * Find the SVG overlay in the player and scan it.
 */
function scanPlayer() {
    if (!getSetting('revealHiddenZones')) return;

    const player = document.getElementById('live-stream-player');
    if (!player) return;

    // The SVG overlay is a child of the player's grandparent (.fixed.bg-dark container)
    const container = player.parentElement?.parentElement;
    if (!container) return;

    const svg = container.querySelector('svg.absolute.z-1');
    if (!svg) return;

    const found = scanAndUnhide(svg);

    if (found > 0) {
        const label = found === 1 ? 'Hidden clickable zone detected!' : `${found} hidden clickable zones detected!`;
        console.log(label);
        ui.toasts.notify(label, {
            description: 'FTL Extended revealed it for you',
            type: 'info',
            duration: 5000,
        });
    }
}

/**
 * Start observing the video player area for SVG changes.
 * Called once on startup. Watches the player's parent container
 * for child changes (SVG appearing, disappearing, or being replaced
 * when switching cameras).
 */
export function initZoneDetection() {
    if (!getSetting('revealHiddenZones')) return;

    injectCSS();

    // Initial scan in case the SVG already exists
    scanPlayer();

    // Watch for the player container to gain/lose SVG children
    // We observe the parent of #live-stream-player since the SVG
    // is a sibling of the player element
    function startObserving() {
        const player = document.getElementById('live-stream-player');
        if (!player) return false;

        const container = player.parentElement?.parentElement;
        if (!container) return false;

        // Don't double-observe
        if (playerObserver) playerObserver.disconnect();

        playerObserver = new MutationObserver(() => {
            scanPlayer();
        });

        playerObserver.observe(container, { childList: true, subtree: true });
        return true;
    }

    // The player might not exist yet on first load
    if (!startObserving()) {
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            if (startObserving() || attempts > 40) {
                clearInterval(poll);
            }
        }, 250);
    }
}

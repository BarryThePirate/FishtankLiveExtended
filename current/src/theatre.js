/**
 * theatre.js — Enhanced Theatre Mode
 *
 * Replaces the site's built-in theatre mode with a cleaner experience:
 * video fills the viewport with an optional collapsible chat panel.
 *
 * When the 'enhancedTheatreMode' setting is enabled:
 * - Intercepts the T keypress (stopImmediatePropagation prevents site handler)
 * - Intercepts clicks on the site's theatre mode button
 * - Intercepts clicks on the fullscreen button (uses page fullscreen instead)
 * - Uses our backdrop overlay approach instead of the site's layout
 *
 * When disabled, T and the button work as normal (site's theatre mode).
 *
 * Strategy:
 * - Insert a black backdrop div at z-index 50 to cover all site chrome
 * - Raise the video container and chat container to z-index 51
 * - Raise the chat container's parent (z-1 stacking context) to z-index 51
 * - Resize video to fill the viewport (minus chat width when open)
 * - Add a toggle button to show/hide chat
 * - ESC to exit
 * - Auto-exit if the video player is removed from the DOM
 */

import { ui } from '../../ftl-ext-sdk/src/index.js';
import { getSetting } from './settings.js';

const BACKDROP_ID = 'ftl-ext-theatre-backdrop';
const TOGGLE_BTN_ID = 'ftl-ext-theatre-chat-toggle';
const STYLE_ID = 'ftl-ext-theatre-styles';
const BODY_CLASS = 'ftl-theatre-mode';
const CHAT_WIDTH = 368; // matches site's 2xl:w-[368px]

let active = false;
let chatVisible = true;
let videoContainer = null;
let controlsContainer = null;
let chatContainer = null;
let savedVideoStyles = {};
let savedControlsStyles = {};
let savedChatStyles = {};
let savedChatParentZIndex = '';
let theatreButtonListener = null;
let playerObserver = null;

/**
 * Find the video player's outermost container.
 *
 * Live (HLS): the .fixed.bg-dark element that contains #live-stream-player.
 * VOD/archive: there is no #live-stream-player — the site promotes the
 * clicked tile's <video> into an id-less fixed wrapper. Grid tile videos
 * sit in static wrappers, so "a <video> with a .fixed ancestor" uniquely
 * identifies the promoted player (our own overlay players are excluded
 * via data-ftl-sdk).
 */
function findVideoContainer() {
    // Re-run mode's focused player: theatre the whole overlay (it owns
    // the video, controls, and zones). Its own layout engine pauses
    // while body.ftl-theatre-mode is set.
    const rerun = document.getElementById('ftl-rerun-overlay');
    if (rerun?.classList.contains('ftl-rerun-focused')) return rerun;

    const player = document.getElementById('live-stream-player');
    if (player) {
        let el = player.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('fixed') && (el.classList.contains('bg-dark') || el.style.transform !== undefined)) {
                return el;
            }
            el = el.parentElement;
        }
        return player.parentElement?.parentElement || null;
    }
    for (const v of document.querySelectorAll('video')) {
        if (v.closest('[data-ftl-sdk]')) continue;
        const wrap = v.closest('.fixed');
        if (wrap) return wrap;
    }
    return null;
}

/**
 * The VOD player renders its controls (close X, volume, day/clock) in a
 * separate fixed pointer-events-none layer, a sibling of the video
 * wrapper. Theatre mode has to reposition it alongside the video or the
 * controls stay stranded at the original player geometry. Identified by
 * the site's close-X icon path. (The live player keeps its controls
 * inside the container, so this returns null there.)
 */
function findControlsContainer(videoWrap) {
    for (const div of document.querySelectorAll('div.fixed.pointer-events-none')) {
        if (div === videoWrap || videoWrap?.contains(div)) continue;
        if (div.closest('[data-ftl-sdk]')) continue;
        const hasCloseX = [...div.querySelectorAll('svg path')]
            .some(p => (p.getAttribute('d') || '').startsWith('M400 145.49'));
        if (hasCloseX) return div;
    }
    return null;
}

/**
 * Find the chat container.
 * It's the .fixed element that contains #chat-input.
 */
function findChatContainer() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return null;
    let el = chatInput.parentElement;
    while (el && el !== document.body) {
        if (el.classList.contains('fixed') || (el.style.position === 'fixed')) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

/**
 * Save an element's current inline styles so we can restore them later.
 */
function saveStyles(el) {
    return {
        cssText: el.style.cssText,
        className: el.className,
    };
}

/**
 * Restore an element's saved inline styles.
 */
function restoreStyles(el, saved) {
    el.style.cssText = saved.cssText;
    el.className = saved.className;
}

/**
 * Toggle browser fullscreen on the whole page.
 */
function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
}

/**
 * Inject the theatre mode stylesheet.
 */
function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* Backdrop covers everything */
        #${BACKDROP_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            z-index: 50;
        }

        /* Chat toggle button */
        #${TOGGLE_BTN_ID} {
            position: fixed;
            bottom: 60px;
            right: 0;
            z-index: 52;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-right: none;
            border-radius: 8px 0 0 8px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            padding: 12px 6px;
            font-size: 14px;
            line-height: 1;
            backdrop-filter: blur(4px);
            transition: background 0.15s, color 0.15s, right 0.3s ease;
        }
        #${TOGGLE_BTN_ID}:hover {
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
        }

        /* When chat is open, nudge the button left */
        body.${BODY_CLASS}.ftl-theatre-chat-open #${TOGGLE_BTN_ID} {
            right: ${CHAT_WIDTH}px;
        }

        /* Ensure site modals appear above the backdrop */
        body.${BODY_CLASS} #modal {
            z-index: 52 !important;
        }

        /* Ensure DM/messenger windows appear above the backdrop */
        body.${BODY_CLASS} .fixed.z-25 {
            z-index: 52 !important;
        }

        /* Ensure profile popups appear above the backdrop */
        body.${BODY_CLASS} .fixed[draggable="false"] {
            z-index: 52 !important;
        }
        
        /* Ensure emoji/medal picker appears above the backdrop */
        body.${BODY_CLASS} [role="dialog"][aria-orientation] {
            z-index: 52 !important;
        }

        /* Ensure floating-ui dropdowns (TTS/SFX voice/room selects) appear above the backdrop */
        body.${BODY_CLASS} [data-floating-ui-portal] {
            position: relative;
            z-index: 53 !important;
        }

        /* Theatre mode transitions */
        body.${BODY_CLASS} .ftl-theatre-video {
            transition: width 0.3s ease, left 0.3s ease;
        }
        body.${BODY_CLASS} .ftl-theatre-chat {
            transition: transform 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create the backdrop div.
 */
function createBackdrop() {
    let backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = BACKDROP_ID;
        document.body.appendChild(backdrop);
    }
    return backdrop;
}

/**
 * Create the chat toggle button.
 */
function createToggleButton() {
    let btn = document.getElementById(TOGGLE_BTN_ID);
    if (!btn) {
        btn = document.createElement('button');
        btn.id = TOGGLE_BTN_ID;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M408 48H104a72.08 72.08 0 0 0-72 72v192a72.08 72.08 0 0 0 72 72h24v64a16 16 0 0 0 26.25 12.29L245.74 384H408a72.08 72.08 0 0 0 72-72V120a72.08 72.08 0 0 0-72-72Z"/></svg>`;
        btn.title = 'Toggle chat';
        btn.addEventListener('click', toggleChat);
        document.body.appendChild(btn);
    }
    return btn;
}

/**
 * Watch for the video player being removed from the DOM.
 * If it disappears (e.g. navigating to a profile), exit theatre mode.
 *
 * React replaces the tree at a high level, so we observe document.body
 * with subtree. This observer only exists during theatre mode and
 * disconnects immediately when the player vanishes or theatre exits.
 */
function watchPlayerRemoval() {
    // Observe body's direct children only (no subtree) to detect when
    // React swaps out the video container during navigation.
    if (!videoContainer) return;

    playerObserver = new MutationObserver(() => {
        if (!videoContainer.isConnected) {
            exitTheatre();
        }
    });

    playerObserver.observe(document.body, { childList: true });
}

/**
 * Apply theatre layout to video container.
 */
function styleVideoForTheatre() {
    if (!videoContainer) return;
    videoContainer.classList.add('ftl-theatre-video');
    videoContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: ${chatVisible ? `calc(100% - ${CHAT_WIDTH}px)` : '100%'} !important;
        height: 100% !important;
        z-index: 51 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        transform: none !important;
    `;
    // VOD player: keep the detached controls layer glued to the video's
    // theatre geometry (pointer-events stays none; its buttons re-enable
    // themselves with pointer-events-auto).
    if (controlsContainer) {
        controlsContainer.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: ${chatVisible ? `calc(100% - ${CHAT_WIDTH}px)` : '100%'} !important;
            height: 100% !important;
            z-index: 52 !important;
            margin: 0 !important;
            transform: none !important;
            pointer-events: none !important;
        `;
    }
}

/**
 * Apply theatre layout to chat container.
 * Also raises the parent wrapper which has z-1 creating a stacking
 * context that would otherwise trap the chat below our backdrop.
 */
function styleChatForTheatre() {
    if (!chatContainer) return;

    // The chat container's parent has class="relative z-1" which creates
    // a stacking context — everything inside is trapped at z-index 1.
    // We need to lift that parent above the backdrop too.
    if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
        chatContainer.parentElement.style.zIndex = '51';
    }

    chatContainer.classList.add('ftl-theatre-chat');
    chatContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        left: auto !important;
        width: ${CHAT_WIDTH}px !important;
        height: 100% !important;
        z-index: 51 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        transform: ${chatVisible ? 'translateX(0)' : `translateX(${CHAT_WIDTH}px)`} !important;
    `;
}

/**
 * Update layout when chat visibility changes.
 */
function updateLayout() {
    styleVideoForTheatre();
    styleChatForTheatre();

    if (chatVisible) {
        document.body.classList.add('ftl-theatre-chat-open');
    } else {
        document.body.classList.remove('ftl-theatre-chat-open');
    }
}

/**
 * Toggle chat panel visibility.
 */
function toggleChat() {
    chatVisible = !chatVisible;
    updateLayout();
}

/**
 * Enter theatre mode.
 */
export function enterTheatre() {
    if (active) return;

    // If already in browser fullscreen, exit it first to prevent
    // the site's fullscreen theatre mode from interfering, then
    // re-enter fullscreen with our clean layout
    if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
            setTimeout(() => {
                enterTheatre();
                setTimeout(() => {
                    document.documentElement.requestFullscreen();
                }, 100);
            }, 100);
        });
        return;
    }

    videoContainer = findVideoContainer();
    chatContainer = findChatContainer();

    if (!videoContainer) {
        ui.toasts.notify('Theatre mode unavailable', {
            description: 'No video player found',
            type: 'error',
            duration: 3000,
        });
        return;
    }

    controlsContainer = findControlsContainer(videoContainer);

    // Save original styles
    savedVideoStyles = saveStyles(videoContainer);
    if (controlsContainer) savedControlsStyles = saveStyles(controlsContainer);
    if (chatContainer) {
        savedChatStyles = saveStyles(chatContainer);
        if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
            savedChatParentZIndex = chatContainer.parentElement.style.zIndex;
        }
    }

    injectStyles();
    createBackdrop();
    createToggleButton();

    chatVisible = true;
    document.body.classList.add(BODY_CLASS);
    document.body.classList.add('ftl-theatre-chat-open');

    updateLayout();
    watchPlayerRemoval();

    active = true;
}

/**
 * Exit theatre mode.
 */
export function exitTheatre() {
    if (!active) return;

    // Disconnect player removal watcher
    if (playerObserver) {
        playerObserver.disconnect();
        playerObserver = null;
    }

    // Exit browser fullscreen if active
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }

    // Remove backdrop
    const backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop) backdrop.remove();

    // Remove toggle button
    const btn = document.getElementById(TOGGLE_BTN_ID);
    if (btn) btn.remove();

    // Restore original styles
    if (videoContainer) {
        restoreStyles(videoContainer, savedVideoStyles);
        videoContainer.classList.remove('ftl-theatre-video');
    }
    if (controlsContainer) {
        restoreStyles(controlsContainer, savedControlsStyles);
    }
    if (chatContainer) {
        restoreStyles(chatContainer, savedChatStyles);
        chatContainer.classList.remove('ftl-theatre-chat');
        if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
            chatContainer.parentElement.style.zIndex = savedChatParentZIndex;
        }
    }

    document.body.classList.remove(BODY_CLASS);
    document.body.classList.remove('ftl-theatre-chat-open');

    active = false;
    videoContainer = null;
    controlsContainer = null;
    chatContainer = null;
    savedChatParentZIndex = '';
}

/**
 * Toggle theatre mode on/off.
 * Checks the enhancedTheatreMode setting — if disabled, does nothing
 * (lets the site's native theatre mode handle it).
 */
export function toggleTheatre() {
    if (!getSetting('enhancedTheatreMode')) return;

    if (active) {
        exitTheatre();
    } else {
        enterTheatre();
    }
}

/**
 * Check if theatre mode is currently active.
 */
export function isTheatreActive() {
    return active;
}

/**
 * Inject theatre + fullscreen buttons into the site's VOD player
 * controls. The live (HLS) player ships its own theatre/fullscreen
 * buttons — which we intercept below — but the VOD player's chrome is
 * only X + volume + clock, leaving our features hotkey-only there.
 * Called from the global click-injection pass in index.js (the VOD
 * player only ever appears after a click).
 */
// Icons matching the site's own player buttons (react-icons paths
// lifted from the site bundle: GiTheaterCurtains and IoExpand).
export const THEATRE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M18 18v94.275c28.382-12.57 52.994-35.202 71.39-59.734-4.662-3.466-8.973-7.064-12.865-10.79C68.903 34.452 62.723 26.51 58.973 18zm61.754 0c2.378 3.508 5.41 7.103 9.22 10.75 10.73 10.274 26.505 20.414 44.88 29.117C170.602 75.274 217.8 87 256 87s85.398-11.726 122.146-29.133c18.375-8.703 34.15-18.843 44.88-29.117 3.81-3.647 6.842-7.242 9.22-10.75zm373.273 0c-3.75 8.51-9.93 16.452-17.552 23.75-3.892 3.726-8.203 7.324-12.864 10.79 18.396 24.533 43.008 47.166 71.39 59.735V18zm-82.554 16.734C354.78 52.937 308.428 65.326 256 65.33c-52.242-.023-98.44-12.343-114.236-30.463C168.982 45.655 211.206 51.987 256 52c44.953-.022 87.294-6.408 114.473-17.266zM104.785 62.78C83.37 91.92 53.765 118.415 18 131.788v174.035c2.116.805 4.112 1.178 6 1.178 8.312-.646 12.295-5.132 18.324-9.984 29.568-24.024 49.255-66.27 65.053-119.094 9.187-30.72 17.136-64.91 25.34-100.78-2.216-.986-4.41-1.986-6.57-3.01-7.512-3.557-14.67-7.346-21.362-11.35zm302.43 0c-6.693 4.006-13.85 7.795-21.36 11.353-2.162 1.023-4.356 2.023-6.572 3.008 8.204 35.872 16.153 70.062 25.34 100.782 15.798 52.825 35.485 95.07 65.053 119.094 5.414 4.648 11.22 9.89 18.324 9.984 1.888 0 3.884-.373 6-1.178V131.787c-35.764-13.373-65.37-39.87-86.785-69.006zM46.13 317.34C39.233 322.193 31.793 325 24 325c-2.025 0-4.026-.197-6-.564v123.2c6.273 2.01 14.098 3.364 22 3.364 12.41 0 24.637-3.336 30.94-7.316-.04-43.556-.973-88.042-24.81-126.344zm419.74 0c-23.837 38.302-24.77 82.788-24.81 126.344 6.303 3.98 18.53 7.316 30.94 7.316 7.902 0 15.727-1.353 22-3.363v-123.2c-1.974.366-3.975.563-6 .563-7.792 0-15.232-2.807-22.13-7.66zM88.39 409c.6 13.277.61 26.37.61 39v3.73l-2.637 2.633C75.18 465.545 57.5 469 40 469c-7.475 0-14.98-.636-22-2.232V487h476v-20.232c-7.02 1.596-14.525 2.232-22 2.232-17.5 0-35.18-3.455-46.363-14.637L423 451.73V448c0-12.63.01-25.723.61-39z"></path></svg>';
export const EXPAND_ICON_SVG = '<svg viewBox="0 0 512 512" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M432 320v112H320m101.8-10.23L304 304M80 192V80h112M90.2 90.23 208 208M320 80h112v112M421.77 90.2 304 208M192 432H80V320m10.23 101.8L208 304"></path></svg>';

// Chrome shared by the site-style player buttons (the site's Button
// component): outer gradient shell + beveled face, per colour variant.
// "primary" matches the site's own player close (X) button.
const SITE_BTN_SHELLS = {
    secondary: 'bg-gradient-to-r from-secondary-500 to-secondary-600/75 active:to-secondary-700/90',
    primary: 'bg-gradient-to-r from-primary-400 to-primary-500/90 active:to-primary-600/75',
};
const SITE_BTN_FACES = {
    secondary: 'bg-gradient-to-t from-secondary-400 to-secondary-500'
        + ' active:bg-gradient-to-b active:from-secondary-500 active:to-secondary-300',
    primary: 'bg-gradient-to-t from-primary-400 to-primary-500'
        + ' active:bg-gradient-to-b active:from-primary-500 active:to-primary-300',
};
const SITE_BTN_SHELL_BASE = 'p-0.5 inline-flex items-center justify-center cursor-pointer'
    + ' rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary'
    + ' pointer-events-auto';
const SITE_BTN_FACE_BASE = 'text-light-text border-light/25 active:border-light/15 rounded-sm'
    + ' flex items-center justify-center h-full w-full';

/**
 * Build a 32×32 icon button matching the site's player controls.
 */
export function siteIconButton(title, svg, onClick, variant = 'secondary') {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = title;
    b.className = `w-[32px] h-[32px] ${SITE_BTN_SHELLS[variant]} ${SITE_BTN_SHELL_BASE}`;
    b.innerHTML = `<div class="${SITE_BTN_FACES[variant]} ${SITE_BTN_FACE_BASE}">${svg}</div>`;
    b.addEventListener('click', onClick);
    return b;
}

/**
 * Same chrome as siteIconButton, but with a text label instead of an
 * icon (width follows the label).
 */
export function siteTextButton(title, text, onClick, variant = 'secondary') {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = title;
    b.className = `h-[32px] ${SITE_BTN_SHELLS[variant]} ${SITE_BTN_SHELL_BASE}`;
    const face = document.createElement('div');
    face.className = `${SITE_BTN_FACES[variant]} ${SITE_BTN_FACE_BASE}`
        + ' px-2 text-sm font-medium whitespace-nowrap leading-none text-shadow-md';
    face.textContent = text;
    b.appendChild(face);
    b.addEventListener('click', onClick);
    return b;
}

export function tryInjectVodControls() {
    if (!getSetting('enhancedTheatreMode')) return;
    if (document.getElementById('live-stream-player')) return; // live player has native buttons
    const layer = findControlsContainer(null);
    if (!layer || layer.querySelector('[data-ftl-sdk="vod-controls"]')) return;

    // The live player groups theatre/fullscreen with the volume cluster;
    // mirror that by appending to the VOD layer's volume flex row.
    const volumeRow = layer.querySelector('input[type="range"]')?.parentElement;
    if (!volumeRow) return;

    const wrap = document.createElement('div');
    wrap.setAttribute('data-ftl-sdk', 'vod-controls');
    wrap.className = 'flex items-center gap-2 ml-2';
    wrap.appendChild(siteIconButton('Theater Mode (T)', THEATRE_ICON_SVG, () => toggleTheatre()));
    wrap.appendChild(siteIconButton('Fullscreen (F)', EXPAND_ICON_SVG, () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            if (active) exitTheatre();
        } else {
            if (!active) enterTheatre();
            document.documentElement.requestFullscreen();
        }
    }));
    volumeRow.appendChild(wrap);
}

/**
 * Intercept clicks on the site's theatre mode button, close button,
 * and fullscreen button. Called once on startup.
 */
export function initTheatreButtonIntercept() {
    function interceptHandler(e) {
        const btn = e.target.closest('button');
        if (!btn) return;

        // Check if it's the theatre button
        if (getSetting('enhancedTheatreMode')) {
            const svg = btn.querySelector('svg');
            if (svg) {
                const path = svg.querySelector('path');
                if (path && path.getAttribute('d')?.includes('M18 18v94.275')) {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleTheatre();
                    return;
                }
            }
        }

        // Check if it's the close/back button (X icon) while theatre is active
        // Only match the X on the video player, not on modals, DMs, or other popups
        if (active && !btn.closest('#modal') && !btn.closest('.fixed[draggable="false"]')) {
            const paths = btn.querySelectorAll('svg path');
            for (const p of paths) {
                if (p.getAttribute('d')?.includes('M400 145.49')) {
                    exitTheatre();
                    return;
                }
            }
        }

        // Check if it's the fullscreen button
        if (getSetting('enhancedTheatreMode')) {
            const paths = btn.querySelectorAll('svg path');
            for (const p of paths) {
                if (p.getAttribute('d')?.includes('M432 320v112H320')) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                        if (active) exitTheatre();
                    } else {
                        if (!active) enterTheatre();
                        document.documentElement.requestFullscreen();
                    }
                    return;
                }
            }
        }
    }

    document.addEventListener('click', interceptHandler, true);
    theatreButtonListener = interceptHandler;
}
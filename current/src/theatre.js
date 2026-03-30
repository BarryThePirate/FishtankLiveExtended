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
let chatContainer = null;
let savedVideoStyles = {};
let savedChatStyles = {};
let savedChatParentZIndex = '';
let theatreButtonListener = null;
let playerObserver = null;

/**
 * Find the video player's outermost container.
 * It's the .fixed.bg-dark element that contains #live-stream-player.
 */
function findVideoContainer() {
    const player = document.getElementById('live-stream-player');
    if (!player) return null;
    let el = player.parentElement;
    while (el && el !== document.body) {
        if (el.classList.contains('fixed') && (el.classList.contains('bg-dark') || el.style.transform !== undefined)) {
            return el;
        }
        el = el.parentElement;
    }
    return player.parentElement?.parentElement || null;
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
    playerObserver = new MutationObserver(() => {
        if (!document.getElementById('live-stream-player')) {
            exitTheatre();
        }
    });

    playerObserver.observe(document.body, { childList: true, subtree: true });
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

    // Save original styles
    savedVideoStyles = saveStyles(videoContainer);
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
        if (active) {
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
/**
 * modals.js — Modal builders and helpers
 *
 * Contains the FTL Extended settings modal (the big tabbed panel),
 * the dropdown button injector, and a generic modal-open helper.
 *
 * NO body-level MutationObservers. The dropdown button is injected
 * via a click listener on the profile avatar area, and modals are
 * detected via the SDK's modalOpen event.
 */

import { getSetting, updateSetting } from './settings.js';
import { toggleRow, logPill } from './ui-helpers.js';
import { renderRecipeResults } from './crafting.js';
import {
    getLog, getAdminFilter, renderLog, clearLog, resizeLog,
    addFilterTerm, removeFilterTerm, resetUnreadPings,
} from './logging.js';
import * as storage from '../../ftl-ext-sdk/src/core/storage.js';

let currentUsername = null;
let activeModalName = null;
let userPasses = { seasonPass: false, seasonPassXL: false };

export function setCurrentUsername(name) {
    currentUsername = name;
}

export function setUserPasses(passes) {
    userPasses = passes;
}

export function setActiveModal(name) {
    activeModalName = name;
}

// ── Firefox-safe event dispatch ──────────────────────────────────────
// Firefox content scripts run in a separate JS realm. CustomEvent detail
// objects created here are not accessible from the page context, causing
// "Permission denied to access property" errors. cloneInto() copies the
// detail into the page realm so NextJS handlers can read it.

function dispatchPageEvent(eventName, detail = {}) {
    const safeDetail = typeof cloneInto === 'function'
        ? cloneInto(detail, document.defaultView) : detail;
    document.dispatchEvent(new CustomEvent(eventName, { detail: safeDetail }));
}

// ── Generic modal open helper ───────────────────────────────────────

export function openModal(modalName, data = {}) {
    // Toggle: if this modal is already open, close it
    if (document.getElementById('modal') && activeModalName === modalName) {
        dispatchPageEvent('modalClose');
        return;
    }

    if (document.getElementById('modal')) {
        dispatchPageEvent('modalClose');
        setTimeout(() => {
            dispatchPageEvent('modalOpen', { modal: modalName, data: JSON.stringify(data) });
        }, 50);
    } else {
        dispatchPageEvent('modalOpen', { modal: modalName, data: JSON.stringify(data) });
    }
}

// ── Dropdown button injection ───────────────────────────────────────
// Injects our "FTL Extended" button into the profile dropdown.
// Called from a click listener on the top-right profile area —
// NOT from a body observer.

export function tryInjectDropdownButton() {
    const dropdown = document.querySelector('.fixed.top-0.right-\\[16px\\]');
    if (!dropdown || dropdown.querySelector('[data-ftl-sdk="dropdown-btn"]')) return;

    const buttons = dropdown.querySelectorAll('button');
    const billingBtn = [...buttons].find(btn => btn.textContent.trim().includes('Billing'));
    if (!billingBtn) return;

    const btn = document.createElement('button');
    btn.setAttribute('data-ftl-sdk', 'dropdown-btn');
    btn.className = 'flex items-center w-full rounded-md gap-2 px-2 py-1 font-medium cursor-pointer drop-shadow-[2px_2px_0_#00000075] hover:text-primary-400 hover:bg-light/5';
    btn.innerHTML = `
        <div class="flex items-center text-primary">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="1em" height="1em">
                <rect x="7" y="6" width="10" height="2"></rect>
                <rect x="6" y="8" width="12" height="2"></rect>
                <rect x="6" y="10" width="2" height="2"></rect>
                <rect x="11" y="10" width="2" height="2"></rect>
                <rect x="16" y="10" width="2" height="2"></rect>
                <rect x="13" y="12" width="3" height="2"></rect>
                <rect x="8" y="12" width="3" height="2"></rect>
                <rect x="9" y="14" width="6" height="1"></rect>
                <rect x="10" y="17" width="4" height="1"></rect>
                <rect x="11" y="15" width="1" height="1"></rect>
                <rect x="13" y="15" width="1" height="1"></rect>
                <rect x="12" y="16" width="1" height="1"></rect>
                <rect x="10" y="16" width="1" height="1"></rect>
                <rect x="2" y="0" width="2" height="2"></rect>
                <rect x="0" y="2" width="4" height="2"></rect>
                <rect x="4" y="4" width="2" height="2"></rect>
                <rect x="20" y="0" width="2" height="2"></rect>
                <rect x="20" y="2" width="4" height="2"></rect>
                <rect x="18" y="4" width="2" height="2"></rect>
                <rect x="0" y="20" width="4" height="2"></rect>
                <rect x="2" y="22" width="2" height="2"></rect>
                <rect x="4" y="18" width="2" height="2"></rect>
                <rect x="6" y="16" width="2" height="2"></rect>
                <rect x="20" y="20" width="4" height="2"></rect>
                <rect x="20" y="22" width="2" height="2"></rect>
                <rect x="18" y="18" width="2" height="2"></rect>
                <rect x="16" y="16" width="2" height="2"></rect>
            </svg>
        </div>
        <div class="flex items-center">FTL Extended</div>
    `;
    btn.addEventListener('click', openSettingsModal);
    billingBtn.insertAdjacentElement('beforebegin', btn);
}

// ── Ping button in chat header ──────────────────────────────────────
// Injects a small @ button into the chat header bar (next to the
// megaphone button). Clicking it opens FTL Extended on the pings log.

export function tryInjectPingButton() {
    if (!getSetting('enablePingIndicator')) return;

    // Find the chat header — it contains "Chat" text and the "Global" pill
    const chatLabels = document.querySelectorAll('span.font-bold.text-dark-text');
    let chatHeader = null;
    for (const label of chatLabels) {
        if (label.textContent.trim() === 'Chat') {
            chatHeader = label.closest('.flex.items-center.px-1');
            break;
        }
    }
    if (!chatHeader) return;

    // Already injected
    if (chatHeader.querySelector('[data-ftl-sdk="ping-btn"]')) return;

    // Find the button container on the right side of the header
    const btnContainer = chatHeader.querySelector('.flex.items-center.gap-0\\.5');
    if (!btnContainer) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'relative translate-y-[2px]';
    wrapper.setAttribute('data-ftl-sdk', 'ping-btn');

    const btn = document.createElement('button');
    // Starts dimmed — opacity-50 + saturate-0
    btn.className = 'bg-gradient-to-r from-primary-400 to-primary-500/90 active:to-primary-600/75 p-0.5 inline-flex items-center justify-center cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary pointer-events-auto transition-[opacity,filter] duration-300 opacity-50 saturate-0';
    btn.type = 'button';
    btn.title = 'View pings';
    btn.innerHTML = `
        <div class="text-light-text bg-gradient-to-t from-primary-400 to-primary-500 active:bg-gradient-to-b active:from-primary-500 active:to-primary-300 border-light/25 active:border-light/15 p-0.5 rounded-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.26 2.92 5.72-.18.66-.52 1.56-1.18 2.56-.22.34-.02.76.36.82 1.76.26 3.64-.12 4.92-.94.62.12 1.28.18 1.98.18 5.52 0 10-3.58 10-8S17.52 2 12 2zm-2 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
        </div>
    `;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModalToTab('logging', 'pings');
    });

    wrapper.appendChild(btn);
    btnContainer.insertBefore(wrapper, btnContainer.firstChild);
}

/**
 * Update the ping button state — dimmed when no unread, lit when unread.
 * Called by the ping count change callback from logging.js.
 */
export function updatePingBadge(count) {
    const wrapper = document.querySelector('[data-ftl-sdk="ping-btn"]');
    const btn = wrapper?.querySelector('button');
    if (!btn) return;

    if (count > 0) {
        btn.classList.remove('opacity-50', 'saturate-0');
    } else {
        btn.classList.add('opacity-50', 'saturate-0');
    }
}

// ── IRC mode ────────────────────────────────────────────────────────

let ircActive = false;
let ircSavedPanelStyle = null;
let ircSavedChild1Style = null;

export function toggleIrcMode() {
    ircActive = !ircActive;

    const panel = document.querySelector('.fixed.bottom-0.right-0');
    const parent = panel?.closest('.relative');

    if (!panel || !parent) return;

    if (ircActive) {
        // Save original inline styles
        ircSavedPanelStyle = panel.style.cssText;
        ircSavedChild1Style = panel.children[1]?.style.cssText || '';

        // Hide both map containers (one above panel, one inside chat)
        panel.children[0].style.setProperty('display', 'none', 'important');
        panel.querySelector('.shrink-0.mt-2.pb-2')?.style.setProperty('display', 'none', 'important');

        // Expand chat panel to fill viewport
        panel.style.setProperty('left', '0', 'important');
        panel.style.setProperty('top', '0', 'important');
        panel.style.setProperty('width', '100vw', 'important');
        panel.style.setProperty('height', '100vh', 'important');
        panel.style.setProperty('margin', '0', 'important');
        panel.style.setProperty('transform', 'none', 'important');

        // Make chat box fill the panel
        panel.children[1].style.setProperty('height', '100%', 'important');

        // Bring parent stacking context above everything
        parent.style.setProperty('z-index', '9999', 'important');
    } else {
        // Restore map containers
        panel.children[0].style.removeProperty('display');
        panel.querySelector('.shrink-0.mt-2.pb-2')?.style.removeProperty('display');

        // Restore original styles
        panel.style.cssText = ircSavedPanelStyle || '';
        panel.children[1].style.cssText = ircSavedChild1Style || '';

        // If theatre mode is active, keep z-index high enough to stay above backdrop
        if (document.body.classList.contains('ftl-theatre-mode')) {
            parent.style.setProperty('z-index', '51', 'important');
        } else {
            parent.style.removeProperty('z-index');
        }

        ircSavedPanelStyle = null;
        ircSavedChild1Style = null;
    }

    // Update button state
    const btn = document.querySelector('[data-ftl-sdk="irc-btn"] button');
    if (btn) {
        btn.classList.toggle('opacity-50', !ircActive);
        btn.classList.toggle('saturate-0', !ircActive);
    }
}

export function isIrcActive() {
    return ircActive;
}

export function tryInjectIrcButton() {
    // Skip on mobile — mobile layout already works as an IRC-style view
    if (window.innerWidth < 1024) return;

    const chatLabels = document.querySelectorAll('span.font-bold.text-dark-text');
    let chatHeader = null;
    for (const label of chatLabels) {
        if (label.textContent.trim() === 'Chat') {
            chatHeader = label.closest('.flex.items-center.px-1');
            break;
        }
    }
    if (!chatHeader) return;

    if (chatHeader.querySelector('[data-ftl-sdk="irc-btn"]')) return;

    const btnContainer = chatHeader.querySelector('.flex.items-center.gap-0\\.5');
    if (!btnContainer) return;

    // Allow buttons to wrap to a second row on narrower layouts
    btnContainer.style.setProperty('flex-wrap', 'wrap', 'important');

    const wrapper = document.createElement('div');
    wrapper.className = 'relative translate-y-[2px]';
    wrapper.setAttribute('data-ftl-sdk', 'irc-btn');

    const btn = document.createElement('button');
    btn.className = 'bg-gradient-to-r from-purple-400 to-purple-500/90 active:to-purple-600/75 p-0.5 inline-flex items-center justify-center cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary pointer-events-auto transition-[opacity,filter] duration-300 opacity-50 saturate-0';
    btn.type = 'button';
    btn.title = 'IRC Mode';
    btn.innerHTML = `
        <div class="text-light-text bg-gradient-to-t from-purple-400 to-purple-500 active:bg-gradient-to-b active:from-purple-500 active:to-purple-300 border-light/25 active:border-light/15 p-0.5 rounded-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/>
            </svg>
        </div>
    `;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleIrcMode();
    });

    wrapper.appendChild(btn);
    btnContainer.insertBefore(wrapper, btnContainer.firstChild);
}

// ── Settings modal ──────────────────────────────────────────────────

let pendingTab = null;
let pendingLog = null;

export function openSettingsModal() {
    // Toggle: if our settings modal is already open, close it
    if (document.getElementById('modal') && activeModalName === 'ftlExtended') {
        dispatchPageEvent('modalClose');
        return;
    }
    pendingTab = null;
    pendingLog = null;
    openSettingsModalInternal();
}

export function openSettingsModalToTab(tabName, logType = null) {
    pendingTab = tabName;
    pendingLog = logType;
    if (logType === 'pings') resetUnreadPings();
    openSettingsModalInternal();
}

function openSettingsModalInternal() {
    if (document.getElementById('modal')) {
        dispatchPageEvent('modalClose');
        setTimeout(openSettingsModalInternal, 50);
        return;
    }

    dispatchPageEvent('modalOpen', {
        modal: 'ftlExtended',
        data: JSON.stringify({}),
    });

    // One-shot observer on body to find the modal element, then disconnect
    const observer = new MutationObserver(() => {
        const modal = document.getElementById('modal');
        if (!modal) return;
        observer.disconnect();

        setTimeout(() => buildSettingsContent(modal), 50);
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function buildSettingsContent(modal) {
    const card = modal.querySelector('.relative');
    if (!card) return;

    const wrapper = modal.querySelector('.absolute.w-\\[400px\\]');
    if (wrapper) wrapper.classList.replace('w-[400px]', 'w-[600px]');

    const contentArea = document.createElement('div');
    contentArea.setAttribute('data-ftl-sdk', 'settings');
    contentArea.innerHTML = `
        <div class="text-center font-bold mb-3 capitalize">FTL Extended</div>

        <!-- Tab bar -->
        <div class="flex gap-1 md:gap-3 mb-4">
            <button data-ftl-tab="general" class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full outline-1 outline-tertiary brightness-110" type="button">
                <div class="text-light-text bg-gradient-to-t from-primary-400 to-primary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">General</div>
            </button>
            <button data-ftl-tab="crafting" class="bg-gradient-to-r from-secondary-500 to-secondary-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-secondary-400 to-secondary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Crafting</div>
            </button>
            <button data-ftl-tab="logging" class="bg-gradient-to-r from-tertiary-500 to-tertiary-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-tertiary-400 to-tertiary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Logging</div>
            </button>
            <button data-ftl-tab="chat" class="bg-gradient-to-r from-purple-500 to-purple-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-purple-400 to-purple-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Chat</div>
            </button>
        </div>

        <!-- General tab -->
        <div data-ftl-panel="general">
            ${toggleRow('Auto Close Season Pass Popup', 'autoCloseSeasonPassPopup', getSetting('autoCloseSeasonPassPopup'))}
            ${toggleRow('Keyboard Shortcuts', 'enableKeyboardShortcuts', getSetting('enableKeyboardShortcuts'), 'Q P H X C M S &nbsp;(E always works)')}
            ${toggleRow('Reveal Hidden Clickable Zones', 'revealHiddenZones', getSetting('revealHiddenZones'), 'Highlights secret zones on the video player')}
            ${toggleRow('Enhanced Theatre Mode', 'enhancedTheatreMode', getSetting('enhancedTheatreMode'), 'Replaces site theatre mode (T)')}
            ${toggleRow('Video Stutter Improver', 'videoStutterImprover', getSetting('videoStutterImprover'), 'Auto fixes the video when stutters causes playback issues')}
            ${toggleRow('Inventory Search', 'enableInventorySearch', getSetting('enableInventorySearch'), 'Search items in inventory and crafting')}
            ${toggleRow('Ping Indicator', 'enablePingIndicator', getSetting('enablePingIndicator'), 'Show unread ping button in chat header')}
        </div>

        <!-- Crafting tab -->
        <div data-ftl-panel="crafting" class="hidden">
            ${toggleRow('Show Recipes When Crafting', 'showRecipesWhenCrafting', getSetting('showRecipesWhenCrafting'))}
            ${toggleRow('Show Recipes When Consuming', 'showRecipeWhenConsuming', getSetting('showRecipeWhenConsuming'))}
            <input data-ftl-craft-search type="text" placeholder="Search recipes..." class="font-regular text-md leading-none w-full h-[32px] p-1 mt-2 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25 mb-2" />
            <div data-ftl-craft-results class="hidden overflow-y-auto border-1 border-dark-400/50 rounded-md px-2 py-1" style="max-height: 400px; scrollbar-width: thin;"></div>
            <div class="text-xs opacity-40 text-center mt-2">Powered by <a href="https://fishtank.guru" target="_blank" class="cursor-pointer text-primary font-heavy hover:underline">fishtank.guru</a></div>
        </div>

        <!-- Logging tab -->
        <div data-ftl-panel="logging" class="hidden">
            <div class="flex gap-1 mb-3">
                ${logPill('admin', 'Admin')}
                ${logPill('staff', 'Staff')}
                ${logPill('mod', 'Mod')}
                ${logPill('fish', 'Fish')}
                ${logPill('pings', 'Pings')}
                ${logPill('tts', 'TTS')}
                ${logPill('sfx', 'SFX')}
            </div>
            <div data-ftl-log-size-row class="hidden flex items-center gap-2 mb-3 text-xs opacity-60">
                <span>Log size (max 1000)</span>
                <input data-ftl-log-size type="number" min="1" max="1000" value="${getSetting('ttsLogSize')}" class="w-[64px] text-center font-regular leading-none h-[24px] p-1 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                <button data-ftl-log-clear class="ml-auto cursor-pointer opacity-60 hover:opacity-100 hover:text-red-400 transition-all" type="button" title="Clear log">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16">
                        <rect x="9" y="0" width="6" height="2"></rect>
                        <rect x="7" y="2" width="2" height="2"></rect>
                        <rect x="15" y="2" width="2" height="2"></rect>
                        <rect x="2" y="4" width="20" height="2"></rect>
                        <rect x="4" y="6" width="2" height="16"></rect>
                        <rect x="18" y="6" width="2" height="16"></rect>
                        <rect x="4" y="22" width="14" height="2"></rect>
                        <rect x="9" y="8" width="1" height="12"></rect>
                        <rect x="14" y="8" width="1" height="12"></rect>
                    </svg>
                </button>
                <div data-ftl-log-clear-confirm class="hidden ml-auto flex items-center gap-2">
                    <span class="opacity-75">Sure?</span>
                    <button data-ftl-log-clear-yes class="cursor-pointer text-red-400 hover:opacity-100 font-bold" type="button">Yes</button>
                    <button data-ftl-log-clear-no class="cursor-pointer hover:opacity-100" type="button">No</button>
                </div>
            </div>
            <div data-ftl-log-content class="relative flex flex-col w-full bg-dark rounded-sm shadow-md bg-gradient-to-r from-dark-500 via-dark-600 to-dark-600 border-2 border-dark-300/50 overflow-y-auto text-light-text" style="height: 500px; max-height: 50dvh; overflow-x: hidden; scrollbar-width: thin;">
                <div class="text-sm text-center font-light italic p-5 m-auto opacity-75">Select a log type above</div>
            </div>
        </div>

        <!-- Chat tab -->
        <div data-ftl-panel="chat" class="hidden">
            ${toggleRow('Smart Anti-Spam Filtering', 'smartAntiSpam', getSetting('smartAntiSpam'), 'Removes spam, repeated messages, and flood copypastas from chat')}
            ${toggleRow('Hide TTS Messages', 'hideTTSMessages', getSetting('hideTTSMessages'), 'Remove TTS messages from the chat feed')}
            ${toggleRow('Hide SFX Messages', 'hideSFXMessages', getSetting('hideSFXMessages'), 'Remove SFX messages from the chat feed')}
            ${toggleRow('Hide StoX Messages', 'hideStoxMessages', getSetting('hideStoxMessages'), 'Remove StoX portfolio messages from the chat feed')}
            ${userPasses.seasonPass ? toggleRow('Monitor Season Pass Chat', 'monitorSeasonPass', getSetting('monitorSeasonPass'), 'Log messages and pings from Season Pass room') : ''}
            ${userPasses.seasonPassXL ? toggleRow('Monitor Season Pass XL Chat', 'monitorSeasonPassXL', getSetting('monitorSeasonPassXL'), 'Log messages and pings from Season Pass XL room') : ''}

            <div class="mt-3 pt-3 border-t-1 border-dark-400/50">
                <div class="text-sm font-medium mb-1 opacity-75">Word / Phrase Filters</div>
                <div class="text-xs opacity-40 mb-2">Messages containing these words or phrases will be hidden (case-insensitive)</div>
                <div class="flex gap-1">
                    <input data-ftl-word-filter-input type="text" placeholder="Add a word or phrase..." class="font-regular text-md leading-none w-full h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                    <button data-ftl-word-filter-add class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Add</div>
                    </button>
                </div>
                <div data-ftl-word-filter-tags class="flex flex-wrap gap-1 mt-2">${(getSetting('chatWordFilters') || []).map(f =>
        `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-400/50 text-xs text-light-text border-1 border-dark-300/50">
                        <span>${f}</span>
                        <button data-ftl-word-filter-remove="${f}" class="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-400" type="button">&times;</button>
                    </span>`
    ).join('')}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-4 pt-3 border-t-1 border-dark-400/50 text-xs font-secondary opacity-60 text-center">
            <div class="flex gap-1 font-bold justify-center flex-wrap">
                <span>Like this extension?</span>
                <span class="cursor-pointer text-primary font-heavy hover:underline" id="ftl-tip-link">TIP</span>
                <span class="opacity-40 mx-1">·</span>
                <span>Want to contribute?</span>
                <a class="cursor-pointer text-primary font-heavy hover:underline" href="https://github.com/BarryThePirate/FishtankLiveExtended" target="_blank">GITHUB</a>
            </div>
        </div>
    `;
    card.appendChild(contentArea);

    wireUpTabs(contentArea);
    wireUpToggles(contentArea);
    wireUpCraftingSearch(contentArea);
    wireUpLogging(contentArea);
    wireUpWordFilters(contentArea);
    wireUpTipLink(contentArea);
}

// ── Tab switching ───────────────────────────────────────────────────

function wireUpTabs(contentArea) {
    const tabs = contentArea.querySelectorAll('[data-ftl-tab]');
    const panels = contentArea.querySelectorAll('[data-ftl-panel]');

    function activateTab(tabName) {
        tabs.forEach(tab => {
            const isActive = tab.getAttribute('data-ftl-tab') === tabName;
            tab.classList.toggle('brightness-110', isActive);
            tab.classList.toggle('outline-1', isActive);
            tab.classList.toggle('outline-tertiary', isActive);
            tab.classList.toggle('brightness-75', !isActive);
        });
        panels.forEach(panel => {
            const isPanelActive = panel.getAttribute('data-ftl-panel') === tabName;
            panel.classList.toggle('hidden', !isPanelActive);
        });

        // Hide admin filter when not on logging/admin
        const filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
        if (filterPanel && tabName !== 'logging') filterPanel.classList.add('hidden');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.getAttribute('data-ftl-tab')));
    });

    activateTab(pendingTab || 'general');
}

// ── Toggles ─────────────────────────────────────────────────────────

function wireUpToggles(contentArea) {
    const chatFilterKeys = ['smartAntiSpam', 'hideTTSMessages', 'hideSFXMessages', 'hideStoxMessages'];

    contentArea.querySelectorAll('[data-ftl-toggle]').forEach(toggle => {
        const key = toggle.getAttribute('data-ftl-toggle');
        const knob = toggle.querySelector('div');
        toggle.addEventListener('click', () => {
            const newVal = !getSetting(key);
            updateSetting(key, newVal);
            knob.classList.toggle('left-[0px]', newVal);
            knob.classList.toggle('left-[calc(100%-16px)]', !newVal);

            // Immediately notify page-level chat filter when any chat setting changes
            if (chatFilterKeys.includes(key)) {
                window.postMessage({
                    type: 'ftl-chat-filter-settings',
                    settings: Object.fromEntries(chatFilterKeys.map(k => [k, getSetting(k)])),
                }, '*');
            }
        });
    });
}

// ── Crafting search ─────────────────────────────────────────────────

function wireUpCraftingSearch(contentArea) {
    const searchInput = contentArea.querySelector('[data-ftl-craft-search]');
    const resultsContainer = contentArea.querySelector('[data-ftl-craft-results]');
    if (searchInput && resultsContainer) {
        searchInput.addEventListener('input', () => {
            renderRecipeResults(searchInput.value.trim(), resultsContainer);
        });
    }
}

// ── Logging panel ───────────────────────────────────────────────────

function wireUpLogging(contentArea) {
    const logBtns    = contentArea.querySelectorAll('[data-ftl-log]');
    const logContent = contentArea.querySelector('[data-ftl-log-content]');
    const sizeRow    = contentArea.querySelector('[data-ftl-log-size-row]');
    const sizeInput  = contentArea.querySelector('[data-ftl-log-size]');
    const clearBtn   = contentArea.querySelector('[data-ftl-log-clear]');
    const clearConfirm = contentArea.querySelector('[data-ftl-log-clear-confirm]');
    const clearYes   = contentArea.querySelector('[data-ftl-log-clear-yes]');
    const clearNo    = contentArea.querySelector('[data-ftl-log-clear-no]');

    let activeLogType = 'admin';

    function activateLog(logType) {
        activeLogType = logType;

        logBtns.forEach(btn => {
            const isActive = btn.getAttribute('data-ftl-log') === logType;
            btn.classList.toggle('brightness-125', isActive);
            btn.classList.toggle('brightness-50', !isActive);
        });

        sizeRow.classList.remove('hidden');
        const sizeKey = {
            tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
            staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
            admin: 'adminLogSize',
        }[logType] || 'adminLogSize';
        sizeInput.value = getSetting(sizeKey) || 200;

        // Hide admin filter for non-admin logs
        const filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
        if (filterPanel) filterPanel.classList.toggle('hidden', logType !== 'admin');

        renderLog(logType, logContent, currentUsername);

        // Show admin filter UI for admin log
        if (logType === 'admin') {
            showAdminFilter(contentArea, logContent);
        }
    }

    logBtns.forEach(btn => {
        btn.addEventListener('click', () => activateLog(btn.getAttribute('data-ftl-log')));
    });

    // Log size change
    sizeInput.addEventListener('change', () => {
        const val = Math.max(1, Math.min(1000, parseInt(sizeInput.value) || 200));
        sizeInput.value = val;
        const sizeKey = {
            tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
            staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
            admin: 'adminLogSize',
        }[activeLogType];
        if (sizeKey) {
            updateSetting(sizeKey, val);
            resizeLog(activeLogType, val);
        }
    });

    // Clear log
    clearBtn.addEventListener('click', () => {
        clearBtn.classList.add('hidden');
        clearConfirm.classList.remove('hidden');
    });
    clearNo.addEventListener('click', () => {
        clearConfirm.classList.add('hidden');
        clearBtn.classList.remove('hidden');
    });
    clearYes.addEventListener('click', () => {
        clearConfirm.classList.add('hidden');
        clearBtn.classList.remove('hidden');
        clearLog(activeLogType);
        renderLog(activeLogType, logContent, currentUsername);
    });

    // Default to admin, or use pending log type if navigating from ping button etc.
    activateLog(pendingLog || 'admin');
}

// ── Admin filter UI ─────────────────────────────────────────────────

function showAdminFilter(contentArea, logContent) {
    let filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
    if (!filterPanel) {
        filterPanel = document.createElement('div');
        filterPanel.setAttribute('data-ftl-admin-filter', '');
        filterPanel.className = 'mb-2';
        filterPanel.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="text-xs opacity-60">Filter terms (hide matching toasts)</span>
            </div>
            <div class="flex gap-1 mb-1">
                <input data-ftl-filter-input type="text" placeholder="e.g. You found an item" class="flex-1 font-regular text-xs leading-none h-[24px] px-2 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                <button data-ftl-filter-add class="text-xs px-2 h-[24px] rounded-md bg-dark-400/75 border-1 border-light/25 cursor-pointer hover:brightness-125" type="button">Add</button>
            </div>
            <div data-ftl-filter-list class="flex flex-wrap gap-1 min-h-[20px]"></div>
        `;
        logContent.insertAdjacentElement('beforebegin', filterPanel);

        const filterInput = filterPanel.querySelector('[data-ftl-filter-input]');
        const filterAdd = filterPanel.querySelector('[data-ftl-filter-add]');
        const filterList = filterPanel.querySelector('[data-ftl-filter-list]');

        const addTerm = () => {
            const val = filterInput.value.trim();
            if (addFilterTerm(val)) {
                filterInput.value = '';
                renderFilterList(filterList);
            } else {
                filterInput.value = '';
            }
        };

        filterAdd.addEventListener('click', addTerm);
        filterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addTerm();
        });

        renderFilterList(filterList);
    }
    filterPanel.classList.remove('hidden');
}

function renderFilterList(container) {
    container.innerHTML = '';
    const terms = getAdminFilter();
    if (terms.length === 0) {
        container.innerHTML = '<div class="text-xs opacity-40 italic">No filter terms yet</div>';
        return;
    }
    terms.forEach((term, i) => {
        const pill = document.createElement('div');
        pill.className = 'flex items-center gap-1 bg-dark-400/50 rounded px-2 py-0.5 text-xs';

        const label = document.createElement('span');
        label.className = 'opacity-75';
        label.textContent = term;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'opacity-40 hover:opacity-100 hover:text-red-400 cursor-pointer ml-1';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            removeFilterTerm(i);
            renderFilterList(container);
        });

        pill.appendChild(label);
        pill.appendChild(removeBtn);
        container.appendChild(pill);
    });
}

// ── Tip link ────────────────────────────────────────────────────────

// ── Word filters ────────────────────────────────────────────────────

function sendWordFiltersToPageScript() {
    const filters = getSetting('chatWordFilters') || [];
    window.postMessage({
        type: 'ftl-chat-filter-settings',
        settings: {
            smartAntiSpam: getSetting('smartAntiSpam'),
            hideTTSMessages: getSetting('hideTTSMessages'),
            hideSFXMessages: getSetting('hideSFXMessages'),
            hideStoxMessages: getSetting('hideStoxMessages'),
            wordFilters: filters,
        },
    }, '*');
}

function wireUpWordFilters(contentArea) {
    const input = contentArea.querySelector('[data-ftl-word-filter-input]');
    const addBtn = contentArea.querySelector('[data-ftl-word-filter-add]');
    const tagsContainer = contentArea.querySelector('[data-ftl-word-filter-tags]');
    if (!input || !addBtn || !tagsContainer) return;

    function addFilter(phrase) {
        phrase = phrase.trim();
        if (!phrase) return;
        const filters = getSetting('chatWordFilters') || [];
        if (filters.some(f => f.toLowerCase() === phrase.toLowerCase())) return;
        filters.push(phrase);
        updateSetting('chatWordFilters', filters);
        renderTags();
        sendWordFiltersToPageScript();
    }

    function removeFilter(phrase) {
        const filters = (getSetting('chatWordFilters') || []).filter(f => f !== phrase);
        updateSetting('chatWordFilters', filters);
        renderTags();
        sendWordFiltersToPageScript();
    }

    function renderTags() {
        const filters = getSetting('chatWordFilters') || [];
        tagsContainer.innerHTML = filters.map(f =>
            `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-400/50 text-xs text-light-text border-1 border-dark-300/50">
                <span>${f}</span>
                <button data-ftl-word-filter-remove="${f}" class="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-400" type="button">&times;</button>
            </span>`
        ).join('');

        // Wire up remove buttons
        tagsContainer.querySelectorAll('[data-ftl-word-filter-remove]').forEach(btn => {
            btn.addEventListener('click', () => removeFilter(btn.getAttribute('data-ftl-word-filter-remove')));
        });
    }

    addBtn.addEventListener('click', () => {
        addFilter(input.value);
        input.value = '';
        input.focus();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();
            addFilter(input.value);
            input.value = '';
        }
    });

    // Wire up initial remove buttons
    tagsContainer.querySelectorAll('[data-ftl-word-filter-remove]').forEach(btn => {
        btn.addEventListener('click', () => removeFilter(btn.getAttribute('data-ftl-word-filter-remove')));
    });
}

function wireUpTipLink(contentArea) {
    contentArea.querySelector('#ftl-tip-link')?.addEventListener('click', () => {
        contentArea.remove();
        dispatchPageEvent('modalClose');
        setTimeout(() => {
            dispatchPageEvent('modalOpen', {
                modal: 'tip',
                data: JSON.stringify({
                    userId: '3bd89a72-5aa2-4ad8-b461-71516bd6b4d5',
                    displayName: 'BarryThePirate'
                }),
            });
        }, 50);
    });
}
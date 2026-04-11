/**
 * ui-helpers.js — Reusable UI builder functions
 *
 * Contains all the small DOM-building helpers used by the settings
 * modal and log panels. No state, no side effects — pure functions
 * that return HTML strings or DOM elements.
 *
 * Log row styling matches the site's chat message layout:
 * - Avatar on the left
 * - Username and message inline on the same line
 * - Timestamp on its own line at bottom right
 */

import { player, ui as sdkUi } from '../../ftl-ext-sdk/src/index.js';

// ── Timestamp formatting ────────────────────────────────────────────

export function formatTimestamp(ts) {
    const d = new Date(ts);
    const date = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${date}, ${time}`;
}

// ── HTML string builders (for innerHTML injection) ──────────────────

export function toggleRow(label, key, value, subLabel = null) {
    return `
        <div class="flex items-center justify-between py-2 border-b-1 border-dark-400/50">
            <div>
                <span class="text-sm font-medium">${label}</span>
                ${subLabel ? `<div class="text-xs opacity-50 mt-0.5">${subLabel}</div>` : ''}
            </div>
            <div class="flex gap-2 items-center">
                <div class="text-xs uppercase font-bold text-shadow-panel opacity-60">On</div>
                <button data-ftl-toggle="${key}" class="cursor-pointer box-content relative bg-dark-300 rounded-lg w-[32px] h-[16px] shadow-md inset-shadow-[0px_4px_4px_#00000050] border-1 border-light/50 hover:brightness-110 focus-visible:outline-1 focus-visible:outline-tertiary" type="button">
                    <div class="absolute top-[0px] ${value ? 'left-[0px]' : 'left-[calc(100%-16px)]'} bg-gradient-to-t from-dark-500 to-dark-600 h-[14px] w-[14px] rounded-[100%] border-1 border-dark-400/75 box-content transition-all ease-spring duration-100"></div>
                </button>
                <div class="text-xs uppercase font-bold text-shadow-panel opacity-60">Off</div>
            </div>
        </div>
    `;
}

export function logPill(key, label) {
    return `
        <button data-ftl-log="${key}" class="bg-gradient-to-b from-dark-400/75 to-dark-500/75 h-[28px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary flex-1 brightness-50" type="button">
            <div class="text-light-text bg-gradient-to-t from-dark-300 to-dark-400 text-shadow-md border-light/25 text-xs px-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">${label}</div>
        </button>
    `;
}

// ── DOM element builders (for log rows) ─────────────────────────────

/**
 * Type @username into the Slate chat input, closing any open modal first.
 */
export function mentionUser(username) {
    document.dispatchEvent(new CustomEvent('modalClose'));
    setTimeout(() => {
        const editor = document.querySelector('[data-slate-editor="true"]');
        if (!editor || !username) return;

        editor.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        const text = '@' + username + ' ';
        setTimeout(() => {
            for (const ch of text) {
                const charCode = ch.charCodeAt(0);
                const isLetter = /[a-zA-Z]/.test(ch);
                const code = isLetter ? 'Key' + ch.toUpperCase() : '';
                const init = { key: ch, code, charCode, keyCode: charCode, which: charCode, bubbles: true, cancelable: true };
                editor.dispatchEvent(new KeyboardEvent('keydown', init));
                editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
                editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
                editor.dispatchEvent(new KeyboardEvent('keyup', init));
            }
        }, 0);
    }, 50);
}

// ── URL reconstruction ──────────────────────────────────────────────

const AVATAR_CDN = 'https://cdn.fishtank.live/avatars/';
const PROFILE_CDN = 'https://cdn.fishtank.live/images/';
const TTS_CDN = 'https://cdn.fishtank.live/tts/';
const SFX_CDN = 'https://cdn.fishtank.live/sfx/';

function avatarUrl(filename) {
    if (!filename) return null;
    // Default profile images live under /images/, avatars under /avatars/
    if (filename === 'profile-small.gif') return PROFILE_CDN + filename;
    return AVATAR_CDN + filename;
}

function ttsAudioUrl(audioId) {
    if (!audioId) return null;
    return `${TTS_CDN}${audioId}.mp3`;
}

function sfxAudioUrl(audioFile) {
    if (!audioFile) return null;
    return SFX_CDN + audioFile;
}

// ── Role styling ────────────────────────────────────────────────────
// Matches the site's own chat styling for each role type.

const ROLE_STYLES = {
    staff: {
        bg: 'bg-lime-300/5',
        textClass: 'font-bold text-lime-400',
    },
    mod: {
        bg: 'bg-blue-300/5',
        textClass: 'font-medium text-blue-400',
    },
    fish: {
        bg: 'bg-green-300/5',
        textClass: 'font-regular text-green-500',
    },
    grandMarshal: {
        bg: 'bg-red-300/5',
        textClass: 'font-regular text-red-600',
    },
    epic: {
        bg: 'bg-amber/10',
        textClass: 'font-regular text-amber-300',
    },
};

// ── Shared element builders ─────────────────────────────────────────

/**
 * Build a clickable username span that inserts an @mention on click.
 * Styled to match the site: inline-flex font-bold mr-1 select-none.
 */
function usernameSpan(displayName, colour) {
    const span = document.createElement('div');
    span.className = colour
        ? 'cursor-pointer inline-flex font-bold mr-1 select-none'
        : 'cursor-pointer inline-flex font-bold mr-1 select-none text-orange-400';
    span.textContent = displayName;
    if (colour) span.style.color = colour;
    span.addEventListener('click', () => mentionUser(displayName));
    return span;
}

/**
 * Build a small avatar image wrapped in a button, matching the site's chat style.
 */
function avatarImg(filename) {
    const url = avatarUrl(filename);
    if (!url) return null;
    const wrapper = document.createElement('div');
    wrapper.className = 'relative flex-shrink-0';
    wrapper.style.cssText = 'width: 28px; height: 28px;';

    const img = document.createElement('img');
    img.src = url;
    img.className = 'w-full h-full rounded-md drop-shadow-md object-contain select-none bg-dark/25 border-1 border-light-400/25';
    img.width = 32;
    img.height = 32;
    img.loading = 'lazy';
    img.draggable = false;

    wrapper.appendChild(img);
    return wrapper;
}

/**
 * Build a clan tag badge matching the site's chat style.
 */
function clanBadge(clan) {
    if (!clan) return null;
    const badge = document.createElement('span');
    badge.className = 'font-secondary text-xs mr-1 px-1 rounded select-none inline-flex items-center bg-white/10 text-light-400/75';
    badge.textContent = clan;
    return badge;
}

/**
 * Build an endorsement badge (e.g. "TWIN", "LAND").
 * Styled similarly to the site's endorsement badges.
 */
function endorsementBadge(endorsement) {
    if (!endorsement) return null;
    const badge = document.createElement('span');
    badge.className = 'font-secondary text-xs mr-1 px-1 rounded select-none inline-flex items-center bg-dark-400/75 text-light-text/60';
    badge.textContent = endorsement;
    return badge;
}

/**
 * Build a chat room badge (e.g. "SP", "XL").
 * Only shown for non-Global rooms to indicate where the message came from.
 */
function chatRoomBadge(chatRoom) {
    if (!chatRoom || chatRoom === 'Global') return null;
    const badge = document.createElement('span');
    badge.className = 'font-secondary text-[10px] mr-1 px-1 rounded select-none inline-flex items-center bg-primary-500/20 text-primary-400/90';
    // Short labels to save space
    badge.textContent = chatRoom === 'Season Pass' ? 'SP'
        : chatRoom === 'Season Pass XL' ? 'XL'
            : chatRoom;
    badge.title = chatRoom;
    return badge;
}

/**
 * Build a timestamp div matching the site's chat style.
 * Positioned at bottom right of the row.
 */
function timeDiv(timestamp) {
    const div = document.createElement('div');
    div.className = 'font-secondary text-xs text-light-400/50 leading-none tracking-wide text-right mt-1 text-shadow-[1px_1px_0_#000000]';
    div.textContent = formatTimestamp(timestamp);
    return div;
}

/**
 * Build a standard log row container matching the site's chat message layout.
 * Structure: group > flex-col > [flex row (avatar + content)] + [timestamp]
 */
function logRow(role) {
    const row = document.createElement('div');
    const bg = role && ROLE_STYLES[role] ? ROLE_STYLES[role].bg : '';
    row.className = `group flex flex-col p-1 md:p-2 hover:bg-white/5 ${bg}`;
    return row;
}

/**
 * Build the inline message content (username + message on the same line).
 * Matches the site's chat layout: leading-4, text-sm, text-shadow-chat.
 */
function inlineContent() {
    const div = document.createElement('div');
    div.className = 'leading-4 3xl:leading-5 text-shadow-chat my-auto pb-1 text-sm 3xl:text-base';
    return div;
}

/**
 * Build message text as an inline span, matching the site's font-extralight style.
 * Parses @mentions into clickable links.
 */
function messageSpan(text, role) {
    const span = document.createElement('span');
    const roleText = role && ROLE_STYLES[role] ? ROLE_STYLES[role].textClass : 'font-extralight text-light-text';
    span.className = roleText;
    span.style.wordBreak = 'break-word';
    span.style.lineBreak = 'auto';

    // Parse @mentions into clickable links
    const parts = text.split(/(@\w+)/g);
    for (const part of parts) {
        if (part.startsWith('@')) {
            const username = part.slice(1);
            const link = document.createElement('span');
            link.className = 'text-orange-400 font-medium cursor-pointer';
            link.textContent = part;
            link.addEventListener('click', () => mentionUser(username));
            span.appendChild(link);
        } else {
            span.appendChild(document.createTextNode(part));
        }
    }

    return span;
}

// Currently playing audio (so we can stop it when playing a new one)
let currentAudio = null;

/**
 * Build a play/stop button for audio playback.
 */
function playButton(audioUrl) {
    const btn = document.createElement('button');
    btn.className = 'opacity-40 hover:opacity-100 hover:text-primary-400 cursor-pointer transition-opacity ml-1';
    btn.title = 'Play audio';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Check if THIS button was the one playing before we reset everything
        const wasPlaying = btn.hasAttribute('data-ftl-playing');

        // If already playing something, stop it
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            // Reset all play buttons back to play icon
            document.querySelectorAll('[data-ftl-playing]').forEach(el => {
                el.removeAttribute('data-ftl-playing');
                el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
                el.title = 'Play audio';
            });
        }

        // If this button was already playing, we just stopped it — done
        if (wasPlaying) {
            btn.removeAttribute('data-ftl-playing');
            return;
        }

        // Play the audio
        const audio = new Audio(audioUrl);
        currentAudio = audio;
        btn.setAttribute('data-ftl-playing', '');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        btn.title = 'Stop audio';

        audio.play().catch(() => {
            // Autoplay blocked or file not found
            btn.removeAttribute('data-ftl-playing');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
            btn.title = 'Play audio';
            currentAudio = null;
        });

        audio.addEventListener('ended', () => {
            btn.removeAttribute('data-ftl-playing');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
            btn.title = 'Play audio';
            currentAudio = null;
        });
    });

    return btn;
}

function downloadButton(audioUrl, filename) {
    const btn = document.createElement('button');
    btn.className = 'opacity-40 hover:opacity-100 hover:text-primary-400 cursor-pointer transition-opacity ml-1';
    btn.title = 'Download audio';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await sdkUi.download.fromUrl(audioUrl, filename || 'audio.mp3', 'audio/mpeg');
        } catch (err) {
            console.warn('[FTL-Ext] Download failed:', err.message);
        }
    });

    return btn;
}

// ── Log row builders ────────────────────────────────────────────────

// -- TTS/SFX use their own compact layout (not chat-style) -----------

/**
 * Build a compact log row for TTS/SFX entries.
 */
function compactRow() {
    const row = document.createElement('div');
    row.className = 'flex gap-2 px-2 py-1.5 hover:bg-white/5';
    return row;
}

/**
 * Build a message body div for TTS/SFX (stacked below header).
 */
function compactMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'text-sm mt-0.5 opacity-75';
    msg.style.wordBreak = 'break-word';

    const parts = text.split(/(@\w+)/g);
    for (const part of parts) {
        if (part.startsWith('@')) {
            const username = part.slice(1);
            const link = document.createElement('span');
            link.className = 'text-orange-400 font-medium cursor-pointer hover:opacity-75';
            link.textContent = part;
            link.addEventListener('click', () => mentionUser(username));
            msg.appendChild(link);
        } else {
            msg.appendChild(document.createTextNode(part));
        }
    }

    return msg;
}

/**
 * Build a compact timestamp span (inline with header).
 */
function compactTimeSpan(timestamp) {
    const span = document.createElement('span');
    span.className = 'text-[11px] opacity-30 ml-auto flex-shrink-0';
    span.textContent = formatTimestamp(timestamp);
    return span;
}

/**
 * Build a compact username span for TTS/SFX.
 */
function compactUsernameSpan(displayName, colour) {
    const span = document.createElement('span');
    span.className = colour
        ? 'font-bold cursor-pointer hover:opacity-75'
        : 'font-bold cursor-pointer hover:opacity-75 text-orange-400';
    span.textContent = displayName;
    if (colour) span.style.color = colour;
    span.addEventListener('click', () => mentionUser(displayName));
    return span;
}

export function buildTtsRow(entry) {
    const row = compactRow();

    // Content column
    const content = document.createElement('div');
    content.className = 'flex flex-col flex-1 min-w-0';

    // Header: username · voice · room [play] timestamp
    const header = document.createElement('div');
    header.className = 'flex items-center gap-1 flex-wrap';

    header.appendChild(compactUsernameSpan(entry.displayName));

    const meta = document.createElement('span');
    meta.className = 'text-[11px] opacity-40';
    meta.textContent = `· ${entry.voice} · ${player.streams.roomName(entry.room)}`;
    header.appendChild(meta);

    if (entry.clan) {
        const badge = clanBadge(entry.clan);
        if (badge) header.appendChild(badge);
    }

    const audioUrl = ttsAudioUrl(entry.audioId);
    if (audioUrl) {
        header.appendChild(playButton(audioUrl));
        const safeName = (entry.displayName || 'tts').replace(/[^a-z0-9]/gi, '_');
        const safeVoice = (entry.voice || 'voice').replace(/[^a-z0-9]/gi, '_');
        header.appendChild(downloadButton(audioUrl, `tts-${safeVoice}-${safeName}.mp3`));
    }

    header.appendChild(compactTimeSpan(entry.timestamp));

    content.appendChild(header);
    content.appendChild(compactMessage(entry.message));

    row.appendChild(content);
    return row;
}

export function buildSfxRow(entry) {
    const row = compactRow();

    const content = document.createElement('div');
    content.className = 'flex flex-col flex-1 min-w-0';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-1 flex-wrap';

    header.appendChild(compactUsernameSpan(entry.displayName));

    const meta = document.createElement('span');
    meta.className = 'text-[11px] opacity-40';
    meta.textContent = `· ${player.streams.roomName(entry.room)}`;
    header.appendChild(meta);

    if (entry.clan) {
        const badge = clanBadge(entry.clan);
        if (badge) header.appendChild(badge);
    }

    const audioUrl = sfxAudioUrl(entry.audioFile);
    if (audioUrl) {
        header.appendChild(playButton(audioUrl));
        const safeSound = (entry.message || 'sfx').replace(/[^a-z0-9]/gi, '_');
        header.appendChild(downloadButton(audioUrl, `sfx-${safeSound}.mp3`));
    }

    header.appendChild(compactTimeSpan(entry.timestamp));

    content.appendChild(header);
    content.appendChild(compactMessage(entry.message));

    row.appendChild(content);
    return row;
}

// -- Pings/Role/Admin use chat-style layout --------------------------

export function buildPingsRow(entry) {
    const role = entry.role || null;
    const row = logRow(role);

    // Top line: avatar + inline content
    const topLine = document.createElement('div');
    topLine.className = 'flex gap-1';

    const img = avatarImg(entry.avatar);
    if (img) topLine.appendChild(img);

    const content = inlineContent();

    const roomBadge = chatRoomBadge(entry.chatRoom);
    if (roomBadge) content.appendChild(roomBadge);

    if (entry.endorsement) {
        const ebadge = endorsementBadge(entry.endorsement);
        if (ebadge) content.appendChild(ebadge);
    }

    if (entry.clan) {
        const badge = clanBadge(entry.clan);
        if (badge) content.appendChild(badge);
    }

    content.appendChild(usernameSpan(entry.displayName, entry.colour));
    content.appendChild(messageSpan(entry.message, role));
    topLine.appendChild(content);
    row.appendChild(topLine);

    // Timestamp bottom right
    row.appendChild(timeDiv(entry.timestamp));

    return row;
}

export function buildRoleRow(entry) {
    const role = entry.role || null;
    const row = logRow(role);

    // Top line: avatar + inline content
    const topLine = document.createElement('div');
    topLine.className = 'flex gap-1';

    const img = avatarImg(entry.avatar);
    if (img) topLine.appendChild(img);

    const content = inlineContent();

    const roomBadge = chatRoomBadge(entry.chatRoom);
    if (roomBadge) content.appendChild(roomBadge);

    if (entry.endorsement) {
        const ebadge = endorsementBadge(entry.endorsement);
        if (ebadge) content.appendChild(ebadge);
    }

    if (entry.clan) {
        const badge = clanBadge(entry.clan);
        if (badge) content.appendChild(badge);
    }

    content.appendChild(usernameSpan(entry.displayName, entry.colour));
    content.appendChild(messageSpan(entry.message, role));
    topLine.appendChild(content);
    row.appendChild(topLine);

    // Timestamp bottom right
    row.appendChild(timeDiv(entry.timestamp));

    return row;
}

export function buildAdminRow(entry) {
    const row = document.createElement('div');
    row.className = 'group flex flex-col p-1 md:p-2 hover:bg-white/5';

    const topLine = document.createElement('div');
    topLine.className = 'flex gap-1';

    if (entry.imageUrl) {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative flex-shrink-0';
        wrapper.style.cssText = 'width: 40px; height: 40px;';
        const img = document.createElement('img');
        img.src = entry.imageUrl;
        img.alt = entry.imageAlt || '';
        img.className = 'w-full h-full rounded-md object-contain';
        wrapper.appendChild(img);
        topLine.appendChild(wrapper);
    }

    const content = inlineContent();

    const titleSpan = document.createElement('span');
    titleSpan.className = 'font-bold text-primary-400 mr-1';
    titleSpan.textContent = entry.title || '(no title)';
    content.appendChild(titleSpan);

    if (entry.description) {
        const desc = document.createElement('div');
        desc.className = 'font-extralight text-light-text text-sm';
        desc.style.wordBreak = 'break-word';
        desc.textContent = entry.description;
        content.appendChild(desc);
    }

    topLine.appendChild(content);
    row.appendChild(topLine);

    // Timestamp bottom right
    row.appendChild(timeDiv(entry.timestamp));

    return row;
}

// ── Render functions (fill a container with log entries) ────────────

function emptyMessage(text) {
    return `<div class="text-sm text-center font-light italic p-5 m-auto opacity-75">${text}</div>`;
}

export function renderTtsLog(container, entries) {
    container.innerHTML = '';
    if (entries.length === 0) { container.innerHTML = emptyMessage('No TTS messages logged yet'); return; }
    [...entries].reverse().forEach(e => container.appendChild(buildTtsRow(e)));
}

export function renderSfxLog(container, entries) {
    container.innerHTML = '';
    if (entries.length === 0) { container.innerHTML = emptyMessage('No SFX messages logged yet'); return; }
    [...entries].reverse().forEach(e => container.appendChild(buildSfxRow(e)));
}

export function renderPingsLog(container, entries, currentUsername) {
    container.innerHTML = '';
    if (!currentUsername) { container.innerHTML = emptyMessage('Not logged in — pings cannot be detected'); return; }
    if (entries.length === 0) { container.innerHTML = emptyMessage('No pings logged yet'); return; }
    [...entries].reverse().forEach(e => container.appendChild(buildPingsRow(e)));
}

export function renderRoleLog(container, entries, emptyMsg) {
    container.innerHTML = '';
    if (entries.length === 0) { container.innerHTML = emptyMessage(emptyMsg); return; }
    [...entries].reverse().forEach(e => container.appendChild(buildRoleRow(e)));
}

export function renderAdminLog(container, entries) {
    container.innerHTML = '';
    if (entries.length === 0) { container.innerHTML = emptyMessage('No admin messages logged yet'); return; }
    [...entries].reverse().forEach(e => container.appendChild(buildAdminRow(e)));
}
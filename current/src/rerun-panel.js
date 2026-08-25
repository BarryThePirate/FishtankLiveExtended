/**
 * rerun-panel.js — Re-run status panel in the site's left sidebar
 *
 * A compact panel styled exactly like the site's own sidebar panels
 * (Events / Missions / Inventory), inserted between Missions and
 * Inventory. Shows the season and the live re-run clock, with
 * pause/resume, Open Player, and Clear controls, and collapses like
 * its neighbours (collapse state persists).
 *
 * Injection is fail-silent: no sidebar (mobile) or changed markup
 * simply means no panel. Gated by the rerunSidebarPanel setting.
 */

import { getSetting, updateSetting } from './settings.js';
import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import {
    virtualNow, virtualMsToDayNumber, isPaused, pause, resume,
    clearAnchor, formatClock, loadSeasonData,
} from './rerun.js';
import { openRerunOverlay, closeRerunOverlay, updatePauseUi } from './rerun-ui.js';

const PANEL_ID = 'ftl-rerun-sidebar-panel';
const COLLAPSED_KEY = 'rerun-panel-collapsed';

// Icons: site react-icons paths (IoPause / IoPlay / IoRemove / IoAdd)
const PAUSE_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16zm144 0h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"></path></svg>';
const PLAY_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"></path></svg>';
const MINUS_SVG = '<svg viewBox="0 0 512 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M400 256H112"></path></svg>';
const PLUS_SVG = '<svg viewBox="0 0 512 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M256 112v288m144-144H112"></path></svg>';

let panel = null;
let interval = null;
let els = null; // { activeBox, emptyBox, seasonEl, clockEl, pauseBtn, pauseFace }
let seasonLoadRequested = false;

// Compact icon button matching the site's small sidebar header buttons
function headerButton(title, svg, variant, onClick) {
    const shells = {
        dark: ['from-dark-400/75 to-dark-500/75', 'from-dark-300 to-dark-400 active:from-dark-400 active:to-dark-300'],
        primary: ['from-primary-400 to-primary-500/90 active:to-primary-600/75', 'from-primary-400 to-primary-500 active:from-primary-500 active:to-primary-300'],
    }[variant];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = `bg-gradient-to-r ${shells[0]} p-0.5 inline-flex items-center justify-center`
        + ' cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary';
    const face = document.createElement('div');
    face.className = `text-light-text bg-gradient-to-t ${shells[1]} active:bg-gradient-to-b`
        + ' border-light/25 active:border-light/15 p-0.5 rounded-sm';
    face.innerHTML = svg;
    btn.appendChild(face);
    btn.addEventListener('click', onClick);
    return { btn, face };
}

// Compact text button matching the site's small full-width buttons
// (e.g. the Stox button under the portfolio)
function smallTextButton(text, variant, onClick) {
    const shells = {
        secondary: ['from-secondary-500 to-secondary-600/75 active:to-secondary-700/90', 'from-secondary-400 to-secondary-500 active:from-secondary-500 active:to-secondary-300'],
        primary: ['from-primary-400 to-primary-500/90 active:to-primary-700/90', 'from-primary-400 to-primary-500 active:from-primary-500 active:to-primary-300'],
    }[variant];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bg-gradient-to-r ${shells[0]} h-[24px] px-0.5 inline-flex items-center justify-center`
        + ' text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1'
        + ' focus-visible:outline-tertiary flex-1';
    const face = document.createElement('div');
    face.className = `text-light-text bg-gradient-to-t ${shells[1]} active:bg-gradient-to-b text-shadow-md`
        + ' border-light/25 active:border-light/15 text-sm px-1 flex justify-center items-center'
        + ' h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none';
    face.textContent = text;
    btn.appendChild(face);
    btn.addEventListener('click', onClick);
    return btn;
}

function buildPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('data-ftl-sdk', 'rerun-panel');
    panel.className = 'relative rounded-lg shadow-panel border-t-2 border-b-3 border-l-2 border-r-2'
        + ' text-dark-text bg-light border-t-light-300/75 border-b-light-700/50 border-l-light-300/75'
        + ' border-r-light-700/75 [background-image:var(--texture-panel)] w-full shrink-0 p-1';

    const texture = document.createElement('div');
    texture.className = 'absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg'
        + ' [background-image:var(--texture-panel)] opacity-50 z-[-1]';

    // Header row: title + button cluster (pause/resume, collapse)
    const header = document.createElement('div');
    header.className = 'flex items-center px-1 gap-1.5';
    const title = document.createElement('span');
    title.className = 'font-bold text-sm leading-6 text-dark-text select-none';
    title.textContent = 'Re-run';
    const cluster = document.createElement('div');
    cluster.className = 'ml-auto flex items-center gap-0.5';

    const { btn: pauseBtn, face: pauseFace } = headerButton('Pause re-run clock', PAUSE_SVG, 'dark', () => {
        if (isPaused()) resume(); else pause();
        updatePauseUi(); // keep the overlay's pause buttons in sync
        renderPanel();
    });

    // Collapsible content — same wrapper the site's panels use
    const content = document.createElement('div');
    content.className = 'origin-top overflow-hidden will-change-transform';

    let collapsed = !!storage.get(COLLAPSED_KEY, false);
    const applyCollapse = () => {
        content.style.display = collapsed ? 'none' : '';
        collapseFace.innerHTML = collapsed ? PLUS_SVG : MINUS_SVG;
        collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
    };
    const { btn: collapseBtn, face: collapseFace } = headerButton('Collapse', MINUS_SVG, 'primary', () => {
        collapsed = !collapsed;
        storage.set(COLLAPSED_KEY, collapsed);
        applyCollapse();
    });

    cluster.append(pauseBtn, collapseBtn);
    header.append(title, cluster);

    // Inner dark box, like Events/Missions content
    const inner = document.createElement('div');
    inner.className = 'm-1 bg-dark-700/30 border-2 border-dark-300/50 rounded-lg p-1'
        + ' text-light-text text-shadow-lg shadow-panel-soft';

    // Active state: season + live clock + action buttons
    const activeBox = document.createElement('div');
    const info = document.createElement('div');
    info.className = 'px-1 pt-1 pb-1.5 text-center';
    const seasonEl = document.createElement('div');
    seasonEl.className = 'font-bold text-sm leading-tight';
    const clockEl = document.createElement('div');
    clockEl.className = 'font-secondary tabular-nums text-xs leading-tight mt-0.5 text-green-400';
    info.append(seasonEl, clockEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-1 p-0.5';
    btnRow.append(
        smallTextButton('Open Player', 'secondary', () => {
            updateSetting('rerunEnabled', true);
            closeRerunOverlay();
            openRerunOverlay();
        }),
        smallTextButton('Clear', 'primary', () => {
            if (!confirm('Clear your re-run start point?')) return;
            clearAnchor();
            closeRerunOverlay();
            renderPanel();
        }),
    );
    activeBox.append(info, btnRow);

    // Empty state, phrased like the site's "Nothing on the schedule yet."
    const emptyBox = document.createElement('div');
    emptyBox.className = 'px-1 py-3 text-center text-light-text/90 text-xs select-none';
    emptyBox.textContent = 'No re-run set. Press E and open the Re-run tab to start one.';

    inner.append(activeBox, emptyBox);
    content.appendChild(inner);
    panel.append(texture, header, content);
    applyCollapse();

    els = { activeBox, emptyBox, seasonEl, clockEl, pauseBtn, pauseFace };
}

function renderPanel() {
    if (!panel) return;
    if (!panel.isConnected) {
        // Site re-render dropped us — reset so the injection pass re-adds
        clearInterval(interval);
        interval = null;
        panel = null;
        els = null;
        return;
    }
    const now = virtualNow();
    const active = now != null;
    els.activeBox.style.display = active ? '' : 'none';
    els.emptyBox.style.display = active ? 'none' : '';
    els.pauseBtn.style.display = active ? '' : 'none';
    if (!active) return;

    const season = getSetting('rerunSeason');
    els.seasonEl.textContent = `Season ${parseInt(String(season).replace(/^s0?/, ''), 10) || season}`;

    const day = virtualMsToDayNumber(now);
    if (day == null && !seasonLoadRequested) {
        // Day numbers need the season's day listing — fetch lazily
        seasonLoadRequested = true;
        loadSeasonData().then(() => renderPanel()).catch(() => {});
    }
    const paused = isPaused();
    els.clockEl.textContent = `${day != null ? `Day ${day} · ` : ''}${formatClock(now)}${paused ? ' · Paused' : ''}`;
    els.clockEl.classList.toggle('text-green-400', !paused);
    els.clockEl.classList.toggle('text-primary-400', paused);
    els.pauseFace.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
    els.pauseBtn.title = paused ? 'Resume re-run clock' : 'Pause re-run clock';
}

export function tryInjectRerunPanel() {
    if (!getSetting('rerunSidebarPanel')) return;
    if (document.getElementById(PANEL_ID)) return;

    // Anchor on the sidebar's Inventory panel; our panel sits above it
    // (between Missions and Inventory)
    const invTitle = [...document.querySelectorAll('span.font-bold')].find(
        t => t.textContent.trim() === 'Inventory' && t.closest('.shadow-panel'));
    const invPanel = invTitle?.closest('.shadow-panel');
    if (!invPanel) return;

    buildPanel();
    invPanel.insertAdjacentElement('beforebegin', panel);
    renderPanel();
    interval = setInterval(renderPanel, 1000);
}

export function removeRerunPanel() {
    document.getElementById(PANEL_ID)?.remove();
    if (interval) clearInterval(interval);
    interval = null;
    panel = null;
    els = null;
}

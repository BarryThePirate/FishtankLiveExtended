/**
 * inventory.js — Inventory and item grid search
 *
 * Injects search inputs into:
 * 1. The inventory popup (floating-ui-portal, NOT a modal)
 * 2. The crafting modal's "Select Item" overlay (inside #modal)
 *
 * Both grids use img[alt] for item names — the same filtering logic
 * works for both. Empty slots are hidden while searching.
 *
 * Detection: uses a click listener + short poll. NO persistent body observers.
 */

import { getSetting } from './settings.js';

let inventoryInjected = false;

// ── Shared: create a search input and wire up filtering ─────────────

function createSearchInput(placeholder, items, container, insertAfter, trailing, autoFocus = true) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-ftl-sdk', 'item-search');
    wrapper.className = 'px-1 pb-1';

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 mt-2 mb-1';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.className = 'font-regular text-md leading-none flex-1 min-w-0 h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25';

    // Prevent keyboard shortcuts from firing while typing
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
    });

    row.appendChild(input);
    if (trailing) row.appendChild(trailing);
    wrapper.appendChild(row);
    insertAfter.insertAdjacentElement('afterend', wrapper);

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();

        for (const item of items) {
            const img = item.querySelector('img');
            if (!img) {
                // Empty slot — hide when searching, show when cleared
                item.style.display = query ? 'none' : '';
                continue;
            }

            const name = (img.alt || '').toLowerCase();
            const match = !query || name.includes(query);
            item.style.display = match ? '' : 'none';
        }

        // Pack visible items to the top of the grid
        container.style.alignContent = query ? 'start' : '';
    });

    // Auto-focus (skipped for persistent hosts like the sidebar panel,
    // where stealing focus on page load would be hostile)
    if (autoFocus) setTimeout(() => input.focus(), 50);

    return wrapper;
}

// ── Inventory popup (floating-ui-portal) ────────────────────────────

function buildSlotCounter(grid) {
    const counter = document.createElement('span');
    counter.setAttribute('data-ftl-sdk', 'slot-counter');
    counter.className = 'font-regular text-md leading-none opacity-60 tabular-nums text-right min-w-[3.5rem] shrink-0';

    const update = () => {
        const options = grid.querySelectorAll('[role="option"]');
        const used = Array.from(options).filter(o => o.querySelector('img')).length;
        counter.textContent = `${used}/${options.length}`;
    };
    // Initial fill runs before the counter is inserted into the DOM, so
    // only the observer-driven updates check for removal: if a site
    // re-render dropped us, self-clean (the injection pass re-adds).
    update();
    const observer = new MutationObserver(() => {
        if (!counter.isConnected) { observer.disconnect(); return; }
        update();
    });
    observer.observe(grid, { childList: true, subtree: true });
    return { counter, observer };
}

export function tryInjectInventorySearch() {
    if (inventoryInjected) return;
    if (!getSetting('enableInventorySearch')) return;

    const portals = document.querySelectorAll('[data-floating-ui-portal]');
    for (const portal of portals) {
        const dialog = portal.querySelector('[role="dialog"]');
        if (!dialog) continue;

        const header = dialog.querySelector('.flex.h-\\[32px\\].items-center');
        if (!header) continue;
        const title = header.querySelector('.font-bold');
        if (!title || title.textContent.trim() !== 'Inventory') continue;

        const grid = dialog.querySelector('[role="listbox"]');
        if (!grid) continue;

        if (dialog.querySelector('[data-ftl-sdk="item-search"]')) {
            inventoryInjected = true;
            return;
        }

        const items = grid.querySelectorAll('[role="option"]');
        const { counter, observer: slotCounterObserver } = buildSlotCounter(grid);
        createSearchInput('Search inventory...', items, grid, header, counter);
        inventoryInjected = true;

        // Clean up when inventory closes
        const closeObserver = new MutationObserver(() => {
            if (!portal.contains(dialog)) {
                closeObserver.disconnect();
                if (slotCounterObserver) slotCounterObserver.disconnect();
                inventoryInjected = false;
            }
        });
        closeObserver.observe(portal, { childList: true });
        return;
    }
}

// ── Sidebar inventory panel (Aug 2026 site layout) ──────────────────
// The site moved the inventory from a floating popup into a persistent
// left sidebar panel. Same img[alt] filtering; the grid's children are
// a live collection, so filtering tracks items as they change.

const CHEVRON_DOWN_SVG = '<svg stroke="currentColor" fill="none" stroke-width="48" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="square" d="M112 184l144 144 144-144"></path></svg>';
const CHEVRON_UP_SVG = '<svg stroke="currentColor" fill="none" stroke-width="48" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="square" d="M112 328l144-144 144 144"></path></svg>';

/**
 * Compact header button (matches the site's small sidebar buttons)
 * that toggles the inventory grid between its capped height and
 * showing every slot at once.
 */
function buildExpandButton(grid) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-ftl-sdk', 'inv-expand');
    btn.title = 'Expand inventory';
    btn.className = 'bg-gradient-to-r from-dark-400/75 to-dark-500/75 p-0.5 inline-flex items-center'
        + ' justify-center cursor-pointer rounded-md hover:brightness-105'
        + ' focus-visible:outline-1 focus-visible:outline-tertiary';
    const face = document.createElement('div');
    face.className = 'text-light-text bg-gradient-to-t from-dark-300 to-dark-400'
        + ' active:bg-gradient-to-b active:from-dark-400 active:to-dark-300'
        + ' border-light/25 active:border-light/15 p-0.5 rounded-sm';
    face.innerHTML = CHEVRON_DOWN_SVG;
    btn.appendChild(face);
    btn.addEventListener('click', () => {
        const expanded = grid.style.maxHeight === 'none';
        // Inline style overrides the site's max-h-48 class; clearing it
        // hands control back untouched.
        grid.style.maxHeight = expanded ? '' : 'none';
        face.innerHTML = expanded ? CHEVRON_DOWN_SVG : CHEVRON_UP_SVG;
        btn.title = expanded ? 'Expand inventory' : 'Collapse inventory';
    });
    return btn;
}

export function tryInjectSidebarInventorySearch() {
    if (!getSetting('enableInventorySearch')) return;

    const title = [...document.querySelectorAll('span.font-bold')].find(
        t => t.textContent.trim() === 'Inventory' && t.closest('.shadow-panel'));
    if (!title) return;
    const panel = title.closest('.shadow-panel');
    if (panel.querySelector('[data-ftl-sdk="item-search"]')) return;
    const grid = panel.querySelector('[role="option"]')?.closest('.grid');
    if (!grid) return;

    const header = title.parentElement;
    const { counter } = buildSlotCounter(grid);
    createSearchInput('Search inventory...', grid.children, grid, header, counter, false);

    // Expand/collapse toggle alongside the panel's own header buttons
    const cluster = header.querySelector('.ml-auto');
    if (cluster && !cluster.querySelector('[data-ftl-sdk="inv-expand"]')) {
        cluster.prepend(buildExpandButton(grid));
    }
}

// ── Crafting item select (inside #modal) ────────────────────────────

export function tryInjectCraftingItemSearch() {
    if (!getSetting('enableInventorySearch')) return;

    const modal = document.getElementById('modal');
    if (!modal) return;

    // Find "Select Item" title — it's a .font-bold inside the item select overlay
    const titles = modal.querySelectorAll('.font-bold');
    let title = null;
    for (const t of titles) {
        if (t.textContent.trim() === 'Select Item') {
            title = t;
            break;
        }
    }
    if (!title) return;

    // The overlay is the parent container with the grid
    const overlay = title.closest('.absolute');
    if (!overlay) return;

    // Already injected
    if (overlay.querySelector('[data-ftl-sdk="item-search"]')) return;

    const grid = overlay.querySelector('.grid.grid-cols-5');
    if (!grid) return;

    // Get ALL direct children of the grid — both item buttons and empty placeholder divs
    const items = grid.children;
    createSearchInput('Search items...', items, grid, title);
}

// ── Trade modal item search (inside #modal) ─────────────────────────

export function initTradeSearch() {
    if (!getSetting('enableInventorySearch')) return;

    // Poll for #modal to exist (React renders it after the modalOpen event)
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        const modal = document.getElementById('modal');
        if (modal) {
            clearInterval(poll);
            injectTradeSearch(modal);
        } else if (attempts > 20) {
            clearInterval(poll);
        }
    }, 50);

    document.addEventListener('modalClose', () => clearInterval(poll), { once: true });
}

function injectTradeSearch(modal) {
    // Watch for the item grid to appear inside the trade modal
    const observer = new MutationObserver(() => {
        const grid = modal.querySelector('.grid.grid-cols-5');
        if (!grid) return;
        if (modal.querySelector('[data-ftl-sdk="item-search"]')) {
            observer.disconnect();
            return;
        }

        const gridParent = grid.parentElement;
        if (!gridParent) return;

        createSearchInput('Search items...', grid.children, grid, gridParent.previousElementSibling || gridParent);
        observer.disconnect();
    });

    observer.observe(modal, { childList: true, subtree: true });

    // Check immediately in case grid already exists
    const grid = modal.querySelector('.grid.grid-cols-5');
    if (grid && !modal.querySelector('[data-ftl-sdk="item-search"]')) {
        const gridParent = grid.parentElement;
        if (gridParent) {
            createSearchInput('Search items...', grid.children, grid, gridParent.previousElementSibling || gridParent);
            observer.disconnect();
        }
    }

    document.addEventListener('modalClose', () => observer.disconnect(), { once: true });
}
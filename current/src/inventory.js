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

function createSearchInput(placeholder, items, container, insertAfter) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-ftl-sdk', 'item-search');
    wrapper.className = 'px-1 pb-1';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.className = 'font-regular text-md leading-none w-full h-[32px] p-1 mt-2 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25 mb-1';

    // Prevent keyboard shortcuts from firing while typing
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
    });

    wrapper.appendChild(input);
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

    // Auto-focus
    setTimeout(() => input.focus(), 50);

    return wrapper;
}

// ── Inventory popup (floating-ui-portal) ────────────────────────────

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
        createSearchInput('Search inventory...', items, grid, header);
        inventoryInjected = true;

        // Clean up when inventory closes
        const closeObserver = new MutationObserver(() => {
            if (!portal.contains(dialog)) {
                closeObserver.disconnect();
                inventoryInjected = false;
            }
        });
        closeObserver.observe(portal, { childList: true });
        return;
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
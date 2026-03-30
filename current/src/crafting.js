/**
 * crafting.js — Crafting recipe management and modal hints
 *
 * Handles fetching recipes from fishtank.guru, caching them,
 * injecting hints into the crafting bench modal, showing recipe
 * info in the use-item modal, and powering the recipe search
 * in the settings panel.
 *
 * Both hint functions use a poll-for-modal pattern because the
 * modalOpen CustomEvent fires BEFORE React renders the #modal
 * element into the DOM. We poll briefly (every 100ms, max 2s)
 * for #modal to appear, then attach a targeted MutationObserver
 * on the modal element (NOT body) to wait for the specific
 * content we need.
 */

import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import { getSetting } from './settings.js';

const RECIPE_URL = 'https://fishtank.guru/resources/recipes.json';
const RECIPE_CACHE_KEY = 'crafting-recipes';

let craftingRecipes = null;

// ── Init ────────────────────────────────────────────────────────────

export function loadRecipesFromCache() {
    const cached = storage.get(RECIPE_CACHE_KEY);
    if (cached) {
        craftingRecipes = cached;
    }
}

export function fetchRecipes() {
    return fetch(RECIPE_URL)
        .then(r => r.json())
        .then(data => {
            craftingRecipes = data;
            storage.set(RECIPE_CACHE_KEY, data);
        })
        .catch(() => {
            if (craftingRecipes) {
                console.warn('[FTL Extended] Could not fetch recipes, using cached version');
            } else {
                console.warn('[FTL Extended] Could not fetch recipes and no cache available');
            }
        });
}

export function getRecipes() {
    return craftingRecipes;
}

// ── Helper: wait for #modal to exist ────────────────────────────────
// Polls every 100ms for up to 2 seconds. Calls callback with the
// modal element when found. Cleans up on modalClose.

function waitForModal(callback) {
    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        const modal = document.getElementById('modal');
        if (modal) {
            clearInterval(poll);
            callback(modal);
        } else if (attempts > 20) {
            clearInterval(poll);
        }
    }, 100);

    // Clean up if modal closes before we find it
    document.addEventListener('modalClose', () => clearInterval(poll), { once: true });
}

// ── Crafting Bench Hints ────────────────────────────────────────────
// Called when the crafting bench modal opens. Waits for the modal to
// render, then observes it (NOT body) for the item row to appear.

export function initCraftingHints() {
    if (!craftingRecipes) return;
    if (!getSetting('showRecipesWhenCrafting')) return;

    waitForModal((modal) => {
        // Watch the modal element for the item row to appear
        const readyObserver = new MutationObserver(() => {
            const itemRow = modal.querySelector('.flex.items-center.justify-center.gap-5');
            if (!itemRow) return;
            readyObserver.disconnect();

            modal.querySelector('[data-ftl-sdk="craft-hints"]')?.remove();

            const hintContainer = document.createElement('div');
            hintContainer.setAttribute('data-ftl-sdk', 'craft-hints');
            hintContainer.className = 'mt-2 px-1';
            itemRow.insertAdjacentElement('afterend', hintContainer);

            function getSelectedItems() {
                return [...itemRow.querySelectorAll('.font-secondary')]
                    .map(el => el.textContent.trim())
                    .filter(text => text && text !== 'Select Item');
            }

            let isUpdating = false;

            function updateHints() {
                if (isUpdating) return;
                isUpdating = true;

                const selected = getSelectedItems();
                hintContainer.innerHTML = '';

                if (selected.length === 0) {
                    isUpdating = false;
                    return;
                }

                if (selected.length === 2) {
                    const sorted = [...selected].sort();
                    const match = craftingRecipes.find(r => {
                        const s = [...r.ingredients].sort();
                        return s[0] === sorted[0] && s[1] === sorted[1];
                    });

                    if (match) {
                        hintContainer.innerHTML = `
                            <div class="flex items-center gap-1 text-xs bg-secondary-600/20 border-1 border-secondary-600/40 rounded-md px-2 py-1.5">
                                <span class="opacity-60">Result:</span>
                                <span class="font-bold text-secondary-400">${match.result}</span>
                            </div>
                        `;
                    } else {
                        hintContainer.innerHTML = `
                            <div class="text-xs opacity-40 text-center py-1">No recipe found for these items</div>
                        `;
                    }
                } else if (selected.length === 1) {
                    const item = selected[0];
                    const matches = craftingRecipes.filter(r => r.ingredients.includes(item));

                    if (matches.length === 0) {
                        hintContainer.innerHTML = `
                            <div class="text-xs opacity-40 text-center py-1">No known recipes for ${item}</div>
                        `;
                    } else {
                        const rows = matches.map(r => {
                            const other = r.ingredients.find(i => i !== item) || item;
                            return `
                                <div class="flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25 last:border-0">
                                    <span class="font-medium opacity-70">${item}</span>
                                    <span class="opacity-40">+</span>
                                    <span class="font-medium">${other}</span>
                                    <span class="opacity-40 mx-1">=</span>
                                    <span class="font-bold text-primary-400">${r.result}</span>
                                </div>
                            `;
                        }).join('');

                        hintContainer.innerHTML = `
                            <div class="border-1 border-dark-400/50 rounded-md px-2 py-1 max-h-[100px] overflow-y-auto" style="scrollbar-width: thin;">
                                <div class="text-xs opacity-40 mb-1">Known recipes for ${item}:</div>
                                ${rows}
                            </div>
                        `;
                    }
                }

                isUpdating = false;
            }

            updateHints();

            // Watch the item row (targeted, NOT body) for selection changes
            const craftObserver = new MutationObserver(updateHints);
            craftObserver.observe(itemRow, { childList: true, subtree: true });
            document.addEventListener('modalClose', () => craftObserver.disconnect(), { once: true });
        });

        readyObserver.observe(modal, { childList: true, subtree: true });
        document.addEventListener('modalClose', () => readyObserver.disconnect(), { once: true });
    });
}

// ── Use Item Hints ──────────────────────────────────────────────────
// Called when the use-item modal opens. Waits for the modal to render,
// then observes it (NOT body) for the Use button to appear.

export function initUseItemHints() {
    if (!craftingRecipes) return;
    if (!getSetting('showRecipeWhenConsuming')) return;

    waitForModal((modal) => {
        if (modal.querySelector('[data-ftl-sdk="use-hints"]')) return;

        // Watch the modal (NOT body) for the Use button to appear
        const readyObserver = new MutationObserver(() => {
            const useBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Use');
            if (!useBtn) return;
            readyObserver.disconnect();

            const nameEl = modal.querySelector('.font-secondary');
            const item = nameEl?.textContent?.trim();
            if (!item) return;

            const matches = craftingRecipes.filter(r => r.ingredients.includes(item));
            if (matches.length === 0) return;

            const btnRow = useBtn.closest('.flex.w-full.gap-2');
            if (!btnRow) return;

            const hintContainer = document.createElement('div');
            hintContainer.setAttribute('data-ftl-sdk', 'use-hints');
            hintContainer.className = 'mb-2 mt-3';

            const rows = matches.map(r => {
                const other = r.ingredients.find(i => i !== item) || item;
                return `
                    <div class="flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25 last:border-0">
                        <span class="font-medium opacity-70">${item}</span>
                        <span class="opacity-40">+</span>
                        <span class="font-medium">${other}</span>
                        <span class="opacity-40 mx-1">=</span>
                        <span class="font-bold text-primary-400">${r.result}</span>
                    </div>
                `;
            }).join('');

            hintContainer.innerHTML = `
                <div class="border-1 border-dark-400/50 rounded-md px-2 py-1 max-h-[80px] overflow-y-auto" style="scrollbar-width: thin;">
                    <div class="text-xs opacity-40 mb-1">Known recipes using ${item}:</div>
                    ${rows}
                </div>
            `;

            btnRow.closest('.flex.flex-col')?.insertAdjacentElement('beforebegin', hintContainer);
        });

        readyObserver.observe(modal, { childList: true, subtree: true });
        document.addEventListener('modalClose', () => readyObserver.disconnect(), { once: true });
    });
}

// ── Recipe search (for settings panel) ──────────────────────────────

export function renderRecipeResults(query, container) {
    container.innerHTML = '';
    if (!query) {
        container.classList.add('hidden');
        return;
    }

    if (!craftingRecipes) {
        container.classList.remove('hidden');
        container.innerHTML = '<div class="text-xs opacity-50 text-center py-2">Recipes not loaded yet, try again shortly</div>';
        return;
    }

    const q = query.toLowerCase();
    const matched = craftingRecipes.filter(recipe =>
        recipe.ingredients.some(i => i.toLowerCase().includes(q)) ||
        recipe.result.toLowerCase().includes(q)
    );

    if (matched.length === 0) {
        container.classList.remove('hidden');
        container.innerHTML = '<div class="text-xs opacity-50 text-center py-2">No recipes found</div>';
        return;
    }

    container.classList.remove('hidden');

    matched.forEach(recipe => {
        const [a, b] = recipe.ingredients;
        const first = b.toLowerCase().includes(q) ? b : a;
        const second = b.toLowerCase().includes(q) ? a : b;

        const row = document.createElement('div');
        row.className = 'flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25';
        row.innerHTML = `
            <span class="font-medium">${first}</span>
            <span class="opacity-40">+</span>
            <span class="font-medium">${second}</span>
            <span class="opacity-40 mx-1">=</span>
            <span class="font-bold text-primary-400">${recipe.result}</span>
        `;
        container.appendChild(row);
    });
}
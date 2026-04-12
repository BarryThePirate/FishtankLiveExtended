/**
 * chat-filter.js — Page-level chat filter
 *
 * Injected into the page realm by the extension to access the
 * React/Zustand chat store directly. Filters spam, repetitious
 * messages, floods, and custom word filters.
 *
 * Runs entirely in the page context (not content script).
 */
(function() {
    const LOG_PREFIX = '[FTL Chat Filter]';
    const DEBUG = false;

    // ── Configuration ───────────────────────────────────────────────
    const config = {
        // Repetition: filter if unique words / total words ratio is below this
        uniqueWordRatioThreshold: 0.25,
        // Repetition: minimum word count before checking ratio
        minWordsForRepetitionCheck: 6,
        // Duplicate: time window in ms to consider messages as duplicates
        duplicateTimeWindow: 30000,
        // Flood: number of users posting the same message to trigger flood detection
        floodUserThreshold: 5,
        // Flood: time window in ms for flood detection
        floodTimeWindow: 10000,
        // Flood: how long to auto-filter a flooded message (ms)
        floodMuteDuration: 60000,
        // Rate limit: max messages per user in time window
        rateLimitCount: 5,
        // Rate limit: time window in ms
        rateLimitWindow: 5000,
        // Skip filtering for these message types (user.id values for special messages)
        skipTypes: ['tts', 'sfx', 'system', 'emote', 'happening'],
    };

    // ── State ────────────────────────────────────────────────────────
    let store = null;
    let currentUserId = null;
    let settings = {
        smartAntiSpam: false,
        hideTTSMessages: false,
        hideSFXMessages: false,
        hideStoxMessages: false,
        wordFilters: [],
    };

    // Per-user recent message tracking: userId -> [{text, timestamp}]
    const userMessageHistory = new Map();

    // Flood detection: normalised text -> [{userId, timestamp}]
    const floodTracker = new Map();

    // Auto-blocked flood messages: normalised text -> expiry timestamp
    const floodBlockList = new Map();

    // IDs of messages already forwarded to the content script.
    // Separate from `processedIds` (which tracks filter state) so that
    // forwarding works even when all filters are off.
    const forwardedIds = new Set();

    // ── Store finder ────────────────────────────────────────────────
    function findStore() {
        const el = document.querySelector('[data-react-window-index]');
        if (!el) return null;
        const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return null;
        let fiber = el[fiberKey];

        for (let i = 0; i < 30; i++) {
            if (!fiber.return) return null;
            fiber = fiber.return;

            let hook = fiber.memoizedState;
            while (hook) {
                const ms = hook.memoizedState;
                if (Array.isArray(ms) && ms.length === 2 && ms[1] && typeof ms[1] === 'object') {
                    const inner = ms[1];
                    if (inner[0] && typeof inner[0].getState === 'function') {
                        const state = inner[0].getState();
                        if (state?.chatMessages) {
                            return inner[0];
                        }
                    }
                }
                hook = hook.next;
            }
        }
        return null;
    }

    // ── Room snapshot state ─────────────────────────────────────────
    // Tracks the user's "real" selected room so we can restore it
    // after a reconnect. Without this, the backend's notion of
    // "current room" gets clobbered when room sockets reconnect and
    // re-emit their own rooms.
    let roomSnapshot = 'Global';
    let roomFrozen = false;
    let snapshotMatchUnfreezer = null;

    // Call the site's own changeChatRoom action on the Zustand store.
    // This triggers exactly the same logic as the user clicking a
    // room in the site's room picker: it fetches messages, updates
    // the store, emits on the site's own socket, and settles backend
    // state correctly. No DOM clicks or modal flashing.
    function changeChatRoom(room) {
        if (!store) return false;
        try {
            const state = store.getState();
            if (typeof state.changeChatRoom === 'function') {
                state.changeChatRoom(room);
                return true;
            }
            if (DEBUG) console.warn(LOG_PREFIX, 'changeChatRoom action not found on store');
            return false;
        } catch (err) {
            if (DEBUG) console.warn(LOG_PREFIX, 'changeChatRoom failed:', err);
            return false;
        }
    }

    // ── Receive settings from content script ────────────────────────
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ftl-chat-filter-userid' && e.data.userId && !currentUserId) {
            currentUserId = e.data.userId;
            if (DEBUG) console.log(LOG_PREFIX, 'Current user ID:', currentUserId);
            window.postMessage({ type: 'ftl-chat-filter-userid-ack' }, '*');
        }
        if (e.data?.type === 'ftl-chat-filter-settings' && e.data.settings) {
            const changed = JSON.stringify(settings) !== JSON.stringify(e.data.settings);
            Object.assign(settings, e.data.settings);
            if (changed) {
                if (DEBUG) console.log(LOG_PREFIX, 'Settings updated:', settings);
                applyFilter();
            }
        }
        // Primary socket disconnected — freeze the snapshot so
        // store updates from incoming room sockets don't overwrite
        // the user's actual selection during the reconnect window.
        if (e.data?.type === 'ftl-socket-disconnected') {
            roomFrozen = true;
            if (DEBUG) console.log(LOG_PREFIX, 'Socket disconnected, room snapshot frozen at:', roomSnapshot);
        }
        // Primary socket reconnected — unfreeze after a short window.
        // During the freeze, if the store's chatRoom flips to anything
        // other than the snapshot, we call changeChatRoom immediately
        // to restore it (handled in the store subscribe below).
        if (e.data?.type === 'ftl-socket-reconnected') {
            if (DEBUG) console.log(LOG_PREFIX, 'Socket reconnected, watching for corruption');
            if (snapshotMatchUnfreezer) clearTimeout(snapshotMatchUnfreezer);
            snapshotMatchUnfreezer = setTimeout(() => {
                roomFrozen = false;
                snapshotMatchUnfreezer = null;
                if (DEBUG) console.log(LOG_PREFIX, 'Room snapshot unfrozen');
            }, 5000);
        }
    });

    // ── Text helpers ────────────────────────────────────────────────
    function normalise(text) {
        return (text || '').toLowerCase().trim();
    }

    function cleanForComparison(text) {
        return normalise(text).replace(/[^a-z0-9\s]/g, '');
    }

    // ── Spam detection functions ────────────────────────────────────

    /**
     * Check if a message is repetitious (same words/patterns repeated).
     * e.g. "L L L L L L L" or "spam spam spam spam"
     */
    function isRepetitious(message) {
        const words = cleanForComparison(message).split(/\s+/).filter(Boolean);
        if (words.length < config.minWordsForRepetitionCheck) return false;

        const unique = new Set(words);
        const ratio = unique.size / words.length;
        return ratio < config.uniqueWordRatioThreshold;
    }

    /**
     * Check if user sent the same or very similar message recently.
     */
    function isDuplicate(message, userId) {
        const now = Date.now();
        const history = userMessageHistory.get(userId);
        if (!history) return false;

        const cleaned = cleanForComparison(message);
        return history.some(entry => {
            if (now - entry.timestamp > config.duplicateTimeWindow) return false;
            return entry.text === cleaned;
        });
    }

    /**
     * Check if this message is part of a flood (many users posting the same thing).
     */
    function isFlood(message) {
        const now = Date.now();
        const cleaned = cleanForComparison(message);
        if (!cleaned || cleaned.length < 10) return false;

        // Check if this message is currently auto-blocked from a previous flood
        const blockExpiry = floodBlockList.get(cleaned);
        if (blockExpiry && now < blockExpiry) return true;

        return false;
    }

    /**
     * Track a message for flood detection. Call this BEFORE filtering.
     * If enough unique users post the same message, add it to the block list.
     */
    function trackForFlood(message, userId) {
        const now = Date.now();
        const cleaned = cleanForComparison(message);
        if (!cleaned || cleaned.length < 10) return;

        if (!floodTracker.has(cleaned)) {
            floodTracker.set(cleaned, []);
        }

        const entries = floodTracker.get(cleaned);

        // Remove old entries
        while (entries.length > 0 && now - entries[0].timestamp > config.floodTimeWindow) {
            entries.shift();
        }

        // Don't count the same user twice
        if (!entries.some(e => e.userId === userId)) {
            entries.push({ userId, timestamp: now });
        }

        // If enough unique users posted this, block it
        if (entries.length >= config.floodUserThreshold) {
            floodBlockList.set(cleaned, now + config.floodMuteDuration);
            if (DEBUG) console.log(LOG_PREFIX, 'Flood detected, auto-blocking:', JSON.stringify(message.substring(0, 50)));
        }
    }

    /**
     * Check if user is sending too many messages too fast.
     */
    function isRateLimited(userId) {
        const now = Date.now();
        const history = userMessageHistory.get(userId);
        if (!history) return false;

        const recent = history.filter(e => now - e.timestamp < config.rateLimitWindow);
        return recent.length >= config.rateLimitCount;
    }

    /**
     * Track a message in the user's history.
     */
    function trackUserMessage(message, userId) {
        const now = Date.now();
        const cleaned = cleanForComparison(message);

        if (!userMessageHistory.has(userId)) {
            userMessageHistory.set(userId, []);
        }

        const history = userMessageHistory.get(userId);
        history.push({ text: cleaned, timestamp: now });

        // Keep only recent entries
        while (history.length > 20) history.shift();
    }

    /**
     * Check against custom word filters (from user settings).
     */
    function matchesWordFilter(message) {
        const filters = settings.wordFilters || [];
        if (filters.length === 0) return null;
        const lower = normalise(message);
        for (const filter of filters) {
            if (lower.includes(normalise(filter))) return filter;
        }
        return null;
    }

    // ── Main filter ─────────────────────────────────────────────────
    function shouldFilter(msg) {
        const userId = msg.user?.id;

        // Hide TTS messages
        if (settings.hideTTSMessages && userId === 'tts') return 'hide TTS';

        // Hide SFX messages
        if (settings.hideSFXMessages && userId === 'sfx') return 'hide SFX';

        // Hide StoX messages
        if (settings.hideStoxMessages && msg.metadata?.portfolioValue !== undefined) return 'hide StoX';

        // Custom word filters (always active when filters exist, skip own messages)
        if (msg.message && !(currentUserId && userId === currentUserId)) {
            const wordMatch = matchesWordFilter(msg.message);
            if (wordMatch) return `word filter: "${wordMatch}"`;
        }

        // Anti-spam checks only run when enabled
        if (!settings.smartAntiSpam) return null;

        // Skip own messages
        if (currentUserId && userId === currentUserId) return null;

        // Skip system/special message types (don't spam-check these)
        if (config.skipTypes.includes(userId)) return null;
        if (msg.type && config.skipTypes.includes(msg.type)) return null;

        const message = msg.message;
        if (!message) return null;

        // Repetitious patterns
        if (isRepetitious(message)) return 'repetitious';

        // Flood (copypasta raids)
        if (isFlood(message)) return 'flood';

        // Duplicate from same user
        if (userId && isDuplicate(message, userId)) return 'duplicate';

        // Rate limiting
        if (userId && isRateLimited(userId)) return 'rate limited';

        return null;
    }

    // Set of message IDs we've already processed (to avoid re-tracking)
    const processedIds = new Set();

    function applyFilter() {
        if (!store) return;
        // Check if any filtering is active
        const hasWordFilters = (settings.wordFilters || []).length > 0;
        if (!settings.smartAntiSpam && !settings.hideTTSMessages && !settings.hideSFXMessages && !settings.hideStoxMessages && !hasWordFilters) return;
        const state = store.getState();
        const messages = state.chatMessages;
        if (!messages || messages.length === 0) return;

        let removed = 0;
        const reasons = {};

        const filtered = messages.filter(msg => {
            // Already processed — keep it, don't re-check
            if (processedIds.has(msg.id)) return true;

            // Mark as processed regardless of outcome
            processedIds.add(msg.id);

            // Track for flood/duplicate detection only when anti-spam is active
            if (settings.smartAntiSpam && msg.user?.id && msg.message && !config.skipTypes.includes(msg.user.id)) {
                trackForFlood(msg.message, msg.user.id);
            }

            const reason = shouldFilter(msg);
            if (reason) {
                removed++;
                reasons[reason] = (reasons[reason] || 0) + 1;
                return false;
            }

            // Track non-filtered messages for duplicate/rate detection
            if (settings.smartAntiSpam && msg.user?.id && msg.message) {
                trackUserMessage(msg.message, msg.user.id);
            }

            return true;
        });

        if (removed > 0) {
            store.setState({ chatMessages: filtered });
            if (DEBUG) {
                const summary = Object.entries(reasons).map(([r, c]) => `${r}: ${c}`).join(', ');
                console.log(LOG_PREFIX, `Removed ${removed} messages (${summary})`);
            }
        }

        // Cap processedIds to prevent unbounded growth
        if (processedIds.size > 2000) {
            const idsArray = [...processedIds];
            processedIds.clear();
            for (let i = idsArray.length - 1000; i < idsArray.length; i++) {
                processedIds.add(idsArray[i]);
            }
        }
    }

    // ── Forward new messages to content script ──────────────────────
    // Runs on every store change regardless of filter state, so the
    // content script gets messages even when filtering is disabled.
    // Used as a backup capture path for messages the monitoring sockets
    // miss. Content script dedupes by message ID against socket events.
    function forwardNewMessages() {
        if (!store) return;
        const messages = store.getState().chatMessages;
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
            if (!msg?.id || forwardedIds.has(msg.id)) continue;
            forwardedIds.add(msg.id);

            // Skip non-chat message types — TTS/SFX have their own
            // dedicated socket events with audio data we can't get
            // from the chat store
            if (msg.user?.id && config.skipTypes.includes(msg.user.id)) continue;

            // Build a minimal normalised shape matching what the SDK's
            // chat.messages.onMessage produces. The content script's
            // handler reads: username, message, role, colour, avatar,
            // endorsement, mentions, chatRoom, raw.id
            const meta = msg.metadata || {};
            const role = meta.isAdmin ? 'staff'
                : meta.isMod ? 'mod'
                    : meta.isFish ? 'fish'
                        : meta.isGrandMarshall ? 'grandMarshal'
                            : meta.isEpic ? 'epic'
                                : null;

            const photoURL = msg.user?.photoURL || '';
            const avatar = photoURL.split('/').pop() || null;

            const rawMentions = msg.mentions || [];
            const mentions = rawMentions.map(m => {
                if (typeof m === 'string') return { displayName: m, userId: null };
                return { displayName: m.displayName || '', userId: m.userId || null };
            });

            const normalised = {
                username: msg.user?.displayName || '???',
                message: msg.message || '',
                role,
                colour: msg.user?.customUsernameColor || null,
                avatar,
                clan: msg.user?.clan || null,
                endorsement: msg.user?.endorsement || null,
                mentions,
                chatRoom: store.getState().chatRoom || 'Global',
                raw: { id: msg.id },
            };

            window.postMessage({
                type: 'ftl-chat-store-message',
                message: normalised,
            }, '*');
        }

        // Cap forwardedIds to prevent unbounded growth
        if (forwardedIds.size > 2000) {
            const idsArray = [...forwardedIds];
            forwardedIds.clear();
            for (let i = idsArray.length - 1000; i < idsArray.length; i++) {
                forwardedIds.add(idsArray[i]);
            }
        }
    }

    // ── Cleanup stale tracking data ─────────────────────────────────
    function cleanup() {
        const now = Date.now();

        // Clean user history
        for (const [userId, history] of userMessageHistory) {
            const recent = history.filter(e => now - e.timestamp < 60000);
            if (recent.length === 0) {
                userMessageHistory.delete(userId);
            } else {
                userMessageHistory.set(userId, recent);
            }
        }

        // Clean flood tracker
        for (const [text, entries] of floodTracker) {
            const recent = entries.filter(e => now - e.timestamp < config.floodTimeWindow);
            if (recent.length === 0) {
                floodTracker.delete(text);
            }
        }

        // Clean expired flood blocks
        for (const [text, expiry] of floodBlockList) {
            if (now > expiry) floodBlockList.delete(text);
        }
    }

    // ── Initialisation ──────────────────────────────────────────────
    let lastLength = 0;

    const findInterval = setInterval(() => {
        store = findStore();
        if (store) {
            clearInterval(findInterval);

            if (DEBUG) console.log(LOG_PREFIX, 'Store found, chat filtering ready');
            if (settings.smartAntiSpam) console.log(LOG_PREFIX, 'Smart anti-spam active');
            lastLength = store.getState().chatMessages.length;

            // Subscribe to store changes
            store.subscribe(() => {
                const current = store.getState().chatMessages.length;
                if (current > lastLength) {
                    applyFilter();
                    forwardNewMessages();
                }
                lastLength = store.getState().chatMessages.length;

                // Room tracking:
                //   - If the store changes and we're not frozen, the
                //     user moved rooms — update the snapshot.
                //   - If the store changes while we're frozen and the
                //     new room doesn't match the snapshot, that's the
                //     post-reconnect corruption. Call changeChatRoom
                //     immediately to snap back to the user's room.
                const currentRoom = store.getState().chatRoom || 'Global';
                if (currentRoom !== roomSnapshot) {
                    if (roomFrozen) {
                        if (DEBUG) console.log(LOG_PREFIX, `Corrective action: store flipped to ${currentRoom}, calling changeChatRoom('${roomSnapshot}')`);
                        changeChatRoom(roomSnapshot);
                    } else {
                        roomSnapshot = currentRoom;
                        if (DEBUG) console.log(LOG_PREFIX, 'Room snapshot updated:', roomSnapshot);
                    }
                }
            });

            // Initialise snapshot from current state
            roomSnapshot = store.getState().chatRoom || 'Global';
            if (DEBUG) console.log(LOG_PREFIX, 'Initial room snapshot:', roomSnapshot);

            // Apply once for existing messages
            applyFilter();
            forwardNewMessages();

            // Periodic cleanup of stale tracking data
            setInterval(cleanup, 30000);
        }
    }, 1000);

})();
<h1 align="center">Fishtank Live Extended</h1>

<div align="center">
  An open source project aimed at extending functionality on fishtank.live

Currently available on [Chrome](https://chromewebstore.google.com/detail/dgalkmpecjmnichfppbbpgdekgfbiige?utm_source=item-share-cb) and [Firefox / Firefox for Android](https://addons.mozilla.org/en-GB/firefox/addon/fishtank-live-extended/).
</div>

<h1 align="center">Contribute</h1>
<div align="center">
  Code contributions are welcome! Check the <a href="https://github.com/BarryThePirate/FishtankLiveExtended/issues">issues page</a> for bugs and feature requests, or open a new issue if you have an idea. Pull requests are always appreciated.
  <br><br>
  In the future I may have a bounty board where adding features / bug fixing results in being paid a reward in site tokens.
</div>

<h1 align="center">Features (Current Site)</h1>

Version 2.0.0 is a complete rewrite for the current fishtank.live site, powered by the [ftl-ext-sdk](https://github.com/BarryThePirate/ftl-ext-sdk).

## Settings
- Press **E** at any time to open the FTL Extended settings panel
- Four tabs: General, Crafting, Logging, and Chat
- All settings are saved and persist across sessions

## General
- **Enhanced Theatre Mode**: replaces the site's built-in theatre mode with a cleaner layout — video fills the viewport with a collapsible chat panel on the right. Toggle chat with the button or hide it entirely. Press **T** or click the site's theatre button to enter, **T** or **ESC** to exit. Can be disabled in settings to use the site's default theatre mode
- **Fullscreen**: press **F** or click the fullscreen button to enter our theatre mode + browser fullscreen together. Press **F** again to exit fullscreen, **T** or **ESC** to exit theatre mode entirely
- **Keyboard Shortcuts**: Q (Settings), P (Edit Profile), H (Help), X (Season Pass), C (Craft), M (Item Market), S (Stox). All togglable in settings. E always works
- **Hidden Clickable Zones**: reveals secret clickable areas on the video player with a golden highlight on hover. Togglable in settings
- **Season Pass Popup Suppression**: automatically closes the season pass popup and removes the banner. Togglable in settings
- **Video Stutter Improver**: automatically resets the playback rate and snaps to the live edge when the stream falls behind, preventing the freeze-and-fast-forward cycle caused by the site's built-in catch-up mechanism. Togglable in settings
- **Inventory Search**: adds a search box to the inventory popup and the crafting modal's item select grid, filtering items by name as you type. Also works in the trade modal. Togglable in settings
- **Ping Indicator**: a button in the chat header that dims when you have no unread pings and lights up when someone @mentions you — click it to jump straight to the pings log. Togglable in settings

## Chat
- **Smart Anti-Spam Filtering**: removes spam from the chat feed in real time by detecting repetitious messages, duplicate messages from the same user, flood/copypasta raids, and rate-limited users. Skips your own messages and system messages. Off by default
- **Word / Phrase Filters**: add custom words or phrases to automatically hide any chat message containing them. Case-insensitive. Filters are saved across sessions and take effect immediately
- **Hide TTS Messages**: removes TTS messages from the chat feed. Togglable in settings
- **Hide SFX Messages**: removes SFX messages from the chat feed. Togglable in settings
- **Hide StoX Messages**: removes StoX portfolio messages from the chat feed. Togglable in settings
- **Monitor Season Pass Chat**: automatically monitors Season Pass and Season Pass XL chat rooms if you have the corresponding pass, logging messages and pings with SP/XL badges. Togglable in settings

## Crafting
- **Recipe Hints (Crafting Bench)**: when you open the crafting bench and select items, matching recipes are shown automatically. Select one item to see all recipes that use it, select two to see the result
- **Recipe Hints (Use Item)**: when viewing an item with a "Use" button, any known recipes using that item are displayed
- **Recipe Search**: the Crafting tab in settings has a search box to look up any recipe by item name or result

## Logging
All logs are accessible from the Logging tab in the FTL Extended settings panel. Each log type has a configurable size limit (default 200 entries).

- **Admin Messages**: logs system notifications and admin announcements that appear as toasts at the bottom of the screen
- **Staff Messages**: logs chat messages from staff members with their distinctive styling
- **Mod Messages**: logs chat messages from moderators
- **Fish Messages**: logs chat messages from contestants (fish)
- **Pings**: logs any chat message that mentions your username, across all monitored rooms
- **TTS**: logs all approved TTS messages with voice, room name, and a play button to hear the audio
- **SFX**: logs all SFX with room name and a play button to hear the audio

All chat-style logs display with avatars, usernames (click to @mention), role-specific styling, and timestamps matching the site's own chat layout. Logs are deduplicated across multiple tabs.

## Technical Details
- Chat, TTS, and SFX data is captured via a dedicated Socket.IO connection (not DOM scraping), ensuring no messages are missed
- Chat filtering operates at the Zustand store level, removing messages from React state before they render — no DOM manipulation, no flickering
- Socket health is monitored — if no events are received for 60 seconds, the connection is automatically reconnected
- Season Pass room monitoring creates separate authenticated WebSocket connections per room
- Zero persistent MutationObservers on document.body (performance critical — the site renders thousands of chat mutations per second)
- Room names are resolved via the fishtank.live API and cached locally
- Cross-tab log deduplication prevents duplicate entries when multiple tabs are open

<h1 align="center">Features (Classic Site)</h1>

The classic site (classic.fishtank.live) retains all v1.x features:

## General
- Improved Theatre Mode
- Keyboard shortcuts
- Automatically close the season pass popup

## Crafting
- Recipe search and automatic recipe hints

## Logging
- Admin/system message logging
- Staff message logging
- Ping logging
- TTS and SFX logging with room filters

## Clickable Zones
- Notifications when clickable areas appear on streams
- Automatic fix for broken clickable zones

<h1 align="center">Install From GitHub</h1>

If you want to develop the extension you will need to install it unpacked in your browser. If you already have it installed from the store, you'll need to disable that version.

- On GitHub, click Code → Download ZIP
- Extract the ZIP file

## Chrome
- Open Chrome Extensions Page: Go to `chrome://extensions/` in your address bar or open the menu → Extensions → Manage Extensions
- If you have it installed from the Chrome store, disable that extension with the toggle button
- Turn on the "Developer mode" switch in the top-right corner of the page
- Click "Load unpacked"
- Select the root folder of the extension (the one that contains manifest.json)

To test changes, you need to click the Reload button on the extension in the Manage Extensions page.

## Firefox
- Go to `about:debugging#/runtime/this-firefox` in your address bar
- Click "Load Temporary Add-on"
- Select `manifest.json` within the root folder of the extension

To test changes, you need to click the Reload button on the extension in the `about:debugging#/runtime/this-firefox` page.

<h1 align="center">Building From Source</h1>

The current site version uses a bundled JavaScript file built with Rollup. The chat filter runs as a separate page-level script (not bundled) to access React internals.

```bash
# Install dependencies (first time only)
cd current
npm install

# Build the bundle
npm run build

# Package for store submission
cd ..
node build-zip.js
```

The build zip is created in the `builds/` directory, named `FishtankLiveExtended-{version}.zip` with the version pulled from `manifest.json`.

Use `node build-zip.js --dry` to preview what will be included without creating the zip.
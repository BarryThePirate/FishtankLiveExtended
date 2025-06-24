<h1 align="center">Fishtank Live Extended</h1>

<div align="center">
  An open source project aimed at extending functionality on fishtank.live

  Currently available on [Chrome](https://chromewebstore.google.com/detail/dgalkmpecjmnichfppbbpgdekgfbiige?utm_source=item-share-cb) and [Firefox / Firefox for Android](https://addons.mozilla.org/en-GB/firefox/addon/fishtank-live-extended/).
</div>

<h1 align="center">Contribute</h1>
<div align="center">
  <img src="images/contributor.gif" width="400" alt="Contributor">
</div>
<div align="center">
  Become a code contributor and your username will show up with a unique effect on the site for anyone using this extension.
</div>

<h1 align="center">Features</h1>

## Customisable Settings
Many settings are off by default, especially if experimental.
 - Click profile picture to open the dropdown
 - Click "FLT Extended" to open the settings

## General
 - Improved Theatre Mode: moves chat to right of video instead of in front, button to toggle chat
 - Keyboard shortcuts -- F: Fullscreen, E: FTL Extended Settings, N: Notifications, P: Profile, B: Blocked Users, C: Secret Code, S: StoX
 - Automatically resolve the 'Think Fast' mission
 - Automatically close the season pass popup

## Anti-Spam
Toggle what you want to be hidden in the chat. This feature only hides messages. (It does not add or remove messages from the chat box, so the max chat length still applies)

## Chat Filtering
 - The chat dropdown has a new section if streams are currently happening
 - Clicking on one of the stream names will hide messages in chat that are not from people watching that stream (It does not add or remove messages from the chat box, so the max chat length still applies)
 - Option in settings to automatically apply the stream room filter when as you change streams
 - EXPERIMENTAL - setting to re-enable the chat dropdown if it is disabled by not having a season pass (this feature is janky and don't turn it on if you have a season pass)

## Crafting
 - The 'Crafting' section on the FTL Extended Settings screen has a search box for seeing recipes
 - Automatically displays known recipes when crafting with an item or consuming an item

## Logging
 - Logs the system messages that appear at the bottom of the screen when an admin manually sends a message or when the system automatically displays one along with many settings to choose what system message get logged
 - Logs chat message from staff members that have the staff message styling and the staff picture as their profile picture
 - Logs each ping you recieve
 - Logs TTS sent by other users and has a dropdown to filter to a specific room
 - Logs SFX sent by other users and has a dropdown to filter to a specific room

## Clickable Zones
Untested and experimental.
 - When an area exists on a video stream that you can click to add an item to your inventory, it pushes a system message to notify you
 - Automatially fix broken clickable zones

<h1 align="center">Install From  GitHub</h1>
If you want to develop the extension you will need to install it unpacked in your browser. If you already have it installed from the store, you'll need to disable that version.

 - On GitHub, click Code → Download ZIP
 - Extract the ZIP file

## Chrome
 - Open Chrome Extensions Page: Go to `chrome://extensions/` in your address bar or open the menu → Extensions → Manage Extensions
 - If you have it installed from the Chrome store, disable that extension with the toggle button
 - Turn on the "Developer mode" switch in the top-right corner of the page
 - Click “Load unpacked”
 - Select the root folder of the extension (the one that contains manifest.json)

To test changes, you need to click the Reload button on the extension in the Manage Extensions page.

## Firefox
 - Go to `about:debugging#/runtime/this-firefox` in your address bar
 - Click "Load Temporary Add-on"
 - Select `manifest.json` within the root folder of the extension

To test changes, you need to click the Reload button on the extension in the `about:debugging#/runtime/this-firefox` page.

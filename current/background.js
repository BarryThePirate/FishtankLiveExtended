// Background service worker for Fishtank Live Extended
//
// Handles cross-origin fetches on behalf of the content script.
// The SDK's transport layer is wired up in bundle.js to send
// messages here — this worker just performs the fetch with the
// extension's host_permissions and returns the bytes.
//
// Message format (from SDK core/transport.js consumer):
//   { type: 'ftl-sdk-fetch', url: string }
// Response:
//   { ok: true, data: number[] } on success
//   { ok: false, error: string } on failure

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'ftl-sdk-fetch') return;

    (async () => {
        try {
            const response = await fetch(msg.url);
            if (!response.ok) {
                sendResponse({ ok: false, error: `HTTP ${response.status}` });
                return;
            }
            const buffer = await response.arrayBuffer();
            // Serialise as a plain array — Chrome can't postMessage
            // ArrayBuffers or Uint8Arrays directly through sendMessage.
            sendResponse({ ok: true, data: Array.from(new Uint8Array(buffer)) });
        } catch (err) {
            sendResponse({ ok: false, error: err.message });
        }
    })();

    return true; // keep the channel open for async sendResponse
});
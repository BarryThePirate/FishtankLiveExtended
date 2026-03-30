const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');

/**
 * Rollup plugin to fix cross-realm ArrayBuffer instanceof failure
 * in Firefox content scripts.
 *
 * Firefox content scripts run in a separate JavaScript realm from the page.
 * WebSocket binary data (ArrayBuffer) is created in the page realm, so
 * `data instanceof ArrayBuffer` fails in the content script realm.
 *
 * Two libraries are affected:
 * 1. engine.io-parser's mapBinary() — loses binary data, passes undefined
 *    to the Socket.IO decoder
 * 2. notepack.io's browser Decoder constructor — throws "Invalid argument"
 *    when receiving the ArrayBuffer for msgpack decoding
 *
 * Both are patched with a realm-agnostic check:
 *   Object.prototype.toString.call(x) === "[object ArrayBuffer]"
 *
 * Uses renderChunk to patch the final bundle output, guaranteeing the fix
 * is applied regardless of how Rollup resolves ESM/CJS/browser fields.
 *
 * This has no effect on Chrome where instanceof works correctly.
 */
function firefoxArrayBufferFix() {
    return {
        name: 'firefox-arraybuffer-fix',
        renderChunk(code) {
            let patched = code;
            let patchCount = 0;

            // Patch 1: engine.io-parser's mapBinary
            patched = patched.replace(
                /if \(data instanceof ArrayBuffer\) \{\s*\/\/ from HTTP long-polling \(base64\) or WebSocket \+ binaryType "arraybuffer"/g,
                (match) => { patchCount++; return 'if (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === "[object ArrayBuffer]") {\n                // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer" (patched for Firefox)'; }
            );

            // Patch 2: notepack.io's browser Decoder constructor
            patched = patched.replace(
                /if \(buffer instanceof ArrayBuffer\) \{/g,
                (match) => { patchCount++; return 'if (buffer instanceof ArrayBuffer || Object.prototype.toString.call(buffer) === "[object ArrayBuffer]") {'; }
            );

            if (patchCount > 0) {
                console.log(`[firefox-arraybuffer-fix] Applied ${patchCount} patches`);
                return { code: patched, map: null };
            }

            console.warn('[firefox-arraybuffer-fix] WARNING: No patterns found!');
            return null;
        },
    };
}

module.exports = {
    input: 'src/index.js',
    output: {
        file: 'bundle.js',
        format: 'iife',
        sourcemap: false,
    },
    plugins: [
        resolve({ browser: true }),
        commonjs(),
        firefoxArrayBufferFix(),
    ],
};
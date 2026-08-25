/**
 * rerun-share.js — Share codes for re-run moments
 *
 * The code format itself (FTL1-s03-D11-1817-kitchen) lives in the SDK
 * (archives.buildShareCode / parseShareCode / shareUrl) so other tools
 * can speak it. This module is the extension-side glue: resolving the
 * re-run's virtual clock to the day/time fields a code carries.
 */

import { archives } from '../../ftl-ext-sdk/src/index.js';
import { virtualMsToDayNumber } from './rerun.js';

export { parseShareCode, shareUrl } from '../../ftl-ext-sdk/src/archives/index.js';

/**
 * Build a share code for a virtual moment. Returns null if the moment
 * doesn't map onto a season day (season data not loaded/out of range).
 */
export function encodeShareCode(season, virtualMs, room) {
    if (virtualMs == null) return null;
    const day = virtualMsToDayNumber(virtualMs);
    if (day == null) return null;
    const time = archives.formatHouseClock(virtualMs).slice(0, 5);
    return archives.buildShareCode({ season, day, time, room });
}

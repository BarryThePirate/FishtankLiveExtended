/**
 * rerun-zones.js — Clickable room-navigation zones for the re-run player
 *
 * Overlays clickable door/doorway polygons on the focused re-run
 * video: hovering highlights the zone with the target room's name,
 * clicking switches the player to that room.
 *
 * Zone geometry is percentage-based ([x, y] in 0-100 of the video
 * frame) and is scaled to the video's rendered content box, taking
 * object-fit: contain letterboxing into account.
 *
 * Season 1 zone data adapted from the "Fishtank Custom Clickable
 * Zones" userscript v1.1 by @c (MIT licensed):
 * https://greasyfork.org — thank you! Season 3 zones to be added.
 */

import { getSetting } from './settings.js';
import { archives } from '../../ftl-ext-sdk/src/index.js';
import * as storage from '../../ftl-ext-sdk/src/core/storage.js';
import { getSeasonRooms } from './rerun.js';
import { siteTextButton } from './theatre.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CONTAINER_ID = 'ftl-rerun-zones';
const EDITOR_ID = 'ftl-rerun-zone-editor';
const CUSTOM_ZONES_KEY = 'rerun-custom-zones';
const HIDDEN_ZONES_KEY = 'rerun-hidden-zones';

// ── Zone data ───────────────────────────────────────────────────────
// Keyed by season → room code → zones. points are [x, y] percentages
// of the video frame; target is the room code to switch to.

const SEASON_ZONES = {
    s01: {
        'living-room': [
            { points: [[44.756, -0.093], [46.070, 17.588], [51.137, 14.919], [62.208, 17.588], [74.500, 25.595], [74.312, 29.431], [76.658, 31.600], [75.345, 38.606], [90.639, 52.451], [93.829, 36.771], [95.236, 37.939], [99.928, 1.073], [99.271, 0.239]], target: 'kitchen' },
            { points: [[35.291, 0.105], [44.483, -0.133], [45.691, 17.997], [37.371, 23.483]], target: 'laundry' },
            { points: [[37.036, 23.961], [9.661, 44.238], [5.904, 23.245], [35.560, 9.170]], target: 'hallway-down' },
            { points: [[35.425, 8.335], [5.635, 22.648], [2.885, 0.582], [35.023, -0.014]], target: 'hallway-up' },
        ],
        'kitchen': [
            { points: [[76.470, 99.492], [85.478, 67.464], [90.170, 45.779], [92.421, 31.600], [93.078, 28.597], [93.641, 28.931], [95.518, 3.909], [94.017, 0.239], [99.834, 0.573], [99.928, 99.492]], target: 'laundry' },
            { points: [[71.967, 0.072], [69.902, 41.275], [88.387, 51.951], [92.703, 28.430], [93.078, 28.097], [95.143, 4.410], [93.454, 0.239]], target: 'hallway-down' },
            { points: [[69.527, 40.941], [34.810, 18.589], [34.810, 0.072], [71.591, 0.072]], target: 'living-room' },
        ],
        'laundry': [
            { points: [[96.175, 11.082], [94.298, 47.947], [88.387, 85.313], [71.404, 78.140], [74.782, 0.907], [95.330, 0.239]], target: 'kitchen' },
            { points: [[45.038, 99.659], [39.502, 0.072], [0, 0.072], [0.281, 99.325]], target: 'garage' },
            { points: [[71.254, 78.710], [59.244, 99.822], [45.355, 99.584], [40.122, -0.014], [74.474, 0.463]], target: 'kitchen' },
            { points: [[88.718, 85.666], [99.956, 87.547], [99.956, 0.577], [95.725, -0.010], [96.915, 10.331], [94.800, 49.233]], target: 'hallway-down' },
        ],
        'hallway-up': [
            { points: [[61.391, 83.123], [69.845, 99.584], [85.008, 99.703], [99.836, 67.378], [99.970, -0.133], [73.133, -0.014]], target: 'hallway-down' },
            { points: [[36.700, 99.703], [17.780, 8.096], [16.169, 3.683], [11.540, 0.343], [0, -0.014], [0.067, 99.584]], target: 'bedroom-2' },
            { points: [[11.436, -0.128], [22.278, 0.224], [29.616, 63.218], [18.047, 7.276], [16.593, 3.515]], target: 'bedroom-3' },
            { points: [[37.219, 99.652], [61.216, 83.668], [69.480, 99.652], [85.280, 99.769], [99.956, 68.507], [99.824, 99.769]], target: 'bedroom-1' },
            { points: [[37.946, 23.259], [25.385, 22.084], [25.980, 19.028], [30.410, 16.325], [28.955, 0.224], [37.285, -0.010]], target: 'bedroom-4' },
        ],
        'bedroom-1': [
            { points: [[40.927, 41.137], [27.978, 50.083], [24.824, 0.105], [40.927, 0.343]], target: 'hallway-up' },
            { points: [[41.330, 40.302], [56.225, 30.998], [57.097, 0.701], [57.164, 0.105], [41.196, 0.343]], target: 'hallway-down' },
            { points: [[27.777, 50.918], [13.687, 59.983], [7.850, 29.447], [6.575, -0.133], [24.489, -0.014]], target: 'bedroom-2' },
        ],
        'bedroom-3': [
            { points: [[80.520, 4.716], [73.645, 50.904], [84.024, 61.129], [95.593, 4.716]], target: 'hallway-up' },
            { points: [[73.380, 50.787], [47.333, 28.104], [47.598, 3.423], [79.991, 4.599]], target: 'bedroom-4' },
            { points: [[95.990, 4.951], [84.222, 61.364], [70.868, 99.913], [99.824, 99.560], [99.824, 4.364]], target: 'bedroom-2' },
        ],
        'hallway-down': [
            { points: [[32.525, 89.923], [31.401, 52.197], [31.996, 0.133], [62.340, 0.368], [54.077, 80.991]], target: 'hallway-up' },
            { points: [[78.339, 68.155], [84.883, 77.087], [92.552, 43.004], [84.354, 37.833]], target: 'laundry' },
            { points: [[86.007, 22.789], [84.222, 37.362], [92.882, 42.886], [94.601, 29.371]], target: 'kitchen' },
            { points: [[97.708, 10.566], [94.932, 29.136], [93.279, 43.239], [85.082, 77.557], [77.677, 99.887], [99.890, 99.887], [99.956, 13.269]], target: 'living-room' },
        ],
        'bedroom-4': [
            { points: [[27.236, 55.227], [25.385, -0.128], [6.743, 0.341], [14.147, 64.159]], target: 'hallway-up' },
        ],
        'bedroom-2': [
            { points: [[8.660, 73.091], [44.491, 33.719], [43.896, 0.224], [0.198, -0.010], [0, 37.362], [1.123, 46.765]], target: 'bedroom-3' },
            { points: [[82.041, 64.276], [44.755, 33.837], [44.160, 0.459], [92.354, -0.128]], target: 'hallway-up' },
            { points: [[73.050, 99.769], [82.305, 64.394], [92.750, 0.694], [92.750, -0.010], [99.956, -0.010], [99.824, 99.769]], target: 'bedroom-1' },
        ],
    },
    // s03 zones traced by BarryThePirate with the built-in zone editor.
    s03: {
        'bedroom-1': [
            { points: [[17.42, 55.985], [15.819, 46.024], [14.548, 35.143], [13.23, 21.166], [12.429, 8.359], [0.235, 17.148], [1.13, 29.787], [2.825, 42.09], [4.991, 54.98], [6.827, 64.857]], target: 'hallway' },
        ],
        'hallway': [
            { points: [[54.661, 50.377], [53.908, 41.923], [57.486, 42.09], [59.934, 5.514], [64.077, 9.448], [60.075, 49.372]], target: 'bedroom-3' },
            { points: [[38.591, 0.132], [40.891, 0.237], [40.507, 16.484], [40.507, 42.06], [39.122, 52.438], [38.414, 27.176]], target: 'bedroom-2' },
            { points: [[37.088, 70.362], [38.65, 55.006], [37.942, 30.583], [37.942, 17.113], [38.119, 0.552], [34.847, 2.753], [34.876, 26.39], [35.643, 49.66], [36.704, 66.641]], target: 'bedroom-1' },
            { points: [[38.606, 85.363], [46.751, 98.253], [56.827, 84.777], [51.93, 84.693], [51.601, 67.2], [44.209, 67.368], [43.644, 85.614]], target: 'island' },
        ],
        'bedroom-3': [
            { points: [[98.164, 6.602], [99.953, 8.694], [99.906, 98.002], [82.203, 98.588], [85.546, 89.213], [89.783, 73.98], [94.115, 52.804], [96.563, 34.641], [97.881, 18.152]], target: 'vanity' },
            { points: [[80.179, 48.117], [81.073, 39.328], [82.015, 29.535], [82.721, 16.729], [82.91, 6.1], [94.256, 11.707], [93.738, 21.249], [92.985, 31.628], [91.808, 41.839], [91.008, 48.619], [90.395, 53.306]], target: 'hallway' },
        ],
        'vanity': [
            { points: [[33.963, 59.513], [47.082, 53.276], [44.87, -0.077], [26.651, -0.025], [29.983, 33.151]], target: 'bedroom-3' },
        ],
        'bedroom-2': [
            { points: [[82.015, 53.976], [83.145, 45.522], [84.934, 31.377], [86.252, 17.985], [87.1, 6.267], [92.891, 10.285], [99.247, 15.055], [97.411, 33.72], [95.433, 47.363], [92.608, 61.09]], target: 'hallway' },
        ],
        'island': [
            { points: [[12.759, 51.465], [20.527, 41.086], [18.362, 0.575], [8.333, 0.492], [9.134, 24.597], [11.064, 43.848], [11.535, 48.535]], target: 'hallway' },
            { points: [[24.773, 42.753], [29.849, 34.366], [34.156, 28.259], [41.386, 19.052], [55.436, 20.055], [55.59, 0.273], [41.284, 0.091], [22.106, 0], [22.465, 8.022], [22.876, 17.138], [23.491, 25.524], [24.158, 35.187]], target: 'kitchen' },
            { points: [[73.588, 45.689], [80.32, 98.42], [99.906, 98.002], [99.906, 0.241], [76.412, 0.241], [75.565, 16.144], [74.67, 30.791]], target: 'dining-room' },
            { points: [[70.83, 42.707], [56.436, 32.751], [57.271, 0.262], [59.384, 0.349], [65.082, 1.048], [69.16, 2.271], [73.237, 3.493], [72.599, 16.943], [72.206, 24.803], [71.223, 37.817]], target: 'mail-room' },
        ],
        'penthouse': [
            { points: [[31.339, 34.356], [29.924, 2.648], [39.033, 0.918], [39.475, 28.119]], target: 'deck' },
            { points: [[70.165, 45.886], [75.029, 46.935], [80.218, 35.037], [81.22, 12.658], [79.717, 6.684], [75.354, 0.289], [63.974, 0.132], [65.625, 5.74], [71.993, 16.013]], target: 'loft' },
            { points: [[0.141, -0.01], [7.863, -0.01], [7.062, 87.372], [99.953, 87.204], [99.859, 98.085], [0.094, 97.667]], target: 'jacuzzi' },
        ],
        'jacuzzi': [
            { points: [[88.936, 17.566], [84.463, 42.007], [77.966, 67.786], [71.328, 88.46], [67.42, 98.588], [90.348, 98.336], [95.998, 83.271], [99.859, 68.623], [99.812, 28.698]], target: 'penthouse' },
            { points: [[37.665, 36.985], [41.478, 43.597], [43.315, 25.099], [44.962, 8.025], [46.109, 0.394], [41.215, 0.08], [39.475, 14.388], [38.208, 27.962]], target: 'penthouse' },
        ],
        'loft': [
            { points: [[21.94, 18.403], [26.93, 54.896], [4.708, 88.878], [0.282, 76.24], [0.094, 41.337], [9.746, 29.87], [17.985, 21.5]], target: 'jacuzzi' },
            { points: [[24.482, 85.53], [36.582, 63.183], [51.365, 72.055], [72.599, 82.434], [68.832, 98.504], [28.484, 98.42]], target: 'penthouse' },
        ],
        'deck': [
            { points: [[19.444, 62.764], [29.614, 55.733], [38.936, 49.54], [51.977, 41.337], [54.379, 39.663], [64.831, 51.883], [56.073, 59.835], [49.247, 65.861], [38.089, 75.152], [29.849, 81.68], [24.388, 85.865]], target: 'den-ptz' },
            { points: [[61.017, 40.082], [55.979, 26.104], [53.296, 26.606], [53.343, 13.13], [58.051, 5.932], [67.043, 5.43], [66.761, 11.624], [59.981, 13.967], [61.394, 20.077], [65.348, 30.791], [65.066, 37.989]], target: 'den' },
            { points: [[8.427, 0.241], [8.945, 13.465], [10.311, 27.861], [11.911, 41.923], [14.218, 54.98], [18.315, 73.227], [21.987, 88.878], [23.682, 97.751], [0.047, 98.085], [0.141, -0.01]], target: 'penthouse' },
            { points: [[53.193, 27.534], [55.657, 26.967], [60.721, 40.349], [57.573, 42.133], [53.467, 37.916]], target: 'flat' },
        ],
        'den': [
            { points: [[16.594, 33.974], [16.25, 31.354], [15.464, 30.83], [15.169, 26.463], [14.482, 18.69], [13.941, 8.297], [13.548, 0.175], [11.436, 0.087], [7.85, 3.406], [2.593, 9.52], [0.038, 12.838], [-0.011, 49.607], [1.905, 49.432], [5.049, 46.725], [10.601, 40.349]], target: 'den-ptz' },
            { points: [[80.085, 12.126], [79.661, 25.183], [91.949, 25.685], [91.902, 33.218], [98.493, 18.655], [91.62, 7.104], [91.478, 13.047]], target: 'confessional' },
            { points: [[92.043, 35.646], [98.493, 47.531], [92.043, 61.676], [92.043, 55.064], [79.755, 54.227], [80.132, 40.5], [91.902, 40.919]], target: 'dining-room' },
            { points: [[92.279, 66.112], [98.54, 78.5], [92.938, 92.31], [92.844, 86.953], [79.661, 86.033], [79.944, 71.385], [92.279, 71.302]], target: 'locker-room' },
            { points: [[63.435, 31.814], [63.999, 13.036], [64.922, 6.746], [57.231, 5.743], [56.308, 0.091], [73.947, 0.091], [73.383, 19.781], [73.844, 19.508], [73.178, 34.913], [72.255, 34.731], [72.306, 32.999]], target: 'deck' },
            { points: [[54.616, 29.079], [54.513, 18.505], [55.282, 18.323], [57.128, 6.563], [64.256, 7.475], [63.435, 13.491], [62.974, 31.996], [62.666, 30.994]], target: 'flat' },
            { points: [[16.742, 34.148], [16.545, 30.917], [15.661, 30.742], [14.875, 23.231], [14.334, 16.594], [13.745, 5.939], [17.331, 4.454], [20.426, 2.795], [20.966, 11.441], [21.605, 21.747], [22.244, 29.17], [19.64, 31.703]], target: 'lounge' },
        ],
        'kitchen': [
            { points: [[35.405, 18.32], [38.136, 16.06], [44.209, 15.39], [49.812, 15.641], [53.908, 17.985], [52.589, 20.496], [51.601, 20.496], [51.46, 31.544], [50.047, 33.888], [49.435, 35.729], [44.915, 37.152], [39.972, 36.148], [37.476, 32.8], [37.288, 20.747]], target: 'island' },
            { points: [[34.087, 17.399], [39.689, 13.465], [39.623, 0.08], [29.187, 0.08], [30.72, 29.063], [36.38, 22.145]], target: 'dining-room' },
            { points: [[65.23, 8.734], [69.209, 17.205], [64.345, 24.192], [64.591, 20.087], [55.846, 18.079], [56.78, 10.044], [65.131, 12.314]], target: 'hallway' },
            { points: [[4.47, 57.412], [4.069, 55.989], [5.937, 46.857], [5.203, 42.469], [12.742, 34.523], [20.08, 28], [23.349, 24.917], [23.682, 33.693], [18.879, 38.911], [13.476, 45.078], [10.34, 48.992]], target: 'mail-room' },
        ],
        'dining-room': [
            { points: [[7.062, 98.169], [0.047, 98.253], [0.047, 0.073], [11.158, 0.157], [10.829, 9.615], [10.829, 20.161], [11.488, 34.809], [12.524, 47.112], [13.418, 55.482], [13.371, 57.742], [12.147, 57.993], [10.499, 67.786], [9.228, 74.231], [7.815, 85.363], [7.109, 94.57]], target: 'island' },
            { points: [[81.098, 52.227], [82.178, 46.114], [83.456, 38.079], [84.537, 30.044], [85.421, 22.271], [85.765, 17.991], [90.677, 21.397], [95.05, 25.24], [99.864, 29.432], [99.913, 41.135], [98.194, 50.044], [95.983, 61.659], [93.576, 71.266], [89.597, 64.279], [85.617, 58.428]], target: 'den' },
        ],
        'locker-room': [
            { points: [[24.388, 50.042], [30.556, 45.689], [35.97, 42.174], [41.761, 38.575], [42.394, 24.66], [43.072, 11.296], [43.809, 0.132], [22.495, -0.025], [22.406, 9.985], [22.819, 26.233], [23.467, 38.339]], target: 'den' },
            { points: [[0.058, 0], [3.032, 0.273], [3.032, 7.84], [3.852, 19.417], [5.185, 32.999], [7.288, 47.767], [9.287, 57.338], [10.98, 65.451], [13.082, 76.117], [16.107, 88.879], [17.902, 94.622], [17.953, 95.533], [0.006, 95.351]], target: 'catwalk' },
        ],
        'mail-room': [
            { points: [[4.708, 46.526], [3.249, 32.967], [2.542, 22.923], [2.307, 12.042], [2.307, 7.02], [5.885, 4.677], [9.463, 3.003], [11.347, 2.501], [11.299, 16.311], [11.629, 26.941], [12.429, 37.989], [12.947, 43.346]], target: 'catwalk' },
            { points: [[99.953, 56.905], [94.633, 78.416], [91.667, 86.786], [0.282, 87.456], [0.235, 97.918], [99.859, 97.165]], target: 'island' },
            { points: [[30.65, 66.447], [52.307, 56.068], [53.814, 30.707], [55.232, 11.684], [55.98, 0.274], [29.25, 0.195], [29.074, 11.606], [29.162, 30.285], [29.602, 45.057], [29.91, 56.624]], target: 'yard' },
        ],
        'catwalk': [
            { points: [[54.068, 18.633], [56.338, 15.174], [56.28, -0.025], [39.977, 0.08], [40.095, 14.388]], target: 'mail-room' },
            { points: [[6.545, 41.746], [14.682, 35.457], [10.614, 25.289], [9.199, 5.111], [3.096, 8.256], [4.895, 30.111]], target: 'locker-room' },
            { points: [[15.773, 26.966], [24.175, 21.987], [32.99, 17.27], [35.761, 17.218], [42.276, 19.629], [20.637, 34.985]], target: 'yard-ptz' },
            { points: [[22.819, 37.553], [44.133, 20.834], [52.653, 24.451], [62.176, 29.639], [72.199, 34.985], [77.211, 38.339], [69.723, 48.979], [59.788, 62.553], [54.039, 69.628], [45.725, 67.846], [39.269, 59.408], [28.332, 45.572]], target: 'yard' },
        ],
        'den-ptz': [
            { points: [[87.994, 97.165], [87.665, 14.553], [0.188, 12.21], [0.141, 0.575], [99.623, 0.492], [99.812, 96.411]], target: 'den' },
            { points: [[0.088, 13.1], [-0.011, 95.721], [87.632, 96.332], [87.533, 84.978], [6.13, 85.502], [6.474, 12.926]], target: 'lounge' },
        ],
        'yard-ptz': [
            { points: [[0.094, 13.967], [99.765, 14.218], [99.718, -0.01], [0.141, -0.01]], target: 'yard' },
        ],
        'yard': [
            { points: [[39.977, -0.077], [39.888, 13.916], [55.543, 14.073], [55.366, 0.08]], target: 'yard-ptz' },
            { points: [[92.276, 15.803], [91.627, 25.08], [90.153, 38.601], [95.902, 42.742], [97.376, 30.949], [98.113, 20.048]], target: 'flat' },
        ],
        'flat': [
            { points: [[82.392, 31.879], [83.239, 16.562], [83.663, 16.227], [84.369, 6.853], [78.107, 4.76], [77.401, 0.073], [84.981, 0.157], [92.608, 3.589], [92.702, 21.5], [91.478, 37.152]], target: 'den' },
            { points: [[99.906, 24.262], [94.774, 27.61], [92.75, 35.06], [89.689, 46.526], [86.723, 64.773], [87.806, 82.35], [94.915, 95.658], [99.859, 98.504]], target: 'bar' },
            { points: [[82.533, 73.394], [80.132, 96.328], [60.782, 84.108], [67.514, 81.178], [60.075, 52.804], [70.48, 49.874], [77.637, 75.654]], target: 'yard' },
        ],
        'confessional': [
            { points: [[0.282, 98.002], [11.911, 97.834], [12.382, -0.01], [0.188, 0.073]], target: 'den' },
        ],
        'bar': [
            { points: [[75.793, 0.182], [59.743, 0.182], [56.872, 5.287], [57.436, 21.513], [66.255, 27.438], [68.306, 25.068]], target: 'den' },
            { points: [[1.288, 69.553], [1.34, 63.263], [1.75, 52.78], [2.468, 42.844], [3.339, 33.181], [4.878, 30.356], [11.646, 23.701], [23.286, 13.765], [31.131, 8.478], [38.45, 3.434], [56.506, 9.837], [56.916, 17.781], [51.673, 21.348], [41.003, 29.535], [30.288, 38.775], [19.528, 49.07], [12.46, 56.608]], target: 'flat' },
            { points: [[8.159, 87.056], [0.776, 84.686], [4.775, 69.553], [5.647, 73.564], [18.158, 61.714], [21.235, 71.923], [7.8, 83.5]], target: 'yard' },
        ],
        'lounge': [
            { points: [[78.74, 11.965], [81.294, 13.275], [79.771, 25.939], [77.315, 24.279]], target: 'confessional' },
            { points: [[84.684, 28.472], [86.305, 17.991], [89.99, 21.397], [88.27, 31.092]], target: 'dining-room' },
            { points: [[92.2, 20.262], [89.351, 33.45], [96.425, 38.777], [99.471, 24.105]], target: 'den-ptz' },
            { points: [[70.683, 52.314], [85.666, 36.943], [82.375, 32.926], [75.645, 27.948], [69.356, 25.677], [62.773, 26.288], [60.268, 49.52]], target: 'den' },
            { points: [[68.816, 23.144], [64.051, 12.227], [64.984, 1.31], [71.125, 4.716], [67.539, 7.86], [72.107, 17.817], [71.862, 23.755]], target: 'deck' },
            { points: [[63.903, 13.362], [68.177, 23.144], [66.114, 22.969], [63.216, 21.223]], target: 'flat' },
        ],
    },
};

// ── State ───────────────────────────────────────────────────────────

let playerEl = null;
let videoEl = null;
let onNavigate = null;
let currentRoom = null;
let resizeObserver = null;
let editing = false;
let draftPoints = [];
let getSeason = () => getSetting('rerunSeason');
let getRooms = getSeasonRooms;

/**
 * Bind the zones module to a player. Call from the player builder —
 * re-binding to a new host replaces the previous binding.
 *
 * @param {HTMLElement} player - The focused player container
 * @param {HTMLVideoElement|null} video - The player's video element
 *   (null for a No Signal room — zones assume a 16:9 frame)
 * @param {Function} navigate - navigate(roomCode) switches rooms
 * @param {Object} [opts]
 * @param {Function} [opts.getSeason] - () => season code; defaults to
 *   the personal re-run's season setting
 * @param {Function} [opts.getRooms] - () => room codes for the editor's
 *   target picker; defaults to the personal re-run's season rooms
 * @param {HTMLElement} [opts.buttonMount] - where to put the Zones
 *   editor button when the player has no .ftl-rerun-player-bar (used
 *   when riding the site's own archive player)
 */
export function initZones(player, video, navigate, opts = {}) {
    playerEl = player;
    videoEl = video;
    onNavigate = navigate;
    getSeason = opts.getSeason || (() => getSetting('rerunSeason'));
    getRooms = opts.getRooms || getSeasonRooms;
    editing = false;
    draftPoints = [];
    videoEl?.addEventListener('loadedmetadata', layoutZones);
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(layoutZones);
    resizeObserver.observe(playerEl);

    // Zone editor toggle: our player bar, or a host-supplied mount
    const bar = playerEl.querySelector('.ftl-rerun-player-bar');
    if (bar || (opts.buttonMount && !opts.buttonMount.querySelector('[data-ftl-sdk="zones-btn"]'))) {
        const editBtn = siteTextButton(
            'Trace clickable door zones for this room',
            'Zones',
            () => setZoneEditing(!editing)
        );
        if (bar) {
            bar.insertBefore(editBtn, bar.querySelector('.ftl-rerun-spacer'));
        } else {
            editBtn.setAttribute('data-ftl-sdk', 'zones-btn');
            opts.buttonMount.appendChild(editBtn);
        }
    }
}

/**
 * Show zones for a room (or clear with null). Call on room change.
 */
export function setZonesRoom(room) {
    currentRoom = room;
    if (editing) setZoneEditing(false);
    renderZones();
}

/**
 * Re-render for the current room — used when the setting toggles.
 */
export function refreshZones() {
    renderZones();
}

// ── Rendering ───────────────────────────────────────────────────────

function getCustomZones() {
    return storage.get(CUSTOM_ZONES_KEY, {});
}

function getHiddenZones() {
    return storage.get(HIDDEN_ZONES_KEY, {});
}

// Identity key for a zone — used to match deletions against the
// built-in data without copying it into storage.
function zoneKey(zone) {
    return JSON.stringify({ points: zone.points, target: zone.target });
}

function getZonesForRoom(room) {
    if (!room || (!editing && !getSetting('rerunClickableZones'))) return [];
    const season = getSeason();
    const hidden = new Set(getHiddenZones()[season]?.[room] || []);
    const builtIn = (SEASON_ZONES[season]?.[room] || []).filter(z => !hidden.has(zoneKey(z)));
    const custom = (getCustomZones()[season]?.[room] || []).map(z => ({ ...z, custom: true }));
    const zones = [...builtIn, ...custom];
    // Only offer rooms that exist in this season's archive
    const known = getRooms();
    return known.length ? zones.filter(z => known.includes(z.target)) : zones;
}

function renderZones() {
    if (!playerEl) return;
    playerEl.querySelector(`#${CONTAINER_ID}`)?.remove();
    const zones = getZonesForRoom(currentRoom);
    if (!zones.length && !editing) return;

    // Wrapper positioned over the video's rendered content box
    // (computed in layoutZones); SVG stretches percentages to fill it.
    const wrapper = document.createElement('div');
    wrapper.id = CONTAINER_ID;
    wrapper.style.cssText = 'position:absolute;pointer-events:none;z-index:2;';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:100%;pointer-events:none;';

    // Labels are HTML, not SVG text: the SVG is stretched to the video
    // (preserveAspectRatio none), which would distort glyphs. HTML divs
    // at the polygon centroid stay undistorted and use the site's own
    // typography.
    const labelLayer = document.createElement('div');
    labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';

    for (const zone of zones) {
        const pts = zone.points.filter(p => p?.length > 1 && !isNaN(p[0]) && !isNaN(p[1]));
        if (pts.length < 3) continue;

        const polygon = document.createElementNS(SVG_NS, 'polygon');
        polygon.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        polygon.style.cssText = 'fill:transparent;stroke:transparent;stroke-width:0.5;transition:all 0.2s ease;';

        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const label = document.createElement('div');
        label.className = 'text-light-text text-lg font-bold leading-none whitespace-nowrap bg-dark rounded-md px-2 py-1';
        label.style.cssText = `position:absolute;left:${cx.toFixed(2)}%;top:${cy.toFixed(2)}%;`
            + 'transform:translate(-50%,-50%);opacity:0;transition:opacity 0.2s ease;';
        label.textContent = archives.formatRoomLabel(zone.target);

        const group = document.createElementNS(SVG_NS, 'g');
        group.style.cssText = 'pointer-events:all;cursor:pointer;';
        if (editing) {
            // Edit mode: zones always visible. Deletion is handled by
            // the draw surface (it sits above this SVG), which hit-tests
            // clicks against zones before starting a trace.
            polygon.style.fill = zone.custom ? 'rgba(216,183,74,0.2)' : 'rgba(255,255,255,0.12)';
            polygon.style.stroke = zone.custom ? 'rgba(216,183,74,0.7)' : 'rgba(255,255,255,0.4)';
            label.style.opacity = '1';
            group.style.pointerEvents = 'none';
        } else {
            group.addEventListener('mouseenter', () => {
                polygon.style.fill = 'rgba(216,183,74,0.12)';
                polygon.style.stroke = 'rgba(216,183,74,0.5)';
                label.style.opacity = '1';
            });
            group.addEventListener('mouseleave', () => {
                polygon.style.fill = 'transparent';
                polygon.style.stroke = 'transparent';
                label.style.opacity = '0';
            });
            group.addEventListener('click', (e) => {
                e.stopPropagation();
                onNavigate?.(zone.target);
            });
        }
        group.append(polygon);
        svg.appendChild(group);
        labelLayer.appendChild(label);
    }

    wrapper.appendChild(svg);
    wrapper.appendChild(labelLayer);
    if (editing) buildDrawSurface(wrapper);
    playerEl.appendChild(wrapper);
    layoutZones();
}

// ── Zone editor ─────────────────────────────────────────────────────
// Trace-your-own zones: click points around a doorway, click the
// first point again to close, pick the target room. Saved locally;
// "Copy JSON" exports the season's zones (built-in + yours) so they
// can be shared or baked into the extension as defaults.

/**
 * ESC hook for the editor: cancels the in-progress trace first, then
 * exits edit mode. Returns true if the event was consumed.
 */
export function handleZonesEscape() {
    if (!editing) return false;
    if (draftPoints.length) {
        draftPoints = [];
        renderZones();
    } else {
        setZoneEditing(false);
    }
    return true;
}

function setZoneEditing(enable) {
    editing = enable;
    draftPoints = [];
    playerEl?.querySelector(`#${EDITOR_ID}`)?.remove();
    if (enable) buildEditorToolbar();
    renderZones();
}

function buildEditorToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = EDITOR_ID;
    toolbar.style.cssText = `
        position:absolute; top:12px; left:50%; transform:translateX(-50%);
        display:flex; align-items:center; gap:10px; z-index:5;
        background:rgba(0,0,0,0.75); border:1px solid rgba(255,255,255,0.2);
        border-radius:8px; padding:8px 12px; font-size:13px; color:#eee;
    `;
    const hint = document.createElement('span');
    hint.textContent = 'Trace a doorway: click points, click the first point to close. Click a zone to delete it. Esc cancels.';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'ftl-rerun-btn';
    copyBtn.textContent = 'Copy JSON';
    copyBtn.title = 'Copy this season\'s zones (defaults + yours) to the clipboard';
    copyBtn.addEventListener('click', () => copyZonesJson(copyBtn));

    const resetBtn = document.createElement('button');
    resetBtn.className = 'ftl-rerun-btn';
    resetBtn.textContent = 'Reset Room';
    resetBtn.title = 'Restore this room\'s default zones and delete your custom ones';
    resetBtn.addEventListener('click', () => {
        if (confirm(`Reset ${archives.formatRoomLabel(currentRoom)} to its default zones? Your custom zones for this room will be deleted.`)) {
            resetRoomZones();
            renderZones();
        }
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'ftl-rerun-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => setZoneEditing(false));

    toolbar.append(hint, copyBtn, resetBtn, doneBtn);
    playerEl.appendChild(toolbar);
}

function buildDrawSurface(wrapper) {
    const surface = document.createElement('div');
    surface.style.cssText = 'position:absolute;inset:0;cursor:crosshair;pointer-events:all;z-index:3;';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:100%;pointer-events:none;';

    const draft = document.createElementNS(SVG_NS, 'polygon');
    draft.setAttribute('fill', 'rgba(0,255,0,0.1)');
    draft.setAttribute('stroke', '#0f0');
    draft.setAttribute('stroke-width', '0.4');

    const rubber = document.createElementNS(SVG_NS, 'line');
    rubber.setAttribute('stroke', '#0f0');
    rubber.setAttribute('stroke-dasharray', '1,1');
    rubber.setAttribute('stroke-width', '0.4');

    const startDot = document.createElementNS(SVG_NS, 'circle');
    startDot.setAttribute('r', '1.2');
    startDot.setAttribute('fill', '#0f0');
    startDot.setAttribute('stroke', '#000');
    startDot.setAttribute('stroke-width', '0.2');
    startDot.style.display = 'none';

    svg.append(draft, rubber, startDot);
    surface.appendChild(svg);

    const toPct = (e) => {
        const rect = surface.getBoundingClientRect();
        return [
            +((e.clientX - rect.left) / rect.width * 100).toFixed(3),
            +((e.clientY - rect.top) / rect.height * 100).toFixed(3),
        ];
    };

    surface.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playerEl.querySelector('.ftl-rerun-zone-form')) return;
        const [x, y] = toPct(e);
        // Before starting a trace, a click inside an existing zone
        // offers deletion (the surface occludes the zone SVG). Custom
        // zones win the hit-test where they overlap a default; deleted
        // defaults are recorded as hidden so Reset Room can restore them.
        if (draftPoints.length === 0) {
            const zones = getZonesForRoom(currentRoom);
            const hit = zones.filter(z => z.custom).find(z => pointInPolygon([x, y], z.points))
                || zones.find(z => pointInPolygon([x, y], z.points));
            if (hit) {
                const label = archives.formatRoomLabel(hit.target);
                if (hit.custom) {
                    if (confirm(`Delete your zone to ${label}?`)) {
                        deleteCustomZone(hit);
                        renderZones();
                    }
                } else if (confirm(`Remove the default zone to ${label}? Reset Room brings the defaults back.`)) {
                    hideBuiltInZone(hit);
                    renderZones();
                }
                return;
            }
        }
        if (draftPoints.length > 2
            && Math.hypot(x - draftPoints[0][0], y - draftPoints[0][1]) < 3) {
            showTargetForm([...draftPoints]);
            return;
        }
        draftPoints.push([x, y]);
        draft.setAttribute('points', draftPoints.map(p => p.join(',')).join(' '));
        if (draftPoints.length === 1) {
            startDot.setAttribute('cx', x);
            startDot.setAttribute('cy', y);
            startDot.style.display = 'block';
        }
    });

    surface.addEventListener('mousemove', (e) => {
        if (!draftPoints.length) return;
        const [x, y] = toPct(e);
        const last = draftPoints[draftPoints.length - 1];
        rubber.setAttribute('x1', last[0]);
        rubber.setAttribute('y1', last[1]);
        const closing = draftPoints.length > 2
            && Math.hypot(x - draftPoints[0][0], y - draftPoints[0][1]) < 3;
        rubber.setAttribute('x2', closing ? draftPoints[0][0] : x);
        rubber.setAttribute('y2', closing ? draftPoints[0][1] : y);
        startDot.setAttribute('fill', closing ? '#ff0' : '#0f0');
        startDot.setAttribute('r', closing ? '2' : '1.2');
    });

    surface.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleZonesEscape();
    });

    wrapper.appendChild(surface);
}

function showTargetForm(points) {
    const form = document.createElement('div');
    form.className = 'ftl-rerun-zone-form';
    form.style.cssText = `
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        display:flex; flex-direction:column; gap:10px; z-index:6; width:260px;
        background:rgba(15,15,15,0.95); border:1px solid rgba(255,255,255,0.2);
        border-radius:8px; padding:14px; font-size:13px; color:#eee;
    `;
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.textContent = 'Where does this doorway lead?';

    const select = document.createElement('select');
    select.style.cssText = 'padding:6px;background:#222;color:#eee;border:1px solid #555;border-radius:6px;';
    for (const room of getRooms()) {
        if (room === currentRoom) continue;
        const opt = document.createElement('option');
        opt.value = room;
        opt.textContent = archives.formatRoomLabel(room);
        select.appendChild(opt);
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ftl-rerun-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        form.remove();
        draftPoints = [];
        renderZones();
    });
    const saveBtn = document.createElement('button');
    saveBtn.className = 'ftl-rerun-btn';
    saveBtn.textContent = 'Save Zone';
    saveBtn.addEventListener('click', () => {
        saveCustomZone(points, select.value);
        form.remove();
        draftPoints = [];
        renderZones();
    });
    row.append(cancelBtn, saveBtn);

    form.append(title, select, row);
    playerEl.appendChild(form);
}

/**
 * Ray-casting point-in-polygon test ([x, y] against [[x, y], ...]).
 */
function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

// ── Custom zone storage ─────────────────────────────────────────────

function saveCustomZone(points, target) {
    const season = getSeason();
    const custom = getCustomZones();
    custom[season] = custom[season] || {};
    custom[season][currentRoom] = custom[season][currentRoom] || [];
    custom[season][currentRoom].push({ points, target });
    storage.set(CUSTOM_ZONES_KEY, custom);
}

function deleteCustomZone(zone) {
    const season = getSeason();
    const custom = getCustomZones();
    const list = custom[season]?.[currentRoom];
    if (!list) return;
    const key = zoneKey(zone);
    custom[season][currentRoom] = list.filter(z => zoneKey(z) !== key);
    storage.set(CUSTOM_ZONES_KEY, custom);
}

function hideBuiltInZone(zone) {
    const season = getSeason();
    const hidden = getHiddenZones();
    hidden[season] = hidden[season] || {};
    hidden[season][currentRoom] = hidden[season][currentRoom] || [];
    hidden[season][currentRoom].push(zoneKey(zone));
    storage.set(HIDDEN_ZONES_KEY, hidden);
}

/**
 * Restore the current room to its built-in zones: un-hides deleted
 * defaults and removes the user's custom zones for the room.
 */
function resetRoomZones() {
    const season = getSeason();
    const hidden = getHiddenZones();
    if (hidden[season]?.[currentRoom]) {
        delete hidden[season][currentRoom];
        storage.set(HIDDEN_ZONES_KEY, hidden);
    }
    const custom = getCustomZones();
    if (custom[season]?.[currentRoom]) {
        delete custom[season][currentRoom];
        storage.set(CUSTOM_ZONES_KEY, custom);
    }
}

function copyZonesJson(button) {
    const season = getSeason();
    const merged = {};
    const builtIn = SEASON_ZONES[season] || {};
    const custom = getCustomZones()[season] || {};
    const hidden = getHiddenZones()[season] || {};
    for (const room of new Set([...Object.keys(builtIn), ...Object.keys(custom)])) {
        const hiddenSet = new Set(hidden[room] || []);
        merged[room] = [
            ...(builtIn[room] || []).filter(z => !hiddenSet.has(zoneKey(z)))
                .map(z => ({ points: z.points, target: z.target })),
            ...(custom[room] || []).map(z => ({ points: z.points, target: z.target })),
        ];
    }
    const json = JSON.stringify(merged, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = 'Copy JSON'; }, 2000);
    }).catch(() => {
        prompt('Copy the zones JSON below:', json);
    });
}

/**
 * Size the wrapper to the video's rendered content box, accounting
 * for object-fit: contain letterboxing.
 */
function layoutZones() {
    if (!playerEl) return;
    const wrapper = playerEl.querySelector(`#${CONTAINER_ID}`);
    if (!wrapper) return;
    // Layout metrics, NOT getBoundingClientRect(): the site animates
    // its focused player with a transform scale, so a mid-animation
    // rect would bake the scaled size in permanently (ResizeObserver
    // doesn't fire on transforms). Client sizes are transform-proof.
    const boxW = playerEl.clientWidth;
    const boxH = playerEl.clientHeight;
    if (!boxW || !boxH) return;
    const boxAspect = boxW / boxH;
    // No video loaded (No Signal) → assume the archive's 16:9 frame so
    // zones still sit where the picture would be and remain clickable.
    const vidAspect = (videoEl?.videoWidth && videoEl?.videoHeight)
        ? videoEl.videoWidth / videoEl.videoHeight
        : 16 / 9;
    const width = boxAspect > vidAspect ? boxH * vidAspect : boxW;
    const height = boxAspect > vidAspect ? boxH : boxW / vidAspect;
    Object.assign(wrapper.style, {
        width: `${width}px`,
        height: `${height}px`,
        left: `${(boxW - width) / 2}px`,
        top: `${(boxH - height) / 2}px`,
    });
}

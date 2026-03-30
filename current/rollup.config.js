const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');

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
    ],
};
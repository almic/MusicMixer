const package = require('../package.json');
const esbuild = require('esbuild');

const platform = 'node';
const target = 'node22.0.0';

const result = esbuild.buildSync({
    globalName: 'MusicMixer',
    entryPoints: ['src/main.ts'],
    outfile: 'dist/musicmixer.min.js',

    charset: 'utf8',
    format: 'iife',
    platform,
    target,

    bundle: true,
    minify: true,
    banner: {
        js: `\
/**
 * Music Mixer v${package.version}, authors: ${package.authors.join(', ')}
 * Bundled for ${platform}, target: ${target}
 *
 * Time: ${new Date().toISOString()}
 * License: ${package.license}
 */
`,
    },
});

if (result.errors.length) {
    result.errors = esbuild.formatMessagesSync(result.errors, { kind: 'error', color: true });
    for (const error of result.errors) {
        console.error(error);
    }
}

if (result.warnings.length) {
    result.warnings = esbuild.formatMessagesSync(result.warnings, { kind: 'warning', color: true });
    for (const warning of result.warnings) {
        console.warn(warning);
    }
}

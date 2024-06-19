const esbuild = require('esbuild');

const result = esbuild.buildSync({
    entryPoints: ['src/main.ts'],
    bundle: true,
    minify: true,
    outfile: 'dist/MusicMixer.min.js',
    platform: 'node',
    target: 'node21.1.0',
});

console.log(result);

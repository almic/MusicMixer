//@ts-check

/** @type import('dts-bundle-generator/config-schema').BundlerConfig */
const config = {
    compilationOptions: {
        preferredConfigPath: './tsconfig.json',
    },
    entries: [
        {
            filePath: './src/main.ts',
            outFile: './musicmixer.d.ts',
            output: {
                inlineDeclareGlobals: true,
                exportReferencedTypes: false,
                umdModuleName: 'MusicMixer',
            },
            libraries: {
                importedLibraries: ['node', 'typescript'],
            },
        },
    ],
};

module.exports = config;

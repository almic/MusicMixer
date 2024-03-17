/**
 * AudioSource options
 */
type AudioSourceOptions = {
    volume?: number;
    panning?: number;
};

/**
 * AudioSource
 */
class AudioSource {
    constructor() {}

    connect(destination: AudioNode) {
        console.log(`stub connect to ${destination}`);
    }

    load(path: string) {
        console.log(`stub load path ${path}`);
    }

    options(options: AudioSourceOptions): void {
        console.log(`stub options set to ${options}`);
    }
}

export default AudioSource;

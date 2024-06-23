/** Callback receiving an {@link AudioBuffer} */
export type LoadAudioCallback = (buffer: AudioBuffer) => any;

/**
 * Simple cache for {@link AudioBuffer audio buffers}
 */
export class AudioSourceCache {
    private _bufferCache: { [key: string]: AudioBuffer };

    /**
     * Do not construct this directly, get a cache by invoking
     * `getAudioCache()` on your Mixer object.
     */
    constructor(private readonly audioContext: AudioContext) {
        this._bufferCache = {};
    }

    /**
     * Get an audio buffer from the cache if it exists, `null` if it does not
     *
     * @param path audio path
     * @returns the loaded {@link AudioBuffer} if it exists
     */
    public getAudio(path: string): AudioBuffer | null {
        return this._bufferCache[path] ?? null;
    }

    /**
     * Test if a given audio path, or many, are loaded into the cache
     *
     * @param paths one or many audio paths to check
     * @returns `true` if the audio paths exist in the cache, `false` otherwise
     */
    public isAudioLoaded(...paths: string[]): boolean {
        for (const path of paths) {
            if (!(path in this._bufferCache)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Loads an audio source, retrieving from the cache if it's available, and
     * passing the AudioBuffer to the callback. If the buffer exists in the
     * cache, the callback is immediately invoked with the buffer.
     *
     * @param path audio source to load
     * @param callback callback provided with the AudioBuffer when complete
     */
    public loadAudio(path: string, callback: LoadAudioCallback): void;
    /**
     * Loads an audio source, retrieving from the cache if it's available, or
     * optionally invalidating the cache and reloading from the file system.
     * If the buffer exists in the cache, the callback is immediately invoked
     * with the buffer.
     *
     * @param path audio source to load
     * @param invalidate skip the cache and reload the source
     * @param callback callback provided with the AudioBuffer when complete
     */
    public loadAudio(path: string, invalidate: boolean, callback: LoadAudioCallback): void;
    loadAudio(
        path: string,
        callbackOrInvalidate: boolean | LoadAudioCallback,
        callback: LoadAudioCallback = () => {},
    ): void {
        let invalidate: boolean = false;
        if (typeof callbackOrInvalidate == 'boolean') {
            invalidate = callbackOrInvalidate;
        } else if (typeof callbackOrInvalidate == 'function') {
            callback = callbackOrInvalidate;
        }

        if (!invalidate && path in this._bufferCache) {
            callback(this._bufferCache[path]!);
            return;
        }

        this.loadAudioAsync(path, invalidate).then(callback);
    }

    /**
     * Loads an audio source, retrieving from the cache if it's available, or
     * optionally invalidating the cache and reloading from the file system.
     *
     * @param path audio source to load
     * @param invalidate skip the cache and reload the source
     * @returns an {@link AudioBuffer}
     */
    public async loadAudioAsync(path: string, invalidate: boolean = false): Promise<AudioBuffer> {
        if (!invalidate && path in this._bufferCache) {
            return this._bufferCache[path]!;
        }
        const audioFile = await fetch(path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this._bufferCache[path] = decodedBuffer;
        return decodedBuffer;
    }

    /**
     * Unloads an audio buffer from the cache, allowing it to be released.
     * Pass no path to unload the entire cache.
     *
     * @param path specific path to unload
     */
    public unloadAudio(path?: string): void {
        if (typeof path == 'string') {
            delete this._bufferCache[path];
        } else {
            this._bufferCache = {};
        }
    }
}

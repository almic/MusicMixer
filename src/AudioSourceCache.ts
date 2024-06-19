import AudioSourceNode from './AudioSourceNode.js';

export class AudioSourceCache {
    private _bufferCache: { [key: string]: AudioBuffer };

    /**
     * Do not construct this directly, get a cache by invoking
     * `getAudioCache()` on your MusicMixer object.
     */
    constructor(private readonly audioContext: AudioContext) {
        this._bufferCache = {};
    }

    /**
     * Loads an audio source, retrieving from the cache if it's available, or
     * optionally invalidating the cache and reloading from the file system.
     *
     * @param path audio source to load
     * @param invalidate skip the cache and reload the source
     * @returns an {@link AudioSourceNode}
     */
    public async loadAudio(path: string, invalidate: boolean = false): Promise<AudioSourceNode> {
        let buffer: AudioBuffer;
        if (!invalidate && path in this._bufferCache) {
            buffer = this._bufferCache[path]!;
        } else {
            const audioFile = await fetch(path);
            const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
            this._bufferCache[path] = decodedBuffer;
            buffer = decodedBuffer;
        }

        const node = new AudioSourceNode(this.audioContext, this);
        node.buffer = buffer;
        return node;
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

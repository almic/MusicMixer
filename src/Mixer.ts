import { AudioSourceCache } from './AudioSourceCache.js';
import AudioSourceNode from './AudioSourceNode.js';
import TrackSingle, { Track, TrackGroup } from './Track.js';
import automation, { AudioAdjustmentOptions } from './automation.js';
import buildOptions from './defaults.js';
import * as defaults from './defaults.js';

/**
 * Mixer
 */
class Mixer {
    private readonly audioContext: AudioContext;
    private readonly gainNode: GainNode;
    private cache: AudioSourceCache | null;
    private tracks: {
        [name: string]: Track;
    } = {};

    constructor(options?: AudioContextOptions) {
        this.audioContext = new AudioContext(options);
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.cache = null;
    }

    /**
     * Allows receiving the output of the entire Mixer, this is strictly intended to be used by
     * AnalyserNode for visualization. Advanced users only!
     *
     * @param destination the {@link AudioNode} or {@link AudioParam} to which to connect
     * @param outputIndex the output index to use, should be 0
     * @param inputIndex the input index into the {@link AudioNode} or {@link AudioParam}
     */
    public connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    public connect(destination: AudioParam, outputIndex?: number): void;
    public connect(
        destination: AudioNode | AudioParam,
        outputIndex?: number,
        inputIndex?: number,
    ): AudioNode | void {
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        } else if (destination instanceof AudioParam) {
            return this.gainNode.connect(destination, outputIndex);
        } else {
            console.warn(
                `Cannot connect to type ${(destination as any)?.constructor?.name}. This is likely a mistake.`,
            );
        }
    }

    /**
     * Get the audio source cache for this Mixer. Highly recommended.
     *
     * Whenever you need to load audio, you should always use the cache.
     * Be sure you understand how it works! The cache will keep all loaded
     * audio forever, until you deliberately ask it to release resources.
     *
     * @returns an {@link AudioSourceCache}
     */
    public getAudioCache(): AudioSourceCache {
        if (!this.cache) {
            this.cache = new AudioSourceCache(this.audioContext);
        }
        return this.cache;
    }

    /**
     * Create an audio source from this Mixer context.
     *
     * @returns {AudioSourceNode}
     */
    public newSource(): AudioSourceNode;
    /**
     * Create an audio source from this Mixer context, loading the given
     * source path on the returned node. This load will happen asynchronously,
     * so you can attach a load listener that will receive a load event.
     *
     * @param path optional path to sound source
     * @returns {AudioSourceNode}
     */
    public newSource(path?: string): AudioSourceNode;
    public newSource(path?: string): AudioSourceNode {
        const audioSource = new AudioSourceNode(this.audioContext, this);
        if (path) {
            audioSource.load(path);
        }
        return audioSource;
    }

    /**
     * Create a new track, without any {@link AudioSourceNode}, allowing you to
     * provide one later.
     *
     * @param name name for the track
     * @returns {Track} the new Track
     */
    public newTrack(name: string): Track;
    /**
     * Create a new track, initializing an {@link AudioSourceNode} by loading
     * the provided `path` source. You can access the node with
     * {@link Track#getLoadedSource}, which is guaranteed to exist, and listen
     * for the loading event on the node.
     *
     * @param name name for the track
     * @param path path for an {@link AudioSourceNode}
     * @returns {Track} the new Track
     */
    public newTrack(name: string, path: string): Track;
    /**
     * Create a new track, passing the provided {@link AudioSourceNode} to the
     * {@link Track#loadSource} method.
     *
     * @param name name for the track
     * @param source {@link AudioSourceNode} for the track
     * @returns {Track} the new Track
     */
    public newTrack(name: string, source: AudioSourceNode): Track;
    public newTrack(name: string, pathOrSource?: string | AudioSourceNode): Track {
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this mixer`);
        }
        let track: Track;
        if (typeof pathOrSource == 'string') {
            track = new TrackSingle(name, this.audioContext, this.gainNode, this.newSource(pathOrSource));
        } else if (pathOrSource instanceof AudioSourceNode) {
            track = new TrackSingle(name, this.audioContext, this.gainNode, pathOrSource);
        } else {
            track = new TrackSingle(name, this.audioContext, this.gainNode);
        }
        this.tracks[name] = track;
        return track;
    }

    /**
     * Create a new track group, without any {@link AudioSourceNode}, allowing
     * you to provide one later.
     *
     * @param name name for the track group
     * @returns {TrackGroup} the new TrackGroup
     */
    public newTrackGroup(name: string): TrackGroup;
    /**
     * Create a new track group, initializing an {@link AudioSourceNode} by
     * loading the provided `path` source. You can access the node with
     * {@link TrackGroup#getLoadedSource}, which is guaranteed to exist, and
     * listen for the loading event on the node.
     *
     * @param name name for the track group
     * @param path path for an {@link AudioSourceNode}
     * @returns the new {@link TrackGroup}
     */
    public newTrackGroup(name: string, path: string): TrackGroup;
    /**
     * Create a new track group, passing the provided {@link AudioSourceNode} to the
     * {@link TrackGroup#loadSource} method.
     *
     * @param name name for the track group
     * @param source {@link AudioSourceNode} for the track group
     * @returns the new {@link TrackGroup}
     */
    public newTrackGroup(name: string, source: AudioSourceNode): TrackGroup;
    public newTrackGroup(name: string, pathOrSource?: string | AudioSourceNode): TrackGroup {
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this mixer`);
        }
        let track: TrackGroup;
        if (typeof pathOrSource == 'string') {
            track = new TrackGroup(name, this.audioContext, this.gainNode, this.newSource(pathOrSource));
        } else if (pathOrSource instanceof AudioSourceNode) {
            track = new TrackGroup(name, this.audioContext, this.gainNode, pathOrSource);
        } else {
            track = new TrackGroup(name, this.audioContext, this.gainNode);
        }
        this.tracks[name] = track;
        return track;
    }

    /**
     * Retrieve a track by its name. If the name points to a {@link TrackGroup}
     * then you will receive that group.
     *
     * @param name track name
     * @returns any {@link Track} with the given name, `undefined` otherwise
     */
    public track(name: string): Track | undefined {
        return this.tracks[name];
    }

    /**
     * Retrieve a track group by its name. Guarantees that a non-null result is
     * a {@link TrackGroup}.
     *
     * @param name track group name
     * @returns the {@link TrackGroup} with the given name, `undefined` otherwise
     */
    public trackGroup(name: string): TrackGroup | undefined {
        const track = this.track(name);
        return track instanceof TrackGroup ? track : undefined;
    }

    /**
     * Set the volume of this mixer, the "master volume"
     *
     * @param volume gain multiplier
     * @param options adjustment parameters
     * @returns {Mixer} this Mixer
     */
    public volume(volume: number, options?: AudioAdjustmentOptions): Mixer {
        const adjustment = buildOptions(options, defaults.automationDefault);

        automation(this.audioContext, this.gainNode.gain, volume, adjustment);

        return this;
    }

    get context(): AudioContext {
        return this.audioContext;
    }

    get currentTime(): number {
        return this.audioContext.currentTime;
    }
}

export default Mixer;

import { AudioSourceCache } from './AudioSourceCache.js';
import AudioSourceNode from './AudioSourceNode.js';
import TrackSingle, { Track, TrackGroup } from './Track.js';
import automation, { AudioAdjustmentOptions } from './automation.js';
import buildOptions from './defaults.js';
import * as defaults from './defaults.js';

/**
 * MusicMixer
 */
class MusicMixer {
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
     * Get the audio source cache for this MusicMixer. Highly recommended.
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
     * Create an audio source from this MusicMixer context.
     *
     * @param path optional path to sound source
     * @returns {AudioSourceNode}
     */
    public loadSource(path?: string): AudioSourceNode {
        const audioSource = new AudioSourceNode(this.audioContext, this);
        if (path) {
            audioSource.load(path);
        }
        return audioSource;
    }

    /**
     * Create a new track, initializing an {@link AudioSourceNode} if one isn't provided.
     *
     * @param name name for the track
     * @param path optional path for an AudioSource, only used if a source isn't provided
     * @param source optional AudioSource for the track
     * @returns {Track} the new Track
     */
    public newTrack(name: string, path?: string, source?: AudioSourceNode): Track {
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this mixer`);
        }
        let audioSource = source;
        if (!audioSource) {
            audioSource = this.loadSource(path);
        }
        const track = new TrackSingle(name, this.audioContext, this.gainNode, audioSource);
        this.tracks[name] = track;
        return track;
    }

    /**
     * Create a new track group, initializing an {@link AudioSourceNode} if one isn't provided.
     *
     * @param name name for the track group
     * @param path optional path for an AudioSource, only used if a source isn't provided
     * @param source optional AudioSource for the track
     * @returns {TrackGroup} the new TrackGroup
     */
    public newTrackGroup(name: string, path?: string, source?: AudioSourceNode): TrackGroup {
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this mixer`);
        }
        let audioSource = source;
        if (!audioSource) {
            audioSource = this.loadSource(path);
        }
        const track = new TrackGroup(name, this.audioContext, this.gainNode, audioSource);
        this.tracks[name] = track;
        return track;
    }

    /**
     * Retrieve a track by its name.
     *
     * @param name track name
     * @returns {Track} if found, `undefined` otherwise
     */
    public track(name: string): Track | undefined {
        return this.tracks[name];
    }

    /**
     * Retrieve a track group by its name.
     *
     * @param name track group name
     * @returns {TrackGroup} if found, `undefined` otherwise
     */
    public trackGroup(name: string): TrackGroup | undefined {
        const track = this.track(name);
        return track instanceof TrackGroup ? track : undefined;
    }

    /**
     * Set the volume of this mixer, the "master volumen."
     * @param volume gain multiplier
     * @param options adjustment parameters
     * @returns {MusicMixer} this MusicMixer
     */
    public volume(volume: number, options?: AudioAdjustmentOptions): MusicMixer {
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

export default MusicMixer;

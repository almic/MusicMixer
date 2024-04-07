import AudioSourceNode from './AudioSourceNode.js';
import TrackSingle, { Track, TrackGroup } from './Track.js';
import automation, { AudioAdjustmentOptions } from './automation.js';
import buildOptions from './defaults.js';
import * as defaults from './defaults.js';

/**
 * MusicMixer
 */
class MusicMixer {
    private readonly audioContext: AudioContext = new AudioContext();
    private readonly gainNode: GainNode;
    private tracks: {
        [name: string]: Track;
    } = {};

    constructor() {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    /**
     * Create an audio source from this MusicMixer context.
     *
     * @param path optional path to sound source
     * @returns {AudioSourceNode}
     */
    public loadSource(path?: string): AudioSourceNode {
        const audioSource = new AudioSourceNode(this.audioContext);
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

    get currentTime(): number {
        return this.audioContext.currentTime;
    }
}

export default MusicMixer;

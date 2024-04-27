import AudioSourceNode from './AudioSourceNode.js';
import { Track, TrackGroup } from './Track.js';
import { AudioAdjustmentOptions } from './automation.js';
/**
 * MusicMixer
 */
declare class MusicMixer {
    private readonly audioContext;
    private readonly gainNode;
    private tracks;
    constructor(options?: AudioContextOptions);
    /**
     * Create an audio source from this MusicMixer context.
     *
     * @param path optional path to sound source
     * @returns {AudioSourceNode}
     */
    loadSource(path?: string): AudioSourceNode;
    /**
     * Create a new track, initializing an {@link AudioSourceNode} if one isn't provided.
     *
     * @param name name for the track
     * @param path optional path for an AudioSource, only used if a source isn't provided
     * @param source optional AudioSource for the track
     * @returns {Track} the new Track
     */
    newTrack(name: string, path?: string, source?: AudioSourceNode): Track;
    /**
     * Create a new track group, initializing an {@link AudioSourceNode} if one isn't provided.
     *
     * @param name name for the track group
     * @param path optional path for an AudioSource, only used if a source isn't provided
     * @param source optional AudioSource for the track
     * @returns {TrackGroup} the new TrackGroup
     */
    newTrackGroup(name: string, path?: string, source?: AudioSourceNode): TrackGroup;
    /**
     * Retrieve a track by its name.
     *
     * @param name track name
     * @returns {Track} if found, `undefined` otherwise
     */
    track(name: string): Track | undefined;
    /**
     * Retrieve a track group by its name.
     *
     * @param name track group name
     * @returns {TrackGroup} if found, `undefined` otherwise
     */
    trackGroup(name: string): TrackGroup | undefined;
    /**
     * Set the volume of this mixer, the "master volumen."
     * @param volume gain multiplier
     * @param options adjustment parameters
     * @returns {MusicMixer} this MusicMixer
     */
    volume(volume: number, options?: AudioAdjustmentOptions): MusicMixer;
    get context(): AudioContext;
    get currentTime(): number;
}
export default MusicMixer;

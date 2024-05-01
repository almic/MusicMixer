import AudioSourceNode from './AudioSourceNode.js';
import TrackSingle, { TrackGroup } from './Track.js';
import automation from './automation.js';
import buildOptions from './defaults.js';
import * as defaults from './defaults.js';
/**
 * MusicMixer
 */
class MusicMixer {
    audioContext;
    gainNode;
    tracks = {};
    constructor(options) {
        this.audioContext = new AudioContext(options);
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }
    connect(destination, outputIndex, inputIndex) {
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        else if (destination instanceof AudioParam) {
            return this.gainNode.connect(destination, outputIndex);
        }
        else {
            console.warn(`Cannot connect to type ${destination?.constructor?.name}. This is likely a mistake.`);
        }
    }
    /**
     * Create an audio source from this MusicMixer context.
     *
     * @param path optional path to sound source
     * @returns {AudioSourceNode}
     */
    loadSource(path) {
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
    newTrack(name, path, source) {
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
    newTrackGroup(name, path, source) {
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
    track(name) {
        return this.tracks[name];
    }
    /**
     * Retrieve a track group by its name.
     *
     * @param name track group name
     * @returns {TrackGroup} if found, `undefined` otherwise
     */
    trackGroup(name) {
        const track = this.track(name);
        return track instanceof TrackGroup ? track : undefined;
    }
    /**
     * Set the volume of this mixer, the "master volumen."
     * @param volume gain multiplier
     * @param options adjustment parameters
     * @returns {MusicMixer} this MusicMixer
     */
    volume(volume, options) {
        const adjustment = buildOptions(options, defaults.automationDefault);
        automation(this.audioContext, this.gainNode.gain, volume, adjustment);
        return this;
    }
    get context() {
        return this.audioContext;
    }
    get currentTime() {
        return this.audioContext.currentTime;
    }
}
export default MusicMixer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTXVzaWNNaXhlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9NdXNpY01peGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sZUFBZSxNQUFNLHNCQUFzQixDQUFDO0FBQ25ELE9BQU8sV0FBVyxFQUFFLEVBQVMsVUFBVSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzVELE9BQU8sVUFBc0MsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRSxPQUFPLFlBQVksTUFBTSxlQUFlLENBQUM7QUFDekMsT0FBTyxLQUFLLFFBQVEsTUFBTSxlQUFlLENBQUM7QUFFMUM7O0dBRUc7QUFDSCxNQUFNLFVBQVU7SUFDSyxZQUFZLENBQWU7SUFDM0IsUUFBUSxDQUFXO0lBQzVCLE1BQU0sR0FFVixFQUFFLENBQUM7SUFFUCxZQUFZLE9BQTZCO1FBQ3JDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9DLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekQsQ0FBQztJQVlNLE9BQU8sQ0FDVixXQUFtQyxFQUNuQyxXQUFvQixFQUNwQixVQUFtQjtRQUVuQixJQUFJLFdBQVcsWUFBWSxTQUFTLEVBQUUsQ0FBQztZQUNuQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkUsQ0FBQzthQUFNLElBQUksV0FBVyxZQUFZLFVBQVUsRUFBRSxDQUFDO1lBQzNDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQzNELENBQUM7YUFBTSxDQUFDO1lBQ0osT0FBTyxDQUFDLElB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
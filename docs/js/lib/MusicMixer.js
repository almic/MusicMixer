import AudioSourceNode from './AudioSourceNode.js';
import TrackSingle, { TrackGroup } from './Track.js';
import automation from './automation.js';
import buildOptions from './defaults.js';
import * as defaults from './defaults.js';
/**
 * MusicMixer
 */
class MusicMixer {
    audioContext = new AudioContext();
    gainNode;
    tracks = {};
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
    get currentTime() {
        return this.audioContext.currentTime;
    }
}
export default MusicMixer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTXVzaWNNaXhlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9NdXNpY01peGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sZUFBZSxNQUFNLHNCQUFzQixDQUFDO0FBQ25ELE9BQU8sV0FBVyxFQUFFLEVBQVMsVUFBVSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzVELE9BQU8sVUFBc0MsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRSxPQUFPLFlBQVksTUFBTSxlQUFlLENBQUM7QUFDekMsT0FBTyxLQUFLLFFBQVEsTUFBTSxlQUFlLENBQUM7QUFFMUM7O0dBRUc7QUFDSCxNQUFNLFVBQVU7SUFDSyxZQUFZLEdBQWlCLElBQUksWUFBWSxFQUFFLENBQUM7SUFDaEQsUUFBUSxDQUFXO0lBQzVCLE1BQU0sR0FFVixFQUFFLENBQUM7SUFFUDtRQUNJLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMvQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLFVBQVUsQ0FBQyxJQUFhO1FBQzNCLE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakUsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUNQLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ksUUFBUSxDQUFDLElBQVksRUFBRSxJQUFhLEVBQUUsTUFBd0I7UUFDakUsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUMxQyxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLHNDQUFzQyxDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUNELElBQUksV0FBVyxHQUFHLE1BQU0sQ0FBQztRQUN6QixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDZixXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBQ0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNuRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUMxQixPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNJLGFBQWEsQ0FBQyxJQUFZLEVBQUUsSUFBYSxFQUFFLE1BQXdCO1FBQ3RFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3BGLENBQUM7UUFDRCxJQUFJLFdBQVcsR0FBRyxNQUFNLENBQUM7UUFDekIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2YsV0FBVyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUNELE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7UUFDMUIsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLElBQVk7UUFDckIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLE1BQU0sQ0FBQyxNQUFjLEVBQUUsT0FBZ0M7UUFDMUQsTUFBTSxVQUFVLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVyRSxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFdEUsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVELElBQUksV0FBVztRQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUM7SUFDekMsQ0FBQztDQUNKO0FBRUQsZUFBZSxVQUFVLENBQUMifQ==
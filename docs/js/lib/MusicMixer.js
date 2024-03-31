import AudioSourceNode, { AudioRampType } from './AudioSourceNode.js';
import TrackSingle, { TrackGroup } from './Track.js';
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
        const currentValue = this.gainNode.gain.value;
        const difference = volume - currentValue;
        const adjustment = options ? buildOptions(options) : defaults.automationDefault;
        // Stop automations and immediately ramp.
        if (Math.abs(difference) < Number.EPSILON) {
            this.gainNode.gain.cancelAndHoldAtTime(this.currentTime);
            this.gainNode.gain.setValueAtTime(currentValue, this.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(volume, adjustment.delay + this.currentTime);
            return this;
        }
        this.gainNode.gain.cancelAndHoldAtTime(adjustment.delay + this.currentTime);
        this.gainNode.gain.setValueAtTime(currentValue, adjustment.delay + this.currentTime);
        if (Array.isArray(adjustment.ramp)) {
            const valueCurve = [];
            for (const markiplier of adjustment.ramp) {
                valueCurve.push(currentValue + difference * markiplier);
            }
            this.gainNode.gain.setValueCurveAtTime(valueCurve, adjustment.delay + this.currentTime, adjustment.duration);
            return this;
        }
        switch (adjustment.ramp) {
            case AudioRampType.EXPONENTIAL: {
                this.gainNode.gain.exponentialRampToValueAtTime(volume, adjustment.delay + adjustment.duration + this.currentTime);
                break;
            }
            case AudioRampType.LINEAR: {
                this.gainNode.gain.linearRampToValueAtTime(volume, adjustment.delay + adjustment.duration + this.currentTime);
                break;
            }
            case AudioRampType.NATURAL: {
                // Logarithmic approach to value, it is 95% the way there after 3 timeConstant, so we linearly ramp at that point
                const timeConstant = adjustment.duration / 4;
                this.gainNode.gain.setTargetAtTime(volume, adjustment.delay + this.currentTime, timeConstant);
                this.gainNode.gain.cancelAndHoldAtTime(adjustment.delay + timeConstant * 3 + this.currentTime);
                // The following event is implicitly added, per WebAudio spec.
                // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
                // this.gainNode.gain.setValueAtTime(currentValue + (difference * (1 - Math.pow(Math.E, -3))), timeConstant * 3 + this.currentTime);
                this.gainNode.gain.linearRampToValueAtTime(volume, adjustment.delay + adjustment.duration + this.currentTime);
                break;
            }
            default: {
                this.gainNode.gain.setValueAtTime(volume, adjustment.delay);
                break;
            }
        }
        return this;
    }
    get currentTime() {
        return this.audioContext.currentTime;
    }
}
export default MusicMixer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTXVzaWNNaXhlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9NdXNpY01peGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sZUFBZSxFQUFFLEVBQTBCLGFBQWEsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzlGLE9BQU8sV0FBVyxFQUFFLEVBQVMsVUFBVSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzVELE9BQU8sWUFBWSxNQUFNLGVBQWUsQ0FBQztBQUN6QyxPQUFPLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQUUxQzs7R0FFRztBQUNILE1BQU0sVUFBVTtJQUNLLFlBQVksR0FBaUIsSUFBSSxZQUFZLEVBQUUsQ0FBQztJQUNoRCxRQUFRLENBQVc7SUFDNUIsTUFBTSxHQUVWLEVBQUUsQ0FBQztJQUVQO1FBQ0ksSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9DLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksVUFBVSxDQUFDLElBQWE7UUFDM0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzNELElBQUksSUFBSSxFQUFFLENBQUM7WUFDUCxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUN2QixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNJLFFBQVEsQ0FBQyxJQUFZLEVBQUUsSUFBYSxFQUFFLE1BQXdCO1FBQ2pFLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxJQUFJLEtBQUss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
import AudioSourceNode, { AudioAdjustmentOptions, AudioRampType } from './AudioSourceNode';
import TrackSingle, { Track, TrackGroup } from './Track';
import buildOptions from './defaults';
import * as defaults from './defaults';

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
            this.gainNode.gain.setValueCurveAtTime(
                valueCurve,
                adjustment.delay + this.currentTime,
                adjustment.duration,
            );
            return this;
        }

        switch (adjustment.ramp) {
            case AudioRampType.EXPONENTIAL: {
                this.gainNode.gain.exponentialRampToValueAtTime(
                    volume,
                    adjustment.delay + adjustment.duration + this.currentTime,
                );
                break;
            }
            case AudioRampType.LINEAR: {
                this.gainNode.gain.linearRampToValueAtTime(
                    volume,
                    adjustment.delay + adjustment.duration + this.currentTime,
                );
                break;
            }
            case AudioRampType.NATURAL: {
                // Logarithmic approach to value, it is 95% the way there after 3 timeConstant, so we linearly ramp at that point
                const timeConstant = adjustment.duration / 4;
                this.gainNode.gain.setTargetAtTime(volume, adjustment.delay + this.currentTime, timeConstant);
                this.gainNode.gain.cancelAndHoldAtTime(
                    adjustment.delay + timeConstant * 3 + this.currentTime,
                );
                // The following event is implicitly added, per WebAudio spec.
                // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
                // this.gainNode.gain.setValueAtTime(currentValue + (difference * (1 - Math.pow(Math.E, -3))), timeConstant * 3 + this.currentTime);
                this.gainNode.gain.linearRampToValueAtTime(
                    volume,
                    adjustment.delay + adjustment.duration + this.currentTime,
                );
                break;
            }
            default: {
                this.gainNode.gain.setValueAtTime(volume, adjustment.delay);
                break;
            }
        }

        return this;
    }

    get currentTime(): number {
        return this.audioContext.currentTime;
    }
}

export default MusicMixer;

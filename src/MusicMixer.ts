import AudioSource, { AudioAdjustmentOptions } from './AudioSource';
import TrackSingle from './Track';
import { Track, TrackGroup } from './Track';

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

    private loadSource(path?: string): AudioSource {
        const audioSource = new AudioSource(this.audioContext);
        if (path) {
            audioSource.load(path);
        }
        return audioSource;
    }

    /**
     * Create a new track
     */
    newTrack(name: string, path?: string, source?: AudioSource): Track {
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
     * Create a new track group
     */
    newTrackGroup(name: string, path?: string, source?: AudioSource): TrackGroup {
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

    track(name: string): Track | undefined {
        return this.tracks[name];
    }

    /**
     * Adjusts the volume output of the mixer
     */
    volume(volume: number, options?: AudioAdjustmentOptions): MusicMixer {
        console.log(`stub volume changed to ${volume} with ${options}`);
        return this;
    }
}

export default MusicMixer;

import AudioSource from './AudioSource';
import TrackSingle from './Track';
import { Track, TrackGroup, AdjustmentOptions } from './Track';

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
     * Loads an audio source and returns it
     */
    static loadSource(path: string): AudioSource {
        console.log(`stub loading ${path} audio file`);
        return new AudioSource();
    }

    /**
     * Loads and audio source and queues immediate playback on a new track.
     * Returns the new track.
     */
    playSource(path?: string, source?: AudioSource): Track {
        console.log(`stub playing ${path} audio file or source ${source}`);
        return this.newTrack(path ?? 'unknown', path, source);
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
            audioSource = MusicMixer.loadSource(path ?? '');
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
            audioSource = MusicMixer.loadSource(path ?? '');
        }
        const track = new TrackGroup(name, this.audioContext, this.gainNode, audioSource);
        this.tracks[name] = track;
        return track;
    }

    /**
     * Adjusts the volume output of the mixer
     */
    volume(volume: number, options?: AdjustmentOptions): void {
        console.log(`stub volume changed to ${volume} with ${options}`);
    }
}

export default MusicMixer;

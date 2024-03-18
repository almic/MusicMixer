/**
 * Adjustment options to use when changing volume, panning, etc.
 */
export type AudioAdjustmentOptions = {
    ramp?: 'linear' | 'exponential' | 'natural' | number[];
    delay?: number;
    duration?: number;
};

/**
 * AudioSource
 */
class AudioSource {
    private sourceNode: AudioBufferSourceNode | undefined;
    private readonly gainNode: GainNode;
    private readonly stereoPannerNode: StereoPannerNode;

    constructor(private readonly audioContext: AudioContext, readonly destination?: AudioNode) {
        this.gainNode = audioContext.createGain();
        this.stereoPannerNode = audioContext.createStereoPanner();

        this.stereoPannerNode.connect(this.gainNode);
        if (destination) {
            this.gainNode.connect(destination);
        }
    }

    connect(destination: AudioNode): AudioSource {
        this.gainNode.disconnect();
        this.gainNode.connect(destination);
        return this;
    }

    async load(path: string): Promise<void> {
        const buffer = await fetch(path);
        const arrayBuffer = await buffer.arrayBuffer();
        const decodedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        const sourceNode = this.audioContext.createBufferSource();
        sourceNode.buffer = decodedBuffer;
        this.sourceNode = sourceNode;
        this.sourceNode.connect(this.gainNode);
    }

    volume(volume: number, options?: AudioAdjustmentOptions): AudioSource {
        console.log(`stub volume ${volume} with options ${options}`);
        return this;
    }

    pan(pan: number, options?: AudioAdjustmentOptions): AudioSource {
        console.log(`stub pan ${pan} with options ${options}`);
        return this;
    }

    pan3d(): AudioSource {
        // TODO: ...someday...
        // https://github.com/twoz/hrtf-panner-js/blob/master/hrtf.js
        return this;
    }
}

export default AudioSource;

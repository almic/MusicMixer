/**
 * Ramp types for audio adjustments
 */
export enum AudioRampType {
    /**
     * Linear ramp
     */
    LINEAR = 'linear',

    /**
     * Exponential ramp
     */
    EXPONENTIAL = 'exponential',

    /**
     * Natural ramp. Depending on the adjustment being made, this will either be a
     * logarithmic adjustment, or an equal-power adjustment. In general, this option
     * will produce the best sounding results compared to the other options, and in
     * general should always be preferred over the others.
     */
    NATURAL = 'natural',
}

/**
 * Adjustment options to use when changing volume, panning, etc.
 */
export type AudioAdjustmentOptions = {
    /**
     * Ramping method to use. Use 'natural' option for good equal power crossfading.
     * Supports a custom ramp by providing an array of numbers, where 0 is the initial state, and
     * 1 is the adjusted state. Going below 0 or above 1 does what you would expect, going beyond
     * the initial and adjusted state respectively.
     */
    ramp: AudioRampType | number[] | null;

    /**
     * Delay of seconds before applying this adjustment.
     */
    delay?: number;

    /**
     * Duration of seconds this adjustment should take, after the delay.
     */
    duration?: number;
};

/**
 * AudioSourceNode, interchangeable with the standard AudioBufferSourceNode.
 *
 * Implements a hack for the much-needed (and 10 years late), getPosition() method.
 *
 * Built on the backs of these people who are smarter than me:
 *
 * > \@kurtsmurf who implemented a full class that encodes position directly into the buffer (WOW!)
 * > https://github.com/kurtsmurf/whirly/blob/master/src/PlaybackPositionNode.js
 * >
 * > \@p-himik who wrote a basic implementation of \@selimachour's concept
 * >
 * > \@selimachour devised an elegant solution to the issue that sidesteps manual calculation
 *
 * Implementation for position:
 * The original idea is to use the float range from -1 to 1 to represent the start and end samples
 * in a buffer. After testing the precision of 32 bit floats, they offer a generous 33,554,432 range
 * of distinct integers. At a sample rate of 44.1k, this precisely handles at least 12 minutes and 40
 * seconds of sound. For a higher rate of 88.2k, this handles at least 6 minutes and 20 seconds.
 *
 * This allows us to not mess around with float pointing precision or fancy multiplications, and just
 * save integers counting from -(length / 2) to +(length / 2).
 *
 * Notice: There is a supported method to obtain a playhead position from an audio source, however
 * it is only supported by the Audio() object, it must be passed to a MediaElementAudioSourceNode
 * which is then connected to the rest of the audio graph.
 *
 * The downside is that scheduling and parameter automation are entirely unsupported, as well as
 * the fact that we cannot share buffers between Audio objects; they must load an audio source
 * every time they are constructed. Because of this, we cannot use Audio() objects.
 */
class AudioSourceNode implements AudioBufferSourceNode {
    private sourceNode: AudioBufferSourceNode;
    private readonly gainNode: GainNode;
    private readonly stereoPannerNode: StereoPannerNode;

    private path: string | null = null;

    // Nodes necessary for tracking position
    private readonly analyser: AnalyserNode;
    private merger?: ChannelMergerNode;
    private splitter?: ChannelSplitterNode;
    // Is an array of 1 element because this is how we must retrieve the channel data from the position track
    private readonly positionContainer: Float32Array = new Float32Array(1);
    private bufferHalfLength: number | null = null;

    readonly numberOfInputs: number = 0;
    readonly numberOfOutputs: number = 1;

    constructor(private readonly audioContext: AudioContext, readonly destination?: AudioNode) {
        this.sourceNode = audioContext.createBufferSource();
        this.gainNode = audioContext.createGain();
        this.stereoPannerNode = audioContext.createStereoPanner();
        this.stereoPannerNode.connect(this.gainNode);

        this.analyser = audioContext.createAnalyser();

        if (destination) {
            this.connect(destination);
        }
    }

    /**
     * Creates and returns a clone of this AudioSourceNode, specifically of just the
     * audio context, buffer, and source path.
     *
     * No other internal state, like volume, is copied.
     * @returns clone
     */
    public clone(): AudioSourceNode {
        const selfClone = new AudioSourceNode(this.audioContext);
        selfClone.path = this.path;
        if (this.buffer) {
            this.copyBufferTo(selfClone);
        }
        return selfClone;
    }

    /**
     * Copies this buffer into a given AudioSourceNode.
     * @param other AudioSourceNode to copy into
     */
    public copyBufferTo(other: AudioSourceNode): void {
        if (!this.buffer) {
            other.buffer = null;
            return;
        }

        const bufferChannels = this.buffer.numberOfChannels;
        const bufferLength = this.buffer.length;

        const bufferClone = new AudioBuffer({
            length: bufferLength,
            sampleRate: this.buffer.sampleRate,
            numberOfChannels: bufferChannels,
        });

        for (let i = 0; i < bufferChannels; i++) {
            bufferClone.copyToChannel(this.buffer.getChannelData(i), i);
        }

        other.sourceNode.buffer = bufferClone;
        other.bufferHalfLength = Math.floor(bufferLength / 2);
        other.computeConnections();
    }

    public connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    public connect(destination: AudioParam, outputIndex?: number): void;
    public connect(
        destination: AudioNode | AudioParam,
        outputIndex?: number,
        inputIndex?: number,
    ): AudioNode | void {
        // We only want to diconnect/ connect the final gain node, doing anything else splits too much logic around
        // that is needed to track the playhead position on the source node. Source connections are made only when
        // the buffer source is known.
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        return this.gainNode.connect(destination, outputIndex);
    }

    public disconnect() {
        // Only diconnect the final gain node, the other nodes will all stay connected
        this.gainNode.disconnect();
    }

    async load(path: string): Promise<void> {
        this.path = path;
        const audioFile = await fetch(this.path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this.buffer = decodedBuffer;
    }

    volume(volume: number, options?: AudioAdjustmentOptions): AudioSourceNode {
        console.log(`stub volume ${volume} with options ${options}`);
        return this;
    }

    pan(pan: number, options?: AudioAdjustmentOptions): AudioSourceNode {
        console.log(`stub pan ${pan} with options ${options}`);
        return this;
    }

    pan3d(): AudioSourceNode {
        // TODO: ...someday...
        // https://github.com/twoz/hrtf-panner-js/blob/master/hrtf.js
        return this;
    }

    start(when?: number, offset?: number, duration?: number): void {
        return this.sourceNode.start(when, offset, duration);
    }

    stop(when?: number): void {
        return this.sourceNode.stop(when);
    }

    /**
     * Retrieve the [playhead position][1] of the source buffer in seconds.
     * A value of -1 means the buffer is null.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    public position(): number {
        if (this.buffer == null) {
            return -1;
        }
        const sampleIndex = this.positionSample();
        if (sampleIndex == -1) {
            return sampleIndex;
        }
        return sampleIndex * this.buffer.sampleRate;
    }

    /**
     * Retrieve the buffer sample index, represented by the internal position track.
     * See [playhead position][1]. A value of -1 means the buffer is null.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    public positionSample(): number {
        if (this.bufferHalfLength == null) {
            return -1;
        }
        this.analyser.getFloatTimeDomainData(this.positionContainer);
        const index = this.positionContainer[0];
        if (index == undefined) {
            return -1;
        }
        return index + this.bufferHalfLength;
    }

    get onended() {
        return this.sourceNode.onended;
    }

    set onended(callback) {
        this.sourceNode.onended = callback;
    }

    get buffer(): AudioBuffer | null {
        return this.sourceNode.buffer;
    }

    set buffer(buffer: AudioBuffer | null) {
        this.computeBuffer(buffer);
        this.computeConnections();
    }

    /**
     * Custom implementation of buffer assignment to support reading [playhead position][1] from
     * the source node, which is currently unsupported.
     *
     * See [first unrepresentable IEEE 754 integer][2] for the reasoning behind using a
     * pigeon hole type implementation.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     * [2]: <https://stackoverflow.com/a/3793950/4561008> "First unrepresentable IEEE 754 integer"
     */
    private computeBuffer(buffer: AudioBuffer | null) {
        // Credit to @kurtsmurf for the original implementation, @p-himik for the POC, and @selimachour for the concept
        if (!buffer) {
            this.sourceNode.buffer = null;
            this.bufferHalfLength = null;
            return;
        }

        const bufferLength = buffer.length;
        const bufferChannels = buffer.numberOfChannels;
        const trackedBuffer = new AudioBuffer({
            length: bufferLength,
            sampleRate: buffer.sampleRate,
            numberOfChannels: bufferChannels + 1, // extra channel for tracking time
        });

        for (let i = 0; i < bufferChannels; i++) {
            trackedBuffer.copyToChannel(buffer.getChannelData(i), i);
        }

        // Credit to @westarne for this improvement
        const trackedArray = new Float32Array(bufferLength);
        const halfBufferLength = Math.floor(bufferLength / 2);
        this.bufferHalfLength = halfBufferLength;
        for (let i = 0; i < bufferLength; i++) {
            trackedArray[i] = i - halfBufferLength;
        }
        trackedBuffer.copyToChannel(trackedArray, bufferChannels);
        this.sourceNode.buffer = trackedBuffer;
    }

    private computeConnections() {
        this.sourceNode.disconnect();

        if (this.splitter) {
            this.splitter.disconnect();
        }

        if (this.merger) {
            this.merger.disconnect();
        }

        const bufferChannels = this.sourceNode.buffer?.numberOfChannels;
        if (!bufferChannels) {
            this.splitter = undefined;
            this.merger = undefined;
            return;
        }

        if (!this.splitter || this.splitter.numberOfInputs != bufferChannels) {
            this.splitter = this.audioContext.createChannelSplitter(bufferChannels);
        }
        this.sourceNode.connect(this.splitter);
        this.splitter.connect(this.analyser, bufferChannels - 1, 0);

        // We do not create a merger unless we actually need one
        const outputChannels = bufferChannels - 1;
        if (outputChannels < 2) {
            this.merger = undefined;
            this.splitter.connect(this.stereoPannerNode, 0, 0);
            return;
        }

        if (!this.merger || this.merger.numberOfInputs != outputChannels) {
            this.merger = this.audioContext.createChannelMerger(outputChannels);
        }

        for (let i = 0; i < outputChannels; i++) {
            this.splitter.connect(this.merger, i, i);
        }

        this.merger.connect(this.stereoPannerNode);
    }

    get detune() {
        return this.sourceNode.detune;
    }

    get loop() {
        return this.sourceNode.loop;
    }

    set loop(value: boolean) {
        this.sourceNode.loop = value;
    }

    get loopStart() {
        return this.sourceNode.loopStart;
    }

    set loopStart(value: number) {
        this.sourceNode.loopStart = value;
    }

    get loopEnd() {
        return this.sourceNode.loopEnd;
    }

    set loopEnd(value: number) {
        this.sourceNode.loopEnd = value;
    }

    get playbackRate() {
        return this.sourceNode.playbackRate;
    }

    get context() {
        return this.audioContext;
    }

    get channelCount() {
        return this.sourceNode.channelCount;
    }

    get channelCountMode() {
        return this.sourceNode.channelCountMode;
    }

    get channelInterpretation() {
        return this.sourceNode.channelInterpretation;
    }

    addEventListener(
        type: 'ended',
        listener: (this: AudioBufferSourceNode, ev: Event) => any,
        options?: boolean | AddEventListenerOptions,
    ): void {
        this.sourceNode.addEventListener(type, listener, options);
    }

    removeEventListener(
        type: 'ended',
        listener: (this: AudioBufferSourceNode, ev: Event) => any,
        options?: boolean | EventListenerOptions,
    ): void {
        this.sourceNode.removeEventListener(type, listener, options);
    }

    dispatchEvent(event: Event): boolean {
        return this.sourceNode.dispatchEvent(event);
    }
}

export default AudioSourceNode;

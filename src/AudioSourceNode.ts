import { AudioAdjustmentOptions } from './automation.js';

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
    private _isDestroyed: boolean = false;
    private _isStarted: boolean = false;
    private _isStopped: boolean = false;
    private _isEnded: boolean = false;
    private onEndedMainCallback: (event: Event) => void = (event) => {
        this._isEnded = true;
        if (this.onEndedCallback) {
            this.onEndedCallback.call(this, event);
        }
    };
    private onEndedCallback: null | ((event: Event) => void) = null;

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

        this.sourceNode.onended = this.onEndedMainCallback;
    }

    /**
     * Creates and returns a clone of this AudioSourceNode, specifically of just the
     * audio context, buffer, and source path.
     *
     * No other internal state, like volume, is copied.
     * @returns clone
     */
    public clone(): AudioSourceNode {
        this.throwIfDestroyed();
        const selfClone = new AudioSourceNode(this.audioContext);
        selfClone.path = this.path;
        this.copyBufferTo(selfClone);
        return selfClone;
    }

    /**
     * Copies this buffer into a given AudioSourceNode.
     * @param other AudioSourceNode to copy into
     */
    public copyBufferTo(other: AudioSourceNode): void {
        this.throwIfDestroyed();
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

        other.computeConnections(bufferChannels);
        other.bufferHalfLength = AudioSourceNode.computeBufferHalfLength(bufferClone);
        other.sourceNode.buffer = bufferClone;
    }

    public connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    public connect(destination: AudioParam, outputIndex?: number): void;
    public connect(
        destination: AudioNode | AudioParam,
        outputIndex?: number,
        inputIndex?: number,
    ): AudioNode | void {
        this.throwIfDestroyed();
        // We only want to diconnect/ connect the final gain node, doing anything else splits too much logic around
        // that is needed to track the playhead position on the source node. Source connections are made only when
        // the buffer source is known.
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        return this.gainNode.connect(destination, outputIndex);
    }

    public disconnect(): void;
    public disconnect(output: number): void;
    public disconnect(destinationNode: AudioNode): void;
    public disconnect(destinationNode: AudioNode, output: number): void;
    public disconnect(destinationNode: AudioNode, output: number, input: number): void;
    public disconnect(destinationParam: AudioParam): void;
    public disconnect(destinationParam: AudioParam, output: number): void;
    public disconnect(param1?: number | AudioNode | AudioParam, output?: number, input?: number) {
        this.throwIfDestroyed();
        // Only diconnect the final gain node, the other nodes will all stay connected
        if (param1 == undefined) {
            return this.gainNode.disconnect();
        }
        if (typeof param1 == 'number') {
            return this.gainNode.disconnect(param1);
        }
        if (param1 instanceof AudioParam) {
            if (output != undefined) {
                return this.gainNode.disconnect(param1, output);
            }
            return this.gainNode.disconnect(param1);
        }
        if (output != undefined && input != undefined) {
            return this.gainNode.disconnect(param1, output, input);
        }
        if (output != undefined) {
            return this.gainNode.disconnect(param1, output);
        }
        this.gainNode.disconnect(param1);
    }

    async load(path: string): Promise<void> {
        this.throwIfDestroyed();
        this.path = path;
        const audioFile = await fetch(this.path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this.buffer = decodedBuffer;
    }

    volume(volume: number, options?: AudioAdjustmentOptions): AudioSourceNode {
        this.throwIfDestroyed();
        console.log(`stub volume ${volume} with options ${options}`);
        return this;
    }

    pan(pan: number, options?: AudioAdjustmentOptions): AudioSourceNode {
        this.throwIfDestroyed();
        console.log(`stub pan ${pan} with options ${options}`);
        return this;
    }

    pan3d(): AudioSourceNode {
        // TODO: ...someday...
        // https://github.com/twoz/hrtf-panner-js/blob/master/hrtf.js
        this.throwIfDestroyed();
        return this;
    }

    /**
     * This method may be called multiple times during the lifetime of the AudioSourceNode.
     * To acheive this utility, the active sourceNode is "released" following a call to stop(),
     * and a new source is constructed that shares the same buffer.
     *
     * Implementation Notes:
     * - If no buffer has been loaded, this method does nothing
     * - Upon constructing a new internal AudioBufferSourceNode, only the loaded buffer will be
     *   shared from the old node. All properties managed by the AudioBufferSourceNode, such as
     *   playbackRate, looping, stopping, and events (onended) will remain on the old one.
     * - At the moment start() is called, methods that operate on the source node directly will
     *   operate on the new source node, even if playback hasn't yet begun.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start
     */
    start(when?: number, offset?: number, duration?: number): void {
        this.throwIfDestroyed();
        if (!this.buffer) {
            console.warn(`Cannot start an AudioSourceNode without first loading a buffer.`);
            return;
        }

        if (this._isStarted || this._isStopped) {
            const buffer: AudioBuffer | null = this.sourceNode.buffer;
            this.sourceNode.onended = this.onEndedCallback;
            this.stop(when);
            this._isStopped = false;
            const oldSourceNode = this.sourceNode;
            if (when && when > this.audioContext.currentTime) {
                setTimeout(
                    () => {
                        oldSourceNode.stop();
                        oldSourceNode.disconnect();
                        oldSourceNode.buffer = null;
                    },
                    when && when > this.audioContext.currentTime
                        ? 1000 * (this.audioContext.currentTime - when)
                        : 0,
                );
            }
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = buffer;
            this.sourceNode.onended = this.onEndedMainCallback;
            if (this.sourceNode.buffer && !this.splitter) {
                console.warn(
                    `An AudioSourceNode appears to be in an invalid state, as a buffer has been ` +
                        `loaded, and no internal splitter node has been constructed. ` +
                        `This is a mistake.`,
                );
            } else if (this.splitter) {
                this.sourceNode.connect(this.splitter);
            }
        }

        if (when && when > this.audioContext.currentTime) {
            setTimeout(() => {
                this._isEnded = false;
            }, 1000 * (this.audioContext.currentTime - when));
        } else {
            this._isEnded = false;
        }
        this._isStarted = true;
        return this.sourceNode.start(when, offset, duration);
    }

    stop(when?: number): void {
        this.throwIfDestroyed();
        if (this._isStarted) {
            this._isStopped = true;
            return this.sourceNode.stop(when);
        }
    }

    /**
     * Retrieve the [playhead position][1] of the source buffer in seconds.
     * A value of -1 means the buffer is null, or the source is playing silence (all zeros).
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    public position(): number {
        this.throwIfDestroyed();
        if (this.buffer == null) {
            return -1;
        }
        const sampleIndex = this.positionSample();
        if (sampleIndex == -1) {
            return sampleIndex;
        }
        return sampleIndex / this.buffer.sampleRate;
    }

    /**
     * Retrieve the buffer sample index, represented by the internal position track.
     * See [playhead position][1].
     *
     * A value of -1 is returned in these conditions:
     *   - The source is not playing
     *   - The buffer is not set
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    public positionSample(): number {
        this.throwIfDestroyed();
        if (this.bufferHalfLength == null || this._isEnded) {
            return -1;
        }
        this.analyser.getFloatTimeDomainData(this.positionContainer);
        const index = this.positionContainer[0];
        if (index == undefined) {
            return -1;
        }
        return index + this.bufferHalfLength;
    }

    /**
     * Due to the nature of event timers, this can return `true` after a source has ended.
     * The recommendation is to check `isEnded()` inside a setTimer() with no delay, and
     * do some fallback logic if it's `true`, or to make use of the `onended` callback.
     * @returns `true` if the source has been started, and has probably not yet ended.
     */
    get isActive() {
        return this.isStarted && !this.isEnded;
    }

    /**
     * @returns `true` if the source has been scheduled to start
     */
    get isStarted() {
        return this._isStarted;
    }

    /**
     * @returns `true` if the source has been scheduled to stop
     */
    get isStopped() {
        return this._isStopped;
    }

    /**
     * In the case that the source hasn't been started yet, this will be `false`.
     * Use `isStarted()` to determine if the source has been started.
     * @returns `true` if the source has ended and is therefore outputting silence.
     */
    get isEnded() {
        return this._isEnded;
    }

    /**
     * @returns `true` if this AudioSourceNode has been destroyed
     */
    get isDestroyed() {
        return this._isDestroyed;
    }

    get onended() {
        this.throwIfDestroyed();
        return this.onEndedCallback;
    }

    set onended(callback) {
        this.throwIfDestroyed();
        this.onEndedCallback = callback;
    }

    get buffer(): AudioBuffer | null {
        this.throwIfDestroyed();
        return this.sourceNode.buffer;
    }

    set buffer(buffer: AudioBuffer | null) {
        this.throwIfDestroyed();
        const computedBuffer = AudioSourceNode.computeBufferWithPositionChannel(buffer);
        this.computeConnections(computedBuffer?.numberOfChannels ?? 0);
        this.bufferHalfLength = AudioSourceNode.computeBufferHalfLength(computedBuffer);
        this.sourceNode.buffer = computedBuffer;
    }

    /**
     * Static definition for how to compute the half-length of a buffer.
     *
     * Why? Because it's computed twice and I want to be certain that it is always the same.
     *
     * Why is this computed twice? To avoid a race condition caused by loading a buffer and then
     * building the node graph.
     *
     * Why do we do it in that order? You ask a lot of questions! Go look at the code!
     * @param buffer the buffer to compute half-length for
     */
    private static computeBufferHalfLength(buffer: AudioBuffer | null): number {
        return Math.floor((buffer?.length ?? 0) / 2);
    }

    /**
     * Custom buffer computation to support reading [playhead position][1] from the source node,
     * which is currently unsupported by Web Audio API (but maybe someday it'll be exposed).
     *
     * See [first unrepresentable IEEE 754 integer][2] for the reasoning behind using a
     * pigeon hole type implementation.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     * [2]: <https://stackoverflow.com/a/3793950/4561008> "First unrepresentable IEEE 754 integer"
     */
    private static computeBufferWithPositionChannel(buffer: AudioBuffer | null): AudioBuffer | null {
        // Credit to @kurtsmurf for the original implementation, @p-himik for the POC, and @selimachour for the concept
        if (!buffer) {
            return null;
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
        const halfBufferLength = AudioSourceNode.computeBufferHalfLength(trackedBuffer);
        for (let i = 0; i < bufferLength; i++) {
            trackedArray[i] = i - halfBufferLength;
        }
        trackedBuffer.copyToChannel(trackedArray, bufferChannels);
        return trackedBuffer;
    }

    /**
     * Constructs the internal audio graph for this AudioSourceNode based on the number of channels
     * provided. The splitter will construct with `bufferChannels` channel outputs, where the last
     * channel is presumed to be the position channel. The merge node, if required, will construct
     * with `bufferChannels - 1` channel inputs, so that the position channel is not output
     * @param bufferChannels number of channels to initialize
     */
    private computeConnections(bufferChannels: number) {
        this.sourceNode.disconnect();

        if (this.splitter) {
            this.splitter.disconnect();
        }

        if (this.merger) {
            this.merger.disconnect();
        }

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

    private throwIfDestroyed(): void {
        if (this._isDestroyed) {
            throw new Error(
                'This AudioSourceNode has been destroyed, it is invalid behavior to call this method. Check the stack trace.',
            );
        }
    }

    /**
     * Rapidly deconstruct this object and its properties in the hopes of freeing memory quickly.
     * Is it okay to call this method multiple times.
     */
    public destroy(): void {
        this._isDestroyed = true;
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode.buffer = null;
            (this.sourceNode as any) = undefined;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            (this.gainNode as any) = undefined;
        }
        if (this.stereoPannerNode) {
            this.stereoPannerNode.disconnect();
            (this.stereoPannerNode as any) = undefined;
        }
        if (this.analyser) {
            (this.analyser as any) = undefined;
        }
        if (this.merger) {
            this.merger.disconnect();
            (this.merger as any) = undefined;
        }
        if (this.splitter) {
            this.splitter.disconnect();
            (this.splitter as any) = undefined;
        }
    }

    get detune() {
        this.throwIfDestroyed();
        return this.sourceNode.detune;
    }

    get loop() {
        this.throwIfDestroyed();
        return this.sourceNode.loop;
    }

    set loop(value: boolean) {
        this.throwIfDestroyed();
        this.sourceNode.loop = value;
    }

    get loopStart() {
        this.throwIfDestroyed();
        return this.sourceNode.loopStart;
    }

    set loopStart(value: number) {
        this.throwIfDestroyed();
        this.sourceNode.loopStart = value;
    }

    get loopEnd() {
        this.throwIfDestroyed();
        return this.sourceNode.loopEnd;
    }

    set loopEnd(value: number) {
        this.throwIfDestroyed();
        this.sourceNode.loopEnd = value;
    }

    get playbackRate() {
        this.throwIfDestroyed();
        return this.sourceNode.playbackRate;
    }

    get context() {
        this.throwIfDestroyed();
        return this.audioContext;
    }

    get channelCount() {
        this.throwIfDestroyed();
        return this.sourceNode.channelCount;
    }

    get channelCountMode() {
        this.throwIfDestroyed();
        return this.sourceNode.channelCountMode;
    }

    get channelInterpretation() {
        this.throwIfDestroyed();
        return this.sourceNode.channelInterpretation;
    }

    addEventListener(
        type: 'ended',
        listener: (this: AudioBufferSourceNode, ev: Event) => any,
        options?: boolean | AddEventListenerOptions,
    ): void {
        this.throwIfDestroyed();
        this.sourceNode.addEventListener(type, listener, options);
    }

    removeEventListener(
        type: 'ended',
        listener: (this: AudioBufferSourceNode, ev: Event) => any,
        options?: boolean | EventListenerOptions,
    ): void {
        this.throwIfDestroyed();
        this.sourceNode.removeEventListener(type, listener, options);
    }

    dispatchEvent(event: Event): boolean {
        this.throwIfDestroyed();
        return this.sourceNode.dispatchEvent(event);
    }
}

export default AudioSourceNode;

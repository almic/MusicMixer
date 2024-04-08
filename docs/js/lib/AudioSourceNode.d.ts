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
declare class AudioSourceNode implements AudioBufferSourceNode {
    private readonly audioContext;
    private sourceNode;
    private readonly gainNode;
    private readonly stereoPannerNode;
    private path;
    private _isDestroyed;
    private _isStarted;
    private _isStopped;
    private _isEnded;
    private onEndedMainCallback;
    private onEndedCallback;
    private readonly analyser;
    private merger?;
    private splitter?;
    private readonly positionContainer;
    private bufferHalfLength;
    readonly numberOfInputs: number;
    readonly numberOfOutputs: number;
    constructor(audioContext: AudioContext, destination?: AudioNode);
    /**
     * Creates and returns a clone of this AudioSourceNode, specifically of just the
     * audio context, buffer, and source path.
     *
     * No other internal state, like volume, is copied.
     * @returns clone
     */
    clone(): AudioSourceNode;
    /**
     * Copies this buffer into a given AudioSourceNode.
     * @param other AudioSourceNode to copy into
     */
    copyBufferTo(other: AudioSourceNode): void;
    connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    connect(destination: AudioParam, outputIndex?: number): void;
    disconnect(): void;
    disconnect(output: number): void;
    disconnect(destinationNode: AudioNode): void;
    disconnect(destinationNode: AudioNode, output: number): void;
    disconnect(destinationNode: AudioNode, output: number, input: number): void;
    disconnect(destinationParam: AudioParam): void;
    disconnect(destinationParam: AudioParam, output: number): void;
    load(path: string): Promise<void>;
    volume(volume: number, options?: AudioAdjustmentOptions): AudioSourceNode;
    pan(pan: number, options?: AudioAdjustmentOptions): AudioSourceNode;
    pan3d(): AudioSourceNode;
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
    start(when?: number, offset?: number, duration?: number): void;
    stop(when?: number): void;
    /**
     * Retrieve the [playhead position][1] of the source buffer in seconds.
     * A value of -1 means the buffer is null, or the source is playing silence (all zeros).
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    position(): number;
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
    positionSample(): number;
    /**
     * Due to the nature of event timers, this can return `true` after a source has ended.
     * The recommendation is to check `isEnded()` inside a setTimer() with no delay, and
     * do some fallback logic if it's `true`, or to make use of the `onended` callback.
     * @returns `true` if the source has been started, and has probably not yet ended.
     */
    get isActive(): boolean;
    /**
     * @returns `true` if the source has been scheduled to start
     */
    get isStarted(): boolean;
    /**
     * @returns `true` if the source has been scheduled to stop
     */
    get isStopped(): boolean;
    /**
     * In the case that the source hasn't been started yet, this will be `false`.
     * Use `isStarted()` to determine if the source has been started.
     * @returns `true` if the source has ended and is therefore outputting silence.
     */
    get isEnded(): boolean;
    /**
     * @returns `true` if this AudioSourceNode has been destroyed
     */
    get isDestroyed(): boolean;
    get onended(): ((event: Event) => void) | null;
    set onended(callback: ((event: Event) => void) | null);
    get buffer(): AudioBuffer | null;
    set buffer(buffer: AudioBuffer | null);
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
    private static computeBufferHalfLength;
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
    private static computeBufferWithPositionChannel;
    /**
     * Constructs the internal audio graph for this AudioSourceNode based on the number of channels
     * provided. The splitter will construct with `bufferChannels` channel outputs, where the last
     * channel is presumed to be the position channel. The merge node, if required, will construct
     * with `bufferChannels - 1` channel inputs, so that the position channel is not output
     * @param bufferChannels number of channels to initialize
     */
    private computeConnections;
    private throwIfDestroyed;
    /**
     * Rapidly deconstruct this object and its properties in the hopes of freeing memory quickly.
     * Is it okay to call this method multiple times.
     */
    destroy(): void;
    get detune(): AudioParam;
    get loop(): boolean;
    set loop(value: boolean);
    get loopStart(): number;
    set loopStart(value: number);
    get loopEnd(): number;
    set loopEnd(value: number);
    get playbackRate(): AudioParam;
    get context(): AudioContext;
    get channelCount(): number;
    get channelCountMode(): ChannelCountMode;
    get channelInterpretation(): ChannelInterpretation;
    addEventListener(type: 'ended', listener: (this: AudioBufferSourceNode, ev: Event) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'ended', listener: (this: AudioBufferSourceNode, ev: Event) => any, options?: boolean | EventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
}
export default AudioSourceNode;

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
    readonly destination?: AudioNode | undefined;
    private sourceNode;
    private readonly gainNode;
    private readonly stereoPannerNode;
    private path;
    private readonly analyser;
    private merger?;
    private splitter?;
    private readonly positionContainer;
    private bufferHalfLength;
    readonly numberOfInputs: number;
    readonly numberOfOutputs: number;
    constructor(audioContext: AudioContext, destination?: AudioNode | undefined);
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
    load(path: string): Promise<void>;
    volume(volume: number, options?: AudioAdjustmentOptions): AudioSourceNode;
    pan(pan: number, options?: AudioAdjustmentOptions): AudioSourceNode;
    pan3d(): AudioSourceNode;
    start(when?: number, offset?: number, duration?: number): void;
    stop(when?: number): void;
    /**
     * Retrieve the [playhead position][1] of the source buffer in seconds.
     * A value of -1 means the buffer is null.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    position(): number;
    /**
     * Retrieve the buffer sample index, represented by the internal position track.
     * See [playhead position][1]. A value of -1 means the buffer is null.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    positionSample(): number;
    get onended(): ((this: AudioScheduledSourceNode, ev: Event) => any) | null;
    set onended(callback: ((this: AudioScheduledSourceNode, ev: Event) => any) | null);
    get buffer(): AudioBuffer | null;
    set buffer(buffer: AudioBuffer | null);
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
    private computeBuffer;
    private computeConnections;
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

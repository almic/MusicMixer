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
class AudioSourceNode {
    audioContext;
    destination;
    sourceNode;
    gainNode;
    stereoPannerNode;
    path = null;
    _isDestroyed = false;
    _isStarted = false;
    _isStopped = false;
    _isEnded = false;
    onEndedMainCallback = (event) => {
        this._isEnded = true;
        if (this.onEndedCallback) {
            this.onEndedCallback.call(this, event);
        }
    };
    onEndedCallback = null;
    // Nodes necessary for tracking position
    analyser;
    merger;
    splitter;
    // Is an array of 1 element because this is how we must retrieve the channel data from the position track
    positionContainer = new Float32Array(1);
    bufferHalfLength = null;
    numberOfInputs = 0;
    numberOfOutputs = 1;
    constructor(audioContext, destination) {
        this.audioContext = audioContext;
        this.destination = destination;
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
    clone() {
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
    copyBufferTo(other) {
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
    connect(destination, outputIndex, inputIndex) {
        this.throwIfDestroyed();
        // We only want to diconnect/ connect the final gain node, doing anything else splits too much logic around
        // that is needed to track the playhead position on the source node. Source connections are made only when
        // the buffer source is known.
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        return this.gainNode.connect(destination, outputIndex);
    }
    disconnect(param1, output, input) {
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
    async load(path) {
        this.throwIfDestroyed();
        this.path = path;
        const audioFile = await fetch(this.path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this.buffer = decodedBuffer;
    }
    volume(volume, options) {
        this.throwIfDestroyed();
        console.log(`stub volume ${volume} with options ${options}`);
        return this;
    }
    pan(pan, options) {
        this.throwIfDestroyed();
        console.log(`stub pan ${pan} with options ${options}`);
        return this;
    }
    pan3d() {
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
    start(when, offset, duration) {
        this.throwIfDestroyed();
        if (!this.buffer) {
            console.warn(`Cannot start an AudioSourceNode without first loading a buffer.`);
            return;
        }
        if (this._isStarted || this._isStopped) {
            const buffer = this.sourceNode.buffer;
            this.sourceNode.onended = this.onEndedCallback;
            this.stop(when);
            this._isStopped = false;
            const oldSourceNode = this.sourceNode;
            if (when && when > this.audioContext.currentTime) {
                setTimeout(() => {
                    oldSourceNode.stop();
                    oldSourceNode.disconnect();
                    oldSourceNode.buffer = null;
                }, when && when > this.audioContext.currentTime
                    ? 1000 * (this.audioContext.currentTime - when)
                    : 0);
            }
            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = buffer;
            this.sourceNode.onended = this.onEndedMainCallback;
            if (this.sourceNode.buffer && !this.splitter) {
                console.warn(`An AudioSourceNode appears to be in an invalid state, as a buffer has been ` +
                    `loaded, and no internal splitter node has been constructed. ` +
                    `This is a mistake.`);
            }
            else if (this.splitter) {
                this.sourceNode.connect(this.splitter);
            }
        }
        if (when && when > this.audioContext.currentTime) {
            setTimeout(() => {
                this._isEnded = false;
            }, 1000 * (this.audioContext.currentTime - when));
        }
        else {
            this._isEnded = false;
        }
        this._isStarted = true;
        return this.sourceNode.start(when, offset, duration);
    }
    stop(when) {
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
    position() {
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
    positionSample() {
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
    get buffer() {
        this.throwIfDestroyed();
        return this.sourceNode.buffer;
    }
    set buffer(buffer) {
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
    static computeBufferHalfLength(buffer) {
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
    static computeBufferWithPositionChannel(buffer) {
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
    computeConnections(bufferChannels) {
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
    throwIfDestroyed() {
        if (this._isDestroyed) {
            throw new Error('This AudioSourceNode has been destroyed, it is invalid behavior to call this method. Check the stack trace.');
        }
    }
    /**
     * Rapidly deconstruct this object and its properties in the hopes of freeing memory quickly.
     * Is it okay to call this method multiple times.
     */
    destroy() {
        this._isDestroyed = true;
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
            this.sourceNode.buffer = null;
            this.sourceNode = undefined;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = undefined;
        }
        if (this.stereoPannerNode) {
            this.stereoPannerNode.disconnect();
            this.stereoPannerNode = undefined;
        }
        if (this.analyser) {
            this.analyser = undefined;
        }
        if (this.merger) {
            this.merger.disconnect();
            this.merger = undefined;
        }
        if (this.splitter) {
            this.splitter.disconnect();
            this.splitter = undefined;
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
    set loop(value) {
        this.throwIfDestroyed();
        this.sourceNode.loop = value;
    }
    get loopStart() {
        this.throwIfDestroyed();
        return this.sourceNode.loopStart;
    }
    set loopStart(value) {
        this.throwIfDestroyed();
        this.sourceNode.loopStart = value;
    }
    get loopEnd() {
        this.throwIfDestroyed();
        return this.sourceNode.loopEnd;
    }
    set loopEnd(value) {
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
    addEventListener(type, listener, options) {
        this.throwIfDestroyed();
        this.sourceNode.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
        this.throwIfDestroyed();
        this.sourceNode.removeEventListener(type, listener, options);
    }
    dispatchEvent(event) {
        this.throwIfDestroyed();
        return this.sourceNode.dispatchEvent(event);
    }
}
export default AudioSourceNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9Tb3VyY2VOb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0F1ZGlvU291cmNlTm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOEJHO0FBQ0gsTUFBTSxlQUFlO0lBNkJZO0lBQXFDO0lBNUIxRCxVQUFVLENBQXdCO0lBQ3pCLFFBQVEsQ0FBVztJQUNuQixnQkFBZ0IsQ0FBbUI7SUFFNUMsSUFBSSxHQUFrQixJQUFJLENBQUM7SUFDM0IsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixVQUFVLEdBQVksS0FBSyxDQUFDO0lBQzVCLFVBQVUsR0FBWSxLQUFLLENBQUM7SUFDNUIsUUFBUSxHQUFZLEtBQUssQ0FBQztJQUMxQixtQkFBbUIsR0FBMkIsQ0FBQyxLQUFLLEVBQUUsRUFBRTtRQUM1RCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNMLENBQUMsQ0FBQztJQUNNLGVBQWUsR0FBb0MsSUFBSSxDQUFDO0lBRWhFLHdDQUF3QztJQUN2QixRQUFRLENBQWU7SUFDaEMsTUFBTSxDQUFxQjtJQUMzQixRQUFRLENBQXVCO0lBQ3ZDLHlHQUF5RztJQUN4RixpQkFBaUIsR0FBaUIsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0QsZ0JBQWdCLEdBQWtCLElBQUksQ0FBQztJQUV0QyxjQUFjLEdBQVcsQ0FBQyxDQUFDO0lBQzNCLGVBQWUsR0FBVyxDQUFDLENBQUM7SUFFckMsWUFBNkIsWUFBMEIsRUFBVyxXQUF1QjtRQUE1RCxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUFXLGdCQUFXLEdBQVgsV0FBVyxDQUFZO1FBQ3JGLElBQUksQ0FBQyxVQUFVLEdBQUcsWUFBWSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDcEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRTlDLElBQUksV0FBVyxFQUFFLENBQUM7WUFDZCxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7SUFDdkQsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNJLEtBQUs7UUFDUixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixNQUFNLFNBQVMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDekQsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDN0IsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7T0FHRztJQUNJLFlBQVksQ0FBQyxLQUFzQjtRQUN0QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2YsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDcEIsT0FBTztRQUNYLENBQUM7UUFFRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQ3BELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBRXhDLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxDQUFDO1lBQ2hDLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVU7WUFDbEMsZ0JBQWdCLEVBQUUsY0FBYztTQUNuQyxDQUFDLENBQUM7UUFFSCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdEMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBRUQsS0FBSyxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3pDLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDOUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDO0lBQzFDLENBQUM7SUFJTSxPQUFPLENBQ1YsV0FBbUMsRUFDbkMsV0FBb0IsRUFDcEIsVUFBbUI7UUFFbkIsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsMkdBQTJHO1FBQzNHLDBHQUEwRztRQUMxRyw4QkFBOEI7UUFDOUIsSUFBSSxXQUFXLFlBQVksU0FBUyxFQUFFLENBQUM7WUFDbkMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBU00sVUFBVSxDQUFDLE1BQXdDLEVBQUUsTUFBZSxFQUFFLEtBQWM7UUFDdkYsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsOEVBQThFO1FBQzlFLElBQUksTUFBTSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN0QyxDQUFDO1FBQ0QsSUFBSSxPQUFPLE1BQU0sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCxJQUFJLE1BQU0sWUFBWSxVQUFVLEVBQUUsQ0FBQztZQUMvQixJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDdEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDcEQsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELElBQUksTUFBTSxJQUFJLFNBQVMsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUM7WUFDNUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFDRCxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUN0QixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNwRCxDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBWTtRQUNuQixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixNQUFNLFNBQVMsR0FBRyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekMsTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQzdGLElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBYyxFQUFFLE9BQWdDO1FBQ25ELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxNQUFNLGlCQUFpQixPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQzdELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxHQUFHLENBQUMsR0FBVyxFQUFFLE9BQWdDO1FBQzdDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxHQUFHLGlCQUFpQixPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxLQUFLO1FBQ0Qsc0JBQXNCO1FBQ3RCLDZEQUE2RDtRQUM3RCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7O09BY0c7SUFDSCxLQUFLLENBQUMsSUFBYSxFQUFFLE1BQWUsRUFBRSxRQUFpQjtRQUNuRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxpRUFBaUUsQ0FBQyxDQUFDO1lBQ2hGLE9BQU87UUFDWCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNyQyxNQUFNLE1BQU0sR0FBdUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDMUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztZQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hCLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDdEMsSUFBSSxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQy9DLFVBQVUsQ0FDTixHQUFHLEVBQUU7b0JBQ0QsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNyQixhQUFhLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQzNCLGFBQWEsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUNoQyxDQUFDLEVBQ0QsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVc7b0JBQ3hDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7b0JBQy9DLENBQUMsQ0FBQyxDQUFDLENBQ1YsQ0FBQztZQUNOLENBQUM7WUFDRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDaEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDO1lBQ25ELElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sQ0FBQyxJQUFJLENBQ1IsNkVBQTZFO29CQUN6RSw4REFBOEQ7b0JBQzlELG9CQUFvQixDQUMzQixDQUFDO1lBQ04sQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzNDLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDL0MsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDWixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztZQUMxQixDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN0RCxDQUFDO2FBQU0sQ0FBQztZQUNKLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQzFCLENBQUM7UUFDRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztRQUN2QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFhO1FBQ2QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdkIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksUUFBUTtRQUNYLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN0QixPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ2QsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUMxQyxJQUFJLFdBQVcsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sV0FBVyxDQUFDO1FBQ3ZCLENBQUM7UUFDRCxPQUFPLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7Ozs7Ozs7OztPQVNHO0lBQ0ksY0FBYztRQUNqQixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2pELE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUM3RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUM7WUFDckIsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7SUFDekMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsSUFBSSxRQUFRO1FBQ1IsT0FBTyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUMzQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLFNBQVM7UUFDVCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDM0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxTQUFTO1FBQ1QsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQzNCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsSUFBSSxPQUFPO1FBQ1AsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksV0FBVztRQUNYLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUM3QixDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1AsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFJLE9BQU8sQ0FBQyxRQUFRO1FBQ2hCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDTixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxJQUFJLE1BQU0sQ0FBQyxNQUEwQjtRQUNqQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixNQUFNLGNBQWMsR0FBRyxlQUFlLENBQUMsZ0NBQWdDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMvRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDLHVCQUF1QixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2hGLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztJQUM1QyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7T0FVRztJQUNLLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxNQUEwQjtRQUM3RCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7Ozs7Ozs7O09BU0c7SUFDSyxNQUFNLENBQUMsZ0NBQWdDLENBQUMsTUFBMEI7UUFDdEUsK0dBQStHO1FBQy9HLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNWLE9BQU8sSUFBSSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ25DLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztRQUMvQyxNQUFNLGFBQWEsR0FBRyxJQUFJLFdBQVcsQ0FBQztZQUNsQyxNQUFNLEVBQUUsWUFBWTtZQUNwQixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDN0IsZ0JBQWdCLEVBQUUsY0FBYyxHQUFHLENBQUMsRUFBRSxrQ0FBa0M7U0FDM0UsQ0FBQyxDQUFDO1FBRUgsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGNBQWMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLGFBQWEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsMkNBQTJDO1FBQzNDLE1BQU0sWUFBWSxHQUFHLElBQUksWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3BELE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2hGLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNwQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLGdCQUFnQixDQUFDO1FBQzNDLENBQUM7UUFDRCxhQUFhLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztRQUMxRCxPQUFPLGFBQWEsQ0FBQztJQUN6QixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0ssa0JBQWtCLENBQUMsY0FBc0I7UUFDN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUU3QixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9CLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDN0IsQ0FBQztRQUVELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQztZQUMxQixJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztZQUN4QixPQUFPO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ25FLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBQ0QsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsY0FBYyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU1RCx3REFBd0Q7UUFDeEQsTUFBTSxjQUFjLEdBQUcsY0FBYyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFJLGNBQWMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztZQUN4QixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ25ELE9BQU87UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksY0FBYyxFQUFFLENBQUM7WUFDL0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFTyxnQkFBZ0I7UUFDcEIsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FDWCw2R0FBNkcsQ0FDaEgsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksT0FBTztRQUNWLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO1FBQ3pCLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDN0IsSUFBSSxDQUFDLFVBQWtCLEdBQUcsU0FBUyxDQUFDO1FBQ3pDLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxRQUFnQixHQUFHLFNBQVMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLGdCQUF3QixHQUFHLFNBQVMsQ0FBQztRQUMvQyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsUUFBZ0IsR0FBRyxTQUFTLENBQUM7UUFDdkMsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsTUFBYyxHQUFHLFNBQVMsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsUUFBZ0IsR0FBRyxTQUFTLENBQUM7UUFDdkMsQ0FBQztJQUNMLENBQUM7SUFFRCxJQUFJLE1BQU07UUFDTixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDSixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxLQUFjO1FBQ25CLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztJQUNqQyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsSUFBSSxTQUFTLENBQUMsS0FBYTtRQUN2QixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7SUFDdEMsQ0FBQztJQUVELElBQUksT0FBTztRQUNQLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7SUFDbkMsQ0FBQztJQUVELElBQUksT0FBTyxDQUFDLEtBQWE7UUFDckIsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLFlBQVk7UUFDWixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO0lBQ3hDLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDUCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDN0IsQ0FBQztJQUVELElBQUksWUFBWTtRQUNaLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUM7SUFDeEMsQ0FBQztJQUVELElBQUksZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQztJQUM1QyxDQUFDO0lBRUQsSUFBSSxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0lBQ2pELENBQUM7SUFFRCxnQkFBZ0IsQ0FDWixJQUFhLEVBQ2IsUUFBeUQsRUFDekQsT0FBMkM7UUFFM0MsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlELENBQUM7SUFFRCxtQkFBbUIsQ0FDZixJQUFhLEVBQ2IsUUFBeUQsRUFDekQsT0FBd0M7UUFFeEMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxhQUFhLENBQUMsS0FBWTtRQUN0QixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDSjtBQUVELGVBQWUsZUFBZSxDQUFDIn0=
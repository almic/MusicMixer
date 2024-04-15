class AudioSourceNodeEvent {
    type;
    target;
    time;
    #propagationStopped = false;
    constructor(type, target, time) {
        this.type = type;
        this.target = target;
        this.time = time;
    }
    stopPropagation() {
        this.#propagationStopped = true;
    }
    get propagationStopped() {
        return this.#propagationStopped;
    }
}
class EventEnded extends AudioSourceNodeEvent {
    constructor(target, time) {
        super('ended', target, time);
    }
}
class EventLoaded extends AudioSourceNodeEvent {
    buffer;
    constructor(target, time, buffer) {
        super('loaded', target, time);
        this.buffer = buffer;
    }
}
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
    owner;
    sourceNode;
    gainNode;
    stereoPannerNode;
    path = null;
    _isDestroyed = false;
    _isStarted = false;
    _isStopped = false;
    _isEnded = false;
    _isLoaded = false;
    onLoadedListeners = [];
    onEndedListeners = [];
    onEndedInternalCallback = () => {
        this._isEnded = true;
        this.dispatchEvent(new EventEnded(this, this.audioContext.currentTime));
    };
    // Nodes necessary for tracking position
    analyser;
    merger;
    splitter;
    // Is an array of 1 element because this is how we must retrieve the channel data from the position track
    positionContainer = new Float32Array(1);
    bufferHalfLength = null;
    numberOfInputs = 0;
    numberOfOutputs = 1;
    constructor(audioContext, owner, destination) {
        this.audioContext = audioContext;
        this.owner = owner;
        if (typeof owner != 'object') {
            throw new Error('Cannot create an AudioSourceNode without specifying an owner. ' +
                'The owner is responsible for destroying the AudioSourceNode');
        }
        this.sourceNode = audioContext.createBufferSource();
        this.gainNode = audioContext.createGain();
        this.stereoPannerNode = audioContext.createStereoPanner();
        this.stereoPannerNode.connect(this.gainNode);
        this.analyser = audioContext.createAnalyser();
        if (destination) {
            this.connect(destination);
        }
        this.sourceNode.onended = this.onEndedInternalCallback;
    }
    /**
     * Creates and returns a clone of this AudioSourceNode, specifically of just the
     * audio context, buffer, and source path.
     *
     * No other internal state, like volume, is copied.
     * @param owner the object that will take ownership of the clone
     * @returns clone
     */
    clone(owner) {
        this.throwIfDestroyed();
        const selfClone = new AudioSourceNode(this.audioContext, owner);
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
    disconnect(outputOrNodeOrParam, output, input) {
        this.throwIfDestroyed();
        // Only diconnect the final gain node, the other nodes will all stay connected
        if (outputOrNodeOrParam == undefined) {
            return this.gainNode.disconnect();
        }
        if (typeof outputOrNodeOrParam == 'number') {
            return this.gainNode.disconnect(outputOrNodeOrParam);
        }
        if (outputOrNodeOrParam instanceof AudioNode) {
            if (output != undefined && input != undefined) {
                return this.gainNode.disconnect(outputOrNodeOrParam, output, input);
            }
            else if (output != undefined) {
                return this.gainNode.disconnect(outputOrNodeOrParam, output);
            }
            else {
                return this.gainNode.disconnect(outputOrNodeOrParam);
            }
        }
        if (outputOrNodeOrParam instanceof AudioParam) {
            if (output != undefined) {
                return this.gainNode.disconnect(outputOrNodeOrParam, output);
            }
            else {
                return this.gainNode.disconnect(outputOrNodeOrParam);
            }
        }
    }
    async load(path) {
        this.throwIfDestroyed();
        this.path = path;
        const audioFile = await fetch(this.path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this.buffer = decodedBuffer;
        this._isLoaded = true;
        this.dispatchEvent(new EventLoaded(this, this.audioContext.currentTime, decodedBuffer));
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
            this.sourceNode.onended = null;
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
            this.sourceNode.onended = this.onEndedInternalCallback;
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
        return !this._isDestroyed && this.isStarted && !this.isEnded;
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
     * In the case that the {@link load()} method has never completed, this will be `false`,
     * regardless of the state of the internal {@link AudioBuffer}.
     * @returns `true` if the method {@link load()} has completed successfully
     */
    get isLoaded() {
        return this._isLoaded;
    }
    /**
     * @returns `true` if this AudioSourceNode has been destroyed
     */
    get isDestroyed() {
        return this._isDestroyed;
    }
    get onended() {
        this.throwIfDestroyed();
        return this.onEndedListeners[0]?.handleEvent ?? null;
    }
    set onended(listener) {
        this.throwIfDestroyed();
        if (listener == null || listener == undefined) {
            this.onEndedListeners = [];
        }
        else if (typeof listener == 'function') {
            this.onEndedListeners = [AudioSourceNode._makeListener(listener, { capture: false })];
        }
    }
    get onloaded() {
        this.throwIfDestroyed();
        return this.onLoadedListeners[0]?.handleEvent ?? null;
    }
    set onloaded(listener) {
        this.throwIfDestroyed();
        if (listener == null || listener == undefined) {
            this.onLoadedListeners = [];
        }
        else if (typeof listener == 'function') {
            this.onLoadedListeners = [AudioSourceNode._makeListener(listener, { capture: false })];
        }
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
        // this.owner = null; // Deliberately retain the owner reference, so users can know what object should be responsible
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
        let listenerList;
        switch (type) {
            case 'ended': {
                listenerList = this.onEndedListeners;
                break;
            }
            case 'loaded': {
                listenerList = this.onLoadedListeners;
                break;
            }
            default: {
                return;
            }
        }
        let capture = typeof options == 'boolean' ? options : options?.capture ?? false;
        let once = false, passive = false, signal = undefined;
        if (typeof options == 'object') {
            once = options?.once ?? once;
            passive = options?.passive ?? passive;
            signal = options?.signal ?? signal;
        }
        if (signal && signal.aborted) {
            return;
        }
        for (const l of listenerList) {
            if (l.handleEvent == listener && l.options.capture == capture) {
                return;
            }
        }
        listenerList.push(AudioSourceNode._makeListener(listener, { capture, once, passive, signal }));
        if (signal) {
            signal.addEventListener('abort', () => this.removeEventListener(type, listener, capture));
        }
    }
    removeEventListener(type, listener, options) {
        this.throwIfDestroyed();
        let listenerList;
        switch (type) {
            case 'ended': {
                listenerList = this.onEndedListeners;
                break;
            }
            case 'loaded': {
                listenerList = this.onLoadedListeners;
                break;
            }
            default: {
                return;
            }
        }
        let capturing = typeof options == 'boolean' ? options : options?.capture ?? false;
        for (let index = 0; index < listenerList.length; index++) {
            const l = listenerList[index];
            if (l?.handleEvent == listener) {
                if (l.options.capture == capturing) {
                    l.removed = true;
                    listenerList.splice(index, 1);
                }
                return;
            }
        }
    }
    /**
     * Dispatch an event onto this {@link AudioSourceNode}
     * @param event event to dispatch
     * @returns `true` if any event listeners received the event
     */
    dispatchEvent(event) {
        if (this._isDestroyed)
            return false;
        let listenerList;
        if (event.type == 'ended') {
            listenerList = this.onEndedListeners;
        }
        else if (event.type == 'loaded') {
            listenerList = this.onLoadedListeners;
        }
        else {
            return false;
        }
        let listenerListCopy = [...listenerList];
        let handled = false;
        for (let index = 0; index < listenerListCopy.length; index++) {
            let listener = listenerListCopy[index];
            if (listener.removed) {
                continue;
            }
            try {
                listener.handleEvent.call(this, event);
                handled = true;
            }
            catch (err) {
                console.error(`An exception occurred during '${event.type}' event handling on an AudioSourceNode:`);
                console.error(err);
            }
            if (listener.options.once) {
                listenerList.splice(index, 1);
            }
            if (event.propagationStopped) {
                break;
            }
        }
        return handled;
    }
    static _makeListener(fn, options) {
        if (options == undefined) {
            return { handleEvent: fn, options: { capture: false }, removed: false };
        }
        else if (typeof options == 'boolean') {
            return { handleEvent: fn, options: { capture: options }, removed: false };
        }
        return { handleEvent: fn, options, removed: false };
    }
}
export default AudioSourceNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9Tb3VyY2VOb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0F1ZGlvU291cmNlTm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLG9CQUFvQjtJQUlUO0lBQ0E7SUFDQTtJQUxiLG1CQUFtQixHQUFHLEtBQUssQ0FBQztJQUU1QixZQUNhLElBQVksRUFDWixNQUF1QixFQUN2QixJQUFZO1FBRlosU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLFdBQU0sR0FBTixNQUFNLENBQWlCO1FBQ3ZCLFNBQUksR0FBSixJQUFJLENBQVE7SUFDdEIsQ0FBQztJQUVHLGVBQWU7UUFDbEIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBVyxrQkFBa0I7UUFDekIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUM7SUFDcEMsQ0FBQztDQUNKO0FBRUQsTUFBTSxVQUFXLFNBQVEsb0JBQW9CO0lBQ3pDLFlBQVksTUFBdUIsRUFBRSxJQUFZO1FBQzdDLEtBQUssQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2pDLENBQUM7Q0FDSjtBQUVELE1BQU0sV0FBWSxTQUFRLG9CQUFvQjtJQUk3QjtJQUhiLFlBQ0ksTUFBdUIsRUFDdkIsSUFBWSxFQUNILE1BQW1CO1FBRTVCLEtBQUssQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRnJCLFdBQU0sR0FBTixNQUFNLENBQWE7SUFHaEMsQ0FBQztDQUNKO0FBUUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQThCRztBQUNILE1BQU0sZUFBZTtJQStCSTtJQUNSO0lBL0JMLFVBQVUsQ0FBd0I7SUFDekIsUUFBUSxDQUFXO0lBQ25CLGdCQUFnQixDQUFtQjtJQUU1QyxJQUFJLEdBQWtCLElBQUksQ0FBQztJQUMzQixZQUFZLEdBQVksS0FBSyxDQUFDO0lBQzlCLFVBQVUsR0FB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
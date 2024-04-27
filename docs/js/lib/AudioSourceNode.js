import automation from './automation.js';
import buildOptions, * as defaults from './defaults.js';
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
    hrtfPannerNode = null;
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
        const target = this.hrtfPannerNode ? this.hrtfPannerNode : this.gainNode;
        if (destination instanceof AudioNode) {
            return target.connect(destination, outputIndex, inputIndex);
        }
        else if (destination instanceof AudioParam) {
            return target.connect(destination, outputIndex);
        }
        else {
            console.warn(`Cannot connect AudioSourceNode to type ${destination?.constructor?.name}. This is likely a mistake.`);
        }
    }
    disconnect(outputOrNodeOrParam, output, input) {
        this.throwIfDestroyed();
        const target = this.hrtfPannerNode ? this.hrtfPannerNode : this.gainNode;
        if (outputOrNodeOrParam == undefined) {
            return target.disconnect();
        }
        if (outputOrNodeOrParam == 0) {
            return target.disconnect(outputOrNodeOrParam);
        }
        if (outputOrNodeOrParam instanceof AudioNode) {
            if (output == 0 && input != undefined) {
                return target.disconnect(outputOrNodeOrParam, output, input);
            }
            else if (output == 0) {
                return target.disconnect(outputOrNodeOrParam, output);
            }
            else {
                return target.disconnect(outputOrNodeOrParam);
            }
        }
        if (outputOrNodeOrParam instanceof AudioParam) {
            if (output == 0) {
                return target.disconnect(outputOrNodeOrParam, output);
            }
            return target.disconnect(outputOrNodeOrParam);
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
        automation(this.audioContext, this.gainNode.gain, volume, buildOptions(options, defaults.automationDefault));
        return this;
    }
    pan(pan, options) {
        this.throwIfDestroyed();
        automation(this.audioContext, this.stereoPannerNode.pan, pan, buildOptions(options, defaults.automationDefault));
        return this;
    }
    /**
     * Attach an {@link HRTFPannerNode} to spatialize this {@link AudioSourceNode}. This will disconnect all current
     * outputs on this {@link AudioSourceNode} to prevent creating cycles. You must call `connect()` again in order to
     * continue sending output to your destination.
     *
     * You should not use the `pan()` method in conjunction with the {@link HRTFPannerNode}.
     *
     * @param hrtfPannerNode {@link HRTFPannerNode} to attach
     * @returns this {@link AudioSourceNode}
     */
    set hrtfPanner(hrtfPannerNode) {
        this.throwIfDestroyed();
        this.disconnect();
        if (!hrtfPannerNode) {
            this.hrtfPannerNode = null;
            return;
        }
        this.hrtfPannerNode = hrtfPannerNode;
        this.hrtfPannerNode.connectSource(this.gainNode);
    }
    /**
     * @returns the currently assigned {@link HRTFPannerNode} or `null` if none is set
     */
    get hrtfPanner() {
        return this.hrtfPannerNode;
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
            try {
                this._isStopped = true;
                this.sourceNode.stop();
            }
            catch (ingored) { }
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
        if (this.hrtfPannerNode) {
            this.hrtfPannerNode = undefined;
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
    set loopStart(seconds) {
        this.throwIfDestroyed();
        this.sourceNode.loopStart = seconds;
    }
    get loopEnd() {
        this.throwIfDestroyed();
        return this.sourceNode.loopEnd;
    }
    set loopEnd(seconds) {
        this.throwIfDestroyed();
        this.sourceNode.loopEnd = seconds;
    }
    get playbackRate() {
        this.throwIfDestroyed();
        return this.sourceNode.playbackRate;
    }
    /**
     * -1 if there is no set buffer
     */
    get sampleRate() {
        this.throwIfDestroyed();
        return this.sourceNode.buffer?.sampleRate ?? -1;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9Tb3VyY2VOb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0F1ZGlvU291cmNlTm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLFVBQXNDLE1BQU0saUJBQWlCLENBQUM7QUFDckUsT0FBTyxZQUFZLEVBQUUsS0FBSyxRQUFRLE1BQU0sZUFBZSxDQUFDO0FBR3hELE1BQU0sb0JBQW9CO0lBSVQ7SUFDQTtJQUNBO0lBTGIsbUJBQW1CLEdBQUcsS0FBSyxDQUFDO0lBRTVCLFlBQ2EsSUFBWSxFQUNaLE1BQXVCLEVBQ3ZCLElBQVk7UUFGWixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1osV0FBTSxHQUFOLE1BQU0sQ0FBaUI7UUFDdkIsU0FBSSxHQUFKLElBQUksQ0FBUTtJQUN0QixDQUFDO0lBRUcsZUFBZTtRQUNsQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFXLGtCQUFrQjtRQUN6QixPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztJQUNwQyxDQUFDO0NBQ0o7QUFFRCxNQUFNLFVBQVcsU0FBUSxvQkFBb0I7SUFDekMsWUFBWSxNQUF1QixFQUFFLElBQVk7UUFDN0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNKO0FBRUQsTUFBTSxXQUFZLFNBQVEsb0JBQW9CO0lBSTdCO0lBSGIsWUFDSSxNQUF1QixFQUN2QixJQUFZLEVBQ0gsTUFBbUI7UUFFNUIsS0FBSyxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFGckIsV0FBTSxHQUFOLE1BQU0sQ0FBYTtJQUdoQyxDQUFDO0NBQ0o7QUFRRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOEJHO0FBQ0gsTUFBTSxlQUFlO0lBZ0NJO0lBQ1I7SUFoQ0wsVUFBVSxDQUF3QjtJQUN6QixRQUFRLENBQVc7SUFDbkIs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
/**
 * Ramp types for audio adjustments
 */
export var AudioRampType;
(function (AudioRampType) {
    /**
     * Linear ramp
     */
    AudioRampType["LINEAR"] = "linear";
    /**
     * Exponential ramp
     */
    AudioRampType["EXPONENTIAL"] = "exponential";
    /**
     * Natural ramp. Depending on the adjustment being made, this will either be a
     * logarithmic adjustment, or an equal-power adjustment. In general, this option
     * will produce the best sounding results compared to the other options, and in
     * general should always be preferred over the others.
     */
    AudioRampType["NATURAL"] = "natural";
})(AudioRampType || (AudioRampType = {}));
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
    }
    /**
     * Creates and returns a clone of this AudioSourceNode, specifically of just the
     * audio context, buffer, and source path.
     *
     * No other internal state, like volume, is copied.
     * @returns clone
     */
    clone() {
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
    copyBufferTo(other) {
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
    connect(destination, outputIndex, inputIndex) {
        // We only want to diconnect/ connect the final gain node, doing anything else splits too much logic around
        // that is needed to track the playhead position on the source node. Source connections are made only when
        // the buffer source is known.
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        return this.gainNode.connect(destination, outputIndex);
    }
    disconnect() {
        // Only diconnect the final gain node, the other nodes will all stay connected
        this.gainNode.disconnect();
    }
    async load(path) {
        this.path = path;
        const audioFile = await fetch(this.path);
        const decodedBuffer = await this.audioContext.decodeAudioData(await audioFile.arrayBuffer());
        this.buffer = decodedBuffer;
    }
    volume(volume, options) {
        console.log(`stub volume ${volume} with options ${options}`);
        return this;
    }
    pan(pan, options) {
        console.log(`stub pan ${pan} with options ${options}`);
        return this;
    }
    pan3d() {
        // TODO: ...someday...
        // https://github.com/twoz/hrtf-panner-js/blob/master/hrtf.js
        return this;
    }
    start(when, offset, duration) {
        return this.sourceNode.start(when, offset, duration);
    }
    stop(when) {
        return this.sourceNode.stop(when);
    }
    /**
     * Retrieve the [playhead position][1] of the source buffer in seconds.
     * A value of -1 means the buffer is null.
     *
     * [1]: <https://webaudio.github.io/web-audio-api/#playhead-position> "Playhead Position"
     */
    position() {
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
    positionSample() {
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
    get buffer() {
        return this.sourceNode.buffer;
    }
    set buffer(buffer) {
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
    computeBuffer(buffer) {
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
    computeConnections() {
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
    set loop(value) {
        this.sourceNode.loop = value;
    }
    get loopStart() {
        return this.sourceNode.loopStart;
    }
    set loopStart(value) {
        this.sourceNode.loopStart = value;
    }
    get loopEnd() {
        return this.sourceNode.loopEnd;
    }
    set loopEnd(value) {
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
    addEventListener(type, listener, options) {
        this.sourceNode.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
        this.sourceNode.removeEventListener(type, listener, options);
    }
    dispatchEvent(event) {
        return this.sourceNode.dispatchEvent(event);
    }
}
export default AudioSourceNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9Tb3VyY2VOb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0F1ZGlvU291cmNlTm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGFBa0JYO0FBbEJELFdBQVksYUFBYTtJQUNyQjs7T0FFRztJQUNILGtDQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsNENBQTJCLENBQUE7SUFFM0I7Ozs7O09BS0c7SUFDSCxvQ0FBbUIsQ0FBQTtBQUN2QixDQUFDLEVBbEJXLGFBQWEsS0FBYixhQUFhLFFBa0J4QjtBQXlCRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOEJHO0FBQ0gsTUFBTSxlQUFlO0lBa0JZO0lBQXFDO0lBakIxRCxVQUFVLENBQXdCO0lBQ3pCLFFBQVEsQ0FBVztJQUNuQixnQkFBZ0IsQ0FBbUI7SUFFNUMsSUFBSSxHQUFrQixJQUFJLENBQUM7SUFFbkMsd0NBQXdDO0lBQ3ZCLFFBQVEsQ0FBZTtJQUNoQyxNQUFNLENBQXFCO0lBQzNCLFFBQVEsQ0FBdUI7SUFDdkMseUdBQXlHO0lBQ3hGLGlCQUFpQixHQUFpQixJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRCxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBRXRDLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsZUFBZSxHQUFXLENBQUMsQ0FBQztJQUVyQyxZQUE2QixZQUEwQixFQUFXLFdBQXVCO1FBQTVELGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQVcsZ0JBQVcsR0FBWCxXQUFXLENBQVk7UUFDckYsSUFBSSxDQUFDLFVBQVUsR0FBRyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUNwRCxJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFD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
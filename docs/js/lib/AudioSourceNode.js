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
        this.analyser = audioContext.createAnalyser();
        if (destination) {
            this.connect(destination);
        }
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
    set buffer(buffer) {
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
        // calling connect() multiple times is part of the standard to support "fan-out"
        // so, we disconnect all the nodes from everything first to prevent lingering channel connections
        this.sourceNode.disconnect();
        this.analyser.disconnect();
        this.stereoPannerNode.disconnect();
        // Recreate the splitter and merger so they use the number of channels needed, which could change buffer-to-buffer
        if (this.splitter) {
            this.splitter.disconnect();
            delete this.splitter;
        }
        this.splitter = this.audioContext.createChannelSplitter(bufferChannels + 1);
        if (this.merger) {
            this.merger.disconnect();
            delete this.merger;
        }
        this.merger = this.audioContext.createChannelMerger(bufferChannels);
        this.sourceNode.connect(this.splitter);
        for (let i = 0; i < bufferChannels; i++) {
            this.splitter.connect(this.merger, i, i);
        }
        this.splitter.connect(this.analyser, bufferChannels, 0);
        this.merger.connect(this.stereoPannerNode).connect(this.gainNode);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9Tb3VyY2VOb2RlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0F1ZGlvU291cmNlTm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGFBa0JYO0FBbEJELFdBQVksYUFBYTtJQUNyQjs7T0FFRztJQUNILGtDQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsNENBQTJCLENBQUE7SUFFM0I7Ozs7O09BS0c7SUFDSCxvQ0FBbUIsQ0FBQTtBQUN2QixDQUFDLEVBbEJXLGFBQWEsS0FBYixhQUFhLFFBa0J4QjtBQXlCRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBOEJHO0FBQ0gsTUFBTSxlQUFlO0lBa0JZO0lBQXFDO0lBakIxRCxVQUFVLENBQXdCO0lBQ3pCLFFBQVEsQ0FBVztJQUNuQixnQkFBZ0IsQ0FBbUI7SUFFNUMsSUFBSSxHQUFrQixJQUFJLENBQUM7SUFFbkMsd0NBQXdDO0lBQ3ZCLFFBQVEsQ0FBZTtJQUNoQyxNQUFNLENBQXFCO0lBQzNCLFFBQVEsQ0FBdUI7SUFDdkMseUdBQXlHO0lBQ3hGLGlCQUFpQixHQUFpQixJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRCxnQkFBZ0IsR0FBa0IsSUFBSSxDQUFDO0lBRXRDLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsZUFBZSxHQUFXLENBQUMsQ0FBQztJQUVyQyxZQUE2QixZQUEwQixFQUFXLFdBQXVCO1FBQTVELGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQVcsZ0JBQVcsR0FBWCxXQUFXLENBQVk7UUFDckYsSUFBSSxDQUFDLFVBQVUsR0FBRyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUNwRCxJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFF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
import AudioSourceNode from './AudioSourceNode.js';
import automation from './automation.js';
import buildOptions, * as defaults from './defaults.js';
/**
 * Enumeration for track beat types. If writing with TypeScript, use these.
 */
export var TrackBeatType;
(function (TrackBeatType) {
    /**
     * Repeating beat, firing every `S + xR` seconds where S is the start point and R is the repeat seconds
     */
    TrackBeatType["REPEATING"] = "repeating";
    /**
     * Precise beat, fires on an exact time
     */
    TrackBeatType["PRECISE"] = "precise";
    /**
     * Exclusion region, beats that would fire in this region... won't fire
     */
    TrackBeatType["EXCLUDE"] = "exclude";
})(TrackBeatType || (TrackBeatType = {}));
/**
 * Enumeration for track event types. If writing with TypeScript, use these.
 *
 * Deprecation Notice: Depending on how these are used or misused, some may be removed, added, or change
 * in future versions. In general, you should never tie any game logic to these events. Only use the
 * events for sound-specific things.
 */
export var TrackEventType;
(function (TrackEventType) {
    /**
     * Fires when a track is scheduling to start playback.
     * - `startPlayback(track, startOptions)` => ({@link Track}, {@link AudioAdjustmentOptions})
     */
    TrackEventType["START_PLAYBACK"] = "startPlayback";
    /**
     * Fires when a track is scheduling to stop playback. If you need to fire when a playing AudioSource
     * goes silent, i.e. when it truly stops playing, use the {@link SILENCED} event instead.
     * - `stopPlayback(track, stopOptions)` => ({@link Track}, {@link AudioAdjustmentOptions})
     */
    TrackEventType["STOP_PLAYBACK"] = "stopPlayback";
    /**
     * - `beat(track, beat)` => ({@link Track}, {@link TrackBeat})
     */
    TrackEventType["BEAT"] = "beat";
    /**
     * Fires regularly from `requestAnimFrame()`. Naturally, this creates a performance hit the more
     * callbacks are tied to this event. If you have any sort of complexity, it's strongly suggested
     * to run your own rendering pipeline and directly access
     * - `position(track, time)` => ({@link Track}, `number`)
     */
    TrackEventType["POSITION"] = "position";
    /**
     * Fires when a playing AudioSource goes silent, i.e. its no longer playing. This uses the built-in
     * "ended" event on AudioBufferSourceNodes.
     * - `silenced(track, time)` => ({@link Track}, `number`)
     */
    TrackEventType["SILENCED"] = "silenced";
})(TrackEventType || (TrackEventType = {}));
export var TrackSwapType;
(function (TrackSwapType) {
    /**
     * Ramps in the new source and then ramps out the old source
     */
    TrackSwapType["IN_OUT"] = "inOut";
    /**
     * Ramps out the old source and then ramps in the new source
     */
    TrackSwapType["OUT_IN"] = "outIn";
    /**
     * Ramps both sources at the same time
     */
    TrackSwapType["CROSS"] = "cross";
    /**
     * Cuts directly from old source to the new source
     */
    TrackSwapType["CUT"] = "cut";
})(TrackSwapType || (TrackSwapType = {}));
//#region TrackSingle
/**
 * Track implementation
 */
class TrackSingle {
    name;
    audioContext;
    /**
     * The master gain for the track, it is exposed for automation
     */
    gainNode;
    /**
     * Internal gain node for fading in/ out the primary source, for stopping and starting
     */
    gainPrimaryNode;
    /**
     * Internal gain node for fading in the secondary source, swapping primary sources
     */
    gainSecondaryNode;
    /**
     * Tracks the most recently loaded source, used in swaping/ starting
     */
    loadedSource;
    /**
     * Tracks the playing source, on which automations and stopping effect
     */
    playingSource;
    /**
     * Stores a position, in seconds, on which stop() will save the playhead
     * position at the moment of activation, on which play() will resume from
     */
    resumeMarker = 0;
    /**
     * Stores the earliest scheduled stop time, used to disable the ability to call
     * stop continuously with future times such that the underlying AudioSourceNode
     * never reaches a stop time.
     */
    nextStopTime = 0;
    /**
     * Tracks whether or not the loadSource() method has previously been called,
     * used by start() to determine if a swap() or plain start() will occur.
     */
    isLoadSourceCalled = false;
    /**
     * Tracks calls to the start method such that deferred start calls, using
     * the 'loaded' event listener, will abort on subsequent calls to start if
     * the time has been updated.
     *
     * This is necessary for the start method because future calls to start must
     * not be replaced by a deferred call that happened to execute after it
     * completed. If start is called many times, and they are all deferred, the
     * latest one should make the call as if it was the only call.
     */
    lastStartCallTime = 0;
    /**
     * Tracks calls to the loop method such that deferred loop calls, using the
     * 'loaded' event listener, will abort on subsequent calls to loop if the
     * time has been updated.
     */
    lastLoopCallTime = 0;
    /**
     * Implementation Notes:
     * - If the given AudioSourceNode has outgoing connections, they will be disconnected at the
     *   time this Track begins playback of the AudioSourceNode.
     * - Providing an AudioSourceNode that is controlled by another Track has undefined behavior.
     *   If you must reuse an AudioSourceNode that may be controlled by another Track, use the
     *   clone() method to obtain a new node.
     * @param name
     * @param audioContext
     * @param destination
     * @param source
     */
    constructor(name, audioContext, destination, source) {
        this.name = name;
        this.audioContext = audioContext;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(destination);
        this.loadedSource = source;
        this.gainPrimaryNode = audioContext.createGain();
        this.gainSecondaryNode = audioContext.createGain();
        this.gainPrimaryNode.connect(this.gainNode);
        this.gainSecondaryNode.connect(this.gainNode);
    }
    toString() {
        return `TrackSingle[${this.name}] with context ${this.audioContext}`;
    }
    connect(destination, outputIndex, inputIndex) {
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        else if (destination instanceof AudioParam) {
            return this.gainNode.connect(destination, outputIndex);
        }
        else {
            console.warn(`Cannot connect to type ${destination?.constructor?.name}. This is likely a mistake.`);
        }
    }
    start(optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        this.lastStartCallTime = this.audioContext.currentTime;
        // Implicitly load a copy of the same source to call swap
        if (this.playingSource?.isActive && !this.loadedSource) {
            this.loadedSource = this.playingSource.clone(this);
            this.loadedSource.hrtfPanner = this.playingSource.hrtfPanner;
            this.isLoadSourceCalled = true;
        }
        // Swap after loading a source with loadSource()
        if (this.playingSource?.isActive && this.isLoadSourceCalled && this.loadedSource) {
            if (delay) {
                return this.swap(delay, offset, duration);
            }
            const swapOptions = buildOptions(options, defaults.trackSwapOutIn);
            if (offset != undefined && duration != undefined) {
                return this.swap(offset, duration, swapOptions);
            }
            return this.swap(swapOptions);
        }
        const startOptions = buildOptions(options, defaults.startImmediate);
        if (delay != undefined) {
            startOptions.delay += delay;
        }
        // Move the loaded source into the playing source
        let sourceChanged = false;
        if (this.loadedSource) {
            this.loadedSource.disconnect(); // claim the loadedSource
            if (this.playingSource) {
                if (this.playingSource.isActive) {
                    const fadeOut = structuredClone(defaults.automationNatural);
                    this.playingSource.volume(0, fadeOut);
                    this.playingSource.stop(this._time + fadeOut.delay + fadeOut.duration);
                    if (this.playingSource.owner == this) {
                        setTimeout(this.playingSource.destroy, fadeOut.delay + fadeOut.duration);
                    }
                }
                else if (this.playingSource.owner == this) {
                    this.playingSource.destroy();
                }
            }
            this.playingSource = this.loadedSource;
            this.gainPrimaryNode.gain.value = 0;
            this.playingSource.connect(this.gainPrimaryNode);
            this.loadedSource = undefined;
            this.isLoadSourceCalled = false;
            sourceChanged = true;
        }
        if (!this.playingSource) {
            console.warn('Track.start() called with no source loaded. This is likely a mistake.');
            return this;
        }
        if (this.playingSource.isDestroyed) {
            if (this.playingSource.owner == this) {
                console.warn(`Track's playingSource was unexpectedly destroyed. This is likely a mistake.`);
            }
            this.playingSource = undefined;
            return this;
        }
        if (this.playingSource.buffer) {
            this.playingSource.start(this._time + startOptions.delay, offset || (!sourceChanged ? this.resumeMarker : 0));
        }
        else if (!this.playingSource.isLoaded) {
            const self = this;
            const expectedCallTime = this.lastStartCallTime;
            this.playingSource.addEventListener('loaded', (event) => {
                if (!event.target.isDestroyed &&
                    self.lastStartCallTime - expectedCallTime < Number.EPSILON) {
                    event.target.start(self._time + startOptions.delay, offset || (!sourceChanged ? self.resumeMarker : 0));
                }
            }, { once: true });
        }
        else {
            console.warn(`Track's AudioSourceNode seems to be in an invalid state. ` +
                `There is no buffer, yet load() has completed previously. ` +
                `Have you deliberately set the AudioSourceNode buffer to null?`);
            return this;
        }
        automation(this.audioContext, this.gainPrimaryNode.gain, 1, startOptions, true);
        this.nextStopTime = 0;
        this.resumeMarker = 0;
        if (duration != undefined) {
            this.stop(startOptions.delay + duration);
        }
        return this;
    }
    stop(delayOrOptions) {
        let delay;
        let options;
        if (typeof delayOrOptions == 'number') {
            delay = delayOrOptions;
        }
        else {
            options = delayOrOptions;
        }
        if (!this.playingSource?.isActive) {
            return this;
        }
        const position = this.playingSource.position();
        if (position != -1) {
            this.resumeMarker = position;
        }
        const stopOptions = buildOptions(options, defaults.stopImmediate);
        if (delay != undefined) {
            stopOptions.delay += delay;
        }
        const scheduledStop = this._time + stopOptions.delay + stopOptions.duration;
        if (this.nextStopTime == 0 || scheduledStop < this.nextStopTime) {
            this.nextStopTime = scheduledStop;
        }
        this.playingSource.stop(this.nextStopTime);
        automation(this.audioContext, this.gainPrimaryNode.gain, 0, stopOptions, true);
        return this;
    }
    playSource(path, optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        const audioSource = this.loadSource(path);
        if (delay) {
            this.start(delay, offset, duration);
        }
        else if (options) {
            if (offset != undefined && duration != undefined) {
                this.start(offset, duration, options);
            }
            else {
                this.start(options);
            }
        }
        else {
            this.start();
        }
        return audioSource;
    }
    loadSource(pathOrSource) {
        if (this.loadedSource?.owner == this) {
            this.loadedSource.destroy();
        }
        if (typeof pathOrSource == 'string') {
            this.loadedSource = new AudioSourceNode(this.audioContext, this);
            this.loadedSource.load(pathOrSource);
        }
        else {
            this.loadedSource = pathOrSource;
        }
        this.isLoadSourceCalled = true;
        return this.loadedSource;
    }
    getActiveSource() {
        return this.playingSource ?? null;
    }
    getLoadedSource() {
        return this.loadedSource ?? null;
    }
    swap(optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        if (!this.isLoadSourceCalled) {
            return this;
        }
        this.isLoadSourceCalled = false;
        if (!this.loadedSource) {
            console.warn('Track has an invalid state, loadSource() seems to have been recently called, ' +
                'but there is no loaded source. This is a mistake.');
            return this;
        }
        const originalSource = this.playingSource;
        this.playingSource = undefined;
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        const swapOptions = buildOptions(options, defaults.trackSwapDefault);
        if (delay != undefined) {
            swapOptions.newSource.delay += delay;
            swapOptions.oldSource.delay += delay;
        }
        if (originalSource) {
            this.gainSecondaryNode.gain.value = this.gainPrimaryNode.gain.value;
            originalSource.connect(this.gainSecondaryNode);
            originalSource.disconnect(this.gainPrimaryNode);
            originalSource.stop(this._time + swapOptions.oldSource.delay + swapOptions.oldSource.duration);
            automation(this.audioContext, this.gainSecondaryNode.gain, 0, swapOptions.oldSource);
            if (originalSource.owner == this) {
                setTimeout(originalSource.destroy, swapOptions.oldSource.delay + swapOptions.oldSource.duration);
            }
        }
        if (offset != undefined && duration != undefined) {
            return this.start(offset, duration, swapOptions.newSource);
        }
        return this.start(swapOptions.newSource);
    }
    volume(volume, options) {
        automation(this.audioContext, this.gainNode.gain, volume, buildOptions(options, defaults.automationDefault));
        return this;
    }
    loop(enabled, startSample, endSample) {
        const source = this.playingSource ?? this.loadedSource;
        this.lastLoopCallTime = this.audioContext.currentTime;
        if (source && !source.isDestroyed) {
            if (source.buffer?.sampleRate) {
                source.loop = enabled;
                if (startSample != undefined) {
                    source.loopStart = startSample / source.buffer.sampleRate;
                }
                if (endSample != undefined) {
                    source.loopEnd = endSample / source.buffer.sampleRate;
                }
            }
            else if (!source.isLoaded) {
                const self = this;
                const expectedCallTime = this.lastLoopCallTime;
                source.addEventListener('loaded', (event) => {
                    if (!event.target.isDestroyed &&
                        self.lastLoopCallTime - expectedCallTime < Number.EPSILON) {
                        self.loop(enabled, startSample, endSample);
                    }
                }, {
                    once: true,
                });
                return this;
            }
            else {
                console.warn(`Track's AudioSourceNode seems to be in an invalid state. ` +
                    `There is no buffer, yet load() has completed previously. ` +
                    `Have you deliberately set the AudioSourceNode buffer to null?`);
                return this;
            }
        }
        return this;
    }
    jump(enabled, fromSample, toSample) {
        console.log(`stub jump ${enabled} from ${fromSample} to ${toSample}`);
        return this;
    }
    createBeat(type, origin, period) {
        console.log(`stub createBeat of ${type} at ${origin} with period ${period}`);
        return { time: 0, isCancelled: false, cancel: () => { } };
    }
    clearBeats() {
        console.log('stub clearBeats');
        return this;
    }
    syncPlayTo(track, options) {
        console.log(`stub syncPlayTo ${track} with options ${options}`);
        return this;
    }
    syncStopTo(track, options) {
        console.log(`stub syncStopTo ${track} with options ${options}`);
        return this;
    }
    listenFor(type, callback) {
        console.log(`stub listenFor ${type} calling ${callback}`);
        return this;
    }
    get _time() {
        return this.audioContext.currentTime;
    }
}
// #endregion TrackSingle
// #region TrackGroup
/**
 * TrackGroup. All TrackGroups are constructed with a primary Track that shares the same name as the group,
 * to which most methods will operate as a transparent call onto the primary Track. Unless otherwise stated
 * by the method's documentation, assume it acts directly onto the primary Track.
 */
class TrackGroup {
    name;
    audioContext;
    tracks = {};
    gainNode;
    constructor(name, audioContext, destination, source) {
        this.name = name;
        this.audioContext = audioContext;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(destination);
        const track = new TrackSingle(name, audioContext, this.gainNode, source);
        this.tracks[name] = track;
    }
    toString() {
        return `TrackGroup[${this.name}] with context ${this.audioContext}`;
    }
    connect(destination, outputIndex, inputIndex) {
        if (destination instanceof AudioNode) {
            return this.gainNode.connect(destination, outputIndex, inputIndex);
        }
        else if (destination instanceof AudioParam) {
            return this.gainNode.connect(destination, outputIndex);
        }
        else {
            console.warn(`Cannot connect to type ${destination?.constructor?.name}. This is likely a mistake.`);
        }
    }
    /**
     * Retrieve a track by its name.
     *
     * @param name track name
     * @returns {Track} if found, `undefined` otherwise
     */
    track(name) {
        return this.tracks[name];
    }
    /**
     * Retrieve the primary Track for this TrackGroup. It will share the name of this TrackGroup
     * and is guaranteed* to exist.
     *
     * \* Unless you do some funny business and delete it!
     *
     * @returns {Track} the primary Track of this TrackGroup
     */
    primaryTrack() {
        return this.tracks[this.name];
    }
    newTrack(name, pathOrSource) {
        if (name == this.name) {
            throw new Error(`Cannot use name "${name}" as it is the name of this group track`);
        }
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this group track`);
        }
        const track = new TrackSingle(name, this.audioContext, this.gainNode);
        if (pathOrSource != undefined) {
            if (typeof pathOrSource == 'string') {
                track.loadSource(pathOrSource);
            }
            else {
                track.loadSource(pathOrSource);
            }
        }
        this.tracks[name] = track;
        return track;
    }
    start(optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        if (delay) {
            for (const track in this.tracks) {
                this.tracks[track]?.start(delay, offset, duration);
            }
        }
        else if (options) {
            if (offset != undefined && duration != undefined) {
                for (const track in this.tracks) {
                    this.tracks[track]?.start(offset, duration, options);
                }
            }
            else {
                for (const track in this.tracks) {
                    this.tracks[track]?.start(options);
                }
            }
        }
        else {
            for (const track in this.tracks) {
                this.tracks[track]?.start();
            }
        }
        return this;
    }
    stop(delayOrOptions) {
        let delay;
        let options;
        if (typeof delayOrOptions == 'number') {
            delay = delayOrOptions;
        }
        else {
            options = delayOrOptions;
        }
        if (delay) {
            for (const track in this.tracks) {
                this.tracks[track]?.stop(delay);
            }
        }
        else if (options) {
            for (const track in this.tracks) {
                this.tracks[track]?.stop(options);
            }
        }
        else {
            for (const track in this.tracks) {
                this.tracks[track]?.stop();
            }
        }
        return this;
    }
    playSource(path, optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        if (delay) {
            return this.primaryTrack().playSource(path, delay, offset, duration);
        }
        else if (options) {
            if (offset != undefined && duration != undefined) {
                return this.primaryTrack().playSource(path, offset, duration, options);
            }
            else {
                return this.primaryTrack().playSource(path, options);
            }
        }
        else {
            return this.primaryTrack().playSource(path);
        }
    }
    loadSource(pathOrSource) {
        if (typeof pathOrSource == 'string') {
            return this.primaryTrack().loadSource(pathOrSource);
        }
        else {
            return this.primaryTrack().loadSource(pathOrSource);
        }
    }
    getActiveSource() {
        return this.primaryTrack().getActiveSource();
    }
    getLoadedSource() {
        return this.primaryTrack().getLoadedSource();
    }
    swap(optionsOrDelayOrOffset, offsetOrDuration, optionsOrDuration) {
        let options;
        let delay;
        let offset;
        let duration;
        if (typeof optionsOrDelayOrOffset == 'number') {
            if (optionsOrDuration == undefined || typeof optionsOrDuration == 'number') {
                delay = optionsOrDelayOrOffset;
                offset = offsetOrDuration;
                duration = optionsOrDuration;
            }
            else {
                offset = optionsOrDelayOrOffset;
                duration = offsetOrDuration;
                options = optionsOrDuration;
            }
        }
        else {
            options = optionsOrDelayOrOffset;
        }
        if (delay) {
            return this.primaryTrack().swap(delay, offset, duration);
        }
        else if (options) {
            if (offset != undefined && duration != undefined) {
                return this.primaryTrack().swap(offset, duration, options);
            }
            else {
                return this.primaryTrack().swap(options);
            }
        }
        else {
            return this.primaryTrack().swap();
        }
    }
    /**
     * Adjusts the volume output of this group.
     */
    volume(volume, options) {
        automation(this.audioContext, this.gainNode.gain, volume, buildOptions(options, defaults.automationDefault));
        return this;
    }
    loop(enabled, startSample, endSample) {
        this.primaryTrack().loop(enabled, startSample, endSample);
        return this;
    }
    jump(enabled, fromSample, toSample) {
        this.primaryTrack().jump(enabled, fromSample, toSample);
        return this;
    }
    createBeat(type, origin, period) {
        return this.primaryTrack().createBeat(type, origin, period);
    }
    /**
     * Clears beats across all tracks in the group.
     */
    clearBeats() {
        for (const track in this.tracks) {
            this.tracks[track]?.clearBeats();
        }
        return this;
    }
    /**
     * Synchronizes playback of all tracks in the group.
     */
    syncPlayTo(track, options) {
        for (const t in this.tracks) {
            this.tracks[t]?.syncPlayTo(track, options);
        }
        return this;
    }
    /**
     * Synchronizes stopping of all track in the group.
     */
    syncStopTo(track, options) {
        for (const t in this.tracks) {
            this.tracks[t]?.syncStopTo(track, options);
        }
        return this;
    }
    listenFor(type, callback) {
        this.primaryTrack().listenFor(type, callback);
        return this;
    }
}
// #endregion TrackGroup
export default TrackSingle;
export { TrackGroup };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvVHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxVQUFzQyxNQUFNLGlCQUFpQixDQUFDO0FBQ3JFLE9BQU8sWUFBWSxFQUFFLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQW9CeEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWVYO0FBZkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsd0NBQXVCLENBQUE7SUFFdkI7O09BRUc7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFmVyxhQUFhLEtBQWIsYUFBYSxRQWV4QjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBaUNYO0FBakNELFdBQVksY0FBYztJQUN0Qjs7O09BR0c7SUFDSCxrREFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsZ0RBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCwrQkFBYSxDQUFBO0lBRWI7Ozs7O09BS0c7SUFDSCx1Q0FBcUIsQ0FBQTtJQUVyQjs7OztPQUlHO0lBQ0gsdUNBQXFCLENBQUE7QUFDekIsQ0FBQyxFQWpDVyxjQUFjLEtBQWQsY0FBYyxRQWlDekI7QUFFRCxNQUFNLENBQU4sSUFBWSxhQW9CWDtBQXBCRCxXQUFZLGFBQWE7SUFDckI7O09BRUc7SUFDSCxpQ0FBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlDQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsZ0NBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNEJBQVcsQ0FBQTtBQUNmLENBQUMsRUFwQlcsYUFBYSxLQUFiLGFBQWEsUUFvQnhCO0FBcU9ELHFCQUFxQjtBQUNyQjs7R0FFRztBQUNILE1BQU0sV0FBVztJQTZFUTtJQUNBO0lBN0VyQjs7T0FFRztJQUNjLFFB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
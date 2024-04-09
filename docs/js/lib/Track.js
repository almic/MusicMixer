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
        // Implicitly load a copy of the same source to call swap
        if (this.playingSource?.isActive && !this.loadedSource) {
            this.loadedSource = this.playingSource.clone();
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
        if (this.loadedSource) {
            this.loadedSource.disconnect(); // claim the loadedSource
            if (this.playingSource) {
                const fadeOut = structuredClone(defaults.automationNatural);
                this.playingSource.volume(0, fadeOut);
                this.playingSource.stop(this._time + fadeOut.delay + fadeOut.duration);
                setTimeout(this.playingSource.destroy, fadeOut.delay + fadeOut.duration);
            }
            this.playingSource = this.loadedSource;
            this.gainPrimaryNode.gain.value = 0;
            this.playingSource.connect(this.gainPrimaryNode);
            this.loadedSource = undefined;
        }
        if (!this.playingSource) {
            console.warn('Track.start() called with no source loaded. This is likely a mistake.');
            return this;
        }
        this.playingSource.start(this._time + startOptions.delay, offset || this.resumeMarker);
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
    loadSource(path) {
        this.loadedSource = new AudioSourceNode(this.audioContext);
        this.isLoadSourceCalled = true;
        this.loadedSource.load(path);
        return this.loadedSource;
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
            setTimeout(originalSource.destroy, swapOptions.oldSource.delay + swapOptions.oldSource.duration);
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
        console.log(`stub loop ${enabled} in range ${startSample} to ${endSample}`);
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
    /**
     * Add a new track to this group.
     * @param name name of the track
     * @param path path to audio source
     * @param source loaded audio source
     * @returns {Track} the new Track
     */
    newTrack(name, path, source) {
        if (name == this.name) {
            throw new Error(`Cannot use name "${name}" as it is the name of this group track`);
        }
        if (Object.keys(this.tracks).includes(name)) {
            throw new Error(`Cannot use name "${name}" as it already exists in this group track`);
        }
        let audioSource = source;
        if (!audioSource) {
            audioSource = new AudioSourceNode(this.audioContext, this.gainNode);
            if (path) {
                audioSource.load(path);
            }
        }
        const track = new TrackSingle(name, this.audioContext, this.gainNode, audioSource);
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
    loadSource(path) {
        return this.primaryTrack().loadSource(path);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvVHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxVQUFzQyxNQUFNLGlCQUFpQixDQUFDO0FBQ3JFLE9BQU8sWUFBWSxFQUFFLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQW9CeEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWVYO0FBZkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsd0NBQXVCLENBQUE7SUFFdkI7O09BRUc7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFmVyxhQUFhLEtBQWIsYUFBYSxRQWV4QjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBaUNYO0FBakNELFdBQVksY0FBYztJQUN0Qjs7O09BR0c7SUFDSCxrREFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsZ0RBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCwrQkFBYSxDQUFBO0lBRWI7Ozs7O09BS0c7SUFDSCx1Q0FBcUIsQ0FBQTtJQUVyQjs7OztPQUlHO0lBQ0gsdUNBQXFCLENBQUE7QUFDekIsQ0FBQyxFQWpDVyxjQUFjLEtBQWQsY0FBYyxRQWlDekI7QUFFRCxNQUFNLENBQU4sSUFBWSxhQW9CWDtBQXBCRCxXQUFZLGFBQWE7SUFDckI7O09BRUc7SUFDSCxpQ0FBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlDQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsZ0NBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNEJBQVcsQ0FBQTtBQUNmLENBQUMsRUFwQlcsYUFBYSxLQUFiLGFBQWEsUUFvQnhCO0FBNk1ELHFCQUFxQjtBQUNyQjs7R0FFRztBQUNILE1BQU0sV0FBVztJQTBEUTtJQUNBO0lBMURyQjs7T0FFRztJQUNjLFFB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
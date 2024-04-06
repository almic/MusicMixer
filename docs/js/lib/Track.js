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
/**
 * Track implementation
 */
class TrackSingle {
    name;
    audioContext;
    destination;
    source;
    gainNode;
    loadedSource;
    playingSource;
    isLoadSourceCalled = false;
    constructor(name, audioContext, destination, source) {
        this.name = name;
        this.audioContext = audioContext;
        this.destination = destination;
        this.source = source;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(destination);
        this.loadedSource = source;
    }
    toString() {
        return `TrackSingle[${this.name}] with context ${this.audioContext} and source ${this.source}`;
    }
    start(delay, options, duration) {
        // Implicitly load a copy of the same source to call swap
        if (this.playingSource && !this.loadedSource) {
            this.loadedSource = this.playingSource.clone();
            this.isLoadSourceCalled = true;
        }
        // Swap after loading a source with loadSource()
        if (this.isLoadSourceCalled && this.loadedSource) {
            const swapOptions = buildOptions(options, defaults.trackSwapDefault);
            this.swap(swapOptions); // resets isLoadSourceCalled and loadedSource
            if (duration != undefined) {
                this.stop((options?.delay ?? delay ?? 0) + duration);
            }
            return this;
        }
        if (this.loadedSource) {
            this.playingSource = this.loadedSource;
            this.playingSource.connect(this.gainNode);
            const startOptions = buildOptions(options, defaults.startImmediate);
            if (delay != undefined && options?.delay == undefined) {
                startOptions.delay += delay;
            }
            const currentGain = this.gainNode.gain.value;
            this.gainNode.gain.value = 0;
            this.playingSource.start(this._time + startOptions.delay);
            this.loadedSource = undefined;
            automation(this.audioContext, this.gainNode.gain, currentGain, startOptions);
            if (duration != undefined) {
                this.stop(startOptions.delay + duration);
            }
            return this;
        }
        console.warn('Track.start() called with no source loaded. This is likely a mistake.');
        return this;
    }
    stop(delay, options) {
        console.log(`stub stop with ${delay} seconds of delay with options ${options}`);
        return this;
    }
    playSource(path, options) {
        console.log(`stub playSource at ${path} with ${options}`);
        const audioSource = this.loadSource(path);
        this.start(0, options);
        return audioSource;
    }
    loadSource(path) {
        console.log(`stub loadSource at ${path}`);
        return new AudioSourceNode(this.audioContext, this.gainNode);
    }
    swap(options) {
        console.log(`stub swap with ${options}`);
        return this;
    }
    volume(volume, options) {
        console.log(`stub volume changed to ${volume} with ${options}`);
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
/**
 * TrackGroup. All TrackGroups are constructed with a primary Track that shares the same name as the group,
 * to which most methods will operate as a transparent call onto the primary Track. Unless otherwise stated
 * by the method's documentation, assume it acts directly onto the primary Track.
 */
class TrackGroup {
    name;
    audioContext;
    destination;
    source;
    tracks = {};
    gainNode;
    constructor(name, audioContext, destination, source) {
        this.name = name;
        this.audioContext = audioContext;
        this.destination = destination;
        this.source = source;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(destination);
        const track = new TrackSingle(name, audioContext, this.gainNode, source);
        this.tracks[name] = track;
    }
    toString() {
        return `TrackGroup[${this.name}] with context ${this.audioContext} and source ${this.source}`;
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
    /**
     * Starts playback of all tracks in this group.
     */
    start(delay, options, duration) {
        for (const track in this.tracks) {
            this.tracks[track]?.start(delay, options, duration);
        }
        return this;
    }
    /**
     * Stops playback of all tracks in this group.
     */
    stop(delay, options) {
        for (const track in this.tracks) {
            this.tracks[track]?.stop(delay, options);
        }
        return this;
    }
    playSource(path, options) {
        return this.primaryTrack().playSource(path, options);
    }
    loadSource(path) {
        return this.primaryTrack().loadSource(path);
    }
    swap(options) {
        return this.primaryTrack().swap(options);
    }
    /**
     * Adjusts the volume output of this group.
     */
    volume(volume, options) {
        console.log(`stub volume changed to ${volume} with ${options}`);
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
export default TrackSingle;
export { TrackGroup };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvVHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxVQUFzQyxNQUFNLGlCQUFpQixDQUFDO0FBQ3JFLE9BQU8sWUFBWSxFQUFFLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQW9CeEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWVYO0FBZkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsd0NBQXVCLENBQUE7SUFFdkI7O09BRUc7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFmVyxhQUFhLEtBQWIsYUFBYSxRQWV4QjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBaUNYO0FBakNELFdBQVksY0FBYztJQUN0Qjs7O09BR0c7SUFDSCxrREFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsZ0RBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCwrQkFBYSxDQUFBO0lBRWI7Ozs7O09BS0c7SUFDSCx1Q0FBcUIsQ0FBQTtJQUVyQjs7OztPQUlHO0lBQ0gsdUNBQXFCLENBQUE7QUFDekIsQ0FBQyxFQWpDVyxjQUFjLEtBQWQsY0FBYyxRQWlDekI7QUFFRCxNQUFNLENBQU4sSUFBWSxhQW9CWDtBQXBCRCxXQUFZLGFBQWE7SUFDckI7O09BRUc7SUFDSCxpQ0FBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlDQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsZ0NBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNEJBQVcsQ0FBQTtBQUNmLENBQUMsRUFwQlcsYUFBYSxLQUFiLGFBQWEsUUFvQnhCO0FBbUxEOztHQUVHO0FBQ0gsTUFBTSxXQUFXO0lBT1E7SUFDQTtJQUNSO0lBQ0E7SUFUSSxRQUFRLENBQVc7SUFDNUIsWUFB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
import AudioSourceNode from './AudioSourceNode.js';
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
                this.stop((delay ?? 0) + (options?.delay ?? 0) + duration);
            }
            return this;
        }
        if (this.loadedSource) {
            this.playingSource = this.loadedSource;
            this.playingSource.connect(this.gainNode);
            const startOptions = buildOptions(options, defaults.startImmediate);
            this.playingSource.start(this._time + (delay ?? 0) + startOptions.delay);
            this.loadedSource = undefined;
            if (duration != undefined) {
                this.stop((delay ?? 0) + startOptions.delay + duration);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvVHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUEyQyxNQUFNLHNCQUFzQixDQUFDO0FBQy9FLE9BQU8sWUFBWSxFQUFFLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQW9CeEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWVYO0FBZkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsd0NBQXVCLENBQUE7SUFFdkI7O09BRUc7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFmVyxhQUFhLEtBQWIsYUFBYSxRQWV4QjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBaUNYO0FBakNELFdBQVksY0FBYztJQUN0Qjs7O09BR0c7SUFDSCxrREFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsZ0RBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCwrQkFBYSxDQUFBO0lBRWI7Ozs7O09BS0c7SUFDSCx1Q0FBcUIsQ0FBQTtJQUVyQjs7OztPQUlHO0lBQ0gsdUNBQXFCLENBQUE7QUFDekIsQ0FBQyxFQWpDVyxjQUFjLEtBQWQsY0FBYyxRQWlDekI7QUFFRCxNQUFNLENBQU4sSUFBWSxhQW9CWDtBQXBCRCxXQUFZLGFBQWE7SUFDckI7O09BRUc7SUFDSCxpQ0FBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlDQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsZ0NBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNEJBQVcsQ0FBQTtBQUNmLENBQUMsRUFwQlcsYUFBYSxLQUFiLGFBQWEsUUFvQnhCO0FBbUxEOztHQUVHO0FBQ0gsTUFBTSxXQUFXO0lBT1E7SUFDQTtJQUNSO0lBQ0E7SUFUSSxRQUFRLENBQVc7SUFDNUIsWUFBWSxDQUFtQjtJQUMvQixhQUFhLENBQW1CO0lBQ2hDLGtC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
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
        this.destination = destination;
        this.source = source;
        this.gainNode = audioContext.createGain();
        this.gainNode.connect(destination);
        this.loadedSource = source;
        this.gainPrimaryNode = audioContext.createGain();
        this.gainSecondaryNode = audioContext.createGain();
        this.gainPrimaryNode.connect(this.gainNode);
        this.gainSecondaryNode.connect(this.gainNode);
    }
    toString() {
        return `TrackSingle[${this.name}] with context ${this.audioContext} and source ${this.source}`;
    }
    start(delay, options, duration) {
        // Implicitly load a copy of the same source to call swap
        if (this.playingSource?.isActive && !this.loadedSource) {
            this.loadedSource = this.playingSource.clone();
            this.isLoadSourceCalled = true;
        }
        // Swap after loading a source with loadSource()
        if (this.playingSource?.isActive && this.isLoadSourceCalled && this.loadedSource) {
            const swapOptions = buildOptions(options, defaults.trackSwapDefault);
            this.swap(swapOptions);
            if (duration != undefined) {
                this.stop((options?.delay ?? delay ?? 0) + duration);
            }
            return this;
        }
        const startOptions = buildOptions(options, defaults.startImmediate);
        if (delay != undefined && options?.delay == undefined) {
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
        this.playingSource.start(this._time + startOptions.delay, this.resumeMarker);
        automation(this.audioContext, this.gainPrimaryNode.gain, 1, startOptions, true);
        this.nextStopTime = 0;
        this.resumeMarker = 0;
        if (duration != undefined) {
            this.stop(startOptions.delay + duration);
        }
        return this;
    }
    stop(delay, options) {
        if (!this.playingSource?.isActive) {
            return this;
        }
        const position = this.playingSource.position();
        if (position != -1) {
            this.resumeMarker = position;
        }
        console.log({ resumeMarker: this.resumeMarker });
        const stopOptions = buildOptions(options, defaults.stopImmediate);
        if (delay != undefined && options?.delay == undefined) {
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
        this.loadedSource = undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvVHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxVQUFzQyxNQUFNLGlCQUFpQixDQUFDO0FBQ3JFLE9BQU8sWUFBWSxFQUFFLEtBQUssUUFBUSxNQUFNLGVBQWUsQ0FBQztBQW9CeEQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQWVYO0FBZkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsd0NBQXVCLENBQUE7SUFFdkI7O09BRUc7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFmVyxhQUFhLEtBQWIsYUFBYSxRQWV4QjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBaUNYO0FBakNELFdBQVksY0FBYztJQUN0Qjs7O09BR0c7SUFDSCxrREFBZ0MsQ0FBQTtJQUVoQzs7OztPQUlHO0lBQ0gsZ0RBQThCLENBQUE7SUFFOUI7O09BRUc7SUFDSCwrQkFBYSxDQUFBO0lBRWI7Ozs7O09BS0c7SUFDSCx1Q0FBcUIsQ0FBQTtJQUVyQjs7OztPQUlHO0lBQ0gsdUNBQXFCLENBQUE7QUFDekIsQ0FBQyxFQWpDVyxjQUFjLEtBQWQsY0FBYyxRQWlDekI7QUFFRCxNQUFNLENBQU4sSUFBWSxhQW9CWDtBQXBCRCxXQUFZLGFBQWE7SUFDckI7O09BRUc7SUFDSCxpQ0FBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILGlDQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsZ0NBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNEJBQVcsQ0FBQTtBQUNmLENBQUMsRUFwQlcsYUFBYSxLQUFiLGFBQWEsUUFvQnhCO0FBdUxEOztHQUVHO0FBQ0gsTUFBTSxXQUFXO0lBMERRO0lBQ0E7SUFDUjtJQUNBO0lBNURiOztPQUVHO0lBQ2MsUUFBUSxD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
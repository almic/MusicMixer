/**
 * HRTF Panner that wraps two PannerNodes so they can be interpolated during updates.
 * Supposedly, the one included with Web Audio APIs are "not of the best quality" and I'm all about quality.
 *
 * The inspiration of this implementation comes from <https://github.com/twoz/hrtf-panner-js>, by Tomasz Woźniak.
 * I have not duplicated enough code to really say this contains a substantial portion, and this project is
 * already under the MIT license, so I'm sure giving his name is more than enough.
 *
 * How this works:
 *   - Split stereo input into left and right channels
 *   - Apply a lowpass filter to each channel, keep these frequencies for last step
 *   - Apply a highpass filter to each channel, spatializing with the panner node
 *   - Merge output of panner node with incoming low frequencies, send to output
 *
 * This means that low frequencies will not be spatialized, because:
 *     "Those are in their nature non-directional: hearing a deep bass coming
 *      only from one direction is very unnatural to hear." - T. Woźniak
 *
 * TODO:
 * - Implement custom HRTF from
 *   <https://codeandsound.wordpress.com/2015/04/08/implementing-binaural-hrtf-panner-node-with-web-audio-api/>.
 *
 * - Using this database:
 *   <https://3d3a.princeton.edu/3d3a-lab-head-related-transfer-function-database>
 *
 */
declare class HRTFPannerNode {
    readonly audioContext: AudioContext;
    private pannerNodeMain;
    private pannerNodeInterpolate;
    private highpassFilter;
    private lowpassFilter;
    private gainPrimaryNode;
    private gainSecondaryNode;
    /** Tracks if the method `connectSource()` has been called previously */
    private isSourceConnected;
    /** Tracks the last time that an interpolation was scheduled */
    private lastInterpolationTime;
    /** The interpolation time, in milliseconds */
    private interpolateTime;
    /** The values that will be used for the next interpolation */
    private nextInterpolateMap;
    constructor(audioContext: AudioContext, options?: PannerOptions);
    connectSource(source: AudioNode): void;
    disconnectSource(source: AudioNode): void;
    updatePosition(positionX: number, positionY: number, positionZ: number): void;
    updateOrientation(orientationX: number, orientationY: number, orientationZ: number): void;
    updatePositionOrientation(positionX: number, positionY: number, positionZ: number, orientationX: number, orientationY: number, orientationZ: number): void;
    /**
     * Schedules an interpolation between the `pannerNodeMain` and `pannerNodeInterpolate`, updating
     * at most every `interpolateTime` milliseconds.
     */
    private scheduleInterpolation;
    connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    connect(destination: AudioParam, outputIndex?: number): void;
    disconnect(): void;
    disconnect(output: number): void;
    disconnect(destinationNode: AudioNode): void;
    disconnect(destinationNode: AudioNode, output: number): void;
    disconnect(destinationNode: AudioNode, output: number, input: number): void;
    disconnect(destinationParam: AudioParam): void;
    disconnect(destinationParam: AudioParam, output: number): void;
}
export default HRTFPannerNode;

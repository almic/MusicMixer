import automation, { AudioRampType } from './automation.js';
import buildOptions, * as defaults from './defaults.js';

/**
 * Values that can be interpolated by HRTFPannerNode
 */
type InterpolationMap = {
    positionX: number;
    positionY: number;
    positionZ: number;
    orientationX: number;
    orientationY: number;
    orientationZ: number;
    coneInnerAngle: number;
    coneOuterAngle: number;
    coneOuterGain: number;
};

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
class HRTFPannerNode {
    private pannerOptions: Required<PannerOptions>;
    private pannerNodeMain: PannerNode;
    private pannerNodeInterpolate: PannerNode;

    private highpassFilter: BiquadFilterNode;
    private lowpassFilter: BiquadFilterNode;

    private gainPrimaryNode: GainNode;
    private gainSecondaryNode: GainNode;
    private gainLowpassNode: GainNode;

    /** Tracks if the method `connectSource()` has been called previously */
    private isSourceConnected: boolean = false;

    /** Tracks the last time that an interpolation was scheduled */
    private lastInterpolationTime: number = 0;

    /** The interpolation time, in milliseconds */
    private interpolateTime: number = 30;

    /** interpolateTime in seconds */
    private interpolateTimeSeconds = this.interpolateTime / 1000;

    /** Small delay for audio scheduling latency, in milliseconds */
    private interpolateDelay: number = 1;

    /** interpolateDelay in seconds */
    private interpolateDelaySeconds = this.interpolateDelay / 1000;

    /** Holds the equal power interpolation ramp */
    private interpolateRamp: Float32Array;

    /** The values that will be used for the next interpolation */
    private nextInterpolateMap: InterpolationMap;

    constructor(
        readonly audioContext: AudioContext,
        options?: PannerOptions,
    ) {
        this.pannerOptions = buildOptions(options, defaults.pannerDefault);

        if (this.pannerOptions.maxDistance < Number.EPSILON) {
            throw new RangeError(
                `The maxDistance value ${this.pannerOptions.maxDistance} is below the minimum acceptable value of ${Number.EPSILON}.`,
            );
        }

        if (this.pannerOptions.refDistance < Number.EPSILON) {
            throw new RangeError(
                `The refDistance value ${this.pannerOptions.refDistance} is below the minimum acceptable value of ${Number.EPSILON}.`,
            );
        }

        this.pannerNodeMain = new PannerNode(audioContext, this.pannerOptions);
        this.pannerNodeInterpolate = new PannerNode(audioContext, this.pannerOptions);

        this.nextInterpolateMap = {
            positionX: this.pannerOptions.positionX,
            positionY: this.pannerOptions.positionY,
            positionZ: this.pannerOptions.positionZ,
            orientationX: this.pannerOptions.orientationX,
            orientationY: this.pannerOptions.orientationY,
            orientationZ: this.pannerOptions.orientationZ,
            coneInnerAngle: this.pannerOptions.coneInnerAngle,
            coneOuterAngle: this.pannerOptions.coneOuterAngle,
            coneOuterGain: this.pannerOptions.coneOuterGain,
        };

        this.highpassFilter = new BiquadFilterNode(audioContext, {
            type: 'highpass',
            frequency: 200,
            channelCount: 2,
            channelCountMode: 'clamped-max',
        });
        this.lowpassFilter = new BiquadFilterNode(audioContext, {
            type: 'lowpass',
            frequency: 200,
            channelCount: 2,
            channelCountMode: 'clamped-max',
        });

        this.gainPrimaryNode = audioContext.createGain();
        this.gainSecondaryNode = audioContext.createGain();
        this.gainLowpassNode = audioContext.createGain();

        this.gainSecondaryNode.gain.value = 0;

        this.lowpassFilter.connect(this.gainLowpassNode).connect(this.gainPrimaryNode);
        this.highpassFilter.connect(this.pannerNodeMain);
        this.pannerNodeMain.connect(this.gainPrimaryNode);

        this.interpolateRamp = this.computeRamp();
    }

    private computeRamp(): Float32Array {
        const length = Math.round(this.interpolateTime);
        const halfPi = Math.PI / 2;
        const squashFactor = halfPi / length;
        const result = new Float32Array(length);
        for (let index = 0; index < length; index++) {
            result[index] = Math.cos((index - length + 1) * squashFactor);
        }
        return result;
    }

    private computeDistanceGain(): number {
        const listener = this.audioContext.listener;
        const x = this.nextInterpolateMap.positionX - listener.positionX.value,
            y = this.nextInterpolateMap.positionY - listener.positionY.value,
            z = this.nextInterpolateMap.positionZ - listener.positionZ.value;
        const maxDistance = this.pannerOptions.maxDistance;
        const distance = Math.sqrt(x * x + y * y + z * z);
        if (distance >= maxDistance) {
            return 0;
        }
        const refDistance = this.pannerOptions.refDistance;
        const rolloffFactor = this.pannerOptions.rolloffFactor;
        switch (this.pannerNodeMain.distanceModel) {
            case 'linear': {
                const distanceClamped = Math.max(refDistance, Math.min(distance, maxDistance));
                return 1 - (rolloffFactor * (distanceClamped - refDistance)) / (maxDistance - refDistance);
            }
            case 'inverse': {
                return (
                    refDistance /
                    (refDistance + rolloffFactor * (Math.max(distance, refDistance) - refDistance))
                );
            }
            case 'exponential': {
                return Math.pow(Math.max(distance, refDistance) / refDistance, -rolloffFactor);
            }
        }
    }

    connectSource(source: AudioNode) {
        source.connect(this.lowpassFilter);
        source.connect(this.highpassFilter);
        this.isSourceConnected = true;
    }

    disconnectSource(source: AudioNode) {
        source.disconnect(this.lowpassFilter);
        source.disconnect(this.highpassFilter);
    }

    public updatePosition(positionX: number, positionY: number, positionZ: number): void {
        this.nextInterpolateMap.positionX = positionX;
        this.nextInterpolateMap.positionY = positionY;
        this.nextInterpolateMap.positionZ = positionZ;
        this.scheduleInterpolation();
    }

    public updateOrientation(orientationX: number, orientationY: number, orientationZ: number): void {
        this.nextInterpolateMap.orientationX = orientationX;
        this.nextInterpolateMap.orientationY = orientationY;
        this.nextInterpolateMap.orientationZ = orientationZ;
        this.scheduleInterpolation();
    }

    public updatePositionOrientation(
        positionX: number,
        positionY: number,
        positionZ: number,
        orientationX: number,
        orientationY: number,
        orientationZ: number,
    ): void {
        this.nextInterpolateMap.positionX = positionX;
        this.nextInterpolateMap.positionY = positionY;
        this.nextInterpolateMap.positionZ = positionZ;
        this.nextInterpolateMap.orientationX = orientationX;
        this.nextInterpolateMap.orientationY = orientationY;
        this.nextInterpolateMap.orientationZ = orientationZ;
        this.scheduleInterpolation();
    }

    /**
     * Schedules an interpolation between the `pannerNodeMain` and `pannerNodeInterpolate`, updating
     * at most every `interpolateTime` milliseconds.
     */
    private scheduleInterpolation(): void {
        if (!this.isSourceConnected) {
            for (const key in this.nextInterpolateMap) {
                const value = this.pannerNodeMain[key as keyof InterpolationMap];
                if (typeof value == 'number') {
                    (this.pannerNodeMain[key as keyof InterpolationMap] as number) =
                        this.nextInterpolateMap[key as keyof InterpolationMap];
                } else {
                    value.value = this.nextInterpolateMap[key as keyof InterpolationMap];
                }
            }
            return;
        }

        if (
            this.audioContext.currentTime >
            this.lastInterpolationTime + this.interpolateDelaySeconds + this.interpolateTimeSeconds
        ) {
            // Set before and after computations
            this.lastInterpolationTime = this.audioContext.currentTime;

            for (const key in this.nextInterpolateMap) {
                const value = this.pannerNodeInterpolate[key as keyof InterpolationMap];
                if (typeof value == 'number') {
                    (this.pannerNodeInterpolate[key as keyof InterpolationMap] as number) =
                        this.nextInterpolateMap[key as keyof InterpolationMap];
                } else {
                    value.value = this.nextInterpolateMap[key as keyof InterpolationMap];
                }
            }

            const originalGain = this.gainPrimaryNode;
            this.gainPrimaryNode = this.gainSecondaryNode;
            this.gainSecondaryNode = originalGain;

            const originalPanner = this.pannerNodeMain;
            this.pannerNodeMain = this.pannerNodeInterpolate;
            this.pannerNodeInterpolate = originalPanner;

            this.gainLowpassNode.connect(this.gainPrimaryNode);
            this.highpassFilter.connect(this.pannerNodeMain);
            this.pannerNodeMain.connect(this.gainPrimaryNode);

            automation(
                this.audioContext,
                this.gainSecondaryNode.gain,
                0,
                {
                    ramp: this.interpolateRamp,
                    delay: this.interpolateDelaySeconds,
                    duration: this.interpolateTimeSeconds,
                },
                true,
            );

            automation(
                this.audioContext,
                this.gainPrimaryNode.gain,
                1,
                {
                    ramp: this.interpolateRamp,
                    delay: this.interpolateDelaySeconds,
                    duration: this.interpolateTimeSeconds,
                },
                true,
            );

            automation(
                this.audioContext,
                this.gainLowpassNode.gain,
                this.computeDistanceGain(),
                {
                    ramp: AudioRampType.LINEAR,
                    delay: this.interpolateDelaySeconds,
                    duration: this.interpolateTimeSeconds,
                },
                true,
            );

            // Set before and after computations
            this.lastInterpolationTime = this.audioContext.currentTime;

            const self = this;
            const expectedInterpolationTime = this.lastInterpolationTime;
            setTimeout(() => {
                if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                    this.gainLowpassNode.disconnect(originalGain);
                    this.highpassFilter.disconnect(originalPanner);
                    originalPanner.disconnect(originalGain);
                }
            }, this.interpolateDelay + this.interpolateTime);
            return;
        }

        const self = this;
        const expectedInterpolationTime = this.lastInterpolationTime;
        setTimeout(
            () => {
                if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                    self.scheduleInterpolation();
                }
            },
            1000 * (this.audioContext.currentTime - this.lastInterpolationTime) +
                this.interpolateTime +
                this.interpolateDelay,
        );
    }

    public connect(destination: AudioNode, outputIndex?: number, inputIndex?: number): AudioNode;
    public connect(destination: AudioParam, outputIndex?: number): void;
    public connect(
        destination: AudioNode | AudioParam,
        outputIndex?: number,
        inputIndex?: number,
    ): AudioNode | void {
        if (destination instanceof AudioNode) {
            this.gainPrimaryNode.connect(destination, outputIndex, inputIndex);
            this.gainSecondaryNode.connect(destination, outputIndex, inputIndex);
            return destination;
        }

        this.gainPrimaryNode.connect(destination, outputIndex);
        this.gainSecondaryNode.connect(destination, outputIndex);
    }

    public disconnect(): void;
    public disconnect(output: number): void;
    public disconnect(destinationNode: AudioNode): void;
    public disconnect(destinationNode: AudioNode, output: number): void;
    public disconnect(destinationNode: AudioNode, output: number, input: number): void;
    public disconnect(destinationParam: AudioParam): void;
    public disconnect(destinationParam: AudioParam, output: number): void;
    public disconnect(
        outputOrNodeOrParam?: number | AudioNode | AudioParam,
        output?: number,
        input?: number,
    ) {
        if (outputOrNodeOrParam == undefined) {
            this.gainPrimaryNode.disconnect();
            this.gainSecondaryNode.disconnect();
            return;
        }
        if (typeof outputOrNodeOrParam == 'number') {
            this.gainPrimaryNode.disconnect(outputOrNodeOrParam);
            this.gainSecondaryNode.disconnect(outputOrNodeOrParam);
            return;
        }
        if (outputOrNodeOrParam instanceof AudioNode) {
            if (output != undefined && input != undefined) {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam, output, input);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam, output, input);
                return;
            } else if (output != undefined) {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam, output);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam, output);
                return;
            } else {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam);
                return;
            }
        }
        if (outputOrNodeOrParam instanceof AudioParam) {
            if (output != undefined) {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam, output);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam, output);
                return;
            } else {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam);
                return;
            }
        }
    }
}

export default HRTFPannerNode;

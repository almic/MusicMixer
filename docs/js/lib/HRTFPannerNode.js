import automation, { AudioRampType } from './automation.js';
import buildOptions, * as defaults from './defaults.js';
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
    audioContext;
    pannerOptions;
    pannerNodeMain;
    pannerNodeInterpolate;
    highpassFilter;
    lowpassFilter;
    gainPrimaryNode;
    gainSecondaryNode;
    gainLowpassNode;
    /** Tracks if the method `connectSource()` has been called previously */
    isSourceConnected = false;
    /** Tracks the last time that an interpolation was scheduled */
    lastInterpolationTime = 0;
    /** The interpolation time, in milliseconds */
    interpolateTime = 30;
    /** interpolateTime in seconds */
    interpolateTimeSeconds = this.interpolateTime / 1000;
    /** Small delay for audio scheduling latency, in milliseconds */
    interpolateDelay = 1;
    /** interpolateDelay in seconds */
    interpolateDelaySeconds = this.interpolateDelay / 1000;
    /** Holds the equal power interpolation ramp */
    interpolateRamp;
    /** The values that will be used for the next interpolation */
    nextInterpolateMap;
    constructor(audioContext, options) {
        this.audioContext = audioContext;
        this.pannerOptions = buildOptions(options, defaults.pannerDefault);
        if (this.pannerOptions.maxDistance < Number.EPSILON) {
            throw new RangeError(`The maxDistance value ${this.pannerOptions.maxDistance} is below the minimum acceptable value of ${Number.EPSILON}.`);
        }
        if (this.pannerOptions.refDistance < Number.EPSILON) {
            throw new RangeError(`The refDistance value ${this.pannerOptions.refDistance} is below the minimum acceptable value of ${Number.EPSILON}.`);
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
    computeRamp() {
        const length = Math.round(this.interpolateTime);
        const halfPi = Math.PI / 2;
        const squashFactor = halfPi / length;
        const result = new Float32Array(length);
        for (let index = 0; index < length; index++) {
            result[index] = Math.cos((index - length + 1) * squashFactor);
        }
        return result;
    }
    computeDistanceGain() {
        const listener = this.audioContext.listener;
        const x = this.nextInterpolateMap.positionX - listener.positionX.value, y = this.nextInterpolateMap.positionY - listener.positionY.value, z = this.nextInterpolateMap.positionZ - listener.positionZ.value;
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
                return (refDistance /
                    (refDistance + rolloffFactor * (Math.max(distance, refDistance) - refDistance)));
            }
            case 'exponential': {
                return Math.pow(Math.max(distance, refDistance) / refDistance, -rolloffFactor);
            }
        }
    }
    connectSource(source) {
        source.connect(this.lowpassFilter);
        source.connect(this.highpassFilter);
        this.isSourceConnected = true;
    }
    disconnectSource(source) {
        source.disconnect(this.lowpassFilter);
        source.disconnect(this.highpassFilter);
    }
    updatePosition(positionX, positionY, positionZ) {
        this.nextInterpolateMap.positionX = positionX;
        this.nextInterpolateMap.positionY = positionY;
        this.nextInterpolateMap.positionZ = positionZ;
        this.scheduleInterpolation();
    }
    updateOrientation(orientationX, orientationY, orientationZ) {
        this.nextInterpolateMap.orientationX = orientationX;
        this.nextInterpolateMap.orientationY = orientationY;
        this.nextInterpolateMap.orientationZ = orientationZ;
        this.scheduleInterpolation();
    }
    updatePositionOrientation(positionX, positionY, positionZ, orientationX, orientationY, orientationZ) {
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
    scheduleInterpolation() {
        if (!this.isSourceConnected) {
            for (const key in this.nextInterpolateMap) {
                const value = this.pannerNodeMain[key];
                if (typeof value == 'number') {
                    this.pannerNodeMain[key] =
                        this.nextInterpolateMap[key];
                }
                else {
                    value.value = this.nextInterpolateMap[key];
                }
            }
            return;
        }
        if (this.audioContext.currentTime >
            this.lastInterpolationTime + this.interpolateDelaySeconds + this.interpolateTimeSeconds) {
            // Set before and after computations
            this.lastInterpolationTime = this.audioContext.currentTime;
            for (const key in this.nextInterpolateMap) {
                const value = this.pannerNodeInterpolate[key];
                if (typeof value == 'number') {
                    this.pannerNodeInterpolate[key] =
                        this.nextInterpolateMap[key];
                }
                else {
                    value.value = this.nextInterpolateMap[key];
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
            automation(this.audioContext, this.gainSecondaryNode.gain, 0, {
                ramp: this.interpolateRamp,
                delay: this.interpolateDelaySeconds,
                duration: this.interpolateTimeSeconds,
            }, true);
            automation(this.audioContext, this.gainPrimaryNode.gain, 1, {
                ramp: this.interpolateRamp,
                delay: this.interpolateDelaySeconds,
                duration: this.interpolateTimeSeconds,
            }, true);
            automation(this.audioContext, this.gainLowpassNode.gain, this.computeDistanceGain(), {
                ramp: AudioRampType.LINEAR,
                delay: this.interpolateDelaySeconds,
                duration: this.interpolateTimeSeconds,
            }, true);
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
        setTimeout(() => {
            if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                self.scheduleInterpolation();
            }
        }, 1000 * (this.audioContext.currentTime - this.lastInterpolationTime) +
            this.interpolateTime +
            this.interpolateDelay);
    }
    connect(destination, outputIndex, inputIndex) {
        if (destination instanceof AudioNode) {
            this.gainPrimaryNode.connect(destination, outputIndex, inputIndex);
            this.gainSecondaryNode.connect(destination, outputIndex, inputIndex);
            return destination;
        }
        this.gainPrimaryNode.connect(destination, outputIndex);
        this.gainSecondaryNode.connect(destination, outputIndex);
    }
    disconnect(outputOrNodeOrParam, output, input) {
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
            }
            else if (output != undefined) {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam, output);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam, output);
                return;
            }
            else {
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
            }
            else {
                this.gainPrimaryNode.disconnect(outputOrNodeOrParam);
                this.gainSecondaryNode.disconnect(outputOrNodeOrParam);
                return;
            }
        }
    }
}
export default HRTFPannerNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSFJURlBhbm5lck5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvSFJURlBhbm5lck5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxVQUFVLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUM1RCxPQUFPLFlBQVksRUFBRSxLQUFLLFFBQVEsTUFBTSxlQUFlLENBQUM7QUFpQnhEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBeUJHO0FBQ0gsTUFBTSxjQUFjO0lBcUNIO0lBcENMLGFBQWEsQ0FBMEI7SUFDdkMsY0FBYyxDQUFhO0lBQzNCLHFCQUFxQixDQUFhO0lBRWxDLGNBQWMsQ0FBbUI7SUFDakMsYUFBYSxDQUFtQjtJQUVoQyxlQUFlLENBQVc7SUFDMUIsaUJBQWlCLENBQVc7SUFDNUIsZUFBZSxDQUFXO0lBRWxDLHdFQUF3RTtJQUNoRSxpQkFBaUIsR0FBWSxLQUFLLENBQUM7SUFFM0MsK0RBQStEO0lBQ3ZELHFCQUFxQixHQUFXLENBQUMsQ0FBQztJQUUxQyw4Q0FBOEM7SUFDdEMsZUFBZSxHQUFXLEVBQUUsQ0FBQztJQUVyQyxpQ0FBaUM7SUFDekIsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7SUFFN0QsZ0VBQWdFO0lBQ3hELGdCQUFnQixHQUFXLENBQUMsQ0FBQztJQUVyQyxrQ0FBa0M7SUFDMUIsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztJQUUvRCwrQ0FBK0M7SUFDdkMsZUFBZSxDQUFlO0lBRXRDLDhEQUE4RDtJQUN0RCxrQkFBa0IsQ0FBbUI7SUFFN0MsWUFDYSxZQUEwQixFQUNuQyxPQUF1QjtRQURkLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBR25DLElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFbkUsSUFBSSxJQUFJLENB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
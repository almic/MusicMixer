import automation from './automation.js';
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
    pannerNodeMain;
    pannerNodeInterpolate;
    highpassFilter;
    lowpassFilter;
    gainPrimaryNode;
    gainSecondaryNode;
    /** Tracks if the method `connectSource()` has been called previously */
    isSourceConnected = false;
    /** Tracks the last time that an interpolation was scheduled */
    lastInterpolationTime = 0;
    /** The interpolation time, in milliseconds */
    interpolateTime = (1 / 24) * 1000;
    /** Small delay for audio scheduling latency, in milliseconds */
    interpolateDelay = 1;
    /** Holds the equal power interpolation ramp */
    interpolateRamp;
    /** The values that will be used for the next interpolation */
    nextInterpolateMap;
    constructor(audioContext, options) {
        this.audioContext = audioContext;
        const pannerOptions = buildOptions(options, defaults.pannerDefault);
        this.pannerNodeMain = new PannerNode(audioContext, pannerOptions);
        this.pannerNodeInterpolate = new PannerNode(audioContext, pannerOptions);
        this.nextInterpolateMap = {
            positionX: pannerOptions.positionX,
            positionY: pannerOptions.positionY,
            positionZ: pannerOptions.positionZ,
            orientationX: pannerOptions.orientationX,
            orientationY: pannerOptions.orientationY,
            orientationZ: pannerOptions.orientationZ,
            coneInnerAngle: pannerOptions.coneInnerAngle,
            coneOuterAngle: pannerOptions.coneOuterAngle,
            coneOuterGain: pannerOptions.coneOuterGain,
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
        this.gainSecondaryNode.gain.value = 0;
        this.lowpassFilter.connect(this.gainPrimaryNode);
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
            this.lastInterpolationTime + (this.interpolateDelay + this.interpolateTime) / 1000) {
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
            this.lowpassFilter.connect(this.gainPrimaryNode);
            this.highpassFilter.connect(this.pannerNodeMain);
            this.pannerNodeMain.connect(this.gainPrimaryNode);
            automation(this.audioContext, this.gainSecondaryNode.gain, 0, {
                ramp: this.interpolateRamp,
                delay: this.interpolateDelay / 1000,
                duration: this.interpolateTime / 1000,
            }, true);
            automation(this.audioContext, this.gainPrimaryNode.gain, 1, {
                ramp: this.interpolateRamp,
                delay: this.interpolateDelay / 1000,
                duration: this.interpolateTime / 1000,
            }, true);
            const self = this;
            const expectedInterpolationTime = this.lastInterpolationTime;
            setTimeout(() => {
                if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                    this.lowpassFilter.disconnect(originalGain);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSFJURlBhbm5lck5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvSFJURlBhbm5lck5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxVQUFVLE1BQU0saUJBQWlCLENBQUM7QUFDekMsT0FBTyxZQUFZLEVBQUUsS0FBSyxRQUFRLE1BQU0sZUFBZSxDQUFDO0FBaUJ4RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCRztBQUNILE1BQU0sY0FBYztJQTZCSDtJQTVCTCxjQUFjLENBQWE7SUFDM0IscUJBQXFCLENBQWE7SUFFbEMsY0FBYyxDQUFtQjtJQUNqQyxhQUFhLENBQW1CO0lBRWhDLGVBQWUsQ0FBVztJQUMxQixpQkFBaUIsQ0FBVztJQUVwQyx3RUFBd0U7SUFDaEUsaUJBQWlCLEdBQVksS0FBSyxDQUFDO0lBRTNDLCtEQUErRDtJQUN2RCxxQkFBcUIsR0FBVyxDQUFDLENBQUM7SUFFMUMsOENBQThDO0lBQ3RDLGVBQWUsR0FBVyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7SUFFbEQsZ0VBQWdFO0lBQ3hELGdCQUFnQixHQUFXLENBQUMsQ0FBQztJQUVyQywrQ0FBK0M7SUFDdkMsZUFBZSxDQUFlO0lBRXRDLDhEQUE4RDtJQUN0RCxrQkFBa0IsQ0FBbUI7SUFFN0MsWUFDYSxZQUEwQixFQUNuQyxPQUF1QjtRQURkLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBR25DLE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRXBFLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFekUsSUFBSSxDQUFDLGtCQUFrQixHQUFHO1lBQ3RCLFNB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
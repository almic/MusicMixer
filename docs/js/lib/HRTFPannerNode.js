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
    interpolateTime = 1 / 32;
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
        this.lowpassFilter.connect(this.gainPrimaryNode);
        this.highpassFilter.connect(this.pannerNodeMain);
        this.pannerNodeMain.connect(this.gainPrimaryNode);
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
        const differenceMillis = (this.audioContext.currentTime - this.lastInterpolationTime) * 1000;
        if (differenceMillis >= this.interpolateTime) {
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
            const originalPanner = this.pannerNodeMain;
            this.gainSecondaryNode.gain.value = 1;
            originalPanner.connect(this.gainSecondaryNode);
            originalPanner.disconnect(this.gainPrimaryNode);
            automation(this.audioContext, this.gainSecondaryNode.gain, 0, { ramp: AudioRampType.EQUAL_POWER, delay: 0, duration: this.interpolateTime / 1000 }, true);
            this.gainPrimaryNode.gain.value = 0;
            this.highpassFilter.connect(this.pannerNodeInterpolate); // begin spatializing with new panner
            this.pannerNodeInterpolate.connect(this.gainPrimaryNode);
            automation(this.audioContext, this.gainPrimaryNode.gain, 1, { ramp: AudioRampType.EQUAL_POWER_IN, delay: 0, duration: this.interpolateTime / 1000 }, true);
            this.pannerNodeMain = this.pannerNodeInterpolate;
            this.pannerNodeInterpolate = originalPanner;
            const self = this;
            const expectedInterpolationTime = this.lastInterpolationTime;
            setTimeout(() => {
                if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                    this.highpassFilter.disconnect(originalPanner);
                    originalPanner.disconnect(this.gainSecondaryNode);
                }
            }, this.interpolateTime);
            return;
        }
        const self = this;
        const expectedInterpolationTime = this.lastInterpolationTime;
        setTimeout(() => {
            if (self.lastInterpolationTime - expectedInterpolationTime < Number.EPSILON) {
                self.scheduleInterpolation();
            }
        }, differenceMillis);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSFJURlBhbm5lck5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvSFJURlBhbm5lck5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxVQUFVLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUM1RCxPQUFPLFlBQVksRUFBRSxLQUFLLFFBQVEsTUFBTSxlQUFlLENBQUM7QUFpQnhEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBeUJHO0FBQ0gsTUFBTSxjQUFjO0lBdUJIO0lBdEJMLGNBQWMsQ0FBYTtJQUMzQixxQkFBcUIsQ0FBYTtJQUVsQyxjQUFjLENBQW1CO0lBQ2pDLGFBQWEsQ0FBbUI7SUFFaEMsZUFBZSxDQUFXO0lBQzFCLGlCQUFpQixDQUFXO0lBRXBDLHdFQUF3RTtJQUNoRSxpQkFBaUIsR0FBWSxLQUFLLENBQUM7SUFFM0MsK0RBQStEO0lBQ3ZELHFCQUFxQixHQUFXLENBQUMsQ0FBQztJQUUxQyw4Q0FBOEM7SUFDdEMsZUFBZSxHQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFekMsOERBQThEO0lBQ3RELGtCQUFrQixDQUFtQjtJQUU3QyxZQUNhLFlBQTBCLEVBQ25DLE9BQXVCO1FBRGQsaUJBQVksR0FBWixZQUFZLENBQWM7UUFHbkMsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFcEUsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDbEUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksVUFBVSxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUV6RSxJQUFJLENBQUMsa0JBQWtCLEdBQUc7WUFDdEIsU0FBUyxFQUFFLGFBQWEsQ0FBQyxTQUFTO1lBQ2xDLFNBQVMsRUFBRSxhQUFhLENBQUMsU0FBUztZQUNsQyxTQUFTLEVBQUUs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
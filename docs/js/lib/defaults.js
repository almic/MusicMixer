import { TrackSwapType } from './Track.js';
import { AudioRampType } from './AudioSourceNode.js';
function buildOptions(options) {
    if ('ramp' in options) {
        const fullOptions = {};
        let baseAdjustment = automationDefault;
        if (Array.isArray(options.ramp)) {
            fullOptions.ramp = [];
            for (const val of options.ramp) {
                fullOptions.ramp.push(val);
            }
        }
        else {
            switch (options.ramp) {
                case AudioRampType.EXPONENTIAL: {
                    baseAdjustment = automationExponential;
                    break;
                }
                case AudioRampType.LINEAR: {
                    baseAdjustment = automationNatural;
                    break;
                }
                case AudioRampType.NATURAL: {
                    baseAdjustment = automationLinear;
                    break;
                }
            }
            fullOptions.ramp = baseAdjustment.ramp;
        }
        fullOptions.delay = options.delay ?? baseAdjustment.delay;
        fullOptions.duration = options.duration ?? baseAdjustment.duration;
        if (!('swap' in options)) {
            return fullOptions;
        }
        let baseSwap = trackSwapDefault;
        switch (options.swap) {
            case TrackSwapType.CROSS: {
                baseSwap = trackSwapCross;
                break;
            }
            case TrackSwapType.CUT: {
                baseSwap = trackSwapCut;
                break;
            }
            case TrackSwapType.IN_OUT: {
                baseSwap = trackSwapInOut;
                break;
            }
            case TrackSwapType.OUT_IN: {
                baseSwap = trackSwapOutIn;
                break;
            }
        }
        const oldSourceDuration = options.duration ?? baseSwap.oldSource.duration;
        let newSourceDelay;
        if (options.swapDelay != undefined &&
            (options.swapDelay > Number.EPSILON || options.swapDelay < -Number.EPSILON)) {
            newSourceDelay = options.swapDelay + (options.delay ?? 0) + oldSourceDuration;
        }
        else {
            newSourceDelay = options.delay ?? baseSwap.newSource.delay;
        }
        const fullSwapOptions = {
            oldSource: {
                ramp: fullOptions.ramp,
                delay: options.delay ?? baseSwap.oldSource.delay,
                duration: oldSourceDuration,
            },
            newSource: {
                ramp: fullOptions.ramp,
                delay: newSourceDelay,
                duration: options.duration ?? baseSwap.newSource.duration,
            },
        };
        return fullSwapOptions;
    }
    const fullSwapOptions = {
        oldSource: {
            ramp: options.oldSource.ramp ?? trackSwapDefault.oldSource.ramp,
            delay: options.oldSource.delay ?? trackSwapDefault.oldSource.delay,
            duration: options.oldSource.duration ?? trackSwapDefault.oldSource.duration,
        },
        newSource: {
            ramp: options.newSource.ramp ?? trackSwapDefault.newSource.ramp,
            delay: options.newSource.delay ?? trackSwapDefault.newSource.delay,
            duration: options.newSource.duration ?? trackSwapDefault.newSource.duration,
        },
    };
    return fullSwapOptions;
}
export default buildOptions;
/**
 * Default behavior for an IN_OUT track audio swap
 */
export const trackSwapInOut = Object.freeze({
    newSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 0.8,
    }),
    oldSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 1,
        duration: 0.8,
    }),
});
/**
 * Default behavior for an OUT_IN track audio swap
 */
export const trackSwapOutIn = Object.freeze({
    oldSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 2,
    }),
    newSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 2.2,
        duration: 2,
    }),
});
/**
 * Default behavior for a CROSS track audio swap
 */
export const trackSwapCross = Object.freeze({
    oldSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1.2,
    }),
    newSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1.2,
    }),
});
/**
 * Default behavior for a CUT track audio swap
 */
export const trackSwapCut = Object.freeze({
    oldSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1 / 1_000,
    }),
    newSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1 / 1_000,
    }),
});
/**
 * Default behavior for a track audio swap
 */
export const trackSwapDefault = Object.freeze({
    oldSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1.2,
    }),
    newSource: Object.freeze({
        ramp: AudioRampType.NATURAL,
        delay: 0,
        duration: 1.2,
    }),
});
/**
 * Default behavior when starting playback
 */
export const startImmediate = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 500,
});
/**
 * Default behavior when stopping playback
 */
export const stopImmediate = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 1_000,
});
/**
 * Behavior for immediate (cut) adjustments. Note that even immediate adjustments take time.
 */
export const automationImmediate = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});
/**
 * Behavior for linear AudioParam automations
 */
export const automationLinear = Object.freeze({
    ramp: AudioRampType.LINEAR,
    delay: 0,
    duration: 1,
});
/**
 * Behavior for exponential AudioParam automations
 */
export const automationExponential = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 0.7,
});
/**
 * Behavior for natural AudioParam automations
 */
export const automationNatural = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 0.23,
});
/**
 * Default behavior for AudioParam automations
 */
export const automationDefault = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVmYXVsdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFvQixhQUFhLEVBQTRCLE1BQU0sWUFBWSxDQUFDO0FBQ3ZGLE9BQU8sRUFBMEIsYUFBYSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFNN0UsU0FBUyxZQUFZLENBQ2pCLE9BQTZFO0lBRTdFLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ3BCLE1BQU0sV0FBVyxHQUFRLEVBQUUsQ0FBQztRQUM1QixJQUFJLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQztRQUN2QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUIsV0FBVyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFDdEIsS0FBSyxNQUFNLEdBQUcsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO2FBQU0sQ0FBQztZQUNKLFFBQVEsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNuQixLQUFLLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO29CQUM3QixjQUFjLEdBQUcscUJBQXFCLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1YsQ0FBQztnQkFDRCxLQUFLLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUN4QixjQUFjLEdBQUcsaUJBQWlCLENBQUM7b0JBQ25DLE1BQU07Z0JBQ1YsQ0FBQztnQkFDRCxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUN6QixjQUFjLEdBQUcsZ0JBQWdCLENBQUM7b0JBQ2xDLE1BQU07Z0JBQ1YsQ0FBQztZQUNMLENBQUM7WUFDRCxXQUFXLENBQUMsSUFBSSxHQUFH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
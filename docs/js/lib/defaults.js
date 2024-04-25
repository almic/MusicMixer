import { TrackSwapType } from './Track.js';
import { AudioRampType } from './automation.js';
function buildOptions(options, defaultOptions) {
    if (!options) {
        return structuredClone(defaultOptions);
    }
    if (isObjectLike(defaultOptions, pannerDefault)) {
        if (!isObjectLike(options, pannerDefault)) {
            console.warn('Specified options were not like PannerOptions. This is likely a mistake.');
            return structuredClone(defaultOptions);
        }
        if (isObjectEquivalent(options, pannerDefault)) {
            return structuredClone(options);
        }
        return optionalCopyInto(defaultOptions, options);
    }
    if (isObjectLike(defaultOptions, automationDefault)) {
        if (!isObjectLike(options, automationDefault)) {
            console.warn('Specified options were not like AudioAdjustmentOptions. This is likely a mistake.');
            return structuredClone(defaultOptions);
        }
        return optionalCopyInto(defaultOptions, options);
    }
    if (isObjectLike(defaultOptions, trackSwapDefault)) {
        if (isObjectLike(options, trackSwapDefault)) {
            return structuredClone(options);
        }
        const fullOptions = structuredClone(defaultOptions);
        if (!isObjectLike(options, trackSwapPlain)) {
            console.warn('Specified options were not like TrackSwapOptions. This is likely a mistake.');
            return fullOptions;
        }
        if ('ramp' in options) {
            fullOptions.oldSource.ramp = options.ramp;
            fullOptions.newSource.ramp = options.ramp;
        }
        if ('duration' in options && options.duration) {
            const oldLength = fullOptions.oldSource.delay + fullOptions.oldSource.duration;
            const newLength = fullOptions.newSource.delay + fullOptions.newSource.duration;
            const difference = oldLength - newLength;
            const markiplier = options.duration /
                (difference > 0 || Math.abs(difference) < Number.EPSILON ? oldLength : newLength);
            fullOptions.oldSource.delay *= markiplier;
            fullOptions.oldSource.duration *= markiplier;
            fullOptions.newSource.delay *= markiplier;
            fullOptions.newSource.duration *= markiplier;
        }
        if ('delay' in options && options.delay) {
            fullOptions.oldSource.delay += options.delay;
            fullOptions.newSource.delay += options.delay;
        }
        return fullOptions;
    }
    console.warn('A caller within MusicMixer provided defaultOptions that did not match any known options. ' +
        'This is likely a mistake');
    return structuredClone(defaultOptions);
}
export default buildOptions;
/**
 * Returns `true` when `obj` has at least one key from `like`
 */
function isObjectLike(obj, like) {
    for (const key in like) {
        if (key in obj) {
            return true;
        }
    }
    return false;
}
/**
 * Returns `true` when `obj` has all keys from `like`
 */
function isObjectEquivalent(obj, other) {
    for (const key in other) {
        if (!(key in obj)) {
            return false;
        }
    }
    return true;
}
/**
 * Given a `target` and `source`, creates a copy `result = structuredClone(target)`, and copies the
 * value of keys that exist on both `target` and `source`, where `source[key] !== undefined`,
 * returning `result`.
 *
 * If `mapFunc` is provided, the value assigned is the result of `mapFunc(key, target[key], source[key])`
 * where the `source[key]` is guaranteed to not be `undefined`, but may be `null`.
 */
function optionalCopyInto(target, source, mapFunc) {
    const result = structuredClone(target);
    if (mapFunc) {
        for (const key in target) {
            if (key in source && source[key] !== undefined) {
                result[key] = mapFunc(key, target[key], source[key]);
            }
        }
        return result;
    }
    for (const key in target) {
        if (key in source && source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}
const trackSwapPlain = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 2,
    swap: TrackSwapType.OUT_IN,
    swapDelay: 0.2,
});
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
        ramp: AudioRampType.EQUAL_POWER,
        delay: 0,
        duration: 1.2,
    }),
    newSource: Object.freeze({
        ramp: AudioRampType.EQUAL_POWER_IN,
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
/**
 * Default PannerOptions
 */
export const pannerDefault = Object.freeze({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    orientationX: 1,
    orientationY: 0,
    orientationZ: 0,
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 360,
    coneOuterGain: 0,
    // Only defined to make typescript happy, don't use these!
    channelCount: 2,
    channelCountMode: 'clamped-max',
    channelInterpretation: 'speakers',
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVmYXVsdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUE4QyxhQUFhLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDdkYsT0FBTyxFQUEwQixhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQWtCeEUsU0FBUyxZQUFZLENBQ2pCLE9BTVUsRUFDVixjQUFxRztJQUVyRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDWCxPQUFPLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLGFBQWEsQ0FBQyxFQUFFLENBQUM7UUFDOUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxPQUFPLENBQUMsSUFBSSxDQUFDLDBFQUEwRSxDQUFDLENBQUM7WUFDekYsT0FBTyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELElBQUksa0JBQWtCLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDN0MsT0FBTyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELE9BQU8sZ0JBQWdCLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxJQUFJLFlBQVksQ0FBQyxjQUFjLEVBQUUsaUJBQWlCLENBQUMsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLEVBQUUsQ0FBQztZQUM1QyxPQUFPLENBQUMsSUFBSSxDQUFDLG1GQUFtRixDQUFDLENBQUM7WUFDbEcsT0FBTyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELE9BQU8sZ0JBQWdCLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FB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
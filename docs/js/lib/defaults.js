import { AudioRampType } from './automation.js';
function buildOptions(options, defaultOptions) {
    if ('swap' in defaultOptions) {
        console.warn('A caller passed a defaultOptions object of type TrackSwapOptions. Only TrackSwapAdvancedOptions ' +
            'are supported for buildOptions(). This is likely a mistake.');
    }
    if (!options) {
        return structuredClone(defaultOptions);
    }
    if ('newSource' in options) {
        if (defaultOptions && !('newSource' in defaultOptions)) {
            console.warn('A caller passed some options of type TrackSwapAdvancedOptions to a MusicMixer function that ' +
                'only accepts AudioAdjustmentOptions. This is likely a mistake.');
            return structuredClone(defaultOptions);
        }
        return structuredClone(options);
    }
    // Doing this here makes logic easier in the next block
    if ('newSource' in defaultOptions) {
        const fullOptions = structuredClone(defaultOptions);
        if (options.ramp) {
            fullOptions.oldSource.ramp = options.ramp;
            fullOptions.newSource.ramp = options.ramp;
        }
        if (options.duration) {
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
        if (options.delay) {
            fullOptions.oldSource.delay += options.delay;
            fullOptions.newSource.delay += options.delay;
        }
        return fullOptions;
    }
    const fullOptions = structuredClone(defaultOptions);
    // while required in typescript, javascript will let this be undefined
    if (options.ramp) {
        fullOptions.ramp = structuredClone(options.ramp);
    }
    if (options.delay) {
        fullOptions.delay = options.delay;
    }
    if (options.duration) {
        fullOptions.duration = options.duration;
    }
    if ('swap' in options) {
        console.warn('A caller passed some options of type TrackSwapOptions to a MusicMixer function that ' +
            'only accepts AudioAdjustmentOptions. This is likely a mistake.');
    }
    return fullOptions;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVmYXVsdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUEwQixhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQWN4RSxTQUFTLFlBQVksQ0FDakIsT0FBZ0csRUFDaEcsY0FBMkU7SUFFM0UsSUFBSSxNQUFNLElBQUksY0FBYyxFQUFFLENBQUM7UUFDM0IsT0FBTyxDQUFDLElBQUksQ0FDUixrR0FBa0c7WUFDOUYsNkRBQTZELENBQ3BFLENBQUM7SUFDTixDQUFDO0lBRUQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsT0FBTyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVELElBQUksV0FBVyxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLElBQUksY0FBYyxJQUFJLENBQUMsQ0FBQyxXQUFXLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUNyRCxPQUFPLENBQUMsSUFBSSxDQUNSLDhGQUE4RjtnQkFDMUYsZ0VBQWdFLENBQ3ZFLENBQUM7WUFDRixPQUFPLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBQ0QsT0FBTyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELHVEQUF1RDtJQUN2RCxJQUFJLFdBQVcsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNoQyxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFcEQsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDZixXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQzFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDOUMsQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFD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
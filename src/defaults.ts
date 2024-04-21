import { TrackSwapOptions, TrackSwapAdvancedOptions, TrackSwapType } from './Track.js';
import { AudioAdjustmentOptions, AudioRampType } from './automation.js';

function buildOptions(
    trackSwapOptions: TrackSwapOptions | TrackSwapAdvancedOptions | undefined | null,
    defaultSwapOptions: TrackSwapAdvancedOptions,
): TrackSwapAdvancedOptions;
function buildOptions(
    audioAdjustmentOptions: AudioAdjustmentOptions | undefined | null,
    defaultAudioAdjustmentOptions: Required<AudioAdjustmentOptions>,
): Required<AudioAdjustmentOptions>;
function buildOptions(
    audioAdjustmentOptions: AudioAdjustmentOptions | undefined | null,
    defaultSwapOptions: TrackSwapAdvancedOptions,
): TrackSwapAdvancedOptions;
function buildOptions(
    pannerOptions: PannerOptions | undefined | null,
    defaultPannerOptions: Required<PannerOptions>,
): Required<PannerOptions>;
function buildOptions(
    options:
        | AudioAdjustmentOptions
        | TrackSwapOptions
        | TrackSwapAdvancedOptions
        | PannerOptions
        | undefined
        | null,
    defaultOptions: Required<AudioAdjustmentOptions> | TrackSwapAdvancedOptions | Required<PannerOptions>,
): Required<AudioAdjustmentOptions> | TrackSwapAdvancedOptions | Required<PannerOptions> {
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
            const markiplier =
                options.duration /
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

    console.warn(
        'A caller within MusicMixer provided defaultOptions that did not match any known options. ' +
            'This is likely a mistake',
    );

    return structuredClone(defaultOptions);
}

export default buildOptions;

/**
 * Returns `true` when `obj` has at least one key from `like`
 */
function isObjectLike<T extends object>(obj: object, like: T): obj is Partial<T> {
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
function isObjectEquivalent<T extends object>(obj: object, other: T): obj is T {
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
function optionalCopyInto<T, V extends {} | null>(
    target: T,
    source: any,
    mapFunc?: (key: string, targetValue: any, sourceValue: V) => any,
): T {
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

const trackSwapPlain: Required<TrackSwapOptions> = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 2,
    swap: TrackSwapType.OUT_IN,
    swapDelay: 0.2,
});

/**
 * Default behavior for an IN_OUT track audio swap
 */
export const trackSwapInOut: TrackSwapAdvancedOptions = Object.freeze({
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
export const trackSwapOutIn: TrackSwapAdvancedOptions = Object.freeze({
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
export const trackSwapCross: TrackSwapAdvancedOptions = Object.freeze({
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
export const trackSwapCut: TrackSwapAdvancedOptions = Object.freeze({
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
export const trackSwapDefault: TrackSwapAdvancedOptions = Object.freeze({
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
export const startImmediate: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 500,
});

/**
 * Default behavior when stopping playback
 */
export const stopImmediate: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 1_000,
});

/**
 * Behavior for immediate (cut) adjustments. Note that even immediate adjustments take time.
 */
export const automationImmediate: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});

/**
 * Behavior for linear AudioParam automations
 */
export const automationLinear: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.LINEAR,
    delay: 0,
    duration: 1,
});

/**
 * Behavior for exponential AudioParam automations
 */
export const automationExponential: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 0.7,
});

/**
 * Behavior for natural AudioParam automations
 */
export const automationNatural: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 0.23,
});

/**
 * Default behavior for AudioParam automations
 */
export const automationDefault: Required<AudioAdjustmentOptions> = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});

/**
 * Default PannerOptions
 */
export const pannerDefault: Required<PannerOptions> = Object.freeze({
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

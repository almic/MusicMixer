import { TrackSwapOptions, TrackSwapAdvancedOptions } from './Track.js';
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
    options: AudioAdjustmentOptions | TrackSwapOptions | TrackSwapAdvancedOptions | undefined | null,
    defaultOptions: Required<AudioAdjustmentOptions> | TrackSwapAdvancedOptions,
): Required<AudioAdjustmentOptions> | TrackSwapAdvancedOptions {
    if ('swap' in defaultOptions) {
        console.warn(
            'A caller passed a defaultOptions object of type TrackSwapOptions. Only TrackSwapAdvancedOptions ' +
                'are supported for buildOptions(). This is likely a mistake.',
        );
    }

    if (!options) {
        return structuredClone(defaultOptions);
    }

    if ('newSource' in options) {
        if (defaultOptions && !('newSource' in defaultOptions)) {
            console.warn(
                'A caller passed some options of type TrackSwapAdvancedOptions to a MusicMixer function that ' +
                    'only accepts AudioAdjustmentOptions. This is likely a mistake.',
            );
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
            const markiplier =
                options.duration /
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
        console.warn(
            'A caller passed some options of type TrackSwapOptions to a MusicMixer function that ' +
                'only accepts AudioAdjustmentOptions. This is likely a mistake.',
        );
    }

    return fullOptions;
}

export default buildOptions;

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

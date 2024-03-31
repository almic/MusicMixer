import { TrackSwapOptions, TrackSwapType, TrackSwapAdvancedOptions } from './Track.js';
import { AudioAdjustmentOptions, AudioRampType } from './AudioSourceNode.js';

function buildOptions(
    trackSwapOptions: TrackSwapOptions | TrackSwapAdvancedOptions,
): TrackSwapAdvancedOptions;
function buildOptions(audioAdjustmentOptions: AudioAdjustmentOptions): Required<AudioAdjustmentOptions>;
function buildOptions(
    options: AudioAdjustmentOptions | TrackSwapOptions | TrackSwapAdvancedOptions,
): Required<AudioAdjustmentOptions> | TrackSwapAdvancedOptions {
    if ('ramp' in options) {
        const fullOptions: any = {};
        let baseAdjustment = automationDefault;
        if (Array.isArray(options.ramp)) {
            fullOptions.ramp = [];
            for (const val of options.ramp) {
                fullOptions.ramp.push(val);
            }
        } else {
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

        fullOptions.delay = options.delay ?? (baseAdjustment.delay as number);
        fullOptions.duration = options.duration ?? (baseAdjustment.duration as number);

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

        const oldSourceDuration = options.duration ?? (baseSwap.oldSource.duration as number);
        let newSourceDelay;

        if (
            options.swapDelay != undefined &&
            (options.swapDelay > Number.EPSILON || options.swapDelay < -Number.EPSILON)
        ) {
            newSourceDelay = options.swapDelay + (options.delay ?? 0) + oldSourceDuration;
        } else {
            newSourceDelay = options.delay ?? (baseSwap.newSource.delay as number);
        }

        const fullSwapOptions: TrackSwapAdvancedOptions = {
            oldSource: {
                ramp: fullOptions.ramp,
                delay: options.delay ?? (baseSwap.oldSource.delay as number),
                duration: oldSourceDuration,
            },
            newSource: {
                ramp: fullOptions.ramp,
                delay: newSourceDelay,
                duration: options.duration ?? (baseSwap.newSource.duration as number),
            },
        };

        return fullSwapOptions;
    }

    const fullSwapOptions: TrackSwapAdvancedOptions = {
        oldSource: {
            ramp: options.oldSource.ramp ?? trackSwapDefault.oldSource.ramp,
            delay: options.oldSource.delay ?? (trackSwapDefault.oldSource.delay as number),
            duration: options.oldSource.duration ?? (trackSwapDefault.oldSource.duration as number),
        },
        newSource: {
            ramp: options.newSource.ramp ?? trackSwapDefault.newSource.ramp,
            delay: options.newSource.delay ?? (trackSwapDefault.newSource.delay as number),
            duration: options.newSource.duration ?? (trackSwapDefault.newSource.duration as number),
        },
    };

    return fullSwapOptions;
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

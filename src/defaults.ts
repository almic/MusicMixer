import { TrackSwapAdvancedOptions } from './Track';
import { AudioAdjustmentOptions, AudioRampType } from './AudioSourceNode';

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
 * Behavior when starting playback immediately.
 */
export const startImmediate: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 500,
});

/**
 * Behavior when stopping playback immediately.
 */
export const stopImmediate: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 1_000,
});

/**
 * Behavior for immediate (cut) adjustments. Note that even immediate adjustments take time.
 */
export const automationImmediate: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});

/**
 * Behavior for linear AudioParam automations
 */
export const automationLinear: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.LINEAR,
    delay: 0,
    duration: 1,
});

/**
 * Behavior for exponential AudioParam automations
 */
export const automationExponential: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 0.7,
});

/**
 * Behavior for natural AudioParam automations
 */
export const automationNatural: AudioAdjustmentOptions = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 0.23,
});

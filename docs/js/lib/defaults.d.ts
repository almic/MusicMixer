import { TrackSwapOptions, TrackSwapAdvancedOptions } from './Track.js';
import { AudioAdjustmentOptions } from './automation.js';
declare function buildOptions(trackSwapOptions: TrackSwapOptions | TrackSwapAdvancedOptions | undefined | null, defaultSwapOptions: TrackSwapAdvancedOptions): TrackSwapAdvancedOptions;
declare function buildOptions(audioAdjustmentOptions: AudioAdjustmentOptions | undefined | null, defaultAudioAdjustmentOptions: Required<AudioAdjustmentOptions>): Required<AudioAdjustmentOptions>;
declare function buildOptions(audioAdjustmentOptions: AudioAdjustmentOptions | undefined | null, defaultSwapOptions: TrackSwapAdvancedOptions): TrackSwapAdvancedOptions;
export default buildOptions;
/**
 * Default behavior for an IN_OUT track audio swap
 */
export declare const trackSwapInOut: TrackSwapAdvancedOptions;
/**
 * Default behavior for an OUT_IN track audio swap
 */
export declare const trackSwapOutIn: TrackSwapAdvancedOptions;
/**
 * Default behavior for a CROSS track audio swap
 */
export declare const trackSwapCross: TrackSwapAdvancedOptions;
/**
 * Default behavior for a CUT track audio swap
 */
export declare const trackSwapCut: TrackSwapAdvancedOptions;
/**
 * Default behavior for a track audio swap
 */
export declare const trackSwapDefault: TrackSwapAdvancedOptions;
/**
 * Default behavior when starting playback
 */
export declare const startImmediate: Required<AudioAdjustmentOptions>;
/**
 * Default behavior when stopping playback
 */
export declare const stopImmediate: Required<AudioAdjustmentOptions>;
/**
 * Behavior for immediate (cut) adjustments. Note that even immediate adjustments take time.
 */
export declare const automationImmediate: Required<AudioAdjustmentOptions>;
/**
 * Behavior for linear AudioParam automations
 */
export declare const automationLinear: Required<AudioAdjustmentOptions>;
/**
 * Behavior for exponential AudioParam automations
 */
export declare const automationExponential: Required<AudioAdjustmentOptions>;
/**
 * Behavior for natural AudioParam automations
 */
export declare const automationNatural: Required<AudioAdjustmentOptions>;
/**
 * Default behavior for AudioParam automations
 */
export declare const automationDefault: Required<AudioAdjustmentOptions>;

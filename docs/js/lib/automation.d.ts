/**
 * Ramp types for audio adjustments
 */
export declare enum AudioRampType {
    /**
     * Linear ramp
     */
    LINEAR = "linear",
    /**
     * Exponential ramp
     */
    EXPONENTIAL = "exponential",
    /**
     * Natural ramp. Depending on the adjustment being made, this will either be a
     * logarithmic adjustment, or an equal-power adjustment. In general, this option
     * will produce the best sounding results compared to the other options, and in
     * general should always be preferred over the others.
     */
    NATURAL = "natural"
}
/**
 * Adjustment options to use when changing volume, panning, etc.
 */
export type AudioAdjustmentOptions = {
    /**
     * Ramping method to use. Use 'natural' option for good equal power crossfading.
     * Supports a custom ramp by providing an array of numbers, where 0 is the initial state, and
     * 1 is the adjusted state. Going below 0 or above 1 does what you would expect, going beyond
     * the initial and adjusted state respectively.
     */
    ramp: AudioRampType | number[] | null;
    /**
     * Delay of seconds before applying this adjustment.
     */
    delay?: number;
    /**
     * Duration of seconds this adjustment should take, after the delay.
     */
    duration?: number;
};
/**
 * Automation function for AudioParam
 */
export default function automation(audioContext: AudioContext, audioParam: AudioParam, value: number, options: Required<AudioAdjustmentOptions>): void;

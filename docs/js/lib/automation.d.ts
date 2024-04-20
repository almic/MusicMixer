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
     * Natural ramp. This is like exponential, but ideal for adjustments where
     * you want a long tail, perfect for fading out sounds.
     */
    NATURAL = "natural",
    /**
     * Equal power ramp. This is ideal for crossfading two sources.
     */
    EQUAL_POWER = "equal_power",
    /**
     * Inverse equal power ramp. Advanced usages only!
     *
     * This should only be used in tandem with the normal equal power ramp,
     * specifically applied to the incoming source of a crossfade.
     */
    EQUAL_POWER_IN = "equal_power_in"
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
 *
 * Set `skipImmediate` to `true` if you want the automation to play out in its entirety, even if
 * the current value of the audioParam is at `value`. By default, the automation will cancel active
 * automations, so in many cases playing the full duration of the automation is not needed.
 *
 * @param audioContext the audioContext from which to use as the time system
 * @param audioParam the audioParam to automate
 * @param value the value to automate towards
 * @param options the method of automation
 * @param skipImmediate if true, dont short the automation if the current value is already at the
 *                      given value, allow the automation to play out.
 */
export default function automation(audioContext: AudioContext, audioParam: AudioParam, value: number, options: Required<AudioAdjustmentOptions>, skipImmediate?: boolean): void;

/**
 * Ramp types for audio adjustments
 */
export enum AudioRampType {
    /**
     * Linear ramp
     */
    LINEAR = 'linear',

    /**
     * Exponential ramp
     */
    EXPONENTIAL = 'exponential',

    /**
     * Natural ramp. This is like exponential, but ideal for adjustments where
     * you want a long tail, perfect for fading out sounds.
     */
    NATURAL = 'natural',

    /**
     * Equal power ramp. This is ideal for crossfading two sources.
     */
    EQUAL_POWER = 'equal_power',

    /**
     * Inverse equal power ramp. Advanced usages only!
     *
     * This should only be used in tandem with the normal equal power ramp,
     * specifically applied to the incoming source of a crossfade.
     */
    EQUAL_POWER_IN = 'equal_power_in',
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
    ramp: AudioRampType | number[] | Float32Array | null;

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
export default function automation(
    audioContext: AudioContext,
    audioParam: AudioParam,
    value: number,
    options: Required<AudioAdjustmentOptions>,
    skipImmediate: boolean = false,
): void {
    const currentValue = audioParam.value;
    const difference = value - currentValue;

    // Stop automations and immediately ramp.
    if (!skipImmediate && Math.abs(difference) < Number.EPSILON) {
        audioParam.cancelAndHoldAtTime(audioContext.currentTime);
        audioParam.setValueAtTime(currentValue, audioContext.currentTime);
        audioParam.linearRampToValueAtTime(value, options.delay + audioContext.currentTime);
        return;
    }

    audioParam.cancelAndHoldAtTime(options.delay + audioContext.currentTime);
    audioParam.setValueAtTime(currentValue, options.delay + audioContext.currentTime);
    if (Array.isArray(options.ramp) || options.ramp instanceof Float32Array) {
        const valueCurve = new Float32Array(options.ramp.length);
        let i = 0;
        for (const markiplier of options.ramp) {
            valueCurve[i++] = currentValue + difference * markiplier;
        }
        audioParam.setValueCurveAtTime(
            valueCurve,
            options.delay + audioContext.currentTime,
            options.duration,
        );
        return;
    }

    /**
     * It is necessary to explain the function of exponential ramping:
     *
     * - Ramping from zero to any value is the same as using setValueAtTime()
     * - Ramping from any value to zero is undefined
     * - Ramping to values near zero have an instantaneous effect
     *
     * The only way to "exponentially" ramp to or away from zero is to use
     * natural ramping; `setTargetAtTime()`. Therefore, an exponential ramp is
     * converted to a natural ramp when the start or end is near zero.
     *
     * This conversion is done with the goal of being intuitive, as it may not
     * be well understood that normal exponential ramping has these limitations.
     */

    if (
        options.ramp == AudioRampType.EXPONENTIAL &&
        (Math.abs(currentValue) < Number.EPSILON || Math.abs(value) < Number.EPSILON)
    ) {
        options = structuredClone(options);
        options.ramp = AudioRampType.NATURAL;
    }

    switch (options.ramp) {
        case AudioRampType.EXPONENTIAL: {
            audioParam.exponentialRampToValueAtTime(
                value,
                options.delay + options.duration + audioContext.currentTime,
            );
            break;
        }
        case AudioRampType.LINEAR: {
            audioParam.linearRampToValueAtTime(
                value,
                options.delay + options.duration + audioContext.currentTime,
            );
            break;
        }
        case AudioRampType.NATURAL: {
            // Logarithmic approach to value, it is 95% the way there after 3 timeConstant, so we linearly ramp at that point
            const timeSteps = 4;
            const timeConstant = options.duration / timeSteps;
            audioParam.setTargetAtTime(value, options.delay + audioContext.currentTime, timeConstant);
            audioParam.cancelAndHoldAtTime(
                timeConstant * (timeSteps - 1) + options.delay + audioContext.currentTime,
            );
            // ThE fOlLoWiNg EvEnT iS iMpLiCiTlY aDdEd, PeR wEbAuDiO SpEc.
            // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
            // https://www.youtube.com/watch?v=EzWNBmjyv7Y
            audioParam.setValueAtTime(
                currentValue + difference * (1 - Math.pow(Math.E, -(timeSteps - 1))),
                timeConstant * (timeSteps - 1) + options.delay + audioContext.currentTime,
            );
            audioParam.linearRampToValueAtTime(
                value,
                options.delay + options.duration + audioContext.currentTime,
            );
            break;
        }
        case AudioRampType.EQUAL_POWER:
        case AudioRampType.EQUAL_POWER_IN: {
            // Web Audio API does not have a built in equal power ramp
            // setValueCurveAtTime linearly interpolates between values
            const pollRate = 10;
            const length = options.duration > 1 ? Math.round(pollRate * options.duration) : pollRate;
            const valueCurve = new Float32Array(length);
            const halfPi = Math.PI / 2;
            const squashFactor = halfPi / length;
            if (options.ramp == AudioRampType.EQUAL_POWER) {
                for (let index = 0; index < length; index++) {
                    // V_0 -> V_1 == V_1 - (V_1 - V_0) * cos( (t - T) * (π / 2T) + (π / 2) )
                    valueCurve[index] =
                        value - difference * Math.cos((index - length + 1) * squashFactor + halfPi);
                }
            } else {
                for (let index = 0; index < length; index++) {
                    // V_0 -> V_1 == V_0 + (V_1 - V_0) * cos( (t - T) * (π / 2T) )
                    valueCurve[index] =
                        currentValue + difference * Math.cos((index - length + 1) * squashFactor);
                }
            }
            audioParam.setValueCurveAtTime(
                valueCurve,
                options.delay + audioContext.currentTime,
                options.duration,
            );
            break;
        }
        default: {
            console.warn(`Automation function received unknown ramp type ${options.ramp}`);
            audioParam.setValueAtTime(value, options.delay + audioContext.currentTime);
            break;
        }
    }
}

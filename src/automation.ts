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
     * Natural ramp. Depending on the adjustment being made, this will either be a
     * logarithmic adjustment, or an equal-power adjustment. In general, this option
     * will produce the best sounding results compared to the other options, and in
     * general should always be preferred over the others.
     */
    NATURAL = 'natural',
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
export default function automation(
    audioContext: AudioContext,
    audioParam: AudioParam,
    value: number,
    options: Required<AudioAdjustmentOptions>,
): void {
    const currentValue = audioParam.value;
    const difference = value - currentValue;

    // Stop automations and immediately ramp.
    if (Math.abs(difference) < Number.EPSILON) {
        audioParam.cancelAndHoldAtTime(audioContext.currentTime);
        audioParam.setValueAtTime(currentValue, audioContext.currentTime);
        audioParam.linearRampToValueAtTime(value, options.delay + audioContext.currentTime);
        return;
    }

    audioParam.cancelAndHoldAtTime(options.delay + audioContext.currentTime);
    audioParam.setValueAtTime(currentValue, options.delay + audioContext.currentTime);
    if (Array.isArray(options.ramp)) {
        const valueCurve = [];
        for (const markiplier of options.ramp) {
            valueCurve.push(currentValue + difference * markiplier);
        }
        audioParam.setValueCurveAtTime(
            valueCurve,
            options.delay + audioContext.currentTime,
            options.duration,
        );
        return;
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
            const timeConstant = options.duration / 4;
            audioParam.setTargetAtTime(value, options.delay + audioContext.currentTime, timeConstant);
            audioParam.cancelAndHoldAtTime(options.delay + timeConstant * 3 + audioContext.currentTime);
            // The following event is implicitly added, per WebAudio spec.
            // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
            // this.gainNode.gain.setValueAtTime(currentValue + (difference * (1 - Math.pow(Math.E, -3))), timeConstant * 3 + this.currentTime);
            audioParam.linearRampToValueAtTime(
                value,
                options.delay + options.duration + audioContext.currentTime,
            );
            break;
        }
        default: {
            audioParam.setValueAtTime(value, options.delay);
            break;
        }
    }
}

/**
 * Ramp types for audio adjustments
 */
export var AudioRampType;
(function (AudioRampType) {
    /**
     * Linear ramp
     */
    AudioRampType["LINEAR"] = "linear";
    /**
     * Exponential ramp
     */
    AudioRampType["EXPONENTIAL"] = "exponential";
    /**
     * Natural ramp. Depending on the adjustment being made, this will either be a
     * logarithmic adjustment, or an equal-power adjustment. In general, this option
     * will produce the best sounding results compared to the other options, and in
     * general should always be preferred over the others.
     */
    AudioRampType["NATURAL"] = "natural";
})(AudioRampType || (AudioRampType = {}));
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
export default function automation(audioContext, audioParam, value, options, skipImmediate = false) {
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
    if (Array.isArray(options.ramp)) {
        const valueCurve = [];
        for (const markiplier of options.ramp) {
            valueCurve.push(currentValue + difference * markiplier);
        }
        audioParam.setValueCurveAtTime(valueCurve, options.delay + audioContext.currentTime, options.duration);
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
    if (options.ramp == AudioRampType.EXPONENTIAL &&
        (Math.abs(currentValue) < Number.EPSILON || Math.abs(value) < Number.EPSILON)) {
        options = structuredClone(options);
        options.ramp = AudioRampType.NATURAL;
    }
    switch (options.ramp) {
        case AudioRampType.EXPONENTIAL: {
            audioParam.exponentialRampToValueAtTime(value, options.delay + options.duration + audioContext.currentTime);
            break;
        }
        case AudioRampType.LINEAR: {
            audioParam.linearRampToValueAtTime(value, options.delay + options.duration + audioContext.currentTime);
            break;
        }
        case AudioRampType.NATURAL: {
            // Logarithmic approach to value, it is 95% the way there after 3 timeConstant, so we linearly ramp at that point
            const timeSteps = 4;
            const timeConstant = options.duration / timeSteps;
            audioParam.setTargetAtTime(value, options.delay + audioContext.currentTime, timeConstant);
            audioParam.cancelAndHoldAtTime(timeConstant * (timeSteps - 1) + options.delay + audioContext.currentTime);
            // ThE fOlLoWiNg EvEnT iS iMpLiCiTlY aDdEd, PeR wEbAuDiO SpEc.
            // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
            // https://www.youtube.com/watch?v=EzWNBmjyv7Y
            audioParam.setValueAtTime(currentValue + difference * (1 - Math.pow(Math.E, -(timeSteps - 1))), timeConstant * (timeSteps - 1) + options.delay + audioContext.currentTime);
            audioParam.linearRampToValueAtTime(value, options.delay + options.duration + audioContext.currentTime);
            break;
        }
        default: {
            console.warn(`Automation function received unknown ramp type ${options.ramp}`);
            audioParam.setValueAtTime(value, options.delay + audioContext.currentTime);
            break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b21hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRvbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksYUFrQlg7QUFsQkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsa0NBQWlCLENBQUE7SUFFakI7O09BRUc7SUFDSCw0Q0FBMkIsQ0FBQTtJQUUzQjs7Ozs7T0FLRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFsQlcsYUFBYSxLQUFiLGFBQWEsUUFrQnhCO0FBeUJEOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxNQUFNLENBQUMsT0FBTyxVQUFVLFVBQVUsQ0FDOUIsWUFBMEIsRUFDMUIsVUFBc0IsRUFDdEIsS0FBYSxFQUNiLE9BQXlDLEVBQ3pDLGdCQUF5QixLQUFLO0lBRTlCLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUM7SUFDdEMsTUFBTSxVQUFVLEdBQUcsS0FBSyxHQUFHLFlBQVksQ0FBQztJQUV4Qyx5Q0FBeUM7SUFDekMsSUFBSSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMxRCxVQUFVLENBQUMsbUJBQW1CLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3pELFVBQVUsQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNsRSxVQUFVLENBQUMsdUJBQXVCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BGLE9BQU87SUFDWCxDQUFDO0lBRUQsVUFBVSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3pFLFVBQVUsQ0FBQyxjQUFj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
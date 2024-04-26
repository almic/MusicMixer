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
     * Natural ramp. This is like exponential, but ideal for adjustments where
     * you want a long tail, perfect for fading out sounds.
     */
    AudioRampType["NATURAL"] = "natural";
    /**
     * Equal power ramp. This is ideal for crossfading two sources.
     */
    AudioRampType["EQUAL_POWER"] = "equal_power";
    /**
     * Inverse equal power ramp. Advanced usages only!
     *
     * This should only be used in tandem with the normal equal power ramp,
     * specifically applied to the incoming source of a crossfade.
     */
    AudioRampType["EQUAL_POWER_IN"] = "equal_power_in";
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
    if (Array.isArray(options.ramp) || options.ramp instanceof Float32Array) {
        const valueCurve = new Float32Array(options.ramp.length);
        let i = 0;
        for (const markiplier of options.ramp) {
            valueCurve[i++] = currentValue + difference * markiplier;
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
            }
            else {
                for (let index = 0; index < length; index++) {
                    // V_0 -> V_1 == V_0 + (V_1 - V_0) * cos( (t - T) * (π / 2T) )
                    valueCurve[index] =
                        currentValue + difference * Math.cos((index - length + 1) * squashFactor);
                }
            }
            audioParam.setValueCurveAtTime(valueCurve, options.delay + audioContext.currentTime, options.duration);
            break;
        }
        default: {
            console.warn(`Automation function received unknown ramp type ${options.ramp}`);
            audioParam.setValueAtTime(value, options.delay + audioContext.currentTime);
            break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b21hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRvbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksYUE2Qlg7QUE3QkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsa0NBQWlCLENBQUE7SUFFakI7O09BRUc7SUFDSCw0Q0FBMkIsQ0FBQTtJQUUzQjs7O09BR0c7SUFDSCxvQ0FBbUIsQ0FBQTtJQUVuQjs7T0FFRztJQUNILDRDQUEyQixDQUFBO0lBRTNCOzs7OztPQUtHO0lBQ0gsa0RBQWlDLENBQUE7QUFDckMsQ0FBQyxFQTdCVyxhQUFhLEtBQWIsYUFBYSxRQTZCeEI7QUF5QkQ7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sQ0FBQyxPQUFPLFVBQVUsVUFBVSxDQUM5QixZQUEwQixFQUMxQixVQUFzQixFQUN0QixLQUFhLEVBQ2IsT0FBeUMsRUFDekMsZ0JBQXlCLEtBQUs7SUFFOUIsTUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztJQUN0QyxNQUFNLFVBQVUsR0FBRyxLQUFLLEdBQUcsWUFBWSxDQUFDO0lBRXhDLHlDQUF5QztJQUN6QyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzFELFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekQsVUFBVSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2xFLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDcEYsT0FBTztJQUNYLENBQUM7SUFFRCxVQUFVLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbEYsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxZQUFZLFlBQVksRUFBRSxDQUFDO1FBQ3RFLE1BQU0sVUFBVSxHQUFHLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxHQUFHLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0QsQ0FBQztRQUNELFVBQVUsQ0FBQyxtQkFBbUIsQ0FDMUIsVUFBVSxFQUNWLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFdBQVcsRUFDeEMsT0FBTyxDQUFDLFFBQVEsQ0FDbkIsQ0FBQztRQUNGLE9BQU87SUFDWCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUVILElBQ0ksT0FBTyxDQUFDLElBQUksSUFBSSxhQUFhLENBQUMsV0FBVztRQUN6QyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFDL0UsQ0FBQztRQUNDLE9BQU8sR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLElBQUksR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxRQUFRLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQixLQUFLLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzdCLFVBQVUsQ0FBQyw0QkFBNEIsQ0FDbkMsS0FBSyxFQUNMLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUM5RCxDQUFDO1lBQ0YsTUFBTTtRQUNWLENBQUM7UUFDRCxLQUFLLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLFVBQVUsQ0FBQyx1QkFBdUIsQ0FDOUIsS0FBSyxFQUNMLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUM5RCxDQUFDO1lBQ0YsTUFBTTtRQUNWLENBQUM7UUFDRCxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLGlIQUFpSDtZQUNqSCxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUM7WUFDcEIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7WUFDbEQsVUFBVSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzFGLFVBQVUsQ0FBQyxtQkFBbUIsQ0FDMUIsWUFBWSxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFdBQVcsQ0FDNUUsQ0FBQztZQUNGLDhEQUE4RDtZQUM5RCwrRUFBK0U7WUFDL0UsOENBQThDO1lBQzlDLFVBQVUsQ0FBQyxjQUFjLENBQ3JCLFlBQVksR0FBRyxVQUFVLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUNwRSxZQUFZLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUM1RSxDQUFDO1lBQ0YsVUFBVSxDQUFDLHVCQUF1QixDQUM5QixLQUFLLEVBQ0wsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQzlELENBQUM7WUFDRixNQUFNO1FBQ1YsQ0FBQztRQUNELEtBQUssYUFBYSxDQUFDLFdBQVcsQ0FBQztRQUMvQixLQUFLLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLDBEQUEwRDtZQUMxRCwyREFBMkQ7WUFDM0QsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUN6RixNQUFNLFVBQVUsR0FBRyxJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUMzQixNQUFNLFlBQVksR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ3JDLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzVDLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztvQkFDMUMsd0VBQXdFO29CQUN4RSxVQUFVLENBQUMsS0FBSyxDQUFDO3dCQUNiLEtBQUssR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsWUFBWSxHQUFHLE1BQU0sQ0FBQyxDQUFDO2dCQUNwRixDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQztvQkFDMUMsOERBQThEO29CQUM5RCxVQUFVLENBQUMsS0FBSyxDQUFDO3dCQUNiLFlBQVksR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7Z0JBQ2xGLENBQUM7WUFDTCxDQUFDO1lBQ0QsVUFBVSxDQUFDLG1CQUFtQixDQUMxQixVQUFVLEVBQ1YsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxFQUN4QyxPQUFPLENBQUMsUUFBUSxDQUNuQixDQUFDO1lBQ0YsTUFBTTtRQUNWLENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ04sT0FBTyxDQUFDLElBQUksQ0FBQyxrREFBa0QsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDL0UsVUFBVSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0UsTUFBTTtRQUNWLENBQUM7SUFDTCxDQUFDO0FBQ0wsQ0FBQyJ9
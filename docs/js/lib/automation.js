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
 */
export default function automation(audioContext, audioParam, value, options) {
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
        audioParam.setValueCurveAtTime(valueCurve, options.delay + audioContext.currentTime, options.duration);
        return;
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
            const timeConstant = options.duration / 4;
            audioParam.setTargetAtTime(value, options.delay + audioContext.currentTime, timeConstant);
            audioParam.cancelAndHoldAtTime(options.delay + timeConstant * 3 + audioContext.currentTime);
            // The following event is implicitly added, per WebAudio spec.
            // https://webaudio.github.io/web-audio-api/#dom-audioparam-cancelandholdattime
            // this.gainNode.gain.setValueAtTime(currentValue + (difference * (1 - Math.pow(Math.E, -3))), timeConstant * 3 + this.currentTime);
            audioParam.linearRampToValueAtTime(value, options.delay + options.duration + audioContext.currentTime);
            break;
        }
        default: {
            audioParam.setValueAtTime(value, options.delay);
            break;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b21hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRvbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksYUFrQlg7QUFsQkQsV0FBWSxhQUFhO0lBQ3JCOztPQUVHO0lBQ0gsa0NBQWlCLENBQUE7SUFFakI7O09BRUc7SUFDSCw0Q0FBMkIsQ0FBQTtJQUUzQjs7Ozs7T0FLRztJQUNILG9DQUFtQixDQUFBO0FBQ3ZCLENBQUMsRUFsQlcsYUFBYSxLQUFiLGFBQWEsUUFrQnhCO0FBeUJEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE9BQU8sVUFBVSxVQUFVLENBQzlCLFlBQTBCLEVBQzFCLFVBQXNCLEVBQ3RCLEtBQWEsRUFDYixPQUF5QztJQUV6QyxNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO0lBQ3RDLE1BQU0sVUFBVSxHQUFHLEtBQUssR0FBRyxZQUFZLENBQUM7SUFFeEMseUNBQXlDO0lBQ3pDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDeEMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN6RCxVQUFVLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbEUsVUFBVSxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRixPQUFPO0lBQ1gsQ0FBQztJQUVELFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN6RSxVQUFVLENBQUMsY0FBYyxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNsRixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDOUIsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLEtBQUssTUFBTSxVQUFVLElBQUksT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3BDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBQ0QsVUFBVSxDQUFDLG1CQUFtQixDQUMxQixVQUFVLEVBQ1YsT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsV0FBVyxFQUN4QyxPQUFPLENBQUMsUUFBUSxDQUNuQixDQUFDO1FBQ0YsT0FBTztJQUNYLENBQUM7SUFFRCxRQUFRLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQixLQUFLLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzdCLFVBQVUsQ0FBQyw0QkFBNEIsQ0FDbkMsS0FBSyxFQUNMLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUM5RCxDQUFDO1lBQ0YsTUFBTTtRQUNWLENBQUM7UUFDRCxLQUFLLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLFVBQVUsQ0FBQyx1QkFBdUIsQ0FDOUIsS0FBSyxFQUNMLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUM5RCxDQUFDO1lBQ0YsTUFBTTtRQUNWLENBQUM7UUFDRCxLQUFLLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLGlIQUFpSDtZQUNqSCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztZQUMxQyxVQUFVLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDMUYsVUFBVSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxHQUFHLENBQUMsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDNUYsOERBQThEO1lBQzlELCtFQUErRTtZQUMvRSxvSUFBb0k7WUFDcEksVUFBVSxDQUFDLHVCQUF1QixDQUM5QixLQUFLLEVBQ0wsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQzlELENBQUM7WUFDRixNQUFNO1FBQ1YsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDTixVQUFVLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEQsTUFBTTtRQUNWLENBQUM7SUFDTCxDQUFDO0FBQ0wsQ0FBQyJ9
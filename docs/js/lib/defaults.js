import { AudioRampType } from './automation.js';
function buildOptions(options, defaultOptions) {
    if ('swap' in defaultOptions) {
        console.warn('A caller passed a defaultOptions object of type TrackSwapOptions. Only TrackSwapAdvancedOptions ' +
            'are supported for buildOptions(). This is likely a mistake.');
    }
    if (!options) {
        return defaultOptions;
    }
    if ('newSource' in options) {
        if (defaultOptions && !('newSource' in defaultOptions)) {
            console.warn('A caller passed some options of type TrackSwapAdvancedOptions to a MusicMixer function that ' +
                'only accepts AudioAdjustmentOptions. This is likely a mistake.');
            return defaultOptions;
        }
        return options;
    }
    // Doing this here makes logic easier in the next block
    if ('newSource' in defaultOptions) {
        const fullOptions = structuredClone(defaultOptions);
        fullOptions.oldSource.ramp = options.ramp;
        fullOptions.newSource.ramp = options.ramp;
        if (options.duration) {
            const oldLength = fullOptions.oldSource.delay + fullOptions.oldSource.duration;
            const newLength = fullOptions.newSource.delay + fullOptions.newSource.duration;
            const difference = oldLength - newLength;
            const markiplier = options.duration /
                (difference > 0 || Math.abs(difference) < Number.EPSILON ? oldLength : newLength);
            fullOptions.oldSource.delay *= markiplier;
            fullOptions.oldSource.duration *= markiplier;
            fullOptions.newSource.delay *= markiplier;
            fullOptions.newSource.duration *= markiplier;
        }
        if (options.delay) {
            fullOptions.oldSource.delay += options.delay;
            fullOptions.newSource.delay += options.delay;
        }
        return fullOptions;
    }
    const fullOptions = structuredClone(defaultOptions);
    fullOptions.ramp = structuredClone(options.ramp);
    if (options.delay) {
        fullOptions.delay = options.delay;
    }
    if (options.duration) {
        fullOptions.duration = options.duration;
    }
    if ('swap' in options) {
        console.warn('A caller passed some options of type TrackSwapOptions to a MusicMixer function that ' +
            'only accepts AudioAdjustmentOptions. This is likely a mistake.');
    }
    return fullOptions;
}
export default buildOptions;
/**
 * Default behavior for an IN_OUT track audio swap
 */
export const trackSwapInOut = Object.freeze({
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
export const trackSwapOutIn = Object.freeze({
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
export const trackSwapCross = Object.freeze({
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
export const trackSwapCut = Object.freeze({
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
export const trackSwapDefault = Object.freeze({
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
export const startImmediate = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 500,
});
/**
 * Default behavior when stopping playback
 */
export const stopImmediate = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 1 / 1_000,
});
/**
 * Behavior for immediate (cut) adjustments. Note that even immediate adjustments take time.
 */
export const automationImmediate = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});
/**
 * Behavior for linear AudioParam automations
 */
export const automationLinear = Object.freeze({
    ramp: AudioRampType.LINEAR,
    delay: 0,
    duration: 1,
});
/**
 * Behavior for exponential AudioParam automations
 */
export const automationExponential = Object.freeze({
    ramp: AudioRampType.EXPONENTIAL,
    delay: 0,
    duration: 0.7,
});
/**
 * Behavior for natural AudioParam automations
 */
export const automationNatural = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 0.23,
});
/**
 * Default behavior for AudioParam automations
 */
export const automationDefault = Object.freeze({
    ramp: AudioRampType.NATURAL,
    delay: 0,
    duration: 1 / 711,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGVmYXVsdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUEwQixhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQWN4RSxTQUFTLFlBQVksQ0FDakIsT0FBZ0csRUFDaEcsY0FBMkU7SUFFM0UsSUFBSSxNQUFNLElBQUksY0FBYyxFQUFFLENBQUM7UUFDM0IsT0FBTyxDQUFDLElBQUksQ0FDUixrR0FBa0c7WUFDOUYsNkRBQTZELENBQ3BFLENBQUM7SUFDTixDQUFDO0lBRUQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsT0FBTyxjQUFjLENBQUM7SUFDMUIsQ0FBQztJQUVELElBQUksV0FBVyxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ3pCLElBQUksY0FBYyxJQUFJLENBQUMsQ0FBQyxXQUFXLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUNyRCxPQUFPLENBQUMsSUFBSSxDQUNSLDhGQUE4RjtnQkFDMUYsZ0VBQWdFLENBQ3ZFLENBQUM7WUFDRixPQUFPLGNBQWMsQ0FBQztRQUMxQixDQUFDO1FBQ0QsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVELHVEQUF1RDtJQUN2RCxJQUFJLFdBQVcsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNoQyxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFcEQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztRQUMxQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBRTFDLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQy9FLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQy9FLE1BQU0sVUFBVSxHQUFHLFNBQVMsR0FBRyxTQUFTLENBQUM7WUFDekMsTUFBTSxVQUFVLEdBQ1osT0FBTyxDQUFDLFFBQVE7Z0JBQ2hCLENBQUMsVUFBVSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdEYsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLElBQUksVUFBVSxDQUFDO1lBQzFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsUUFBUSxJQUFJLFVBQVUsQ0FBQztZQUM3QyxXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxVQUFVLENBQUM7WUFDMUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxRQUFRLElBQUksVUFBVSxDQUFDO1FBQ2pELENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQzdDLFdBQVcsQ0FBQyxTQUFTLENBQUMsS0FBSyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFDakQsQ0FBQztRQUVELE9BQU8sV0FBVyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7SUFFcEQsV0FBVyxDQUFDLElBQUksR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWpELElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2hCLFdBQVcsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUN0QyxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkIsV0FBVyxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO0lBQzVDLENBQUM7SUFFRCxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNwQixPQUFPLENBQUMsSUFBSSxDQUNSLHNGQUFzRjtZQUNsRixnRUFBZ0UsQ0FDdkUsQ0FBQztJQUNOLENBQUM7SUFFRCxPQUFPLFdBQVcsQ0FBQztBQUN2QixDQUFDO0FBRUQsZUFBZSxZQUFZLENBQUM7QUFFNUI7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQTZCLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDbEUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDckIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxPQUFPO1FBQzNCLEtBQUssRUFBRSxDQUFDO1FBQ1IsUUFBUSxFQUFFLEdBQUc7S0FDaEIsQ0FBQztJQUNGLFNBQVMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3JCLElBQUksRUFBRSxhQUFhLENBQUMsT0FBTztRQUMzQixLQUFLLEVBQUUsQ0FBQztRQUNSLFFBQVEsRUFBRSxHQUFHO0tBQ2hCLENBQUM7Q0FDTCxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBNkIsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNsRSxTQUFTLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUUsYUFBYSxDQUFDLE9BQU87UUFDM0IsS0FBSyxFQUFFLENBQUM7UUFDUixRQUFRLEVBQUUsQ0FBQztLQUNkLENBQUM7SUFDRixTQUFTLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUUsYUFBYSxDQUFDLE9BQU87UUFDM0IsS0FBSyxFQUFFLEdBQUc7UUFDVixRQUFRLEVBQUUsQ0FBQztLQUNkLENBQUM7Q0FDTCxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBNkIsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNsRSxTQUFTLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUUsYUFBYSxDQUFDLE9BQU87UUFDM0IsS0FBSyxFQUFFLENBQUM7UUFDUixRQUFRLEVBQUUsR0FBRztLQUNoQixDQUFDO0lBQ0YsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDckIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxPQUFPO1FBQzNCLEtBQUssRUFBRSxDQUFDO1FBQ1IsUUFBUSxFQUFFLEdBQUc7S0FDaEIsQ0FBQztDQUNMLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUE2QixNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hFLFNBQVMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3JCLElBQUksRUFBRSxhQUFhLENBQUMsT0FBTztRQUMzQixLQUFLLEVBQUUsQ0FBQztRQUNSLFFBQVEsRUFBRSxDQUFDLEdBQUcsS0FBSztLQUN0QixDQUFDO0lBQ0YsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDckIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxPQUFPO1FBQzNCLEtBQUssRUFBRSxDQUFDO1FBQ1IsUUFBUSxFQUFFLENBQUMsR0FBRyxLQUFLO0tBQ3RCLENBQUM7Q0FDTCxDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUE2QixNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3BFLFNBQVMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3JCLElBQUksRUFBRSxhQUFhLENBQUMsT0FBTztRQUMzQixLQUFLLEVBQUUsQ0FBQztRQUNSLFFBQVEsRUFBRSxHQUFHO0tBQ2hCLENBQUM7SUFDRixTQUFTLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUUsYUFBYSxDQUFDLE9BQU87UUFDM0IsS0FBSyxFQUFFLENBQUM7UUFDUixRQUFRLEVBQUUsR0FBRztLQUNoQixDQUFDO0NBQ0wsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQXFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDMUUsSUFBSSxFQUFFLGFBQWEsQ0FBQyxXQUFXO0lBQy9CLEtBQUssRUFBRSxDQUFDO0lBQ1IsUUFBUSxFQUFFLENBQUMsR0FBRyxHQUFHO0NBQ3BCLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFxQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3pFLElBQUksRUFBRSxhQUFhLENBQUMsV0FBVztJQUMvQixLQUFLLEVBQUUsQ0FBQztJQUNSLFFBQVEsRUFBRSxDQUFDLEdBQUcsS0FBSztDQUN0QixDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFxQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQy9FLElBQUksRUFBRSxhQUFhLENBQUMsT0FBTztJQUMzQixLQUFLLEVBQUUsQ0FBQztJQUNSLFFBQVEsRUFBRSxDQUFDLEdBQUcsR0FBRztDQUNwQixDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFxQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzVFLElBQUksRUFBRSxhQUFhLENBQUMsTUFBTTtJQUMxQixLQUFLLEVBQUUsQ0FBQztJQUNSLFFBQVEsRUFBRSxDQUFDO0NBQ2QsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBcUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNqRixJQUFJLEVBQUUsYUFBYSxDQUFDLFdBQVc7SUFDL0IsS0FBSyxFQUFFLENBQUM7SUFDUixRQUFRLEVBQUUsR0FBRztDQUNoQixDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFxQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzdFLElBQUksRUFBRSxhQUFhLENBQUMsT0FBTztJQUMzQixLQUFLLEVBQUUsQ0FBQztJQUNSLFFBQVEsRUFBRSxJQUFJO0NBQ2pCLENBQUMsQ0FBQztBQUVIOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBQXFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDN0UsSUFBSSxFQUFFLGFBQWEsQ0FBQyxPQUFPO0lBQzNCLEtBQUssRUFBRSxDQUFDO0lBQ1IsUUFBUSxFQUFFLENBQUMsR0FBRyxHQUFHO0NBQ3BCLENBQUMsQ0FBQyJ9
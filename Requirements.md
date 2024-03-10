# Introduction

MusicMixer will manage an `AudioContext` object, part of the Web Audio API in JavaScript. This object essentially acts like the bridge to the primary audio output device. Quite literally, we will be loading audio sources and `.connect()` them to the `AudioContext.destination`.

```javascript
// Just create a new AudioContext, a built-in class for JavaScript
let audioContext = new AudioContext();

// pretend we already loaded the `audioBuffer` from the file system
let audioSource = new AudioBufferSourceNode(audioContext, { buffer: audioBuffer });

// Connect the source to the destination.
// Imagine physically running a wire from one place to another
audioSource.connect(audioContext.destination);

// Start playing the audio source
audioSource.start();
```

All MusicMixer does is create a simple API to use the AudioContext object at a higher level. Instead of writing all those lines above, a user would write instead:

```javascript
const musicMixer = new MusicMixer();

musicMixer.playSource('halo_tunes.ogg');
```

# Goals & Values

This is the list of goals and values for MusicMixer.

### 1. Minimal
MusicMixer has a small API footprint, just enough to meet the requirements, no more. **No dependencies!**

### 2. Intuitive
MusicMixer methods are simply named and predictable. For instance, `playSource()`, `loadSource()`, `start()`, `stop()`, are simply named and their behavior is obvious from the name.

### 3. Sensible
For methods that have extra options, the default behavior is as simple as possible and makes sense (K.I.S.S., keep it simple, stupid).

### 4. Reusable
All methods should return something reusable, allowing chaining behaviors. If it doesn't make sense for a method to return something, reconsider if the method should exist at all (see goal #1). Additionally, functions and plugin commands should match exactly, i.e. the `track.loadSource(...)` function becomes the `MMTrackLoadSource ...` plugin command.

### 5. Reliable
Default behavior must be chosen carefully and remain constant. No public APIs to change default values/ behaviors.

# Requirements

This is the list of requirements for MusicMixer.

### Split from RPG Maker's AudioContext

RPG Maker engines use their own entire sound system, but ultimately stems from the same `AudioContext` class that MusicMixer will use. When MusicMixer is added, it will always use its own AudioContext, and leave the RPG Maker AudioContext untouched. This means that MusicMixer could be dropped into a project and only used when and where a developer wants to use it. This also provides the benefit to us that we don't have to worry about what sounds RPG Maker is playing.

### Support RPG Maker MV Plugin Commands

MusicMixer is being built for use within RPG Maker MV as a plugin. To support development of the game, basic features will be available as plugin commands. All plugin commands must be prefixed with `MM` to prevent colliding with other plugin commands. Here is what a plugin command looks like:

```javascript
MMTrackPlaySource music temple1
```

As you can see, it is pure text. Standard implementation is to have a `CamelCase` identifier, followed by a list of arguments separated by spaces. However, the engine sets no requirements and makes no distinction between plugin commands, it fires a single event and passes the entire text as the only argument. In the RPG Maker engine, plugin commands are handled somewhat like this:

```javascript
let args = ["MMTrackPlaySource music temple1"];
fireEvent('pluginCommand', ...args);
```

It is up to the plugin developer to listen for plugin commands and process the "argument" which is the entire command as a string.

### Anti-Support for Variables

Because an RPG Maker plugin has unrestricted access to the entire state of the game when running, including custom variables created via command scripting with the game engine, it is possible and common for plugins to support variable use within their commands. Without getting into the details...

**MusicMixer will support plugin commands with parameters to a sufficient degree, but deliberately offer no support for variables via plugin commands.**

### Audio File Loading

MusicMixer must be able to accept a file path and load an audio file into memory. Due to technical requirements, the only supported audio file format will be the `.ogg` format.

### Audio Source Management

MusicMixer will have its own "Audio Source" class that exposes settings to apply to the source, such as volume, panning, etc. Audio Sources may be given to tracks manually, or tracks can create their own audio source with just a filepath and optional parameters.

### Audio Source Looping and Jumping

Audio Source classes must offer looping and jumping. In reality, this is just manipulating the underlying audio buffer to start and stop playing at precise times with precise offsets. Technically, for flawless playback, we must schedule jumps and loops before they will happen. What is most important is that the jump/ loop *sounds* perfect, not that it happens at a perfect time, unless it must be aligned with playback of another track via "beats", more about that later. For most cases this can be scheduled far enough in advance that playback will always be flawless, as developers will know long ahead of time when a jump or loop should happen.

Audio source jumping is instantaneously moving forward in time, going backwards is looping. Luckily, looping is supported directly by the `AudioBufferSourceNode` object. Jumping must be manually implemented. This implementation will effectively do the same thing that looping does. The implementation must schedule a stop time in the future for the current source, and a start time for a new source that shares the same buffer. For jumps, we must include a small fade-in/out to avoid a "click" sound as the samples abruptly change.

The loop implementation has some specification that permits it to "overshoot" the loop point, but jump backwards to the start point afterwards. For the sake of simplicity, the jump implementation only needs to look ahead some small amount of time to determine if it's close to reaching the jump point. If it finds the jump point is about to be reached, it schedules the jump to happen. There is no need to consider reversed playback or jumping after a missed jump point. If there is a situation where a developer expects a jump could be missed, and still wants it to happen, they must manually jump by stopping playback, scrubbing forward, and resuming playback.

### Track Management

MusicMixer must support track creation, similar to how an image editor like Paint.NET uses a layer system. Each track is a layer, and each track will support playing a single audio source at a time. Tracks will support a volume setting. This allows developers to, for instance, let a user change the volume of a track and have it influence all sounds played on the track. This may also enable audio ducking, so that when a "voice" track is playing dialogue, the "music" track will duck out and get quieter so the voice is easier to hear.

Tracks can be created and removed at random, started and stopped at random, and change their audio source at random.

When removing a track, assume the source is to be immediately stopped. When stopping a track, allow a developer to decide how to stop the source, such as fading it out over time. When changing the audio source, allow a developer to decide how to swap the source. Will the new sound play immediately, or will they crossfade, or will one fade out completely before the other fades in?

### Track Groups

MusicMixer tracks only support one source at a time. This means, for instance, to play a soundscape that includes five unique audio sources, a developer has to create five tracks. To remedy this, a unique "Track Group" can be created that will virtually function like a single track. Developers can then simply tell the track group to take a new audio source, as they would with a normal track, and it will automatically create a new track for that source. This allows a developer to allow a user to change one volume slider, and have all child tracks be affected by the volume change.

An important technical requirement is that the "Track Group" implement the exact same API as a normal track, and so become effectively interchangeable in usage. Track Groups must allow access to the autogenerated tracks within, so a developer may deliberately change the properties of a specific track. It will be the developer's responsibility to locate their desired track and change its volume. By default, using methods on the track group will apply settings onto the first track in its list.

### Track Beat Timing

MusicMixer tracks must support "beat timing" based on developer specified settings. Beat timing means that, when the next source is playing, "beats" are generated that other tracks can synchronize to. This will make it possible to create dynamic music. The primary track might be a bass guitar sample, with beats on which other tracks (drums, claps, piano) will begin playing their audio source. Tracks can be initialized with their audio source, and wait for an in-game trigger, then start playing their source when it lines up with a beat on its target track.

Beats may be defined using one or many of the following specifications:

- Repeating: From an initial point in a source, every X seconds will generate a beat.
- Precise: An exact time X seconds into the source is a beat.
- Excluded: Between two points A and B in a source, any beats generated by the other two specifications will be removed.

It is important to keep in mind that beats are always **relative** with an actively playing source. Defining beats won't have any tangible effect until the source starts playing. However, beats are always assigned to **tracks, not their sources**. This means the track manages the beat specification, and looks to the audio source's playhead for timing. Assigning a new source to a track will remove all generated beats and specifications.

For "Track Groups," attempting to assign beats will simply look to the first available track in the group and pass on the target/ specifications. Developers looking to synchronize tracks with a track within a group must manually search the group, and then assign the target/ specifications.

### Event Signals

MusicMixer must allow a developer to assign logic to tracks. This will function as a callback list, where the developer passes a function and selects an event to call that function on. The following events, and data, must be supported:

- Event: `startPlayback`, Parameters: track object, start options. Called as soon as the track schedules the start of its audio source, even if it might be delayed for some time.
- Event: `stopPlayback`, Parameters: track object, stop options. Called as soon as the track schedules to stop playing its audio source, even if it might be delayed for some time.
- Event: `beat`, Parameters: track object, beat specification that triggered this beat and the time it will occur. Called when the track determines it is about to generate a beat during playback. This will be the method by which track timing synchronization happens. Due to the nature of audio playback, this event must be emitted when the beat is scheduled, before the actual beat time.

### Race Condition Handling

MusicMixer must be able to responsibly handle race conditions during audio playback. In general, changing an audio source after some other playback is scheduled seems to be the most likely place for issues to arise. It will be important to write unit tests, or rather audio tests on an HTML page that will run on a browser, for manual review to ensure audio playback stays smooth and no sounds are left playing when they should have been interrupted.

# Usage Potential

This section will contain samples of how MusicMixer **might** be used in both JavaScript and with the plugin command feature of RPG Maker MV.

### Potential Example 1: Playing a looping music track

JavaScript:
```javascript
let track = musicMixer.newTrack(
    'music',
    './assets/music/bg_music.ogg'
);

track.loop(true);
track.start();
```

RPGMMV:
```javascript
MMNewTrack music
MMTrackLoadSource music bg_music.ogg
MMTrackOptions music loop:true
MMTrackStart music
```

### Potential Example 2: Creating a group track and playing many sounds

JavaScript:
```javascript
let group = musicMixer.newTrackGroup('effects');

// play immediately
group.playSource('./assets/sfx/waves.ogg');

// play immediately, 50% volume
let windSource = group.playSource('./assets/sfx/wind.ogg', 0.5);

// can retrieve the actual track of the source and apply options
windSource.track.loop(true);

// play later, with options
group.playSource('./assets/sfx/birds.ogg', {
    delay: 5,
    volume: 0.5,
    panning: -0.5
});
```

RPGMMV:
```javascript
MMNewTrackGroup effects
MMTrackPlaySource effects waves.ogg
MMTrackPlaySource effects wind.ogg volume:50
// Access track from group with the name of the source
MMTrackOptions effects.wind loop:true
MMTrackPlaySource effects birds.ogg delay:5 volume:50 panning:-50
```

### Potential Example 3: Defining loop and jump points

It is possible to support having multiple loop and jump points. These potential examples only demonstrate setting a single loop and jump on a track. It is up to developers to ensure that loops are closed, and that jumps are predictable. For instance, creating a loop, but also setting a jump within the loop area that immediately escapes the loop could have undefined behavior. We may choose to leave it as undefined behavior.

JavaScript:
```javascript
let track = musicMixer.newTrack('music');

// loadSource will load the source without starting playback
// useful to create tracks before you know what will play on them,
// and load sources before you know their parameters
// equivalent:
//   musicMixer.newTrack('music', './assets/music/endless.ogg');
track.loadSource('./assets/music/endless.ogg');

// set loop options
track.loop(true, LOOP_SAMPLE_START, LOOP_SAMPLE_END);

// set jump options
track.jump(true, JUMP_SAMPLE_FROM, JUMP_SAMPLE_TO);

track.start();
```

RPGMMV:
```javascript
MMNewTrack music
MMTrackLoadSource music endless.ogg
MMTrackOptions music loop:true loopStart:1000 loopEnd:30000
MMTrackOptions music jump:true jumpFrom:5000 jumpTo:8000
MMTrackStart music
```

### Potential Example 4: Different track and source options

Tracks will only support loop, jump, beat, and volume settings. To make use of panning, pitch, playback speed, etc., developers must apply these directly to the audio source. This separation ensures developers don't end up swapping between track and source for settings, with the exception of volume. Volume is supported on tracks so all playing sources will have a consistent volume. It is also supported on sources as there are instances where a source may be distant and should be quieter, without amplifying other sources that may play later on the same track (or group!).

JavaScript:
```javascript
let trackRadio = musicMixer.newTrack('radio');

let radioSource = trackRadio.loadSource('./assets/music/radio1.ogg');

// Apply user settings for radio sources
trackRadio.volume(USER_RADIO_VOLUME);

// Apply radio volume and panning based on calculations
radioSource.options({
    volume: distanceBetween(radio, player),
    panning: directionFromTo(player, radio)
});

trackRadio.loop(true);
trackRadio.start();
```

RPGMMV: **Unsupported**. See [Anti-Support for Variables](#Anti-Support-for-Variables).

### Potential Example 5: Switching sources on a track

Assume that passing no options to a second `playSource` call applies some default fast-cut swap, quickly cross-fading the sources. Also, changing the source will always reset any track settings (except volume), as well as audio source settings.

JavaScript:
```javascript
let track = musicMixer.newTrack('music');

track.playSource('./assets/music/halo1.ogg');

// ... level changes

track.playSource('./assets/music/halo3.ogg', {
    // fade out current source, then fade in new source
    swap: 'fadeOutIn',
    // wait 1 second after fade-out, before fade-in
    swapDelay: 1
});
```

RPGMMV:
```javascript
MMNewTrack music
MMTrackPlaySource music halo1.ogg
// ... level changes
MMTrackPlaySource music halo3.ogg swap:fadeOutIn swapDelay:1
```

# MusicMixer.js

Music mixing library, designed for general use in JavaScript applications.

I made this for a personal project in RPGMaker, but the plugin is so big that I decided to just make general purpose
and made a repository for it, mostly for organizational purposes.

## How to Use

MusicMixer supports creating tracks with controls and filters, and you can queue sounds to play on those tracks with
their own specific parameters. You can have as many tracks as you want, and tracks can play only one audio source at a
time. Adding new audio sources to a track which is already playing audio will cross-fade to the new audio.

To support seamless looping and sound synchronization, most timing options use sample counts instead of seconds. For an
audio source with a sample rate of 44.1kHz, this means the sample at position 44,100 corresponds to precisely 1 second.
Changes to audio output (synchronization, volume, etc.) are always scheduled for a future time, but audio processing
happens at CPU clock speeds, so even changes scheduled for "now" will practically take effect instantly.

These are the steps to create tracks and play audio:
  1. Create a track, giving a name, and optional controls like volume, panning, and filters.
  2. Queue an audio source to play on a track, providing controls for the queued audio source, like volume, panning,
  filters, and starting/ ending points. These apply directly to the audio source, independent of track controls which
  apply to the final sound output.
  3. Schedule the configured audio source to start playing on the track it has been assigned to. It will start playing
  at the scheduled time.
  4. Once the sound is playing, you can change its parameters, such as changing the loop section.
  5. After a track has been created, you can also create markers, which are useful to synchronize other sounds on
  different tracks, or for switching audio sources on the same track.

Example simple usage:
```javascript
// Create track
//                      name,   options
MusicMixer.createTrack('music', {volume: 50});

// Queue audio onto the track
//                     file path,           track,  options
MusicMixer.queueAudio('audio/Village.ogg', 'music', {loopStart: 804825, loopEnd: 2579850});

// Schedule the audio to play immediately
//                        track,  time
MusicMixer.scheduleAudio('music', 0);

// Schedule the audio to stop in the future, fading out over a duration
MusicMixer.stopAudio('music', {delay: 5, duration: 7});
```

Advanced uses:
```javascript
// Add marker 'beat' to the track. Markers are always in seconds, yet you can specify sample times only if the track
// has playing audio, using the next example.

//                    track,   name,  options
MusicMixer.addMarker('music', 'beat', {time: 0, interval: 1});

// Using sample timings, can interchange sample time and sample interval with seconds 'time' and seconds 'interval'.
// Requires playing audio on the track, as sample times are converted into seconds using the sample rate.

//                    track,   name,  options
MusicMixer.addMarker('music', 'beat', {sample: 82, sampleInterval: 44100});

// Schedule audio to begin playing on a beat, with 0 fade time. This can be used to create seamless jumps in the same
// audio source, or perfectly synchronize a beat track with the music

MusicMixer.queueAudio(
    'audio/VillageBeat.ogg',
    'beat',
    {loopStart: 88200, loopEnd: 1411200}
);
MusicMixer.scheduleAudio(
    'beat',
    {marker: 'music#beat'}
);

// Adjust track controls, such as fading music over time. Unless the audio stops playing by reaching the end, setting
// volume to zero will retain the audio source and continue playing muted. Increasing the volume later can provide the
// effect of a player moving far away from the source and then returning.

//                                  track,  delay, duration, options
MusicMixer.scheduleTrackAdjustment('music', 0,     2,        {volume: 0});

// Similar to `scheduleTrackAdjustment`, except it applies to the primary audio source on the track instead of the
// track, and is timed according to the sample time of the audio source. Requires playing audio on the track.

//                                  track,  options
MusicMixer.scheduleAudioAdjustment('music', {from: 573300, to: 683550, pan: -1, volume: 0});

// Schedule loop change on a track, requires playing audio as it uses sample timings. Reaching/ passing `loopEnd` jumps
// output to `loopStart`. For a loop to trigger, the audio output needs to be at either `loopStart`, `loopEnd`, or
// between the two points. You can even use this to "loop" forward in time, but be aware that forward "loops" run on
// timers as they aren't officially supported, so scheduling a small jump within milliseconds of the jump time may
// fail to trigger!

//                                  track,  options
MusicMixer.scheduleAudioAdjustment('music', {loopStart: 804825, loopEnd: 2579850});
```

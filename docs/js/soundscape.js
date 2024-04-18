/**
 * Soundscape.js
 */

import { toggleText } from './main.js';
import MusicMixer from './lib/MusicMixer.js';

/* Web only; loading after interaction with page */
let mixer;
let ambienceTrack;
function loadMixer() {
    mixer = new MusicMixer();
    ambienceTrack = mixer.newTrackGroup('ambience');
    ambienceTrack.volume(0.5);

    ambienceTrack
        .newTrack('storm', 'audio/Storm2.ogg')
        .loop(true, 772_453, 772_453 + 2_233_599)
        .volume(0.4);

    ambienceTrack
        .newTrack('rain', 'audio/River.ogg')
        .loop(true, 31, 31 + 353_589)
        .volume(0.35);

    ambienceTrack
        .newTrack('wildlife', 'audio/Night.ogg')
        .loop(true, 572_933, 572_933 + 4_101_063)
        .volume(0.5);

    ambienceTrack
        .newTrack('cave', 'audio/Drips.ogg')
        .loop(true, 10, 10 + 544_625)
        .volume(0.25);
}

/* Button functions */

function toggleTrack(self) {
    const name = self.getAttribute('data-track');
    const playing = self.getAttribute('data-playing') == 'true';
    const track = ambienceTrack.track(name);
    if (track) {
        if (playing) {
            track.getActiveSource().onended = null;
            track.stop({ duration: 2 });
            self.setAttribute('data-playing', 'false');
            toggleText(self);
        } else {
            const source = track.getActiveSource() ?? track.getLoadedSource();
            const loop = source.loop,
                loopStart = source.loopStart,
                loopEnd = source.loopEnd;
            track.start({ duration: 2 }).loop(loop, loopStart, loopEnd);
            self.setAttribute('data-playing', 'true');
            toggleText(self);
            track.getActiveSource().addEventListener('ended', () => {
                if (self.getAttribute('data-playing') == 'true') {
                    self.setAttribute('data-playing', 'false');
                    toggleText(self);
                }
            });
        }
    }
}

function changeVolume(name, volume) {
    if (name == 'ambience') {
        ambienceTrack.volume(volume);
        return;
    }

    const track = ambienceTrack.track(name);
    if (track) {
        track.volume(volume);
    }
}

/* Web only; bind functions to global context */

window.loadMixer = loadMixer;
window.toggleTrack = toggleTrack;
window.changeVolume = changeVolume;

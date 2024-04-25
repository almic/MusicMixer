/**
 * Panning.js source
 */

import { toggleText } from './main.js';
import MusicMixer from './lib/MusicMixer.js';
import HRTFPannerNode from './lib/HRTFPannerNode.js';

/* Web only; loading after interaction with page */
let mixer;
let track;
let hrtfPanner;
const position = {
    distance: 0.5,
    azimuth: 0.5,
    elevation: 0.5,
};

function loadMixer() {
    mixer = new MusicMixer({ latencyHint: 'interactive', sampleRate: 44100 });
    // Point listener towards +Z, for some reason the default is -Z
    mixer.context.listener.forwardZ.value = 1;
    track = mixer
        .newTrack('noice', 'audio/2000_Shop3.ogg')
        .loop(true, 37_988, 37_988 + 1_227_391)
        .volume(0.5);
    hrtfPanner = new HRTFPannerNode(mixer.context);
    hrtfPanner.updatePosition(...computePosition());
    track.getLoadedSource().hrtfPanner = hrtfPanner;
}

/* Input functions */

function computePosition() {
    const azimuth = position.azimuth * Math.PI;
    const elevation = position.elevation * Math.PI;
    const elevationSin = Math.sin(elevation);
    return [
        position.distance * elevationSin * Math.cos(azimuth),
        position.distance * Math.cos(elevation),
        position.distance * elevationSin * Math.sin(azimuth),
    ];
}

function updateDistance(value) {
    value = -(value / (value - 1));
    position.distance = isFinite(value) ? value : 10000;
    hrtfPanner.updatePosition(...computePosition());
}

function updateAzimuth(value) {
    position.azimuth = value;
    hrtfPanner.updatePosition(...computePosition());
}

function updateElevation(value) {
    position.elevation = value;
    hrtfPanner.updatePosition(...computePosition());
}

function toggleTrack(self) {
    const playing = self.getAttribute('data-playing') == 'true';
    if (playing) {
        track.getActiveSource().onended = null;
        track.stop({ duration: 1 });
        self.setAttribute('data-playing', 'false');
        toggleText(self);
    } else {
        const source = track.getActiveSource() ?? track.getLoadedSource();
        const loop = source.loop,
            loopStart = source.loopStart * source.sampleRate,
            loopEnd = source.loopEnd * source.sampleRate;
        track.start({ duration: 1 }).loop(loop, loopStart, loopEnd);
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

function changeVolume(volume) {
    track.volume(volume);
}

/* Web only; bind functions to global context */

window.loadMixer = loadMixer;
window.updateDistance = updateDistance;
window.updateAzimuth = updateAzimuth;
window.updateElevation = updateElevation;
window.toggleTrack = toggleTrack;
window.changeVolume = changeVolume;

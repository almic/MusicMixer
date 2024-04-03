import MusicMixer from './lib/MusicMixer.js';

/* Web only; loading after interaction with page */
let mixer;
let musicTrack;
function loadMixer() {
    mixer = new MusicMixer();
    musicTrack = mixer.newTrack('music', 'audio/03_Cybercity.ogg');
    mixer.volume(0.5);
}

/* Button functions */

function playMusic() {
    musicTrack.start();
}

function stopMusic() {
    musicTrack.stop();
}

function fadeIn() {
    musicTrack.start(0, { duration: 2 });
}

function fadeOut() {
    musicTrack.stop(0, { duration: 2 });
}

function changeVolume(volume) {
    mixer.volume(volume);
}

/* Web only; bind functions to global context */

window.loadMixer = loadMixer;
window.playMusic = playMusic;
window.stopMusic = stopMusic;
window.fadeIn = fadeIn;
window.fadeOut = fadeOut;
window.changeVolume = changeVolume;

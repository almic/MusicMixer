/**
 * Multitrack.js
 */

import { toggleText } from './main.js';
import MusicMixer from './lib/MusicMixer.js';
import { AudioRampType } from './lib/automation.js';

/* Web only; loading after interaction with page */
let mixer;
let tracks = {
    music: null,
    environment: null,
    crowd: null,
    effects: null,
};
let songList = [
    {
        path: 'audio/03_Cybercity.ogg',
        loopStart: 723_525,
        loopEnd: 3_618_386,
    },
    {
        path: 'audio/2000_Shop3.ogg',
        loopStart: 37_988,
        loopEnd: 1_265_379,
    },
    {
        path: 'audio/Dungeon4.ogg',
        loopStart: 0,
        loopEnd: 2_945_115,
    },
];
let sounds = {
    writing: [
        'audio/pencil-foley-write-1-162850.ogg',
        'audio/pencil-foley-write-2-162851.ogg',
        'audio/pencil-foley-write-3-162852.ogg',
    ],
    equip: ['audio/Equip2.ogg', 'audio/Equip3.ogg'],
};
let cache = {};

function loadMixer() {
    mixer = new MusicMixer({ latencyHint: 'interactive', sampleRate: 44100 });
    mixer.volume(0.5);

    const music = mixer.newTrackGroup('music').volume(0.25);
    const environment = mixer.newTrackGroup('environment').volume(0.5);
    const crowd = mixer.newTrackGroup('crowd').volume(0.5);
    const effects = mixer.newTrackGroup('effects').volume(0.5);

    const song = songList[0];
    music.loadSource(song.path);
    music.loop(true, song.loopStart, song.loopEnd);

    environment //
        .newTrack('wind', 'audio/ambience-wind-blowing-through-trees-01-186986.ogg')
        .volume(1.5)
        .loop(true);
    environment //
        .newTrack('birds', 'audio/forrest_birds_norway-6944-crop.ogg')
        .volume(2.25)
        .loop(true);

    crowd //
        .newTrack('traffic', 'audio/amb_int_roomtone_traffic_001-57547.ogg')
        .volume(3.0)
        .loop(true);
    crowd //
        .newTrack('chatter', 'audio/outdoors-walla-20463.ogg')
        .volume(0.5)
        .loop(true);

    effects.newTrack('writing');
    effects.newTrack('gear');

    tracks.music = music;
    tracks.environment = environment;
    tracks.crowd = crowd;
    tracks.effects = effects;
}

/* Button functions */

function playAll() {
    const buttons = document.querySelectorAll('button[data-track]');
    for (const button of buttons) {
        if (button.getAttribute('data-track').startsWith('effects')) {
            continue;
        }

        const playing = button.getAttribute('data-playing') == 'true';
        if (!playing) {
            toggleTrack(button);
        }
    }
}

function stopAll() {
    const buttons = document.querySelectorAll('button[data-track]');
    for (const button of buttons) {
        const playing = button.getAttribute('data-playing') == 'true';
        if (playing) {
            toggleTrack(button);
        }
    }
}

function nextSong(self) {
    const next = songList.pop();
    songList.unshift(next);
    if (!cache[next.path]) {
        cache[next.path] = mixer.loadSource(next.path);
    }
    tracks.music.loadSource(cache[next.path]);
    tracks.music.loop(true, next.loopStart, next.loopEnd);
    if (self.getAttribute('data-playing') == 'true') {
        // This is silly but deliberate
        toggleTrack(self);
        toggleTrack(self);
    }
}

function playSound(self) {
    const [groupName, trackName] = self.getAttribute('data-track').split('.');
    const track = mixer.trackGroup(groupName)?.track(trackName);
    if (track) {
        const soundGroup = self.getAttribute('data-sound');
        const soundList = sounds[soundGroup];
        if (soundList) {
            const next = soundList.pop();
            soundList.unshift(next);
            if (!cache[next]) {
                cache[next] = mixer.loadSource(next);
            }
            track.loadSource(cache[next]);
            track.swap({
                oldSource: { ramp: AudioRampType.NATURAL, delay: 0, duration: 0.25 },
                newSource: { ramp: AudioRampType.NATURAL, delay: 0, duration: 0.01 },
            });
        }
    }
}

function toggleTrack(self) {
    const [groupName, trackName] = self.getAttribute('data-track').split('.');
    const playing = self.getAttribute('data-playing') == 'true';
    const track = mixer.trackGroup(groupName)?.track(trackName) ?? mixer.trackGroup(groupName);
    if (track) {
        if (playing) {
            track.getActiveSource().onended = null;
            track.stop({ duration: 2 });
            self.setAttribute('data-playing', 'false');
            toggleText(self);
        } else {
            const source = track.getActiveSource() ?? track.getLoadedSource();
            const loop = source.loop,
                loopStart = source.loopStart * source.sampleRate,
                loopEnd = source.loopEnd * source.sampleRate;
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

function changeVolume(self) {
    const name = self.getAttribute('data-track');
    if (name == 'master') {
        mixer.volume(Number(self.value));
        return;
    }
    const track = mixer.track(name);
    if (track) {
        track.volume(Number(self.value));
    }
}

/* Web only; bind functions to global context */

window.loadMixer = loadMixer;
window.playAll = playAll;
window.stopAll = stopAll;
window.nextSong = nextSong;
window.playSound = playSound;
window.toggleTrack = toggleTrack;
window.changeVolume = changeVolume;

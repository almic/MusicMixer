# <img align="center" src="https://github.com/almic/MusicMixer/blob/main/docs/logo.svg?raw=true" width="48"> Music Mixer

Music mixing library, designed for general use in JavaScript applications.

I made this for a personal project in RPGMaker, but the plugin is so big that I decided to just make general purpose
and made a repository for it, mostly for organizational purposes.

## Version Information

NW.js: `v0.85.0`
Chromium: `v122`
Node: `v21.1.0`

## What is NW.js ?

From <https://nwjs.io/>
> NW.js (previously known as node-webkit) lets you call all Node.js modules directly from DOM and enables a new way of writing applications with all Web technologies.

In essence, it's a runtime bundle that let's you write HTML/ JavaScript applications which can run natively across platforms. It really is the "write once, run everywhere" for desktop JavaScript applications.

This project was built to be used for RPG Maker MV, which unfortunately comes packaged with a very old version of NW.js, `v0.29.0`.

*After some research, it's clear that this can be updated manually so that games will run on the latest versions available!*

NW.js has not had breaking changes to their API since v0.13, and the current RPG Maker MV uses `v0.29.0`, well past the most recent API change. Did you know RPGMMV is pretty much just 14 javascript files bundled with assets and JSON files that run with NW.js? This makes it possible to "drop in" any RPG Maker MV project's files with the latest release of NW.js. This brings the most recent APIs and performance improvements from Chromium and Node! Yay!

## Is that safe?

Maybe this is best written alongside my actual game files, but for now I'll write this information here.

I looked through the RPG Maker MV source code, and the most it does with NW.js is calling the Window API. It also checks if NW.js is even available first! The code is all written to run on pure JavaScript, so using the latest NW.js versions (and latest Node/ Chromium APIs), is totally safe. All I could see was using i/o from Node, and simple event listeners from Chromium. Besides that, it's just pure JS and the Pixi library running on the back of NW.js. (Pixi only uses WebGL and is very robust on legacy support.)

## Building

This section will be removed in the future, as it's only applicable to building and RPG Maker MV game with the latest NW.js version.

### Using NW.js

First, I highly recommend building your game in a sub-folder of your project. This allows RPG Maker to do its normal stuff without busting anything else. Then, create a folder for building your game. You can modify the RPG engine source code this way, and just copy your project's assets to the build folder. I would even suggest touching up the file save system, by default all saves follow the format 'fileX.rpgsave' and is hard-limited to 20 saves. It would be nicer to let users name their saves and keep as many as they want. This build version should just include the plugins you want, and the game assets (JSON files, images, sounds, etc) taken from the original RPG Maker project.

Once you've finished making your game, and copied the original assets to your build folder, do the following:

1. Compress your game assets using free software, `.ogg` audio files are often way smaller than `.wav` and `.mp3` files, there are `.png` compressors than can seriously cut file sizes without sacrificing any visual quality, you can minify your JavaScript files and then compile them to native code with NW.js build tools.
1. Download the latest version of NW.js from <https://nwjs.io/>
1. Follow the documentation on building/ compiling to native code. There are a few choices, you can smash everything into a single executable (for windows only), or put things into an installer.
    - There's also the ability to create an auto-updater. This will search for versions on your own public hosting server and download new files. If you're shipping on Steam or other game library services, they'll do that for you, so don't do that yourself.
    - Consider compiling javascript to native, this should compress the file sizes more, and can improve game performance. You can also sign your build so people can be sure they have a legitimate version of the game. If you have anything proprietary, it also helps hide that code. But be safe; never include private keys in your builds, as they can always be extracted!
1. Finally, go through and build your application for all platforms you want to support.
    - You'll be smart to test the build using a fresh virtual machine, even if you are only building for the platform you currently use!
    - You'll ensure that you haven't accidentally written/ included code that relies on third-party installed software, such as Python. While Python is pretty cool, the majority of people have not installed it globally on their computer.
    - You'll catch instant-crashes very quickly! It would be terrible to publish a game only to have it instantly crash for all users because you forgot about a file that the game relies on being present.
1. Finally finally, play it all the way through! Play it three times before you have anyone else test it! You wouldn't believe how many progress-stopping, soft-locking bugs could be left over from a waterfall-type development process. I've tested RPG Maker games before, and one client was just looking for feedback on the story and gameplay. After about five hours of testing across three days, and downloading a dozen patches, I only ever got about 10 minutes into the game, and more than half of that was just the unskippable introduction cutscene and tutorial. Supposedly there was over an hour of gameplay. It was a dumpster fire to say the least.

### Finding Platform Versions

As this project is used for RPG Maker MV, it must run on the same node version that is packaged with games. Through the methods described below, I've determined that version. To ensure I'm testing things properly, I use `nvm` to set my project to the right node version, and develop that way. I also specify the type versions for anything I use (just WebAudioAPI right now).

Here's how I (and you can, too) determined the precise bundled version of node with RPG Maker MV.

1. Locate the RPG Maker MV root folder. If you use it on Steam, it should be here: `Steam/steamapps/common/RPG Maker MV`.
2. Locate the `nwjs-win` folder (if you develop on linux, then it's `nwjs-lnx`)
3. Create the file `RPG Maker MV/nwjs-win/www/index.html` and paste this inside:
    ```html
    <p id="version"></p>

    <script>
    document.getElementById("version").innerHTML = process.version;
    </script>
    ```
4. Save the file, run the executable file `RPG Maker MV/nwjs-win/Game.exe`, `Game.desktop` for linux, and see the version printed on screen.

You can do this same process for deployed games as well, just open the same `www/index.html` file from your build and add the code to the body section. You might be able to use an "alert()" instead.

### Real-time JavaScript Testing

I created an html file that you can use to write JavaScript directly into the game window to test certain APIs for support. Since we can bundle RPGMMV project files into whatever version of NW.js we want, this isn't really needed as NW.js keeps up with the latest tech quite well.

```html
<p id="top">Script:</p>
<textarea id="input" autofocus="" rows="10" cols="80"></textarea>
<p></p>
<button type="button" onclick="runCode()">Evaluate Input</button>
<p id="output"></p>

<script>
function runCode() {
    const inputValue = document.getElementById("input").value;
    try {
        const result = eval(inputValue);
        document.getElementById("output").innerHTML = result;
    } catch (exception) {
        document.getElementById("output").innerHTML = exception.stack;
    }
}
</script>
```

Whatever is returned by the final statement in the code will be output onto the screen. Try not to change the DOM such that you break the environment! And, be careful what you run! The code executes in the same context as the application window, and you can create/ delete/ execute other files just as if you were an administrator on the computer! Develop responsibly!

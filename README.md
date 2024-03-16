# MusicMixer.js

Music mixing library, designed for general use in JavaScript applications.

I made this for a personal project in RPGMaker, but the plugin is so big that I decided to just make general purpose
and made a repository for it, mostly for organizational purposes.

## Version Information

Node version: `9.7.1`

As this project is used for RPG Maker MV, it must run on the same node version that is packaged with games. Through the methods described below, I've determined that version. To ensure I'm testing things properly, I use `nvm` to set my project to the right node version, and develop that way.

Technically, once you deploy a game, you can overwrite the `node.dll` file with whatever version of node you want to use, but it's not that important to me and I don't want to think about debugging that. So, here's how I (and you can, too) determined the precise bundled version of node with RPG Maker MV.

1. Locate the RPG Maker MV root folder. If you use it on Steam, it should be here: `Steam/steamapps/common/RPG Maker MV`.
2. Locate the `nwjs-win` folder (if you develop on linux, then it's `nwjs-lnx`)
3. Create the file `RPG Maker MV/nwjs-win/www/index.html` and paste this inside:
    ```html
    <p id="version"></p>

    <script>
    document.getElementById("version").innerHTML = process.version;
    </script>
    ```
4. Save the file, run the executable file `RPG Maker MV/nwjs-win/Game.exe`, see the version printed on screen.

You can do this same process for deployed games as well, just open the same `www/index.html` file from your build and add the code to the body section. You might be able to use an "alert()" instead.

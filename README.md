# Spider-Man mobile PWA

Touch controls: use the left thumb directional pad to move left/right. Push up to jump vertically, up-right to jump forward, or up-left to jump backward. Hold the right thumb Shoot button to fire while moving or jumping. Release the joystick to stop. Holding up repeats jumps when grounded. Pause opens the game menu. Keyboard controls remain supported.

## Run and install

Serve this folder with a web server. Local preview with XAMPP: http://localhost/Import_module/SpiderMan/

For phones, publish these files on HTTPS, for example GitHub Pages. In the repository Settings > Pages, select Deploy from a branch and the branch containing these files, with the root folder. No build step is required. Relative URLs support the /SpiderMan/ project path.

Android: open the hosted URL in Chrome and use Install (when offered) or the browser menu > Add to Home screen. iPhone: open in Safari, Share > Add to Home Screen.

Wait for the offline-files confirmation before disconnecting. The initial download includes game images, fonts and music. Installation and offline support require HTTPS or localhost; a phone accessing an ordinary HTTP LAN address will not get service-worker support.

## Updates

Change CACHE in sw.js for each release that changes cached files. Close all existing game tabs/windows and reopen to activate a downloaded update.

## Verification

JavaScript syntax checks passed. Local browser preview loaded all game assets, displayed touch controls and pause menu, resumed successfully, and confirmed service-worker cache installation. Physical Android/iPhone installation, simultaneous finger input, and offline relaunch should also be checked on target devices.

## Current game rules

- Endless, randomly generated rooftops; no final level or win screen.
- One active enemy type: knife-throwing thugs. Other villain images are unused assets. Each rooftop has about a 70% chance to spawn one thug.
- Start with 5 hearts and 50 webs. A knife removes 1 heart; falling off the bottom, reaching zero hearts, or reaching zero webs ends the run.
- Each shot costs 1 web and does 2 damage. A thug has 4 health, so two hits defeat one. Each defeated thug gives 1 score and restores 4 webs. Webs do not refill over time.
- Health restores 1 heart every 1,200 gameplay frames, up to 5. At 60 frames/second this is about 20 seconds. Shooting repeats every 20 frames, and thugs attack every 100 frames while on screen. These timings depend on frame rate and slow-motion mode.
- Scrolling follows forward progress; moving left is limited by the current left edge of the camera. There is no web swinging.

Build 3 fixes a startup failure caused by missing joystick markup. The left pad supports continuous press-and-slide movement and diagonal jumps; Shoot is on the right. Offline worker activates updates immediately and checks fresh game code online.

Build 4 caps normal gameplay at 45 simulation steps per second, 25% slower than the original 60 FPS baseline, independent of display refresh rate. Health restoration now takes roughly 27 seconds, held shooting repeats roughly every 0.44 seconds, and enemy attacks repeat roughly every 2.22 seconds. Slow motion remains 10 steps per second.

/* Shared touch/keyboard input, installation and offline setup. */
var game = new SpidermanGame({canvas: '#canvas'});
var ready = false;
var held = new Map();
var keyboard = new Set();
var joystickKeys = new Set();
var joystickPointer = null;
var joystick = document.querySelector('#joystick');
var knob = document.querySelector('#joystick-knob');
function touchHasKey(key) {
  return joystickKeys.has(key) || Array.from(held.values()).some(function(value) { return value.key === key; });
}
function resetJoystick() {
  joystickPointer = null;
  var oldKeys = Array.from(joystickKeys);
  joystickKeys.clear();
  oldKeys.forEach(function(key) { if (!keyboard.has(key) && !touchHasKey(key)) game.spiderman.keyup(key); });
  knob.style.transform = 'translate(-50%, -50%)';
}
function moveJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  event.preventDefault();
  var rect = joystick.getBoundingClientRect();
  var radius = rect.width / 2;
  var x = (event.clientX - rect.left - radius) / radius;
  var y = (event.clientY - rect.top - radius) / radius;
  var distance = Math.hypot(x, y);
  if (distance > 1) { x /= distance; y /= distance; }
  var next = new Set();
  // Separate axes allow a diagonal jump without letting a resting thumb drift.
  if (x < -0.28) next.add(37);
  if (x > 0.28) next.add(39);
  if (y < -0.35) next.add(38);
  var previous = joystickKeys;
  joystickKeys = next;
  previous.forEach(function(key) { if (!next.has(key) && !keyboard.has(key)) game.spiderman.keyup(key); });
  next.forEach(function(key) { game.spiderman.keydown(key); });
  knob.style.transform = 'translate(calc(-50% + ' + x * radius * 0.55 + 'px), calc(-50% + ' + y * radius * 0.55 + 'px))';
}
joystick.addEventListener('pointerdown', function(event) {
  event.preventDefault();
  if (!ready || game.paused || game.gameIsOver || joystickPointer !== null) return;
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  moveJoystick(event);
});
joystick.addEventListener('pointermove', moveJoystick);
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(type) {
  joystick.addEventListener(type, function(event) { if (event.pointerId === joystickPointer) resetJoystick(); });
});
joystick.addEventListener('contextmenu', function(event) { event.preventDefault(); });
var statusText = document.querySelector('#status');
function releaseAll() {
  resetJoystick();
  held.clear(); keyboard.clear();
  if (game.spiderman) game.spiderman.keydowns.slice().forEach(function(key) { game.spiderman.keyup(key); });
  document.querySelectorAll('.pressed').forEach(function(button) { button.classList.remove('pressed'); });
}
function release(event) {
  var entry = held.get(event.pointerId);
  if (!entry) return;
  held.delete(event.pointerId);
  if (!Array.from(held.values()).some(function(value) { return value.key === entry.key; })) {
    entry.button.classList.remove('pressed');
    if (!keyboard.has(entry.key)) game.spiderman.keyup(entry.key);
  }
}
document.querySelectorAll('[data-key]').forEach(function(button) {
  button.addEventListener('pointerdown', function(event) {
    event.preventDefault();
    if (!ready || game.paused || game.gameIsOver) return;
    button.setPointerCapture(event.pointerId);
    var key = Number(button.dataset.key);
    held.set(event.pointerId, {key: key, button: button});
    button.classList.add('pressed');
    game.spiderman.keydown(key);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(type) { button.addEventListener(type, release); });
  button.addEventListener('contextmenu', function(event) { event.preventDefault(); });
});
document.addEventListener('keydown', function(event) {
  if ([37,38,39,32,27].includes(event.keyCode)) { event.preventDefault(); keyboard.add(event.keyCode); }
});
document.addEventListener('keyup', function(event) {
  keyboard.delete(event.keyCode);
  if (touchHasKey(event.keyCode)) game.spiderman.keydown(event.keyCode);
});
['pause', 'gameover', 'restart'].forEach(function(name) {
  var original = game[name];
  game[name] = function() { releaseAll(); return original.apply(game, arguments); };
});
document.querySelector('#pause').onclick = function() {
  releaseAll();
  if (game.paused) game.unpause(); else game.pause();
};
window.addEventListener('blur', function() { releaseAll(); if (ready) game.pause(); });
document.addEventListener('visibilitychange', function() { if (document.hidden) { releaseAll(); if (ready) game.pause(); } });
game.load().then(function() {
  ready = true;
  game.pause();
  document.querySelector('#pause').disabled = false;
  statusText.textContent = 'Tap Resume to play. Landscape gives you a larger view.';
}).catch(function(error) { statusText.textContent = error.message + '. Please reload to retry.'; });
// Music playback must start inside a user gesture on mobile browsers.
function unlockAudio() {
  if (!ready) return;
  if (!game.muted) game.playSound('AMAZING_SPIDER_MAN_2', false);
  document.removeEventListener('pointerdown', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);
var installPrompt;
window.addEventListener('beforeinstallprompt', function(event) {
  event.preventDefault(); installPrompt = event;
  document.querySelector('#install').hidden = false;
});
document.querySelector('#install').onclick = async function() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null; document.querySelector('#install').hidden = true;
};
window.addEventListener('appinstalled', function() { document.querySelector('#install').hidden = true; });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).then(function() { return navigator.serviceWorker.ready; }).then(function() {
    statusText.textContent = 'Offline files saved. Tap Resume to play.';
  }).catch(function() { statusText.textContent = 'Offline setup unavailable. You can still play online.'; });
}

if ('serviceWorker' in navigator) {
  var hadController = !!navigator.serviceWorker.controller;
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (hadController && !refreshing) { refreshing = true; location.reload(); }
  });
}

var originalUnpause = game.unpause;
game.unpause = function() {
  originalUnpause.apply(game, arguments);
  if (!game.paused && !game.gameIsOver) statusText.textContent = 'Slide left pad to run or jump. Hold right Shoot button to fire.';
};

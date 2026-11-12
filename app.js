/* Shared touch/keyboard input, installation and offline setup. */
var game = new SpidermanGame({canvas: '#canvas'});
var ready = false;
var held = new Map();
var keyboard = new Map();
function keyboardHasKey(key) {
  return Array.from(keyboard.values()).includes(key);
}
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
  oldKeys.forEach(function(key) { if (!keyboardHasKey(key) && !touchHasKey(key)) game.spiderman.keyup(key); });
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
  previous.forEach(function(key) { if (!next.has(key) && !keyboardHasKey(key)) game.spiderman.keyup(key); });
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
    if (!keyboardHasKey(entry.key)) game.spiderman.keyup(entry.key);
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
var actions = [
  { label: 'Move left', code: 'KeyA', alias: 'ArrowLeft', input: 37 },
  { label: 'Move right', code: 'KeyD', alias: 'ArrowRight', input: 39 },
  { label: 'Jump', code: 'KeyW', alias: 'ArrowUp', input: 38 },
  { label: 'Crouch / slide', code: 'KeyS', alias: 'ArrowDown', input: 40 },
  { label: 'Shoot', code: 'Space', input: 32 },
  { label: 'Pause / resume', code: 'Escape', input: 27 }
];
var defaults = actions.map(function(action) { return action.code; });
var bindings = defaults.slice();
var controls = document.querySelector('#controls-dialog');
var bindingList = document.querySelector('#key-bindings');
var bindingStatus = document.querySelector('#binding-status');
var editing = null;
function bindable(code) {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Escape|F[1-9]|Numpad[0-9]|Comma|Period|Slash|Semicolon|Quote|Bracket(Left|Right)|Minus|Equal|Backslash)$/.test(code);
}
function validBinding(code, index, keys) {
  return bindable(code) && !actions.some(function(action, other) {
    return index !== other && (action.alias === code || keys[other] === code);
  }) && (code !== 'Escape' || actions[index].input === 27);
}
try {
  var stored = JSON.parse(localStorage.getItem('spiderman-controls'));
  if (Array.isArray(stored) && stored.length === defaults.length &&
      stored.every(function(code, i) { return validBinding(code, i, stored); })) bindings = stored;
} catch (error) {}
function saveBindings() {
  try { localStorage.setItem('spiderman-controls', JSON.stringify(bindings)); } catch (error) {}
}
function renderBindings() {
  bindingList.replaceChildren();
  actions.forEach(function(action, i) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    var key = document.createElement('kbd');
    key.textContent = i === editing ? 'Press a key…' :
      bindings[i].replace(/^(Key|Digit)/, '') + (action.alias && action.alias !== bindings[i] ? ' / ' + action.alias : '');
    button.appendChild(key);
    button.onclick = function() {
      editing = i;
      bindingStatus.textContent = 'Press a new key, or Escape to cancel.';
      renderBindings();
      bindingList.children[i].focus();
    };
    bindingList.appendChild(button);
  });
}
document.querySelector('#controls-open').onclick = function() {
  if (ready) game.pause();
  releaseAll();
  editing = null;
  bindingStatus.textContent = '';
  renderBindings();
  controls.showModal();
};
document.querySelector('#controls-close').onclick = function() { controls.close(); };
document.querySelector('#controls-reset').onclick = function() {
  bindings = defaults.slice();
  editing = null;
  saveBindings();
  renderBindings();
  bindingStatus.textContent = 'Default keys restored.';
};
document.addEventListener('keydown', function(event) {
  if (controls.open && editing !== null) {
    if (event.code === 'Tab') return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.code !== 'Escape' && !validBinding(event.code, editing, bindings)) {
      bindingStatus.textContent = 'That key is reserved, unavailable, or already assigned.';
      return;
    }
    var index = editing;
    if (event.code !== 'Escape') {
      bindings[index] = event.code;
      saveBindings();
    }
    editing = null;
    renderBindings();
    bindingList.children[index].focus();
    bindingStatus.textContent = event.code === 'Escape' ? 'Change canceled.' : 'Key saved.';
    return;
  }
  if (!ready || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
  var index = actions.findIndex(function(action, i) {
    return bindings[i] === event.code || action.alias === event.code;
  });
  if (index === -1 || (event.target.closest('button, select, input') && actions[index].input !== 27)) return;
  event.preventDefault();
  var input = actions[index].input;
  if (input === 27) {
    if (!event.repeat) {
      if (game.paused) game.unpause(); else game.pause();
    }
    return;
  }
  if (game.paused || game.gameIsOver) return;
  keyboard.set(event.code, input);
  game.spiderman.keydown(input);
});
document.addEventListener('keyup', function(event) {
  var input = keyboard.get(event.code);
  keyboard.delete(event.code);
  if (input !== undefined && !keyboardHasKey(input) && !touchHasKey(input)) game.spiderman.keyup(input);
});
['pause', 'gameover', 'restart', 'continueRun'].forEach(function(name) {
  var original = game[name];
  game[name] = function() { releaseAll(); return original.apply(game, arguments); };
});
document.querySelector('#pause').onclick = function() {
  releaseAll();
  if (game.paused) game.unpause(); else game.pause();
  this.blur();
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

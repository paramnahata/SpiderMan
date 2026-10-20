const $ = id => document.getElementById(id);
const dialog = $('account-dialog');
const read = key => { try { return Math.max(0, Number(localStorage.getItem(key)) || 0); } catch { return 0; } };
const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
let deviceBest = read('spiderman-device-best');
$('device-best').textContent = deviceBest;
let user = null, auth, db, sdk, store, syncTimer, unsubscribe;
let sessionBest = 0;
let runOwner;
let saving = false;
const feedback = text => { $('account-feedback').textContent = text; };
const pendingKey = uid => 'spiderman-pending-' + uid;
function record(score) {
  if (!Number.isSafeInteger(score) || score < 0) return;
  deviceBest = Math.max(deviceBest, score);
  write('spiderman-device-best', deviceBest);
  $('device-best').textContent = deviceBest;
  if (user && score > 0) {
    sessionBest = Math.max(sessionBest, score);
    write(pendingKey(user.uid), Math.max(read(pendingKey(user.uid)), sessionBest));
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncBest, 750);
  }
}
// Capture scores as enemies are defeated, so closing the game preserves progress.
const removeEnemy = window.Enemy.prototype.remove;
window.Enemy.prototype.remove = function() {
  const previous = this.game.score;
  removeEnemy.apply(this, arguments);
  if (this.game.score > previous) record(this.game.score);
};
const endGame = game.gameover;
game.gameover = function() { record(game.score); return endGame.apply(game, arguments); };
$('account-open').onclick = () => {
  if (ready && !game.gameIsOver) game.pause();
  dialog.showModal();
};
$('account-close').onclick = () => dialog.close();
// Keep gameplay key handlers from swallowing spaces/arrows while typing.
dialog.addEventListener('keydown', event => event.stopPropagation());
async function syncBest() {
  if (!user || !db || saving) return;
  const current = user;
  const score = read(pendingKey(current.uid));
  if (!score) return;
  if (!navigator.onLine) { feedback('Score saved on this device. It will sync when you are online.'); return; }
  saving = true;
  try {
    const ref = store.doc(db, 'scores', current.uid);
    await store.runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const old = snapshot.exists() ? snapshot.data().bestScore : 0;
      if (score > old) transaction.set(ref, {bestScore: score, alias: 'Spider-' + current.uid.slice(0, 8), updatedAt: store.serverTimestamp()});
    });
    if (read(pendingKey(current.uid)) <= score) write(pendingKey(current.uid), 0);
    if (user?.uid === current.uid) feedback('Best score synced.');
  } catch { if (user?.uid === current.uid) feedback('Could not sync yet. Your score is saved here; reconnect or reopen this panel to retry.'); }
  finally {
    saving = false;
    if (user?.uid === current.uid && read(pendingKey(current.uid)) > score) syncBest();
  }
}
async function loadLeaderboard() {
  if (!db) return;
  $('leaderboard-state').textContent = 'Loading leaderboard...';
  try {
    const result = await store.getDocs(store.query(store.collection(db, 'scores'), store.orderBy('bestScore', 'desc'), store.limit(20)));
    $('leaderboard').replaceChildren();
    result.forEach(snapshot => {
      const data = snapshot.data();
      const row = document.createElement('li');
      row.append(document.createTextNode(data.alias));
      const score = document.createElement('span'); score.textContent = data.bestScore;
      row.append(score); $('leaderboard').append(row);
    });
    $('leaderboard-state').textContent = result.empty ? 'No scores yet. Sign in and play to be first!' : 'Top 20 players';
  } catch { $('leaderboard-state').textContent = 'Leaderboard unavailable. Check your connection and try Refresh.'; }
}
function message(error) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account exists for this email. Sign in or reset your password.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/popup-blocked': 'Allow the sign-in popup and try again.',
    'auth/popup-closed-by-user': 'Sign-in cancelled. You can try again.',
    'auth/unauthorized-domain': 'This site must be added to Firebase authorized domains.',
    'auth/operation-not-allowed': 'This sign-in method has not been enabled yet.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'No connection. Reconnect and try again.'
  };
  return messages[error.code] || 'Sign-in could not be completed. Check your details and try again.';
}
let busy = false;
async function action(callback) {
  if (busy || !auth) return;
  busy = true;
  document.querySelectorAll('#auth-panel button').forEach(button => button.disabled = true);
  feedback('Please wait...');
  try { await callback(); }
  catch (error) { feedback(message(error)); }
  finally { busy = false; document.querySelectorAll('#auth-panel button').forEach(button => button.disabled = false); }
}
$('google-login').onclick = () => action(async () => {
  await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
  feedback('Signed in with Google.');
});
$('email-form').onsubmit = event => {
  event.preventDefault();
  action(async () => { await sdk.signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value); $('login-password').value = ''; feedback('Signed in.'); });
};
$('email-register').onclick = () => {
  if (!$('email-form').reportValidity()) return;
  action(async () => {
    await sdk.createUserWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value);
    $('login-password').value = ''; feedback('Account created. You can start playing.');
  });
};
$('password-reset').onclick = () => {
  if (!$('login-email').reportValidity()) return;
  action(async () => { await sdk.sendPasswordResetEmail(auth, $('login-email').value.trim()); feedback('If an account exists, a reset email will arrive shortly.'); });
};
$('logout').onclick = async () => { try { await syncBest(); await sdk.signOut(auth); feedback('Signed out. You can keep playing as a guest.'); } catch { feedback('Sign out failed. Please try again.'); } };
$('leaderboard-refresh').onclick = () => { syncBest(); loadLeaderboard(); };
window.addEventListener('online', () => { syncBest(); loadLeaderboard(); });
$('account-open').addEventListener('click', () => { syncBest(); loadLeaderboard(); });
async function initialize() {
  try {
    const {firebaseConfig} = await import('./firebase-config.js?v=7');
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain || !firebaseConfig.appId) {
      $('account-state').textContent = 'Online accounts are coming soon. You can play now; your best score is saved on this device.';
      return;
    }
    const base = 'https://www.gstatic.com/firebasejs/13.0.0/';
    const [app, authModule, firestoreModule] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
    sdk = authModule; store = firestoreModule;
    const firebaseApp = app.initializeApp(firebaseConfig);
    auth = sdk.getAuth(firebaseApp); db = store.getFirestore(firebaseApp);
    await sdk.setPersistence(auth, sdk.browserLocalPersistence);
    document.querySelectorAll('#auth-panel button').forEach(button => button.disabled = false);
    $('leaderboard-refresh').disabled = false;
    sdk.onAuthStateChanged(auth, current => {
      if (unsubscribe) unsubscribe();
      clearTimeout(syncTimer);
      const nextOwner = current ? current.uid : null;
      if (runOwner !== undefined && runOwner !== nextOwner && ready) { game.restart(); game.pause(); }
      runOwner = nextOwner; user = current; sessionBest = 0;
      $('auth-panel').hidden = !!current; $('signed-panel').hidden = !current;
      $('account-open').textContent = current ? 'My score / Leaderboard' : 'Sign in / Leaderboard';
      $('account-state').textContent = current ? 'Signed in as Spider-' + current.uid.slice(0, 8) : 'Sign in to save scores across devices, or keep playing as a guest.';
      $('cloud-best').textContent = '0';
      if (current) {
        unsubscribe = store.onSnapshot(store.doc(db, 'scores', current.uid), snapshot => {
          if (user?.uid === current.uid) $('cloud-best').textContent = snapshot.exists() ? snapshot.data().bestScore : 0;
        }, () => feedback('Cannot read your online score. Check your connection and try again.'));
        syncBest();
      }
    });
    loadLeaderboard();
  } catch {
    $('account-state').textContent = 'Online accounts are unavailable right now. You can still play and save your best on this device.';
  }
}
initialize();

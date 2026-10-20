# Enable live accounts and leaderboard

Connected project: `my-application-454df`; registered web app: `spiderman` (`1:859309042144:web:257567be86b056ec94a385`). Public browser configuration is in firebase-config.js. Google and email/password providers are enabled, and paramnahata.github.io is authorized for sign-in. The existing default Firestore database uses Standard edition in nam5. No private credentials are included. The steps below are for future setup or maintenance.

1. Open https://console.firebase.google.com/ and create/select your project. Analytics is optional.
2. Add a Web app under Project settings > Your apps. Copy its public firebaseConfig fields into firebase-config.js. Do not share service-account JSON files or private keys.
3. Authentication > Sign-in method: enable Google (select a support email) and Email/Password.
4. Authentication > Settings > Authorized domains: add paramnahata.github.io. Add localhost only if you want local login testing. Keep the default Firebase auth domain.
5. Create Cloud Firestore in production mode. Choose the region appropriate for your players. Publish the contents of firestore.rules in the Rules tab before enabling the site configuration.
6. Commit/push firebase-config.js. GitHub Pages will deploy it. Firebase browser API keys are public configuration; database protection comes from the rules.
7. Test Google login, email registration, sign-out/sign-in, password reset, and two devices logged into the same account. Earn a score, check the leaderboard, and verify a lower score cannot replace the best. Test offline play and reconnect sync. Check that users cannot write another user's document or store email in public scores.

## Behaviour and limits

Guests keep a local device best. Signed-in scores save as enemies are defeated, with a short debounce; their highest pending score is retained on that device per account and retries when online or when reopening the account panel. Guest scores are not automatically imported into an account. Changing accounts starts a fresh paused run, so one account does not inherit another player's ongoing run. Only a generated player alias, score and update timestamp are stored in public score documents. Email/password data is handled by Firebase Authentication, not Firestore or this repository.

This casual leaderboard accepts scores from the browser. Rules prevent changing another user's score and decreasing your best, but cannot prove that a score was earned honestly. A competitive, cheat-resistant leaderboard needs server-validated game sessions. This implementation does not claim anti-cheat protection.

Authentication may require a popup/new browser window; if an embedded browser blocks it, open the live game in Chrome or Safari. Firebase SDK modules need a network connection initially; guest/offline gameplay remains independent. Existing sessions and pending local scores remain per browser profile. Local storage can be cleared by the user/browser.

The Firestore default single-field descending index supports this top-20 query. Review Firebase quotas in the project console; do not enable paid services without reviewing billing.

## Checks performed

Run `node tests/accounts.test.cjs` for score merge, per-account pending storage, guest isolation and retry behaviour. JavaScript syntax and local browser guest/account-panel checks passed. Live provider sign-in, real two-device reads/writes, and Firestore rule emulator checks remain manual checks. Rules compile successfully against the real Firebase project with a deployment dry run.

## Rules review

Public reads are intentionally restricted to score documents; list queries require a limit of at most 20. Other collections and subcollections are denied. Ownership is bound to the authenticated UID in the path. Create and update both validate all required/allowed fields, integer score bounds, deterministic alias and length, and server timestamp. Updates must increase the best and keep the alias. Deletes are denied. Extra email/role/owner/path fields, missing fields, oversized strings, invalid types, forged timestamps, negative scores, cross-user writes, lower scores and unbounded list queries are denied by these conditions. Client-submitted high scores are still forgeable; this is a casual leaderboard, not server-validated anti-cheat. These prototype rules need review before broad release.

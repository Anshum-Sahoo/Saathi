# Tests

Run the focused auth and authorization unit tests with `npm run test`. They cover pairing and PIN primitives, session policy, Firebase token revocation checks, and permission rules without Firebase credentials. They do not verify Firestore transactions or live Firebase behavior; add integration coverage when a Firebase project or emulator is available.

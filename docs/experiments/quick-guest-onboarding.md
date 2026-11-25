# Quick guest onboarding pilot

An invited visitor can enter from the signed-out **Join as a guest** flow with a
display name and a valid Home Base invite code. The visitor starts on the existing
island, with an automatically saved avatar. Tapping it opens the same **Edit avatar**
action members use. Neither an email, a password, nor a new island is created.

## API and visibility

- `POST /api/v1/auth/guest` accepts exactly `{ "name": "Juniper", "inviteCode": "<host-code>" }`.
  It returns `201` with a bearer session and a user with `email: null` and
  `isGuest: true`. Missing or malformed fields return `400`; an unknown code
  returns `404` and the transaction rolls back. A database-backed limit permits
  30 guest attempts per IP in a 15-minute window, then returns `429`.
- The guest can view their invited island, member display profiles and avatars,
  cottages, milestone windows, earned rewards, garden and coast. Guest state
  excludes subjects, participation, check-ins, event deliveries and other event
  history. `GET /homebases` returns `inviteCode: null` for the guest.
- The only guest mutations are saving their own avatar and ending their session.
  Guest access is denied unless a handler explicitly allows it. Guests cannot
  create or join other bases, change shared records, plant or place objects,
  unlock coast tiles or participate in activities. Their presence does not affect
  current or future activity and reward rosters.

## Identity and session lifetime

Migration 014 makes `app_user.email` nullable. Credentialed accounts still use a
unique email. The visitor has no password credential
or synthetic email. The visitor's island membership and avatar are saved together
with the session in one transaction.

An opaque 256-bit token expires after 30 days; the server stores only its SHA-256
hash. The app restores it on the same browser profile (local storage) or native
device (secure storage). Signing out online revokes the token; signing out offline
still clears the local token but cannot contact the server to revoke it. Once a
guest has no unexpired session, their avatar no longer appears in the active island
roster. The identity and saved appearance remain in storage; automatic retention
and cleanup are outside this pilot.

Clearing local storage, reinstalling, changing browsers/devices, signing out or
expiry can make the original visit inaccessible. There is no recovery or conversion
to a password account in this pilot. Redeeming an invite again creates a different
guest. Existing invite codes remain reusable shared secrets. A holder can still
use the same code during ordinary registration to join as a full member. Guest
permissions restrict the guest session, not what an invite code can authorize;
guest-only, single-use and expiring invitation codes are outside this pilot.

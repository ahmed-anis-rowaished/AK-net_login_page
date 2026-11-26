# RouterOS 7 staged deployment checklist

No deployment was performed by this frontend task. Deploying to the active `hotspot` directory or changing `hsprof1` is a production action and `REQUIRES NETWORK ADMINISTRATOR APPROVAL`.

## Before approval

1. Review the pull-request diff and [router requirements report](MIKROTIK_REQUIRED_ACTIONS.md).
2. Run `node test/status_audit.test.js` on a workstation.
3. Confirm the release contains `js/status.js` as well as the HTML, image, XML, `md5.js`, error, and `api.json` files.
4. Do not upload `test/`, `dev/`, `.git/`, or `docs/` to the HotSpot web directory.
5. On the router, the administrator should record the current file list and active profile directory, then take a binary backup, textual export, and recoverable copy of the current HotSpot directory.

Suggested read-only checks for the administrator:

```routeros
/system resource print
/ip hotspot print detail
/ip hotspot profile print detail
/ip hotspot active print detail
/radius print detail
/user-manager profile print detail
/user-manager limitation print detail
/user-manager profile-limitation print detail
```

These commands were not executed during this task.

## Staged validation

Use a lab router or an isolated test profile first. Validate with dedicated accounts for all seven packages:

- HTTP-CHAP login succeeds and `md5.js` loads locally.
- Successful login opens the status servlet.
- The username is literal text even with punctuation.
- The status says “جلسة HotSpot مصادق عليها”, not “متصل بالإنترنت”.
- Download matches `bytes-out`; upload matches `bytes-in`; their sum is current-session usage.
- Numeric `remain-bytes-total=0` appears exhausted.
- Missing or `---` remaining values appear unavailable, never unlimited.
- Directional remainders remain separately labeled.
- Package name confidence is correct: exact RADIUS token is confirmed; capacity match is inferred; otherwise unknown.
- Session countdown starts from the RouterOS remaining value without subtracting uptime.
- Subscription expiration remains unavailable unless a separately approved authoritative integration exists.
- Logout erases the HotSpot cookie and a new login can start.
- Android, iOS captive assistants, and desktop browsers load the responsive page without internet access.
- `api.json` is valid in both logged-in and logged-out states.

## Rollback

Rollback is file restoration: restore the exact pre-deployment HotSpot directory copy and verify its hashes/file sizes. If an administrator chose to test through a separate profile directory, restore only that profile's original `html-directory` value from the recorded export. Do not alter RADIUS, User Manager, firewall, services, or HotSpot servers as part of a frontend rollback.

## Required evidence after a physical test

Record RouterOS version, browser/device, test package, rendered values, matching `/ip hotspot active print detail`, and matching User Manager session/user-profile data. Redact passwords, shared secrets, and management addresses before sharing logs.

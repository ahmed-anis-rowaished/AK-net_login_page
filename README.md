# AK Net HotSpot portal

Arabic RTL captive-portal frontend for MikroTik RouterOS 7 HotSpot and User Manager v7. It is a static RouterOS page set: no backend, build server, external JavaScript, router credential, or production configuration change is included.

## What the portal can show accurately

- Authenticated HotSpot username and session state.
- Client IP and MAC.
- Current-session uptime.
- Current-session download (`bytes-out`), upload (`bytes-in`), and their total.
- Combined remaining local/session quota when `remain-bytes-total` resolves numerically.
- Separate directional remainders without adding them together.
- Remaining current-session time from RouterOS session variables, with a stable live countdown.
- A package confirmed by an exact known RADIUS group/Class token, or explicitly labeled as inferred when only an exact RADIUS limit capacity matches.

## What static HotSpot HTML cannot prove

- Internet reachability beyond an authenticated HotSpot session.
- User Manager cumulative account consumption when only session counters are exposed.
- A User Manager remaining balance when HotSpot does not resolve a remaining-quota variable.
- The active User Manager profile name unless a verified browser-visible RADIUS attribute carries it.
- The actual User Manager subscription expiration timestamp.

Unknown values are shown as unavailable. The portal never subtracts current-session traffic from package capacity, treats `---` as an unlimited subscription, combines independent directional limits, or estimates an expiration date.

## AK package metadata

| Package | Capacity | Validity from first authentication |
|---|---:|---:|
| 200RY | 800 MiB | 1 day |
| 500RY | 2 GiB | 3 days |
| 1000RY | 5 GiB | 7 days |
| 3000RY | 18 GiB | 30 days |
| 6000RY | 40 GiB | 30 days |
| 10000RY | 80 GiB | 30 days |
| 20000RY | 170 GiB | 30 days |

This table is plan metadata, not a source of live balance or expiration data.

## Authentication and security

- HTTP-CHAP keeps MikroTik's required MD5 flow: `chap-id + password + chap-challenge` through local `md5.js`.
- The existing one-field voucher behavior is preserved: the entered card value is used as username and password.
- Successful login targets the RouterOS status servlet.
- Post-login redirects allow only same-origin HTTP(S), otherwise they fall back to local `status`.
- Browser-visible template text uses `-esc`, is decoded locally, and is assigned with `textContent`.
- Logout requests `erase-cookie=on` for a clean subsequent login.
- No production diagnostic output or User Manager management link is exposed.

## Tests

Requires Node.js only:

```bash
node test/status_audit.test.js
```

The suite covers the 25 requested areas: login, CHAP, identity, session state/counters/timers, quota variants, Gigawords, package confidence, navigation, redirect security, XSS, `api.json`, mobile CSS, and production hardening.

These are simulated tests. They do not establish successful operation on the physical RB1100AHx4 or prove which conditional RADIUS values RouterOS 7.23.8 will expose in production.

## Documentation

- [RouterOS 7 variable compatibility audit](docs/ROUTEROS7_COMPATIBILITY_AUDIT.md)
- [Router-side requirements and approval boundary](docs/MIKROTIK_REQUIRED_ACTIONS.md)
- [Staged deployment checklist](docs/MIKROTIK_ROS7_DEPLOYMENT.md)

No RouterOS command was executed and nothing was deployed to the active HotSpot directory as part of this change.

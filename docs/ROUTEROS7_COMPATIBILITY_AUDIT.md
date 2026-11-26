# RouterOS 7 HotSpot compatibility audit

Audit target: AK Net static HotSpot frontend on RouterOS 7.23.8 with RADIUS/User Manager v7. This classification follows the official [HotSpot customization](https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot%20customisation), [HotSpot captive portal](https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot%2B-%2BCaptive%2Bportal), [RADIUS](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS), and [User Manager](https://help.mikrotik.com/docs/spaces/ROS/pages/2555940/User%2BManager) documentation.

## Classification

| Template expression | Classification | Portal use |
|---|---|---|
| `username`, `ip`, `mac`, `logged-in` | 1 — officially documented | Identity and authenticated HotSpot-session state. `logged-in=yes` does not prove wider internet reachability. |
| `link-login`, `link-login-only`, `link-logout`, `link-status`, `link-orig` | 1 — officially documented | Local servlet navigation. Untrusted/original destinations are not used after login. |
| `link-redirect` | 2 — supported in RouterOS redirect/advertisement page flow | Retained in RouterOS redirect and WISPr compatibility templates. Browser JavaScript accepts only HTTP(S) advertisement targets. |
| Any documented variable with `-esc` suffix | 1 — officially documented escaping form | Used before putting template text into JavaScript or URLs. |
| `hostname` | 1 — officially documented | Used by the stock WISPr XML compatibility pages. It is not displayed as administration information. |
| `location-id`, `location-name` | 2 — conditional WISPr/HotSpot location data | Retained only in the XML login compatibility response. |
| `chap-id`, `chap-challenge`, `error` | 2 — documented, login-page-only | HTTP-CHAP and login errors. `md5.js` must load before CHAP submission. |
| `error-orig` | 2 — documented, login-page-only | Error fallback; decoded and inserted with `textContent` on the visual error page. |
| `http-status`, `http-header` | 1 — documented response-control expressions | Used by RouterOS redirect response templates; these expressions set response metadata rather than test ordinary values. |
| `uptime`, `uptime-secs` | 1 — officially documented | Current HotSpot session uptime only. |
| `session-time-left`, `session-time-left-secs` | 2 — conditional on a session time limit | Remaining current-session time. Values are used directly. |
| `session-timeout`, `session-timeout-secs` | 2 — conditional; documented as time left | Fallback remaining current-session time. Uptime must not be subtracted again. |
| `bytes-in`, `bytes-out` | 2 — documented, status traffic counters | Current-session upload and download respectively. |
| `bytes-in-nice`, `bytes-out-nice` | 2 — documented, status traffic counters | Not used for calculations; numeric counters are formatted consistently by the frontend. |
| `remain-bytes-in`, `remain-bytes-out` | 2 — conditional on directional local limits | Displayed separately. `---` means no such local limit is exposed; it does not prove an unlimited User Manager subscription. |
| `remain-bytes-total` | 2 — used by MikroTik's documented captive-portal API | Highest-priority combined remainder when it resolves to a numeric value. |
| `limit-bytes-total` | 3 — template use is not listed in the official HotSpot variable table | Used only as an optional, resolved numeric denominator for a local progress bar; never required and never used to infer remaining quota. |
| `limit-bytes-in`, `limit-bytes-out` | 1 as documented HotSpot status values, conditional when no limit | Retained for compatibility input; the UI does not combine directional limits. |
| `bytes-total-nice` | 3 — undocumented/unverified template expression | Removed from calculations. Total is `bytes-in + bytes-out`. |
| `radius<id>`, `radius<id>u`, `radius<id>-<vendor>`, `radius<id>-<vendor>u` | 2 — official generic syntax, only when RADIUS authentication/attribute is present | Treated as conditional evidence, never as guaranteed User Manager data. |
| `radius3-14988` (`Mikrotik-Group`) | 2 — conditional | Exact AK package token may confirm a package; generic groups do not. |
| `radius25` (`Class`) | 2 — conditional | Exact AK package token may confirm a package. `Class` is otherwise an opaque accounting cookie. |
| `radius1/2/14/15/17/18-14988u` | 2 — conditional; numeric IDs documented | Low-word/Gigawords calculation. Exact capacity matches are labeled inferred, not confirmed account data. |
| `radius8-14988`, `radius27u` | 2 — conditional | Audited but not needed by the production dashboard. The official session variables are preferred. |
| `radius18[n]` in `xml/*.html` | 3 — legacy/stock WISPr array syntax, not documented in the current variable table | Retained only for stock WISPr reply-message compatibility and never trusted by the visual dashboard. |
| `error-type` in `xml/login.html` | 3 — legacy/stock XML conditional, not listed in the current variable table | Retained only for RouterOS WISPr error compatibility. |
| User Manager active profile name | 4 — unavailable as a documented HotSpot variable | Shown only if a verified RADIUS attribute contains an exact package token; otherwise “لم يتم التعرف على الباقة”. |
| User Manager cumulative transfer usage/balance | 4 — unavailable from documented session counters | Never estimated from current-session traffic. |
| User Manager `user-profile end-time` | 4 — unavailable as a documented HotSpot variable | Always “تاريخ انتهاء الاشتراك غير متاح”. |
| User Manager `$(userprofname)` / `$(userprofendtime)` | 4 for HotSpot pages | These are documented voucher-template variables, not HotSpot servlet variables. |

## Direction mapping

On the HotSpot status page, `bytes-in` is traffic received from the client (upload) and `bytes-out` is traffic sent to the client (download). The dashboard follows that router-centric definition.

## Gigawords

For a received RADIUS limit, the calculation is:

`bytes = low_word + gigawords × 4,294,967,296`

The seven configured package capacities are 800 MiB, 2 GiB, 5 GiB, 18 GiB, 40 GiB, 80 GiB, and 170 GiB. Their validity metadata is 1, 3, 7, 30, 30, 30, and 30 days. Validity is reference metadata only; it is never converted into an expiration timestamp.

## Security decisions

- Browser-visible text values use the template `-esc` form, are decoded in JavaScript, and reach the DOM through `textContent`.
- Status navigation accepts only same-origin HTTP(S) or a local fallback.
- The login destination is the RouterOS `link-status`, not an attacker-controlled original URL.
- No RouterOS credential, API secret, diagnostic panel, console logging, or external runtime dependency is included.
- The `/um/` management/reporting link was removed from the subscriber status modal.

## Physical-router limitation

The Node.js suite simulates template results and browser DOM behavior. It does not prove how RouterOS 7.23.8 resolves every conditional variable on the physical RB1100AHx4. A network administrator must perform a staged, reversible device test after review; no such deployment occurred in this task.

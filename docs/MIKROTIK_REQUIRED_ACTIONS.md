# AK Net — Router-side requirements and approval boundary

This report covers only gaps that static RouterOS HotSpot files cannot close. No RouterOS, User Manager, RADIUS, firewall, service, or production HotSpot setting was changed while preparing this repository.

Official references:

- [HotSpot template variables and page flow](https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot%20customisation)
- [HotSpot active-session fields and captive portal API](https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot%2B-%2BCaptive%2Bportal)
- [RADIUS attributes and numeric IDs](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS)
- [User Manager profiles, sessions, and user-profile end-time](https://help.mikrotik.com/docs/spaces/ROS/pages/2555940/User%2BManager)

## A. No router changes required

The verified environment already supports the following frontend behavior:

- HTTP-CHAP authentication through the local `md5.js` file.
- Login submission to the existing HotSpot servlet and navigation to `$(link-status)`.
- Authenticated username, client IP, client MAC, current-session uptime, upload, and download.
- Current-session total calculated as documented `bytes-in + bytes-out`.
- A live session countdown when RouterOS supplies `session-time-left(-secs)` or `session-timeout(-secs)`.
- Combined remaining data when RouterOS resolves `remain-bytes-total`.
- Separate upload/download remainders when RouterOS resolves only directional values.
- RFC captive-portal JSON using the existing `api.json` template.
- Logout with `erase-cookie=on`, followed by a clean login link.

No change is recommended to `hsprof1`, RADIUS accounting, interim updates, User Manager profiles/limitations, or any of the approximately 65 HotSpot servers merely to support those features.

## B. Router-side changes potentially required

Every item in this section is outside the approved frontend-only execution scope.

### 1. Reliable package name in the HotSpot status page

**Status:** `REQUIRES NETWORK ADMINISTRATOR APPROVAL`

- **Why static HTML cannot finish it:** `$(username)` identifies the account, but no documented HotSpot variable directly returns the active User Manager profile name. Generic `radius<id>` placeholders only expose an attribute when RADIUS authentication was used and that attribute was actually present.
- **Official evidence:** HotSpot documents conditional RADIUS placeholders; RADIUS documents `Class` and `Mikrotik-Group`; User Manager documents the active profile separately under `/user-manager user-profile`.
- **Potential mechanism:** after a lab capture proves the current Access-Accept behavior, the administrator may deliberately return an exact AK package token in `Class` or another agreed non-sensitive RADIUS attribute. The frontend already recognizes exact package tokens and labels byte-only matches as inferred.
- **Impact on existing users:** changing Access-Accept attributes can alter accounting cookies or the applied HotSpot profile; test with a dedicated account first.
- **Security:** never return secrets, comments, administrator identifiers, or internal topology in browser-visible attributes.
- **Required backup:** binary backup, textual export, and a copy of User Manager configuration before any change.
- **Read-only verification:** `/user-manager user print detail where name="<TEST_USER>"`; `/user-manager user-profile print detail where user="<TEST_USER>"`; `/ip hotspot active print detail where user="<TEST_USER>"`.
- **Configuration-changing command:** none proposed. The correct User Manager attribute syntax must be validated on RouterOS 7.23.8 in a lab; speculative commands are intentionally omitted.
- **Rollback:** remove only the tested attribute assignment and reconnect the dedicated test user; restore the saved configuration if behavior differs.
- **Backend required:** no, if a safe RADIUS attribute is verified; otherwise yes for authoritative lookup.

### 2. Cumulative remaining User Manager quota

**Status:** `REQUIRES NETWORK ADMINISTRATOR APPROVAL`

- **Why static HTML cannot finish it:** HotSpot session counters are not User Manager cumulative counters. A package capacity or RADIUS limit cannot be reduced by current-session traffic to manufacture an account balance.
- **Official evidence:** HotSpot documents `bytes-in/out` as status-page traffic counters, while User Manager documents cumulative session download/upload in `/user-manager session` and enforcement through profiles/limitations.
- **Potential mechanism:** first verify whether the current Access-Accept causes RouterOS to resolve `remain-bytes-total` for each profile. If not, an authenticated read-only service would have to query User Manager and expose only the logged-in subscriber's balance.
- **Impact on existing users:** changing limit attributes may change disconnect/enforcement behavior for every subscriber in a group.
- **Security:** a browser must never receive RouterOS credentials or unrestricted API access. Any future service needs per-user authorization, TLS, rate limiting, and minimal responses.
- **Required backup:** full RouterOS backup/export plus User Manager database backup before altering limitations or RADIUS attributes.
- **Read-only verification:** `/ip hotspot active print detail where user="<TEST_USER>"`; `/user-manager session print detail where user="<TEST_USER>"`; `/user-manager limitation print detail`; `/user-manager profile-limitation print detail`.
- **Configuration-changing command:** none proposed. Existing working limits must not be rewritten just to populate the portal.
- **Rollback:** revert the exact attribute/limitation change from the recorded export and disconnect only the lab account if a new Access-Accept is required.
- **Backend required:** likely, when an authoritative cumulative balance is required and HotSpot does not resolve it.

### 3. Actual subscription expiration timestamp

**Status:** `REQUIRES NETWORK ADMINISTRATOR APPROVAL`

- **Why static HTML cannot finish it:** the HotSpot variable table has no documented User Manager `end-time` variable. User Manager's `$(userprofendtime)` belongs to voucher templates, not HotSpot servlet pages.
- **Official evidence:** User Manager documents `end-time` under `/user-manager user-profile` and voucher-template variables; HotSpot's documented variable list does not include either value.
- **Potential mechanism:** an optional authenticated read-only service may return the active user-profile `end-time`. Do not derive it from package validity and current-session uptime.
- **Impact on existing users:** a read-only query has no accounting impact; enabling an API/service increases attack surface.
- **Security:** use a least-privilege account, TLS, strict subscriber binding, audit logs, and no browser-embedded credentials.
- **Required backup:** configuration export before enabling any new RouterOS service or account.
- **Read-only verification:** `/user-manager user-profile print detail where user="<TEST_USER>"`.
- **Configuration-changing command:** none proposed. No service should be enabled until a separate security design is approved.
- **Rollback:** disable/remove only the newly approved service account and API exposure; restore firewall/service settings from the export.
- **Backend required:** yes, unless a future RouterOS release documents a safe HotSpot variable for this value.

### 4. Cumulative upload/download history

**Status:** `REQUIRES NETWORK ADMINISTRATOR APPROVAL`

- **Why static HTML cannot finish it:** the portal receives current HotSpot session counters, while User Manager retains accounting sessions and report data.
- **Official evidence:** User Manager documents `/user-manager session` fields and `generate-report`; HotSpot limits traffic counters to the active status context.
- **Potential mechanism:** a separate authenticated reporting service or the administrator-controlled User Manager reporting workflow.
- **Impact on existing users:** none for read-only reporting; API/service changes still require review.
- **Security:** usage history is subscriber data and must not be enumerable by username.
- **Required backup:** export before creating service users, firewall rules, or scheduled reports.
- **Read-only verification:** `/user-manager session print detail where user="<TEST_USER>"`.
- **Configuration-changing command:** none proposed.
- **Rollback:** remove the optional reporting integration and its least-privilege credentials.
- **Backend required:** yes for live display inside this HotSpot portal.

## Deployment approval boundary

Copying these files to the active `hotspot` directory is a production change and was not performed. Before a network administrator deploys a reviewed release, preserve the current directory as a recoverable copy and take a RouterOS backup/export. Rollback is restoration of that exact directory copy. Any profile-directory switch, service enablement, RADIUS change, User Manager change, or firewall change remains `REQUIRES NETWORK ADMINISTRATOR APPROVAL`.

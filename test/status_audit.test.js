'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const statusScript = fs.readFileSync(path.join(root, 'js', 'status.js'), 'utf8');
const statusHtml = fs.readFileSync(path.join(root, 'status.html'), 'utf8');
const loginHtml = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const aloginHtml = fs.readFileSync(path.join(root, 'alogin.html'), 'utf8');
const logoutHtml = fs.readFileSync(path.join(root, 'logout.html'), 'utf8');
const errorHtml = fs.readFileSync(path.join(root, 'error.html'), 'utf8');
const radvertHtml = fs.readFileSync(path.join(root, 'radvert.html'), 'utf8');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, name) {
    if (actual === expected) {
        passed += 1;
        console.log('  PASS ' + name);
    } else {
        failed += 1;
        console.error('  FAIL ' + name + '\n       expected: ' + JSON.stringify(expected) + '\n       actual:   ' + JSON.stringify(actual));
    }
}

function assert(condition, name) {
    assertEqual(Boolean(condition), true, name);
}

function createDom() {
    const elements = Object.create(null);
    function element(id) {
        if (!elements[id]) {
            elements[id] = {
                id,
                textContent: '',
                innerHTML: '',
                style: {},
                classList: { add() {}, remove() {}, contains() { return false; } },
                addEventListener() {},
                appendChild() {}
            };
        }
        return elements[id];
    }
    return {
        elements,
        document: {
            getElementById: element,
            querySelectorAll() { return []; },
            createElement(tag) { return element('created-' + tag); }
        }
    };
}

function runStatus(values) {
    const { elements, document } = createDom();
    let interval = null;
    const window = {
        AKNET_SESSION: Object.assign({}, values),
        setInterval(fn, ms) { interval = { fn, ms }; return 1; }
    };
    const sandbox = { window, document, Math, Number, String, Object, RegExp, decodeURIComponent, isFinite };
    vm.createContext(sandbox);
    vm.runInContext(statusScript, sandbox, { filename: 'js/status.js' });
    return { elements, window, tick: interval && interval.fn, intervalMs: interval && interval.ms };
}

function text(result, id) {
    return result.elements[id] ? result.elements[id].textContent : '';
}

function evaluateApi(vars) {
    let template = fs.readFileSync(path.join(root, 'api.json'), 'utf8');
    const loggedIn = vars['logged-in'] === 'yes';
    template = template.replace(/\$\(if logged-in == 'yes'\)([\s\S]*?)\$\(else\)([\s\S]*?)\$\(endif\)/g, loggedIn ? '$1' : '$2');
    const seconds = Number(vars['session-timeout-secs'] || 0);
    template = template.replace(/\$\(if session-timeout-secs != 0\)([\s\S]*?)\$\(endif\)/g, seconds !== 0 ? '$1' : '');
    const remaining = vars['remain-bytes-total'];
    template = template.replace(/\$\(if remain-bytes-total\)([\s\S]*?)\$\(endif\)/g, remaining !== undefined && remaining !== '' ? '$1' : '');
    Object.keys(vars).forEach((key) => { template = template.split('$(' + key + ')').join(String(vars[key])); });
    return JSON.parse(template);
}

function aloginTarget(encodedTarget) {
    const script = aloginHtml.match(/<script>([\s\S]*?)<\/script>/)[1]
        .split('$(link-status-esc)').join(encodedTarget);
    const window = { location: { href: 'http://ak.net/alogin', origin: 'http://ak.net' } };
    const sandbox = {
        window,
        document: { addEventListener() {}, getElementById() { return { href: '' }; } },
        URL,
        decodeURIComponent,
        setTimeout() {}
    };
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox);
    return sandbox.getRedirectTarget();
}

console.log('AK Net frontend audit — exact simulated checks');

console.log('\n1. Successful login flow');
assert(loginHtml.includes('name="dst" value="$(link-status)"'), 'login posts a status destination');
assert(aloginHtml.includes('$(link-status-esc)'), 'post-login page resolves the RouterOS status link');

console.log('\n2. CHAP authentication integration');
{
    const chapScript = loginHtml.match(/<script src="md5\.js"><\/script>\s*<script>([\s\S]*?)<\/script>/)[1]
        .split('$(chap-id)').join('A').split('$(chap-challenge)').join('B');
    let submitted = false;
    const document = {
        login: { username: { value: 'card1' }, password: { value: 'card1' } },
        sendin: { username: {}, password: {}, submit() { submitted = true; } },
        getElementById() { return { textContent: '' }; }
    };
    const sandbox = { document, hexMD5(value) { return 'md5:' + value; } };
    vm.createContext(sandbox);
    vm.runInContext(chapScript, sandbox);
    assertEqual(sandbox.doLogin(), false, 'CHAP handler prevents the plain form submit');
    assertEqual(document.sendin.password.value, 'md5:Acard1B', 'CHAP hashes id + password + challenge in order');
    assert(submitted, 'CHAP hidden form is submitted');
}

console.log('\n3. Correct username display');
{
    const result = runStatus({ username: 'Ahmed+User' });
    assertEqual(text(result, 'user-display'), 'Ahmed User', 'URL-escaped username is decoded into textContent');
}

console.log('\n4. Connection status handling');
assertEqual(text(runStatus({ loggedIn: 'yes' }), 'connection-status'), 'جلسة HotSpot مصادق عليها', 'authenticated session is described without claiming internet access');
assertEqual(text(runStatus({ loggedIn: 'unexpected' }), 'connection-status'), 'حالة الجلسة غير متاحة', 'unexpected state degrades safely');

console.log('\n5. Session uptime');
assertEqual(text(runStatus({ uptimeSecs: '3661' }), 'uptime-display'), '01:01:01', 'uptime seconds format exactly');

console.log('\n6. Download and upload counters');
{
    const result = runStatus({ bytesOut: '1048576', bytesIn: '524288' });
    assertEqual(text(result, 'download-val'), '1 MiB', 'bytes-out maps to download');
    assertEqual(text(result, 'upload-val'), '512 KiB', 'bytes-in maps to upload');
}

console.log('\n7. Accurate session data total');
assertEqual(text(runStatus({ bytesOut: '1048576', bytesIn: '524288' }), 'data-used'), '1.5 MiB', 'session total is download plus upload only');

console.log('\n8. Combined remaining quota');
{
    const result = runStatus({ remainBytesTotal: '1073741824', limitBytesTotal: '2147483648' });
    assertEqual(text(result, 'data-rem'), '1 GiB', 'combined remainder is exact');
    assertEqual(text(result, 'progress-percent-text'), 'مستهلك 50%', 'progress uses a matching local combined limit');
}

console.log('\n9. Separate directional quota limits');
{
    const result = runStatus({ remainBytesOut: '104857600', remainBytesIn: '52428800' });
    assertEqual(text(result, 'data-rem'), 'حصص اتجاهية منفصلة', 'directional values are not combined');
    assertEqual(text(result, 'data-rem-sub'), 'تنزيل: 100 MiB | رفع: 50 MiB', 'both directions retain their labels');
}

console.log('\n10. Missing quota information');
assertEqual(text(runStatus({}), 'data-rem'), 'غير متاح', 'missing quota stays unavailable');

console.log('\n11. Explicit zero remaining quota');
assertEqual(text(runStatus({ remainBytesTotal: '0' }), 'data-rem-sub'), 'الحد المحلي الإجمالي مستنفد', 'numeric zero is treated as exhausted, not missing');

console.log('\n12. Unlimited local values versus unknown User Manager quota');
{
    const result = runStatus({ remainBytesTotal: '---', limitBytesTotal: '---', radiusGroup: '1000RY' });
    assertEqual(text(result, 'data-rem'), 'غير متاح', 'no local limit never proves an unlimited subscription');
    assertEqual(text(result, 'package-total-val'), '5 GiB', 'known package capacity remains separate from remaining balance');
}

console.log('\n13. 5, 18, 40, 80, and 170 GiB Gigawords calculations');
[
    ['1073741824', '1', '5 GiB'],
    ['2147483648', '4', '18 GiB'],
    ['0', '10', '40 GiB'],
    ['0', '20', '80 GiB'],
    ['2147483648', '42', '170 GiB']
].forEach(([low, giga, expected]) => {
    const result = runStatus({ radiusTotalLimitLow: low, radiusTotalLimitGiga: giga });
    assertEqual(text(result, 'package-total-val'), expected, 'Gigawords package resolves to ' + expected);
});

console.log('\n14. Correct package identification and confidence');
{
    const confirmed = runStatus({ radiusClass: 'plan%3D3000RY' });
    assert(text(confirmed, 'active-pkg-text').includes('موثقة عبر سمة RADIUS'), 'Class token produces confirmed confidence');
    const inferred = runStatus({ radiusTotalLimitLow: '0', radiusTotalLimitGiga: '20' });
    assert(text(inferred, 'active-pkg-text').includes('مستدل عليها'), 'byte match is explicitly inferred');
}

console.log('\n15. Unknown package handling');
assertEqual(text(runStatus({ radiusGroup: 'default' }), 'active-pkg-text'), 'لم يتم التعرف على الباقة', 'unknown group uses the required wording');

console.log('\n16. Session timeout and countdown semantics');
{
    const result = runStatus({ uptimeSecs: '1800', sessionTimeoutSecs: '3600' });
    assertEqual(text(result, 'time-rem-sub'), 'متبقي للجلسة: 01:00:00', 'session-timeout-secs is already remaining and is not reduced by uptime');
}

console.log('\n17. Unavailable subscription expiration');
assertEqual(text(runStatus({ radiusGroup: '200RY' }), 'subscription-expiry'), 'تاريخ انتهاء الاشتراك غير متاح', 'package validity is not presented as an expiration timestamp');

console.log('\n18. RouterOS time parsing');
{
    const result = runStatus({ sessionTimeLeft: '1w2d04%3A10%3A20' });
    assertEqual(text(result, 'time-rem-sub'), 'متبقي للجلسة: 9d 04:10:20', 'week/day/clock format parses exactly');
    const noLimit = runStatus({ sessionTimeLeftSecs: '0', sessionTimeLeft: '' });
    assertEqual(text(noLimit, 'time-rem'), 'غير متاح', 'bare zero seconds without an explicit zero time is not called expired');
}

console.log('\n19. Live timer progression');
{
    const result = runStatus({ uptimeSecs: '10', sessionTimeLeftSecs: '2' });
    assertEqual(result.intervalMs, 1000, 'live timer uses a one-second interval');
    result.tick();
    assertEqual(text(result, 'uptime-display'), '00:00:11', 'uptime advances by one second');
    assertEqual(text(result, 'time-rem-sub'), 'متبقي للجلسة: 00:00:01', 'remaining time decrements once');
    result.tick();
    assertEqual(text(result, 'time-rem'), 'انتهى وقت الجلسة', 'countdown reaches an explicit expired state');
}

console.log('\n20. Login and logout navigation');
assert(statusHtml.includes('$(link-logout)?erase-cookie=on'), 'logout requests cookie erasure');
assert(logoutHtml.includes('href="$(link-login-only)"'), 'logout page starts a clean new login');

console.log('\n21. Unsafe redirect rejection');
assertEqual(aloginTarget('javascript%3Aalert%281%29'), 'status', 'javascript URL is rejected');
assertEqual(aloginTarget('data%3Atext%2Fhtml%2Cbad'), 'status', 'data URL is rejected');
assertEqual(aloginTarget('https%3A%2F%2Fevil.example%2Fstatus'), 'status', 'cross-origin URL is rejected');
assertEqual(aloginTarget('http%3A%2F%2Fak.net%2Fstatus'), 'http://ak.net/status', 'same-origin HTTP status URL is accepted');

console.log('\n22. XSS prevention');
{
    const payload = '%3Cimg%20src%3Dx%20onerror%3Dalert%281%29%3E';
    const result = runStatus({ username: payload, radiusClass: payload });
    assertEqual(text(result, 'user-display'), '<img src=x onerror=alert(1)>', 'untrusted username is rendered as literal text');
    assertEqual(result.elements['user-display'].innerHTML, '', 'no HTML sink is used for the username');
    assert(!statusScript.includes('.innerHTML'), 'status runtime contains no innerHTML assignment');
    assert(errorHtml.includes("detail.textContent = translated || original"), 'error text uses textContent');
    assert(!errorHtml.includes('<div class="error-text">$(error-orig)'), 'raw error text is not injected into HTML');
}

console.log('\n23. api.json validity');
{
    const active = evaluateApi({ 'logged-in': 'yes', 'link-login-only': 'http://ak.net/login', 'session-timeout-secs': '60', 'remain-bytes-total': '1024' });
    assertEqual(active.captive, false, 'active API response is valid and non-captive');
    assertEqual(active['seconds-remaining'], 60, 'API seconds are numeric');
    assertEqual(active['bytes-remaining'], 1024, 'API bytes are numeric');
    const captive = evaluateApi({ 'logged-in': 'no', 'link-login-only': 'http://ak.net/login', 'session-timeout-secs': '0', 'remain-bytes-total': '' });
    assertEqual(captive.captive, true, 'logged-out API response remains valid JSON');
}

console.log('\n24. Mobile layout');
assert(statusHtml.includes('width=device-width'), 'status page declares a responsive viewport');
assert(/@media\s*\(max-width:\s*480px\)/.test(statusHtml), 'status page has a small-screen breakpoint');
assert(/grid-template-columns:\s*1fr/.test(statusHtml), 'mobile cards collapse to one column');

console.log('\n25. Production build without debugging information');
{
    const production = [statusHtml, statusScript, loginHtml, aloginHtml, logoutHtml, errorHtml, radvertHtml].join('\n');
    assert(!production.includes('id="diag-panel"'), 'diagnostic panel is absent');
    assert(!production.includes('renderDiagnostics'), 'diagnostic renderer is absent');
    assert(!production.includes('chap-debug'), 'CHAP debug element is absent');
    assert(!production.includes('console.log') && !production.includes('console.error'), 'production pages contain no console diagnostics');
    assert(!loginHtml.includes('اسبوعين') && loginHtml.includes('170</span>'), 'all seven package cards use corrected metadata');
}

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);

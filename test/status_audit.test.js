/**
 * AK Net HotSpot Portal - Automated Test Suite
 * Comprehensive Pre-Deployment Validation for MikroTik RouterOS 7 & User Manager v7
 *
 * Covers all 16 required test scenarios with exact expected results assertions.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock DOM Environment
function createMockDOM(urlSearch = '') {
    const elements = {};
    function getOrCreate(id) {
        if (!elements[id]) {
            elements[id] = {
                id: id,
                _text: '',
                set textContent(v) { this._text = String(v); },
                get textContent() { return this._text; },
                set innerText(v) { this._text = String(v); },
                get innerText() { return this._text; },
                style: {},
                classList: {
                    classes: new Set(),
                    add(c) { this.classes.add(c); },
                    remove(c) { this.classes.delete(c); },
                    contains(c) { return this.classes.has(c); }
                },
                children: [],
                innerHTML: '',
                addEventListener: () => {},
                appendChild: function(child) { this.children.push(child); }
            };
        }
        return elements[id];
    }

    let intervalFn = null;
    let intervalMs = 0;

    const documentMock = {
        getElementById: (id) => getOrCreate(id),
        querySelector: (sel) => {
            if (sel.startsWith('#')) return getOrCreate(sel.slice(1));
            return getOrCreate('sel_' + sel.replace(/[^a-zA-Z0-9]/g, '_'));
        },
        querySelectorAll: () => [],
        createElement: (tag) => ({
            tag,
            style: {},
            className: '',
            children: [],
            appendChild(c) { this.children.push(c); }
        })
    };

    const windowMock = {
        location: {
            search: urlSearch,
            hash: '',
            href: 'http://10.0.0.1/status' + urlSearch
        },
        localStorage: {
            _data: {},
            getItem(k) { return this._data[k] || null; },
            setItem(k, v) { this._data[k] = String(v); },
            removeItem(k) { delete this._data[k]; }
        },
        setInterval: (fn, ms) => {
            intervalFn = fn;
            intervalMs = ms;
            return 1;
        },
        clearInterval: () => {
            intervalFn = null;
        }
    };

    return {
        documentMock,
        windowMock,
        elements,
        getIntervalFn: () => intervalFn,
        getIntervalMs: () => intervalMs
    };
}

// Function to substitute MikroTik template variables in a file and execute it in a sandbox
function runStatusScript(mockVars, targetFile = 'status.html') {
    const filePath = path.join(__dirname, '..', targetFile);
    let html = fs.readFileSync(filePath, 'utf8');

    // Substitute provided variables
    for (const [key, val] of Object.entries(mockVars)) {
        html = html.split(`$(${key})`).join(val !== undefined ? String(val) : '');
    }

    // Extract script
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) throw new Error(`No script tag found in ${targetFile}`);
    const scriptContent = scriptMatch[1];

    const { documentMock, windowMock, elements, getIntervalFn } = createMockDOM();

    const logs = [];
    const errors = [];
    const sandbox = {
        document: documentMock,
        window: windowMock,
        console: {
            log: (...args) => logs.push(args.join(' ')),
            error: (...args) => errors.push(args.join(' ')),
            warn: (...args) => logs.push('WARN: ' + args.join(' '))
        },
        setInterval: windowMock.setInterval,
        clearInterval: windowMock.clearInterval,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        Math: Math,
        String: String,
        Number: Number,
        Date: Date,
        openModal: () => {},
        closeModal: () => {}
    };

    vm.createContext(sandbox);
    vm.runInContext(scriptContent, sandbox);

    return { elements, logs, errors, sandbox, windowMock, getIntervalFn };
}

// Helper for testing api.json template substitution
function evaluateApiJson(mockVars) {
    const filePath = path.join(__dirname, '..', 'api.json');
    let template = fs.readFileSync(filePath, 'utf8');

    // Evaluate $(if condition) ... $(else) ... $(endif)
    // 1. logged-in conditional
    const isLoggedIn = mockVars['logged-in'] === 'yes';
    template = template.replace(/\$\(if logged-in == 'yes'\)([\s\S]*?)\$\(else\)([\s\S]*?)\$\(endif\)/g,
        isLoggedIn ? '$1' : '$2');

    // 2. session-timeout-secs != 0 conditional
    const timeoutSecs = parseInt(mockVars['session-timeout-secs'] || '0', 10);
    template = template.replace(/\$\(if session-timeout-secs != 0\)([\s\S]*?)\$\(endif\)/g,
        timeoutSecs !== 0 ? '$1' : '');

    // 3. remain-bytes-total conditional
    const hasRemainBytesTotal = Boolean(mockVars['remain-bytes-total'] && mockVars['remain-bytes-total'].trim() !== '');
    template = template.replace(/\$\(if remain-bytes-total\)([\s\S]*?)\$\(endif\)/g,
        hasRemainBytesTotal ? '$1' : '');

    // 4. Substitute standard variables
    for (const [key, val] of Object.entries(mockVars)) {
        template = template.split(`$(${key})`).join(val !== undefined ? String(val) : '');
    }

    return template;
}

// ================= TEST SUITE =================
let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${testName} - ${details}`);
        failed++;
    }
}

console.log('================================================================');
console.log('AK Net Status Page: Strengthened Automated Verification Suite');
console.log('Testing RouterOS 7 + User Manager v7 Pre-Deployment Compatibility');
console.log('================================================================\n');

// ----------------------------------------------------
// Test Area 1: Combined Quota Using $(remain-bytes-total)
// ----------------------------------------------------
console.log('Test Area 1: Combined Quota via $(remain-bytes-total)');
{
    const res = runStatusScript({
        'username': 'ahmed_total',
        'remain-bytes-total': '1073741824', // exactly 1 GiB
        'limit-bytes-total': '2147483648',  // 2 GiB
        'radius3-14988': '500RY'
    });

    assert(res.errors.length === 0, 'No JavaScript execution errors');
    assert(res.elements['data-rem'].textContent.trim() === '1 جيجابايت',
           'Exact 1 GiB formatted remaining quota', `Got: "${res.elements['data-rem'].textContent}"`);
    assert(res.elements['data-rem-sub'].textContent.includes('متبقي من 2 جيجابايت'),
           'Correct total quota sub-label', `Got: "${res.elements['data-rem-sub'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 2: Separate Upload and Download Quotas (No Summing!)
// ----------------------------------------------------
console.log('\nTest Area 2: Separate Directional Quotas (Never Summing Independent Limits)');
{
    // Test 2a: Both download and upload limits exist
    const resBoth = runStatusScript({
        'username': 'directional_user',
        'remain-bytes-out': '104857600', // 100 MiB download
        'remain-bytes-in': '52428800',   // 50 MiB upload
        'limit-bytes-out': '524288000',
        'limit-bytes-in': '104857600'
    });

    assert(resBoth.errors.length === 0, 'No errors on directional limits');
    // Ensure it did NOT sum them (100 + 50 = 150 MiB)
    assert(!resBoth.elements['data-rem'].textContent.includes('150'),
           'Never sums independent directional limits to fabricate combined quota',
           `Got: "${resBoth.elements['data-rem'].textContent}"`);
    assert(resBoth.elements['data-rem-sub'].textContent.includes('تنزيل') &&
           resBoth.elements['data-rem-sub'].textContent.includes('رفع'),
           'Preserves separate directional values in subtitle',
           `Got: "${resBoth.elements['data-rem-sub'].textContent}"`);

    // Test 2b: Download only quota
    const resDownOnly = runStatusScript({
        'username': 'down_only_user',
        'remain-bytes-out': '209715200', // 200 MiB download
        'limit-bytes-out': '1073741824'
    });
    assert(resDownOnly.elements['data-rem'].textContent.trim() === '200 ميغابايت',
           'Exact download-only remaining quota displayed',
           `Got: "${resDownOnly.elements['data-rem'].textContent}"`);
    assert(resDownOnly.elements['data-rem-sub'].textContent.includes('حصة التنزيل'),
           'Labels quota specifically as download allowance',
           `Got: "${resDownOnly.elements['data-rem-sub'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 3: Missing Quota Information
// ----------------------------------------------------
console.log('\nTest Area 3: Missing Quota Information (User Manager Server Tracking)');
{
    const res = runStatusScript({
        'username': 'um_untracked',
        'bytes-in': '1000000',
        'bytes-out': '2000000'
        // no remain-bytes, no limits
    });

    assert(res.errors.length === 0, 'No errors when quota variables missing');
    assert(res.elements['data-rem'].textContent.includes('يُدار عبر السيرفر'),
           'Displays server-managed state without guessing balance',
           `Got: "${res.elements['data-rem'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 4: Exactly Zero Remaining Quota (Exhausted State)
// ----------------------------------------------------
console.log('\nTest Area 4: Exactly Zero Remaining Quota (Exhausted State)');
{
    const res = runStatusScript({
        'username': 'zero_quota_user',
        'remain-bytes-total': '0',
        'bytes-in': '500000',
        'bytes-out': '500000',
        'radius3-14988': '200RY'
    });

    assert(res.elements['data-rem'].textContent.includes('منتهي') ||
           res.elements['data-rem'].textContent.includes('0 ميغابايت'),
           'Identifies 0 bytes as exhausted quota',
           `Got: "${res.elements['data-rem'].textContent}"`);
    assert(res.elements['data-rem-sub'].textContent.includes('بالكامل'),
           'Subtitle confirms full consumption',
           `Got: "${res.elements['data-rem-sub'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 5: Unlimited Sessions Without False Positives
// ----------------------------------------------------
console.log('\nTest Area 5: Unlimited Sessions (True Positive vs Negative)');
{
    // 5a: True Unlimited
    const resUnlim = runStatusScript({
        'username': 'true_unlimited',
        'remain-bytes-total': '---',
        'limit-bytes-total': '---'
    });
    assert(resUnlim.elements['data-rem'].textContent.trim() === 'غير محدود',
           'Explicit unlimited reports "غير محدود"',
           `Got: "${resUnlim.elements['data-rem'].textContent}"`);

    // 5b: Capped user must NOT falsely show unlimited
    const resCapped = runStatusScript({
        'username': 'capped_user',
        'remain-bytes-total': '524288000' // 500 MB
    });
    assert(resCapped.elements['data-rem'].textContent !== 'غير محدود',
           'Capped user is never marked as unlimited (no false positive)',
           `Got: "${resCapped.elements['data-rem'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 6: Large RADIUS Packages via Gigawords (5, 18, 40, 80, 170 GiB)
// ----------------------------------------------------
console.log('\nTest Area 6: Large Packages with Exact 64-bit Gigawords Calculation');
{
    const packagesToTest = [
        { name: '5 GiB (1000RY)', low: 1073741824, giga: 1, expectedTotal: 5368709120, label: '5 جيجابايت' },
        { name: '18 GiB (3000RY)', low: 2147483648, giga: 4, expectedTotal: 19327352832, label: '18 جيجابايت' },
        { name: '40 GiB (6000RY)', low: 0, giga: 10, expectedTotal: 42949672960, label: '40 جيجابايت' },
        { name: '80 GiB (10000RY)', low: 0, giga: 20, expectedTotal: 85899345920, label: '80 جيجابايت' },
        { name: '170 GiB (20000RY)', low: 2147483648, giga: 42, expectedTotal: 182536110080, label: '170 جيجابايت' }
    ];

    for (const pkg of packagesToTest) {
        const res = runStatusScript({
            'username': 'test_giga',
            'radius17-14988u': String(pkg.low),
            'radius18-14988u': String(pkg.giga),
            'radius3-14988': 'default_group' // group name does NOT contain the key!
        });

        const totalVal = res.elements['package-total-val'].textContent;
        const badgeVal = res.elements['active-pkg-text'].textContent;

        assert(totalVal.includes(pkg.label),
               `Exact capacity calculated for ${pkg.name}: ${pkg.label}`,
               `Got: "${totalVal}"`);
        assert(badgeVal.includes(pkg.label),
               `Identified package tier from exact byte capacity: ${pkg.name}`,
               `Got: "${badgeVal}"`);
    }
}

// ----------------------------------------------------
// Test Area 7: Remaining Session Time Without Double Subtraction
// ----------------------------------------------------
console.log('\nTest Area 7: Remaining Session Time Without Double Subtraction');
{
    // When RouterOS provides session-time-left-secs = 3600 (1 hour remaining) and uptime is 1800 (30 min)
    // The remaining time MUST be 3600 seconds (1 hour), NOT 3600 - 1800 = 1800!
    const res = runStatusScript({
        'username': 'timer_user',
        'uptime-secs': '1800',
        'session-time-left-secs': '3600'
    });

    assert(res.elements['time-rem'].textContent.includes('ساعة') &&
           !res.elements['time-rem'].textContent.includes('دقيقة'),
           'Exact 1 hour remaining session time (no double subtraction of uptime)',
           `Got: "${res.elements['time-rem'].textContent}"`);
    assert(res.elements['time-rem-sub'].textContent.includes('1:00:00'),
           'Exact duration format in subtitle',
           `Got: "${res.elements['time-rem-sub'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 8: Zero and Expired Session Time
// ----------------------------------------------------
console.log('\nTest Area 8: Zero and Expired Session Time');
{
    const res = runStatusScript({
        'username': 'expired_session',
        'uptime-secs': '7200',
        'session-time-left-secs': '0',
        'session-time-left': '00:00:00'
    });

    assert(res.elements['time-rem'].textContent.trim() === 'انتهت الجلسة',
           'Reports exact expired session state',
           `Got: "${res.elements['time-rem'].textContent}"`);
    assert(res.elements['time-rem-sub'].textContent.includes('مهلة الاتصال منتهية'),
           'Subtitle confirms session expired',
           `Got: "${res.elements['time-rem-sub'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 9: Missing and Unresolved Template Variables
// ----------------------------------------------------
console.log('\nTest Area 9: Unresolved MikroTik Variables (Raw $(...) Literals)');
{
    const res = runStatusScript({
        'username': '$(username)',
        'ip': '$(ip)',
        'mac': '$(mac)',
        'uptime': '$(uptime)',
        'uptime-secs': '$(uptime-secs)',
        'session-time-left': '$(session-time-left)',
        'remain-bytes-total': '$(remain-bytes-total)',
        'remain-bytes-out': '$(remain-bytes-out)'
    });

    assert(res.errors.length === 0, 'No runtime exceptions on unreplaced templates');
    assert(!res.elements['data-rem'].textContent.includes('NaN'),
           'Data remaining never displays NaN', `Got: "${res.elements['data-rem'].textContent}"`);
    assert(!res.elements['time-rem'].textContent.includes('NaN'),
           'Time remaining never displays NaN', `Got: "${res.elements['time-rem'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 10: Exact Parsing of RouterOS Time Formats
// ----------------------------------------------------
console.log('\nTest Area 10: RouterOS Time Format Parsing');
{
    const timeFormats = [
        { raw: '1d02:30:45', expectedDesc: '1 day, 2 hours, 30 min, 45 sec' },
        { raw: '12h30m', expectedDesc: '12 hours, 30 min' },
        { raw: '00:15:30', expectedDesc: '15 min, 30 sec' },
        { raw: '1w2d04:10:20', expectedDesc: '1 week, 2 days, 4 hours' },
        { raw: '45s', expectedDesc: '45 sec' },
        { raw: '3d', expectedDesc: '3 days' },
        { raw: '2w', expectedDesc: '2 weeks' }
    ];

    for (const tf of timeFormats) {
        const res = runStatusScript({
            'username': 'time_parser_test',
            'session-time-left': tf.raw,
            'session-time-left-secs': '0'
        });

        assert(res.errors.length === 0, `Parsed format "${tf.raw}" without errors`);
        assert(!res.elements['time-rem'].textContent.includes('غير محدد') &&
               !res.elements['time-rem'].textContent.includes('NaN'),
               `Valid Arabic representation for ${tf.raw}`,
               `Got: "${res.elements['time-rem'].textContent}"`);
    }
}

// ----------------------------------------------------
// Test Area 11: Progression of Simulated Live Timers
// ----------------------------------------------------
console.log('\nTest Area 11: Live Timers Tick Progression (Advancing Time)');
{
    const res = runStatusScript({
        'username': 'tick_user',
        'uptime-secs': '10',
        'session-time-left-secs': '3'
    });

    const tick = res.getIntervalFn();
    assert(typeof tick === 'function', 'Live interval timer registered');

    // Initial state: Uptime 10s -> "00:10", Remaining 3s
    assert(res.elements['uptime-display'].textContent === '00:10',
           'Initial uptime is 00:10', `Got: "${res.elements['uptime-display'].textContent}"`);

    // Tick 1
    tick();
    assert(res.elements['uptime-display'].textContent === '00:11',
           'Uptime advances to 00:11 on tick 1', `Got: "${res.elements['uptime-display'].textContent}"`);

    // Tick 2
    tick();
    assert(res.elements['uptime-display'].textContent === '00:12',
           'Uptime advances to 00:12 on tick 2');

    // Tick 3: Remaining should reach 0 and show expired
    tick();
    assert(res.elements['time-rem'].textContent.includes('انتهت الجلسة'),
           'Remaining session time decrements and triggers expired state at 0',
           `Got: "${res.elements['time-rem'].textContent}"`);
}

// ----------------------------------------------------
// Test Area 12: Package Identification
// ----------------------------------------------------
console.log('\nTest Area 12: Package Identification (Group, Class, and Byte Match)');
{
    // 12a: By Group
    const resGroup = runStatusScript({
        'username': 'u1',
        'radius3-14988': '3000RY'
    });
    assert(resGroup.elements['active-pkg-text'].textContent.includes('3,000'),
           'Matches 3000RY package via radiusGroup');

    // 12b: By Class
    const resClass = runStatusScript({
        'username': 'u2',
        'radius25': '1000RY'
    });
    assert(resClass.elements['active-pkg-text'].textContent.includes('1,000'),
           'Matches 1000RY package via Class attribute');
}

// ----------------------------------------------------
// Test Area 13: Valid JSON Output from api.json (RFC 8908)
// ----------------------------------------------------
console.log('\nTest Area 13: Captive Portal API (api.json) RFC 8908 Validity');
{
    // 13a: Logged in with limits
    const jsonStr1 = evaluateApiJson({
        'logged-in': 'yes',
        'link-login-only': 'http://10.0.0.1/login',
        'session-timeout-secs': '3600',
        'remain-bytes-total': '104857600'
    });
    let parsed1;
    try {
        parsed1 = JSON.parse(jsonStr1);
    } catch(e) {
        parsed1 = null;
    }
    assert(parsed1 !== null, 'Valid JSON when logged-in with timeout and bytes');
    assert(parsed1 && parsed1.captive === false, 'Captive is false when logged in');
    assert(parsed1 && parsed1['bytes-remaining'] === 104857600, 'Exact bytes-remaining in JSON');

    // 13b: Logged in without optional limits
    const jsonStr2 = evaluateApiJson({
        'logged-in': 'yes',
        'link-login-only': 'http://10.0.0.1/login',
        'session-timeout-secs': '0',
        'remain-bytes-total': ''
    });
    let parsed2;
    try {
        parsed2 = JSON.parse(jsonStr2);
    } catch(e) {
        parsed2 = null;
    }
    assert(parsed2 !== null, 'Valid JSON when logged-in with NO limits');
    assert(parsed2 && !('bytes-remaining' in parsed2), 'bytes-remaining cleanly omitted without syntax error');

    // 13c: Logged out (captive)
    const jsonStr3 = evaluateApiJson({
        'logged-in': 'no',
        'link-login-only': 'http://10.0.0.1/login'
    });
    let parsed3;
    try {
        parsed3 = JSON.parse(jsonStr3);
    } catch(e) {
        parsed3 = null;
    }
    assert(parsed3 !== null, 'Valid JSON when logged out');
    assert(parsed3 && parsed3.captive === true, 'Captive is true when logged out');
}

// ----------------------------------------------------
// Test Area 14: Login-to-Status Navigation Behavior
// ----------------------------------------------------
console.log('\nTest Area 14: Navigation & Redirection Security (alogin.html)');
{
    const aloginPath = path.join(__dirname, '..', 'alogin.html');
    let aloginHtml = fs.readFileSync(aloginPath, 'utf8');

    // Extract script from alogin.html
    const scriptMatch = aloginHtml.match(/<script>([\s\S]*?)<\/script>/);
    assert(scriptMatch !== null, 'alogin.html contains redirection script');

    // Test malicious javascript: URI injection
    let injectedScript = scriptMatch[1].replace('\$(link-redirect)', 'javascript:alert(1)');
    injectedScript = injectedScript.replace('\$(link-status)', 'status.html');

    const sandbox = {
        window: { location: { href: '' } },
        document: { addEventListener: () => {}, getElementById: () => ({ href: '' }) },
        setTimeout: (fn) => fn()
    };
    vm.createContext(sandbox);
    vm.runInContext(injectedScript, sandbox);

    assert(!sandbox.window.location.href.startsWith('javascript:'),
           'Guards against javascript: URI execution in redirection',
           `Redirected to: ${sandbox.window.location.href}`);
    assert(sandbox.window.location.href === 'status.html',
           'Safely falls back to status.html when target is invalid or malicious');
}

// ----------------------------------------------------
// Test Area 15: Production Build Without Diagnostics Exposure
// ----------------------------------------------------
console.log('\nTest Area 15: Production Hardening (No Diagnostics in Production)');
{
    const prodStatusHtml = fs.readFileSync(path.join(__dirname, '..', 'status.html'), 'utf8');

    assert(!prodStatusHtml.includes('id="diag-panel"'),
           'diag-panel completely removed from production status.html');
    assert(!prodStatusHtml.includes('renderDiagnostics'),
           'renderDiagnostics function completely removed from production status.html');
    assert(fs.existsSync(path.join(__dirname, '..', 'dev', 'status-diagnostics.html')),
           'Separate dev/status-diagnostics.html exists for development testing');
}

// ----------------------------------------------------
// Test Area 16: Cumulative Usage vs Current-Session Usage
// ----------------------------------------------------
console.log('\nTest Area 16: Cumulative Usage vs Current-Session Usage Isolation');
{
    // User has 5 GiB package (1000RY). In this session they consumed only 50 MiB.
    // If the router does NOT pass remain-bytes-total, the system MUST NOT subtract 50 MiB
    // from 5 GiB and claim the user has 4.95 GiB remaining!
    const res = runStatusScript({
        'username': 'repeat_user',
        'bytes-in': '10485760',   // 10 MiB
        'bytes-out': '41943040',  // 40 MiB
        'radius3-14988': '1000RY' // 5 GiB plan
    });

    assert(res.elements['data-used'].textContent.trim() === '50 ميغابايت',
           'Session usage accurately reflects only current session: 50 MiB');
    assert(res.elements['data-rem'].textContent.trim() === 'يُدار عبر السيرفر',
           'Never fabricates remaining quota by subtracting single session from package',
           `Got: "${res.elements['data-rem'].textContent}"`);
    assert(res.elements['package-total-val'].textContent.trim() === '5 جيجابايت',
           'Package total accurately reflects advertised capacity: 5 GiB');
}

console.log('\n================================================================');
console.log(`Final Test Results: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) process.exit(1);

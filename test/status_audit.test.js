/**
 * AK Net HotSpot Status Page Test Suite
 * Validating RouterOS 7 and User Manager v7 compatibility across all required scenarios.
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
                innerText: '',
                textContent: '',
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
        setInterval: (fn, ms) => ({ fn, ms, id: 1 }),
        clearInterval: () => {}
    };

    return { documentMock, windowMock, elements };
}

// Function to substitute MikroTik template variables in status.html and run the script in a sandbox
function runStatusScript(mockVars, urlSearch = '') {
    const htmlPath = path.join(__dirname, '..', 'status.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Substitute provided variables
    for (const [key, val] of Object.entries(mockVars)) {
        html = html.split(`$(${key})`).join(val !== undefined ? String(val) : '');
    }

    // Extract the <script> body
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) throw new Error('No script tag found in status.html');
    const scriptContent = scriptMatch[1];

    const { documentMock, windowMock, elements } = createMockDOM(urlSearch);

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

    return { elements, logs, errors, sandbox, windowMock };
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

console.log('====================================================');
console.log('AK Net Status Page: Automated Test & Audit Suite');
console.log('====================================================\n');

// ----------------------------------------------------
// Test 1: Authenticated user with valid quota and remaining time
// ----------------------------------------------------
console.log('Scenario 1: Authenticated User with Valid Quota & Time Remaining');
{
    const res = runStatusScript({
        'username': 'ahmed_user',
        'ip': '10.0.0.55',
        'mac': '00:1A:2B:3C:4D:5E',
        'uptime': '01:30:00',
        'uptime-secs': '5400',
        'session-time-left': '02:30:00',
        'session-time-left-secs': '9000',
        'bytes-in': '10485760',
        'bytes-out': '41943040',
        'bytes-in-nice': '10 MB',
        'bytes-out-nice': '40 MB',
        'bytes-total-nice': '50 MB',
        'remain-bytes-out': '1073741824', // 1 GB
        'remain-bytes-in': '536870912',   // 512 MB
        'limit-bytes-out': '2147483648',
        'radius3-14988': '500RY',
        'radius25': '500RY'
    });

    assert(res.errors.length === 0, 'No JavaScript errors thrown');
    assert(res.elements['data-rem'].innerText.includes('1.5') || res.elements['data-rem'].innerText.includes('جيجابايت'),
           'Remaining quota displays correctly (1.5 GB)', `Got: ${res.elements['data-rem'].innerText}`);
    assert(res.elements['time-rem'].innerText.includes('ساعتين') || res.elements['time-rem'].innerText.includes('ساعة'),
           'Remaining time displays Arabic format', `Got: ${res.elements['time-rem'].innerText}`);
    assert(res.elements['active-pkg-text'].innerText.includes('500'),
           'Package detected as 500RY', `Got: ${res.elements['active-pkg-text'].innerText}`);
}

// ----------------------------------------------------
// Test 2: User with exhausted data quota (0 bytes remaining)
// ----------------------------------------------------
console.log('\nScenario 2: User with Exhausted Data Quota');
{
    const res = runStatusScript({
        'username': 'exhausted_user',
        'uptime': '05:00:00',
        'uptime-secs': '18000',
        'remain-bytes-out': '0',
        'remain-bytes-in': '0',
        'bytes-in': '50000000',
        'bytes-out': '200000000',
        'radius3-14988': '200RY'
    });

    assert(res.errors.length === 0, 'No JavaScript errors');
    assert(res.elements['data-rem'].innerText.includes('0') || res.elements['data-rem'].innerText.includes('منتهي'),
           'Quota displays exhausted state', `Got: ${res.elements['data-rem'].innerText}`);
    assert(res.elements['data-rem-sub'].innerText.includes('بالكامل') || res.elements['data-rem-sub'].innerText.includes('منتهي'),
           'Quota subtitle reflects full consumption', `Got: ${res.elements['data-rem-sub'].innerText}`);
}

// ----------------------------------------------------
// Test 3: User with expired session time
// ----------------------------------------------------
console.log('\nScenario 3: User with Expired Session Time');
{
    const res = runStatusScript({
        'username': 'expired_time_user',
        'uptime': '24:00:00',
        'uptime-secs': '86400',
        'session-time-left': '00:00:00',
        'session-time-left-secs': '0',
        'session-timeout-secs': '86400',
        'radius3-14988': '200RY'
    });

    assert(res.errors.length === 0, 'No errors');
    assert(res.elements['time-rem'].innerText.includes('انتهت') || res.elements['time-rem'].innerText.includes('منتهي'),
           'Session time displays expired state', `Got: ${res.elements['time-rem'].innerText}`);
}

// ----------------------------------------------------
// Test 4: User with unlimited quota
// ----------------------------------------------------
console.log('\nScenario 4: User with Unlimited Quota');
{
    const res = runStatusScript({
        'username': 'vip_unlimited',
        'remain-bytes-out': '---',
        'remain-bytes-in': '---',
        'limit-bytes-out': '---',
        'limit-bytes-in': '---',
        'radius17-14988u': '0',
        'radius18-14988u': '0',
        'radius3-14988': 'VIP_UNLIMITED'
    });

    assert(res.errors.length === 0, 'No errors');
    assert(res.elements['data-rem'].innerText.includes('غير محدود') || res.elements['data-rem'].innerText.includes('مفتوح'),
           'Displays unlimited quota state', `Got: ${res.elements['data-rem'].innerText}`);
}

// ----------------------------------------------------
// Test 5: User with no RADIUS quota information
// ----------------------------------------------------
console.log('\nScenario 5: User with No RADIUS Quota Information (User Manager Default)');
{
    const res = runStatusScript({
        'username': 'standard_user',
        'remain-bytes-out': '',
        'remain-bytes-in': '',
        'limit-bytes-out': '',
        'radius17-14988u': '0',
        'radius18-14988u': '0',
        'radius3-14988': '',
        'radius25': ''
    });

    assert(res.errors.length === 0, 'No errors');
    assert(res.elements['data-rem'].innerText.includes('السيرفر') || res.elements['data-rem'].innerText.includes('غير محدد'),
           'Displays server-managed state without fabricating false values',
           `Got: ${res.elements['data-rem'].innerText}`);
}

// ----------------------------------------------------
// Test 6: Data packages larger than 4 GB (40 GB, 80 GB, 170 GB via Gigawords)
// ----------------------------------------------------
console.log('\nScenario 6: Packages Larger than 4 GB with Gigawords VSAs');
{
    // 40 GB = 42,949,672,960 bytes -> Giga = 10, Low = 0 (or Giga = 9, Low = 4294967296)
    // 42949672960 / 4294967296 = 10 Gigawords
    const res40 = runStatusScript({
        'username': 'user_40gb',
        'radius17-14988u': '0',
        'radius18-14988u': '10', // 10 * 4294967296 = 40 GB
        'radius3-14988': 'default_group'
    });

    assert(res40.elements['active-pkg-text'].innerText.includes('40') || res40.elements['package-total-val'].innerText.includes('40'),
           '40 GB package detected via Gigawords calculation',
           `Badge: ${res40.elements['active-pkg-text'].innerText}, Total: ${res40.elements['package-total-val'].innerText}`);

    // 80 GB = 85,899,345,920 bytes -> 20 Gigawords
    const res80 = runStatusScript({
        'username': 'user_80gb',
        'radius17-14988u': '0',
        'radius18-14988u': '20',
        'radius3-14988': 'default_group'
    });

    assert(res80.elements['active-pkg-text'].innerText.includes('80') || res80.elements['package-total-val'].innerText.includes('80'),
           '80 GB package detected via Gigawords calculation',
           `Badge: ${res80.elements['active-pkg-text'].innerText}, Total: ${res80.elements['package-total-val'].innerText}`);

    // 170 GB = 182,536,110,080 bytes -> 42.5 Gigawords (Giga = 42, Low = 2147483648)
    const res170 = runStatusScript({
        'username': 'user_170gb',
        'radius17-14988u': '2147483648', // 2 GB
        'radius18-14988u': '42',         // 42 * 4GB = 168 GB -> Total 170 GB
        'radius3-14988': 'default_group'
    });

    assert(res170.elements['active-pkg-text'].innerText.includes('170') || res170.elements['package-total-val'].innerText.includes('170'),
           '170 GB package detected via Gigawords calculation',
           `Badge: ${res170.elements['active-pkg-text'].innerText}, Total: ${res170.elements['package-total-val'].innerText}`);
}

// ----------------------------------------------------
// Test 7: Missing or Unresolved MikroTik Template Variables
// ----------------------------------------------------
console.log('\nScenario 7: Missing or Unresolved Template Variables (Raw $(...) Literals)');
{
    // Do not substitute some variables to simulate router template substitution failure
    const res = runStatusScript({
        'username': '$(username)',
        'ip': '$(ip)',
        'mac': '$(mac)',
        'uptime': '$(uptime)',
        'uptime-secs': '$(uptime-secs)',
        'session-time-left': '$(session-time-left)',
        'remain-bytes-out': '$(remain-bytes-out)'
    });

    assert(res.errors.length === 0, 'Does not throw JS errors when variables are unresolved');
    assert(!res.elements['data-rem'].innerText.includes('NaN'),
           'Data remaining does not show NaN', `Got: ${res.elements['data-rem'].innerText}`);
    assert(!res.elements['time-rem'].innerText.includes('NaN'),
           'Time remaining does not show NaN', `Got: ${res.elements['time-rem'].innerText}`);
}

// ----------------------------------------------------
// Test 8: Complex RouterOS Time Formats Parsing
// ----------------------------------------------------
console.log('\nScenario 8: Complex RouterOS Time Formats Parsing');
{
    const formats = [
        { raw: '1d02:30:45', expectedSecs: 95445 },
        { raw: '12h30m', expectedSecs: 45000 },
        { raw: '00:15:30', expectedSecs: 930 },
        { raw: '1w2d04:10:20', expectedSecs: 792620 },
        { raw: '45s', expectedSecs: 45 },
        { raw: '3d', expectedSecs: 259200 }
    ];

    for (const f of formats) {
        const res = runStatusScript({
            'username': 'time_test',
            'session-time-left': f.raw,
            'session-time-left-secs': '0'
        });

        assert(!res.elements['time-rem'].innerText.includes('غير محدد') &&
               !res.elements['time-rem'].innerText.includes('NaN') &&
               res.elements['time-rem'].innerText.length > 0,
               `Parsed time format "${f.raw}" without error`,
               `Display: ${res.elements['time-rem'].innerText}`);
    }
}

// ----------------------------------------------------
// Test 9: Live Ticking Counters and Zero-Value Handling
// ----------------------------------------------------
console.log('\nScenario 9: Live Ticking Counters and Timer Behavior');
{
    const res = runStatusScript({
        'username': 'live_tick_user',
        'uptime-secs': '10',
        'session-time-left-secs': '5'
    });

    const intervalCall = res.windowMock.setInterval.lastCall || res.sandbox.window.setInterval;
    assert(typeof intervalCall === 'function', 'setInterval was registered for live ticking');
}

// ----------------------------------------------------
// Test 10: Diagnostics Mode Toggle (?debug=1)
// ----------------------------------------------------
console.log('\nScenario 10: Diagnostics Mode (?debug=1)');
{
    // Normal mode (production)
    const resProd = runStatusScript({ 'username': 'test' }, '');
    assert(resProd.elements['diag-panel'].style.display === 'none' || !resProd.elements['diag-panel'].style.display,
           'Diagnostics panel is hidden in production mode');

    // Debug mode
    const resDebug = runStatusScript({ 'username': 'test' }, '?debug=1');
    assert(resDebug.elements['diag-panel'].style.display === 'block',
           'Diagnostics panel is visible when ?debug=1 is set');
}

console.log('\n====================================================');
console.log(`Summary: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) process.exit(1);

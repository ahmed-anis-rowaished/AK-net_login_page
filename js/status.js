(function (window, document) {
    'use strict';

    var source = window.AKNET_SESSION || {};
    var GIGAWORD_BYTES = 4294967296;
    var PACKAGES = {
        '200RY': { name: 'باقة 200 ريال', bytes: 838860800, validity: 'يوم واحد' },
        '500RY': { name: 'باقة 500 ريال', bytes: 2147483648, validity: '3 أيام' },
        '1000RY': { name: 'باقة 1,000 ريال', bytes: 5368709120, validity: '7 أيام' },
        '3000RY': { name: 'باقة 3,000 ريال', bytes: 19327352832, validity: '30 يوماً' },
        '6000RY': { name: 'باقة 6,000 ريال', bytes: 42949672960, validity: '30 يوماً' },
        '10000RY': { name: 'باقة 10,000 ريال', bytes: 85899345920, validity: '30 يوماً' },
        '20000RY': { name: 'باقة 20,000 ريال', bytes: 182536110080, validity: '30 يوماً' }
    };

    function unresolved(value) {
        return value === null || value === undefined || String(value).indexOf('$(') !== -1;
    }

    function decodeTemplate(value) {
        if (unresolved(value)) return '';
        var text = String(value);
        try {
            return decodeURIComponent(text.replace(/\+/g, ' '));
        } catch (ignore) {
            return '';
        }
    }

    function clean(value) {
        if (unresolved(value)) return '';
        var text = String(value).trim();
        return text === '---' ? '' : text;
    }

    function parseUnsigned(value) {
        var text = clean(value);
        if (!/^\d+$/.test(text)) return null;
        var number = Number(text);
        return isFinite(number) && number >= 0 ? number : null;
    }

    function setText(id, value) {
        var element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function formatBytes(bytes) {
        if (bytes === null || bytes === undefined || !isFinite(bytes) || bytes < 0) return 'غير متاح';
        if (bytes === 0) return '0 بايت';
        var units = ['بايت', 'KiB', 'MiB', 'GiB', 'TiB'];
        var exponent = Math.floor(Math.log(bytes) / Math.log(1024));
        exponent = Math.max(0, Math.min(exponent, units.length - 1));
        var amount = bytes / Math.pow(1024, exponent);
        var formatted = (amount >= 100 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(2));
        formatted = formatted.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
        return formatted + ' ' + units[exponent];
    }

    function parseRouterOSTime(value) {
        var text = clean(value).toLowerCase().replace(/\s+/g, '');
        if (!text) return null;
        if (/^\d+$/.test(text)) return Number(text);

        var total = 0;
        var prefix = text.match(/^(?:(\d+)w)?(?:(\d+)d)?/);
        if (prefix) {
            total += Number(prefix[1] || 0) * 604800;
            total += Number(prefix[2] || 0) * 86400;
            text = text.slice(prefix[0].length);
        }
        if (!text) return total;

        var colon = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
        if (colon) return total + Number(colon[1]) * 3600 + Number(colon[2]) * 60 + Number(colon[3] || 0);

        var tokenPattern = /(\d+)(h|m|s)/g;
        var consumed = '';
        var match;
        while ((match = tokenPattern.exec(text)) !== null) {
            consumed += match[0];
            if (match[2] === 'h') total += Number(match[1]) * 3600;
            if (match[2] === 'm') total += Number(match[1]) * 60;
            if (match[2] === 's') total += Number(match[1]);
        }
        return consumed === text ? total : null;
    }

    function isExplicitZeroTime(value) {
        var text = clean(value).toLowerCase();
        return /^(?:0|0s|00:00|00:00:00)$/.test(text);
    }

    function formatClock(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = seconds % 60;
        function pad(number) { return number < 10 ? '0' + number : String(number); }
        return (days ? days + 'd ' : '') + pad(hours) + ':' + pad(minutes) + ':' + pad(secs);
    }

    function formatTimeArabic(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        var secs = seconds % 60;
        var parts = [];
        if (days) parts.push(days + ' يوم');
        if (hours) parts.push(hours + ' ساعة');
        if (minutes && !days) parts.push(minutes + ' دقيقة');
        if (!days && !hours && !minutes) parts.push(secs + ' ثانية');
        return parts.join(' و ');
    }

    function combinedGigawords(lowValue, gigaValue) {
        var low = parseUnsigned(lowValue);
        var giga = parseUnsigned(gigaValue);
        if ((low === null || low === 0) && (giga === null || giga === 0)) return null;
        return (giga || 0) * GIGAWORD_BYTES + (low || 0);
    }

    function findPackageToken(value) {
        var normalized = value.toUpperCase();
        var keys = Object.keys(PACKAGES);
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            var expression = new RegExp('(^|[^A-Z0-9])' + key + '([^A-Z0-9]|$)');
            if (expression.test(normalized)) return key;
        }
        return null;
    }

    function packageByBytes(bytes) {
        if (bytes === null) return null;
        var keys = Object.keys(PACKAGES);
        for (var i = 0; i < keys.length; i += 1) {
            if (PACKAGES[keys[i]].bytes === bytes) return keys[i];
        }
        return null;
    }

    function renderProgress(remaining, limit) {
        var box = document.getElementById('progress-box');
        if (!box) return;
        if (limit === null || limit <= 0 || remaining < 0 || remaining > limit) {
            box.style.display = 'none';
            return;
        }
        var used = limit - remaining;
        var percent = Math.round((used / limit) * 100);
        box.style.display = 'block';
        var fill = document.getElementById('progress-bar-fill');
        if (fill) fill.style.width = percent + '%';
        setText('progress-percent-text', 'مستهلك ' + percent + '%');
        setText('progress-used-text', 'المستهلك من الحد المحلي: ' + formatBytes(used));
        setText('progress-total-text', 'الحد المحلي: ' + formatBytes(limit));
    }

    var username = decodeTemplate(source.username) || 'غير متاح';
    var ip = decodeTemplate(source.ip) || 'غير متاح';
    var mac = decodeTemplate(source.mac) || 'غير متاح';
    setText('user-display', username);
    setText('modal-username', username);
    setText('ip-display', ip);
    setText('modal-ip', ip);
    setText('mac-display', mac);
    setText('modal-mac', mac);

    var loggedIn = decodeTemplate(source.loggedIn).toLowerCase();
    var sessionLabel = 'حالة الجلسة غير متاحة';
    if (loggedIn === 'yes') sessionLabel = 'جلسة HotSpot مصادق عليها';
    if (loggedIn === 'no') sessionLabel = 'لا توجد جلسة HotSpot مصادق عليها';
    setText('connection-status', sessionLabel);
    setText('modal-session-status', sessionLabel);
    var statusDot = document.getElementById('session-status-dot');
    var statusText = document.getElementById('connection-status');
    if (loggedIn === 'yes') {
        if (statusDot) {
            statusDot.style.background = '#4caf50';
            statusDot.style.boxShadow = '0 0 12px rgba(76, 175, 80, 0.7)';
        }
        if (statusText) statusText.style.color = '#1b5e20';
    } else if (loggedIn === 'no') {
        if (statusDot) {
            statusDot.style.background = '#c62828';
            statusDot.style.boxShadow = '0 0 12px rgba(198, 40, 40, 0.5)';
        }
        if (statusText) statusText.style.color = '#b71c1c';
    }

    var bytesIn = parseUnsigned(source.bytesIn);
    var bytesOut = parseUnsigned(source.bytesOut);
    var hasSessionCounters = bytesIn !== null || bytesOut !== null;
    var sessionUsed = (bytesIn || 0) + (bytesOut || 0);
    setText('download-val', bytesOut === null ? 'غير متاح' : formatBytes(bytesOut));
    setText('upload-val', bytesIn === null ? 'غير متاح' : formatBytes(bytesIn));
    setText('data-used', hasSessionCounters ? formatBytes(sessionUsed) : 'غير متاح');
    setText('modal-session-used', hasSessionCounters ? formatBytes(sessionUsed) : 'غير متاح');
    setText('data-used-sub', 'تنزيل: ' + (bytesOut === null ? 'غير متاح' : formatBytes(bytesOut)) + ' | رفع: ' + (bytesIn === null ? 'غير متاح' : formatBytes(bytesIn)));

    var radiusTotalLimit = combinedGigawords(source.radiusTotalLimitLow, source.radiusTotalLimitGiga);
    var radiusRecvLimit = combinedGigawords(source.radiusRecvLimitLow, source.radiusRecvLimitGiga);
    var radiusXmitLimit = combinedGigawords(source.radiusXmitLimitLow, source.radiusXmitLimitGiga);
    var radiusGroup = decodeTemplate(source.radiusGroup);
    var radiusClass = decodeTemplate(source.radiusClass);
    var packageKey = findPackageToken(radiusClass) || findPackageToken(radiusGroup);
    var packageConfidence = packageKey ? 'confirmed' : '';
    var inferredLimit = radiusTotalLimit || radiusRecvLimit || radiusXmitLimit;
    if (!packageKey) {
        packageKey = packageByBytes(inferredLimit);
        if (packageKey) packageConfidence = 'inferred';
    }
    var activePackage = packageKey ? PACKAGES[packageKey] : null;
    if (activePackage) {
        var confidenceText = packageConfidence === 'confirmed' ? 'موثقة عبر سمة RADIUS' : 'مستدل عليها من حد RADIUS';
        setText('active-pkg-text', activePackage.name + ' — ' + confidenceText);
        setText('modal-pkg-name', activePackage.name + ' (' + confidenceText + ')');
        setText('package-total-val', formatBytes(activePackage.bytes));
        setText('modal-pkg-total', formatBytes(activePackage.bytes) + '؛ صلاحية مرجعية: ' + activePackage.validity + ' من أول تفعيل');
    } else {
        setText('active-pkg-text', 'لم يتم التعرف على الباقة');
        setText('modal-pkg-name', 'لم يتم التعرف على الباقة');
        var receivedLimitText = inferredLimit === null ? 'غير متاح' : formatBytes(inferredLimit) + ' (حد RADIUS مستلم، ليس رصيداً متبقياً)';
        setText('package-total-val', receivedLimitText);
        setText('modal-pkg-total', receivedLimitText);
    }

    var remainTotal = parseUnsigned(source.remainBytesTotal);
    var remainIn = parseUnsigned(source.remainBytesIn);
    var remainOut = parseUnsigned(source.remainBytesOut);
    var limitTotal = parseUnsigned(source.limitBytesTotal);
    if (remainTotal !== null) {
        setText('data-rem', formatBytes(remainTotal));
        setText('data-rem-sub', remainTotal === 0 ? 'الحد المحلي الإجمالي مستنفد' : 'رصيد إجمالي متبقٍ يقدمه HotSpot');
        setText('modal-pkg-rem', formatBytes(remainTotal) + ' (إجمالي موثوق من HotSpot)');
        renderProgress(remainTotal, limitTotal);
    } else if (remainOut !== null || remainIn !== null) {
        var downloadRemaining = remainOut === null ? 'غير متاح' : formatBytes(remainOut);
        var uploadRemaining = remainIn === null ? 'غير متاح' : formatBytes(remainIn);
        setText('data-rem', 'حصص اتجاهية منفصلة');
        setText('data-rem-sub', 'تنزيل: ' + downloadRemaining + ' | رفع: ' + uploadRemaining);
        setText('modal-pkg-rem', 'تنزيل: ' + downloadRemaining + ' | رفع: ' + uploadRemaining);
        renderProgress(-1, null);
    } else {
        setText('data-rem', 'غير متاح');
        setText('data-rem-sub', 'لم يقدّم HotSpot رصيداً متبقياً موثوقاً');
        setText('modal-pkg-rem', 'غير متاح من قالب HotSpot');
        renderProgress(-1, null);
    }

    var uptimeSeconds = parseUnsigned(source.uptimeSecs);
    if (uptimeSeconds === null) uptimeSeconds = parseRouterOSTime(decodeTemplate(source.uptime));
    var hasUptime = uptimeSeconds !== null;
    if (!hasUptime) uptimeSeconds = 0;

    var leftSeconds = parseUnsigned(source.sessionTimeLeftSecs);
    var leftText = decodeTemplate(source.sessionTimeLeft);
    var timeoutSeconds = parseUnsigned(source.sessionTimeoutSecs);
    var timeoutText = decodeTemplate(source.sessionTimeout);
    var remainingSeconds = null;
    var expired = false;
    if (leftSeconds !== null && leftSeconds > 0) {
        remainingSeconds = leftSeconds;
    } else {
        var parsedLeft = parseRouterOSTime(leftText);
        if (parsedLeft !== null && parsedLeft > 0) remainingSeconds = parsedLeft;
        else if (isExplicitZeroTime(leftText)) expired = true;
    }
    if (remainingSeconds === null && !expired) {
        if (timeoutSeconds !== null && timeoutSeconds > 0) remainingSeconds = timeoutSeconds;
        else {
            var parsedTimeout = parseRouterOSTime(timeoutText);
            if (parsedTimeout !== null && parsedTimeout > 0) remainingSeconds = parsedTimeout;
            else if (isExplicitZeroTime(timeoutText)) expired = true;
        }
    }

    function renderUptime() {
        var value = hasUptime ? formatClock(uptimeSeconds) : 'غير متاح';
        setText('uptime-display', value);
        setText('modal-uptime', value);
        setText('uptime-sub', hasUptime ? 'مدة جلسة HotSpot الحالية' : 'لم يقدّم HotSpot مدة الجلسة');
    }

    function renderRemainingTime() {
        if (remainingSeconds !== null && remainingSeconds > 0) {
            setText('time-rem', formatTimeArabic(remainingSeconds));
            setText('time-rem-sub', 'متبقي للجلسة: ' + formatClock(remainingSeconds));
        } else if (expired || remainingSeconds === 0) {
            setText('time-rem', 'انتهى وقت الجلسة');
            setText('time-rem-sub', 'قيمة انتهاء صريحة من HotSpot');
        } else {
            setText('time-rem', 'غير متاح');
            setText('time-rem-sub', 'لا يوجد حد زمني ظاهر للجلسة الحالية');
        }
    }

    renderUptime();
    renderRemainingTime();
    setText('subscription-expiry', 'تاريخ انتهاء الاشتراك غير متاح');

    window.setInterval(function () {
        if (hasUptime) {
            uptimeSeconds += 1;
            renderUptime();
        }
        if (remainingSeconds !== null && remainingSeconds > 0) {
            remainingSeconds -= 1;
            if (remainingSeconds === 0) expired = true;
            renderRemainingTime();
        }
    }, 1000);

    window.AKNET_STATUS_READY = true;
}(window, document));

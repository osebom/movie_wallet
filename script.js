(function () {
    'use strict';

    const CARD_TILT_MAX = 18;
    const CARD_TILT_SMOOTH = 0.12;

    const homeView = document.getElementById('homeView');
    const detailView = document.getElementById('detailView');
    const backBtn = document.getElementById('backBtn');
    const cardsStack = document.getElementById('cardsStack');
    const stage = document.getElementById('cardStage');
    const card = document.getElementById('walletCard');
    const cardInner = card && card.querySelector('.card-inner');
    const dotsContainer = document.getElementById('cardDots');
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.dot') : [];

    if (!card || !cardInner) return;

    let cardsData = [];
    try {
        const el = document.getElementById('cardsDataJson');
        if (el && el.textContent) cardsData = JSON.parse(el.textContent.trim());
    } catch (_) {}

    if (!cardsData.length) {
        cardsData = [
            { bg: 'frankenstein.png', date: 'FRI, DEC 15', time: '7:30PM', seat: 'A-12', type: 'IMAX General' },
            { bg: 'aliens.jpeg', date: 'SAT, DEC 16', time: '9:15PM', seat: 'B-8', type: 'Standard' },
            { bg: 'starwars.jpeg', date: 'SUN, DEC 17', time: '6:00PM', seat: 'C-15', type: 'IMAX General' },
            { bg: 'avenger.jpeg', date: 'MON, DEC 18', time: '8:45PM', seat: 'D-5', type: 'Premium' },
            { bg: 'matrixes.jpeg', date: 'TUE, DEC 19', time: '10:00PM', seat: 'E-9', type: 'IMAX General' }
        ];
    }

    var CARD_HEIGHT = 463;
    var STACK_OFFSET_Y = 44;

    function buildCardsStack() {
        if (!cardsStack) return;
        cardsStack.innerHTML = '';
        var wrapper = document.createElement('div');
        wrapper.className = 'card-stack-wrapper';
        var n = cardsData.length;
        wrapper.style.setProperty('--stack-n', String(n));
        wrapper.style.setProperty('--stack-offset-y', STACK_OFFSET_Y + 'px');
        cardsData.forEach(function (data, i) {
            var isDark = data.bg.indexOf('starwars') !== -1;
            var scaler = document.createElement('div');
            scaler.className = 'card-stack-scaler';
            if (isDark) scaler.setAttribute('data-theme', 'dark-text');
            var inner = document.createElement('div');
            inner.className = 'card-inner';
            inner.style.backgroundImage = 'url(' + encodeURI(data.bg) + ')';
            inner.style.backgroundPosition = 'center';
            inner.style.backgroundSize = 'cover';
            inner.innerHTML =
                '<div class="ticket-logo"><img src="cinplex.png" alt="Cineplex"></div>' +
                '<div class="ticket-date-time"><div class="ticket-date">' + (data.date || '') + '</div><div class="ticket-time">' + (data.time || '') + '</div></div>' +
                '<div class="ticket-type"><div class="ticket-type-label">TICKET TYPE</div><div class="ticket-type-value">' + (data.type || '') + '</div></div>' +
                '<div class="ticket-content"></div>' +
                '<div class="ticket-qr"><img src="qrcode.png" alt="QR Code"></div>' +
                '<div class="ticket-seat"><div class="seat-label">SEAT</div><div class="seat-number">' + (data.seat || '') + '</div></div>' +
                '<div class="glass-overlay"></div>';
            scaler.appendChild(inner);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-stack-item';
            btn.setAttribute('data-index', String(i));
            btn.setAttribute('aria-label', 'View ticket ' + (i + 1));
            btn.style.setProperty('--stack-i', String(i));
            btn.style.zIndex = String(i);
            btn.appendChild(scaler);
            wrapper.appendChild(btn);
        });
        cardsStack.appendChild(wrapper);
    }

    buildCardsStack();

    let currentIndex = 0;
    let mouseX = 0, mouseY = 0;
    let targetRotateX = 0, targetRotateY = 0;
    let currentRotateX = 0, currentRotateY = 0;
    let rafId = null;
    let useTilt = false;
    let tiltPermissionAsked = false;

    function isMobileOrTouch() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
    }

    function applyCardTransform(rx, ry) {
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function animateTilt() {
        currentRotateX = lerp(currentRotateX, targetRotateX, CARD_TILT_SMOOTH);
        currentRotateY = lerp(currentRotateY, targetRotateY, CARD_TILT_SMOOTH);
        applyCardTransform(currentRotateX, currentRotateY);
        if (Math.abs(currentRotateX - targetRotateX) > 0.01 || Math.abs(currentRotateY - targetRotateY) > 0.01) {
            rafId = requestAnimationFrame(animateTilt);
        } else {
            rafId = null;
        }
    }

    function scheduleTiltUpdate() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(animateTilt);
    }

    function setTargetTilt(rx, ry) {
        targetRotateX = Math.max(-CARD_TILT_MAX, Math.min(CARD_TILT_MAX, rx));
        targetRotateY = Math.max(-CARD_TILT_MAX, Math.min(CARD_TILT_MAX, ry));
        if (!useTilt) scheduleTiltUpdate();
    }

    function resetTilt() {
        targetRotateX = 0;
        targetRotateY = 0;
        if (!useTilt) scheduleTiltUpdate();
    }

    // ---- Web: hover to move card ----
    function getCardRect() {
        return card.getBoundingClientRect();
    }

    function onMouseMove(e) {
        if (useTilt) return;
        const rect = getCardRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const x = (e.clientX - cx) / (rect.width / 2);
        const y = (e.clientY - cy) / (rect.height / 2);
        setTargetTilt(-y * CARD_TILT_MAX, x * CARD_TILT_MAX);
    }

    function onMouseLeave() {
        if (useTilt) return;
        resetTilt();
    }

    stage.addEventListener('mousemove', onMouseMove, { passive: true });
    stage.addEventListener('mouseleave', onMouseLeave);

    // ---- Mobile: device tilt ----
    function setupDeviceTilt() {
        if (!window.DeviceOrientationEvent) return;

        const requestPermission = window.DeviceOrientationEvent.requestPermission;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        function onOrientation(e) {
            if (e.beta == null || e.gamma == null) return;
            const beta = e.beta;
            const gamma = e.gamma;
            const ry = Math.max(-90, Math.min(90, gamma)) * 0.3;
            const rx = (beta - 45) * 0.4;
            setTargetTilt(rx, ry);
            currentRotateX = targetRotateX;
            currentRotateY = targetRotateY;
            applyCardTransform(currentRotateX, currentRotateY);
        }

        function startTilt() {
            useTilt = true;
            var hint = document.getElementById('iosHint');
            if (hint) hint.style.display = 'none';
            window.addEventListener('deviceorientation', onOrientation, { passive: true });
        }

        if (isIOS && typeof requestPermission === 'function' && !tiltPermissionAsked) {
            tiltPermissionAsked = true;
            var hint = document.getElementById('iosHint');
            if (hint) hint.style.display = 'block';
            function askOnce() {
                document.body.removeEventListener('click', askOnce);
                if (hint) hint.style.display = 'none';
                requestPermission()
                    .then(function (p) {
                        if (p === 'granted') startTilt();
                    })
                    .catch(function () {});
            }
            document.body.addEventListener('click', askOnce, { once: true });
            return;
        }

        if (!isIOS) {
            startTilt();
        }
    }

    if (isMobileOrTouch()) {
        setupDeviceTilt();
    }

    // ---- Card content from data ----
    function fillCard(index) {
        const data = cardsData[index];
        if (!data) return;
        const inner = card.querySelector('.card-inner');
        inner.style.backgroundImage = `url(${encodeURI(data.bg)})`;
        inner.style.backgroundPosition = 'center';
        inner.style.backgroundSize = 'cover';
        card.querySelector('.ticket-date').textContent = data.date;
        card.querySelector('.ticket-time').textContent = data.time;
        card.querySelector('.seat-number').textContent = data.seat;
        card.querySelector('.ticket-type-value').textContent = data.type;
        card.setAttribute('data-theme', data.bg.indexOf('starwars') !== -1 ? 'dark-text' : '');
        card.setAttribute('data-index', String(index));
    }

    function setActiveDot(index) {
        dots.forEach(function (dot, i) {
            dot.classList.toggle('is-active', i === index);
        });
    }

    function goToCard(index) {
        index = Math.max(0, Math.min(index, cardsData.length - 1));
        currentIndex = index;
        fillCard(index);
        setActiveDot(index);
    }

    dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            goToCard(i);
        });
    });

    function showView(name) {
        if (name === 'home') {
            if (homeView) homeView.classList.add('is-active');
            if (detailView) detailView.classList.remove('is-active');
        } else {
            if (homeView) homeView.classList.remove('is-active');
            if (detailView) detailView.classList.add('is-active');
        }
    }

    function openCardDetail(index) {
        goToCard(index);
        showView('detail');
    }

    if (backBtn) {
        backBtn.addEventListener('click', function () {
            showView('home');
        });
    }

    if (cardsStack) {
        cardsStack.addEventListener('click', function (e) {
            var item = e.target.closest('.card-stack-item');
            if (item) {
                var i = parseInt(item.getAttribute('data-index'), 10);
                if (!isNaN(i)) openCardDetail(i);
            }
        });
    }

    goToCard(0);
})();

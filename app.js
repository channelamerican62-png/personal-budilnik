/* ==========================================================================
   ChronoGuard - Web App Frontend API & Telegram Bot Real-Time Sync
   API Endpoint: https://sizning-botingiz.onrender.com/api
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    // DIQQAT: Render.com ga ulaganingizdan so'ng, o'zingizning API havolangizni shu yerga kiriting!
    const API_BASE = 'https://chronoguard-backend.onrender.com/api'; 
    // const API_BASE = 'http://localhost:3000/api'; // (Lokal test uchun)

    // --- PWA SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Registration error:', err));
    }

    // --- DARK MODE THEME SYSTEM ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const themeToggleText = document.getElementById('themeToggleText');

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('chrono_theme', theme);
        if (theme === 'dark') {
            if (themeToggleIcon) themeToggleIcon.className = 'fa-solid fa-sun';
            if (themeToggleText) themeToggleText.textContent = 'Kunduzgi';
        } else {
            if (themeToggleIcon) themeToggleIcon.className = 'fa-solid fa-moon';
            if (themeToggleText) themeToggleText.textContent = 'Tungi';
        }
    }

    const savedTheme = localStorage.getItem('chrono_theme') || 'afternoon';
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'afternoon' : 'dark';
            applyTheme(nextTheme);
        });
    }

    // --- PUSH NOTIFICATION SYSTEM ---
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        showToast("✅ Bildirishnomalar yoqildi!", 'success');
                        notificationBtn.style.color = '#10b981';
                        new Notification("ChronoGuard", {
                            body: "Bildirishnomalar muvaffaqiyatli yoqildi!",
                            icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/hourglass-half.svg"
                        });
                    } else {
                        showToast("❌ Bildirishnomalarga ruxsat berilmadi", 'warning');
                    }
                });
            } else {
                showToast("Brauzeringiz bildirishnomalarni qo'llab-quvvatlamaydi", 'danger');
            }
        });
    }

    function sendPushNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/hourglass-half.svg"
            });
        }
    }
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    // --- SAVED ACCOUNTS LOGIC ---
    function getSavedAccounts() {
        try { return JSON.parse(localStorage.getItem('chrono_saved_accounts')) || []; }
        catch(e) { return []; }
    }
    function saveAccount(email, name) {
        const accounts = getSavedAccounts();
        const existing = accounts.findIndex(a => a.email === email);
        const entry = { email, name: name || email.split('@')[0], lastLogin: Date.now() };
        if (existing >= 0) accounts[existing] = entry;
        else accounts.unshift(entry);
        // Keep only last 5 accounts
        localStorage.setItem('chrono_saved_accounts', JSON.stringify(accounts.slice(0, 5)));
    }
    function removeAccount(email) {
        const accounts = getSavedAccounts().filter(a => a.email !== email);
        localStorage.setItem('chrono_saved_accounts', JSON.stringify(accounts));
        renderSavedAccounts();
    }
    function renderSavedAccounts() {
        const accounts = getSavedAccounts();
        const section = document.getElementById('savedAccountsSection');
        const list = document.getElementById('savedAccountsList');
        const formSlide = document.getElementById('loginFormSlide');
        if (!section || !list || !formSlide) return;

        if (accounts.length === 0) {
            section.style.display = 'none';
            formSlide.classList.remove('hidden');
            formSlide.classList.add('visible');
            return;
        }

        section.style.display = 'block';
        formSlide.classList.add('hidden');
        formSlide.classList.remove('visible');

        list.innerHTML = accounts.map(acc => {
            const initials = (acc.name || acc.email).slice(0, 2).toUpperCase();
            const timeAgo = acc.lastLogin ? new Date(acc.lastLogin).toLocaleDateString('uz-UZ') : '';
            return `
            <div class="saved-account-card" onclick="window._loginWithSaved('${acc.email}', '${acc.name}')">  
                <div class="account-avatar">${initials}</div>
                <div class="account-info">
                    <span class="account-name">${acc.name}</span>
                    <span class="account-email">${acc.email} · ${timeAgo}</span>
                </div>
                <button class="account-remove-btn" title="Akkauntni ro'yxatdan o'chirish" 
                    onclick="event.stopPropagation(); window._removeAccount('${acc.email}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
        }).join('');
    }

    // Expose helpers to window for inline onclick
    window._loginWithSaved = function(email, name) {
        userName = name;
        localStorage.setItem('chrono_username', name);
        saveAccount(email, name);
        doLoginTransition();
    };
    window._removeAccount = function(email) {
        removeAccount(email);
    };

    const addNewAccountBtn = document.getElementById('addNewAccountBtn');
    if (addNewAccountBtn) {
        addNewAccountBtn.addEventListener('click', () => {
            const formSlide = document.getElementById('loginFormSlide');
            if (formSlide) {
                formSlide.classList.remove('hidden');
                formSlide.classList.add('visible');
            }
        });
    }

    // Render saved accounts on page load
    renderSavedAccounts();

    // Ticker state
    let tickerStarted = false;

    function startTicker() {
        if (tickerStarted) return;
        tickerStarted = true;
        tick();
        setInterval(tick, 1000);
        setInterval(fetchTasksFromAPI, 4000);
    }

    function doLoginTransition() {
        loginScreen.style.animation = "fadeOut 0.5s forwards";
        setTimeout(() => {
            loginScreen.style.display = 'none';
            appScreen.style.display = 'block';
            appScreen.style.animation = "fadeIn 0.5s forwards";
            startTicker();
            updateUserNameUI();
            fetchWeather();
            if (typeof renderCalendar === 'function') renderCalendar();
        }, 500);
    }

    function handleLogin(e) {
        if (e) e.preventDefault();
        
        const emailInput = document.getElementById('loginEmail');
        const pwdInput = document.getElementById('loginPwd');
        
        if (emailInput && pwdInput) {
            const email = emailInput.value.trim();
            const pwd = pwdInput.value.trim();
            
            if (!email) {
                alert("Kechirasiz, tizimga kirish uchun avval Email manzilingizni kiriting!");
                return;
            }
            if (!pwd) {
                alert("Iltimos, parolingizni ham kiriting!");
                return;
            }
            if (pwd.length < 4) {
                alert("Parolingiz juda qisqa! Kamida 4 ta belgi bo'lishi kerak.");
                return;
            }
            
            const newUserName = email.split('@')[0];
            userName = newUserName;
            localStorage.setItem('chrono_username', userName);
            saveAccount(email, newUserName);
        }

        doLoginTransition();
    }

    const mockSignInBtn = document.getElementById('mockSignInBtn');
    if(mockSignInBtn) mockSignInBtn.addEventListener('click', handleLogin);

    // --- GOOGLE IDENTITY SERVICES ---
    window.handleCredentialResponse = function(response) {
        try {
            const responsePayload = decodeJwtResponse(response.credential);
            const googleId = responsePayload.sub;
            const name = responsePayload.name;
            const email = responsePayload.email || (googleId + '@google.com');
            
            localStorage.setItem('chrono_userid', googleId);
            localStorage.setItem('chrono_username', name);
            
            userId = googleId;
            userName = name;
            saveAccount(email, name);
            
            doLoginTransition();
            
            initServerAccount().then(() => {
                updateUserNameUI();
                updateStatsUI();
                renderTasks();
                renderFocusCard();
                if (typeof renderCalendar === 'function') renderCalendar();
                if (typeof showToast === 'function') {
                    showToast(`Xush kelibsiz, ${name}!`, 'success');
                }
            });
        } catch(err) {
            console.error('Google login error:', err);
        }
    };

    function decodeJwtResponse(token) {
        let base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    function initGoogleAuth() {
        if(typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: "1047469391776-fa96ul1eo5t3cc3i6csk71enmuh6lojv.apps.googleusercontent.com",
                callback: window.handleCredentialResponse
            });
            const btnContainer = document.getElementById("googleBtnContainer");
            if (btnContainer) {
                google.accounts.id.renderButton(
                    btnContainer,
                    { theme: "outline", size: "large", width: 280, text: "signin_with" }
                );
            }
        }
    }

    // Try init immediately or wait for script load
    if (typeof google !== 'undefined') {
        initGoogleAuth();
    } else {
        setTimeout(initGoogleAuth, 1000);
    }

    // --- State Management ---
    let calViewYear = new Date().getFullYear();
    let calViewMonth = new Date().getMonth();
    let calSelectedDate = null;
    let rankMode = 'weekly';
    const UZ_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktyabr','Noyabr','Dekabr'];

    let userId = localStorage.getItem('chrono_userid') || ('user_' + Date.now());
    let userName = localStorage.getItem('chrono_username') || 'Ali';
    let syncCode = localStorage.getItem('chrono_synccode') || '';
    let tasks = [];
    
    // Per-user discipline score (New users start at 0%)
    const userScoreKey = 'chrono_score_' + userName;
    let disciplineScore = localStorage.getItem(userScoreKey) !== null 
        ? parseInt(localStorage.getItem(userScoreKey)) 
        : 0;
    let disciplineChartInstance = null;

    let currentFilter = 'all';
    let activeWarningTaskId = null;
    let audioCtx = null;

    // User GPS Location (Default: Tashkent Center)
    let userCoords = [41.2995, 69.2401]; 
    let formMap = null;
    let formUserMarker = null;
    let formDestMarker = null;
    let formRouteLine = null;

    let modalMap = null;
    let modalUserMarker = null;
    let modalDestMarker = null;
    let modalRouteLine = null;

    // Known Locations Dictionary
    const knownLocations = {
        "golds gym": { name: "Gold's Gym Fitness, Toshkent", lat: 41.3111, lng: 69.2797 },
        "najot ta'lim": { name: "Najot Ta'lim Universiteti, Chilonzor", lat: 41.2858, lng: 69.2045 },
        "najot talim": { name: "Najot Ta'lim Universiteti, Chilonzor", lat: 41.2858, lng: 69.2045 },
        "it park": { name: "Toshkent IT Park, Mirzo Ulug'bek", lat: 41.3385, lng: 69.3348 },
        "tdtu": { name: "Toshkent Davlat Texnika Universiteti", lat: 41.3533, lng: 69.2081 },
        "magic city": { name: "Magic City Park, Toshkent", lat: 41.3038, lng: 69.2468 }
    };

    // --- DOM Elements ---
    const liveTimeEl = document.getElementById('liveTime');
    const liveDateEl = document.getElementById('liveDate');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const editNameBtn = document.getElementById('editNameBtn');
    const nameModalBackdrop = document.getElementById('nameModalBackdrop');
    const nameInputModal = document.getElementById('nameInputModal');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const closeNameModal = document.getElementById('closeNameModal');
    const logoutBtn = document.getElementById('logoutBtn');

    // Telegram Sync Elements
    const telegramSyncBtn = document.getElementById('telegramSyncBtn');
    const syncModalBackdrop = document.getElementById('syncModalBackdrop');
    const closeSyncModal = document.getElementById('closeSyncModal');
    const syncCodeDisplay = document.getElementById('syncCodeDisplay');
    const syncCodeInput = document.getElementById('syncCodeInput');
    const verifySyncCodeBtn = document.getElementById('verifySyncCodeBtn');



    // Map Modal Elements
    const mapModalBackdrop = document.getElementById('mapModalBackdrop');
    const closeMapModal = document.getElementById('closeMapModal');
    const mapModalTitle = document.getElementById('mapModalTitle');
    const mapModalSubtitle = document.getElementById('mapModalSubtitle');
    const modalRouteStats = document.getElementById('modalRouteStats');
    const openGoogleMapsDirectBtn = document.getElementById('openGoogleMapsDirectBtn');

    // Stats Elements
    const disciplineScoreEl = document.getElementById('disciplineScore');
    const scoreProgressBar = document.getElementById('scoreProgressBar');
    const scoreStatusBadge = document.getElementById('scoreStatusBadge');
    const totalTasksCountEl = document.getElementById('totalTasksCount');
    const completedTasksCountEl = document.getElementById('completedTasksCount');
    const lateTasksCountEl = document.getElementById('lateTasksCount');

    // Form Elements
    const taskForm = document.getElementById('taskForm');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskTimeInput = document.getElementById('taskTime');
    const bufferTimeSelect = document.getElementById('bufferTime');
    const taskLocationInput = document.getElementById('taskLocation');
    const strictnessLevelSelect = document.getElementById('strictnessLevel');
    const presetLocBtn = document.getElementById('presetLocBtn');
    const routeInfoText = document.getElementById('routeInfoText');

    // Focus & Timeline Elements
    const focusContentEl = document.getElementById('focusContent');
    const tasksListEl = document.getElementById('tasksList');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Warning Modal Elements
    const warningModalBackdrop = document.getElementById('warningModalBackdrop');
    const warningSpeechText = document.getElementById('warningSpeechText');
    const lateTimerDisplay = document.getElementById('lateTimerDisplay');
    const warningTaskDetails = document.getElementById('warningTaskDetails');
    const arrivedNowBtn = document.getElementById('arrivedNowBtn');
    const onMyWayBtn = document.getElementById('onMyWayBtn');
    const missedEventBtn = document.getElementById('missedEventBtn');
    const toastContainer = document.getElementById('toastContainer');



    // --- Safe Local Storage Load ---
    try {
        tasks = JSON.parse(localStorage.getItem('chrono_tasks')) || [];
    } catch(e) {
        tasks = [];
    }
    
    initFormMap();
    updateUserNameUI();
    updateStatsUI();
    renderTasks();
    renderFocusCard();
    if (typeof renderCalendar === 'function') renderCalendar();

    // NOTE: tick() and setInterval are started INSIDE doLoginTransition()
    // This ensures the clock only runs after the user has logged in.
    // app.js version: 6

    // --- Init Account API Sync (Non-blocking) ---
    initServerAccount();

    // --- Geolocation Init (get coords for map immediately) ---
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                updateFormMapRoute(taskLocationInput.value || "Gold's Gym Fitness, Toshkent");
            },
            () => console.log("User GPS fallback")
        );
    }

    // --- Weather Fetch (runs after login) ---
    async function fetchWeather() {
        const weatherBadge = document.getElementById('weatherBadge');
        const weatherIcon = document.getElementById('weatherIcon');
        const weatherTemp = document.getElementById('weatherTemp');
        const weatherCity = document.getElementById('weatherCity');
        if (!weatherBadge) return;

        const weatherCodes = {
            0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
            45: '🌫️', 48: '🌫️',
            51: '🌦️', 53: '🌦️', 55: '🌧️',
            61: '🌧️', 63: '🌧️', 65: '🌧️',
            71: '❄️', 73: '❄️', 75: '❄️',
            80: '🌦️', 81: '🌦️', 82: '⛈️',
            95: '⛈️', 96: '⛈️', 99: '⛈️'
        };

        function showWeather(lat, lon) {
            Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`).then(r => r.json()),
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`).then(r => r.json())
            ]).then(([wData, geoData]) => {
                if (wData && wData.current_weather) {
                    const temp = Math.round(wData.current_weather.temperature);
                    const code = wData.current_weather.weathercode;
                    const icon = weatherCodes[code] || '🌡️';
                    const city = geoData?.address?.city || geoData?.address?.town || geoData?.address?.village || geoData?.address?.county || 'Joylashuv';

                    if (weatherIcon) weatherIcon.textContent = icon;
                    if (weatherTemp) weatherTemp.textContent = `${temp}°C`;
                    if (weatherCity) weatherCity.textContent = city;
                    if (weatherBadge) weatherBadge.style.display = 'flex';

                    // Update userCoords for map usage
                    userCoords = [lat, lon];
                }
            }).catch(err => console.log('Weather fetch error:', err));
        }

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => showWeather(pos.coords.latitude, pos.coords.longitude),
                () => {
                    // Fallback: Toshkent coordinates
                    showWeather(41.2995, 69.2401);
                }
            );
        } else {
            showWeather(41.2995, 69.2401);
        }
    }

    // --- Mini Calendar Logic ---
    function getTaskDotColors(dateStr) {
        // BUG #2 FIX: Use local date string (not UTC) for comparison
        // dateStr format: 'YYYY-MM-DD' in local timezone
        const dayTasks = tasks.filter(t => {
            if (!t.createdAt) return false;
            // Convert ISO string to local date string for correct timezone comparison
            const taskLocalDate = new Date(t.createdAt);
            const localStr = `${taskLocalDate.getFullYear()}-${String(taskLocalDate.getMonth()+1).padStart(2,'0')}-${String(taskLocalDate.getDate()).padStart(2,'0')}`;
            return localStr === dateStr;
        });
        if (dayTasks.length === 0) return [];
        const colors = [];
        if (dayTasks.some(t => t.status === 'completed')) colors.push('#10b981');
        if (dayTasks.some(t => t.status === 'late' || t.status === 'missed')) colors.push('#ef4444');
        if (dayTasks.some(t => t.status === 'pending')) colors.push('#f59e0b');
        return colors.slice(0, 3);
    }

    function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const label = document.getElementById('calMonthYear');
        if (!grid || !label) return;

        label.textContent = `${UZ_MONTHS[calViewMonth]} ${calViewYear}`;

        const today = new Date();
        const firstDay = new Date(calViewYear, calViewMonth, 1);
        // Monday=0 start
        let startDow = firstDay.getDay(); // 0=Sun
        startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon-start

        const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(calViewYear, calViewMonth, 0).getDate();

        grid.innerHTML = '';

        // Prev month filler
        for (let i = startDow - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<span class="cal-day-num">${day}</span>`;
            grid.appendChild(cell);
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            const isToday = (d === today.getDate() && calViewMonth === today.getMonth() && calViewYear === today.getFullYear());
            const dateStr = `${calViewYear}-${String(calViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dots = getTaskDotColors(dateStr);
            
            let cls = 'cal-day-cell';
            if (isToday) cls += ' today';
            if (calSelectedDate === dateStr) cls += ' selected';
            if (dots.length > 0) cls += ' has-tasks';
            
            cell.className = cls;
            cell.innerHTML = `
                <span class="cal-day-num">${d}</span>
                ${dots.length > 0 && !isToday ? `<div class="cal-dots">${dots.map(c => `<span class="cal-dot" style="background:${c}"></span>`).join('')}</div>` : ''}
            `;

            cell.addEventListener('click', () => {
                if (calSelectedDate === dateStr) {
                    // BUG #4 FIX: Deselect and show all tasks
                    calSelectedDate = null;
                    currentFilter = 'all';
                    // Reset filter button UI
                    filterBtns.forEach(b => b.classList.remove('active'));
                    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
                    if (allBtn) allBtn.classList.add('active');
                } else {
                    calSelectedDate = dateStr;
                }
                renderCalendar();
                // BUG #4 FIX: Actually re-render tasks filtered by selected date
                renderTasksByDate(calSelectedDate);
            });

            grid.appendChild(cell);
        }

        // Next month filler
        const totalCells = grid.children.length;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<span class="cal-day-num">${i}</span>`;
            grid.appendChild(cell);
        }
    }

    const calPrevBtn = document.getElementById('calPrevBtn');
    const calNextBtn = document.getElementById('calNextBtn');
    if (calPrevBtn) calPrevBtn.addEventListener('click', () => {
        calViewMonth--;
        if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
        renderCalendar();
    });
    if (calNextBtn) calNextBtn.addEventListener('click', () => {
        calViewMonth++;
        if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
        renderCalendar();
    });

    // Initial calendar render
    renderCalendar();

    // --- API Sync Functions ---
    async function initServerAccount() {
        try {
            const resp = await fetch(`${API_BASE}/auth/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, userName })
            });
            const data = await resp.json();
            if (data.success && data.account) {
                userId = data.account.id;
                userName = data.account.name;
                syncCode = data.account.syncCode;
                disciplineScore = data.account.disciplineScore || 100;
                tasks = data.account.tasks || [];

                localStorage.setItem('chrono_userid', userId);
                localStorage.setItem('chrono_username', userName);
                localStorage.setItem('chrono_synccode', syncCode);

                syncCodeDisplay.textContent = syncCode;
            }
        } catch (e) {
            console.log("Server API Offline, using Local Storage mode");
            try {
                tasks = JSON.parse(localStorage.getItem('chrono_tasks')) || [];
            } catch(err) {
                tasks = [];
            }
            disciplineScore = parseInt(localStorage.getItem('chrono_score')) || 100;
        }
    }

    async function fetchTasksFromAPI() {
        try {
            const resp = await fetch(`${API_BASE}/tasks?userId=${userId}`);
            const data = await resp.json();
            if (data.success && data.account) {
                tasks = data.account.tasks || [];
                disciplineScore = data.account.disciplineScore || 100;
                renderTasks();
                renderFocusCard();
                updateStatsUI();
            }
        } catch (e) {}
    }

    // --- Telegram Sync Modal Event Listeners ---
    // BUG #3 FIX: use optional chaining to prevent crash if element is null
    telegramSyncBtn?.addEventListener('click', () => {
        if (syncCodeDisplay) syncCodeDisplay.textContent = syncCode || '782-910';
        syncModalBackdrop?.classList.add('active');
    });

    closeSyncModal?.addEventListener('click', () => {
        syncModalBackdrop?.classList.remove('active');
    });

    verifySyncCodeBtn.addEventListener('click', async () => {
        const enteredCode = syncCodeInput.value.trim();
        if (!enteredCode) return showToast("Iltimos, Sinxronlash kodini kiriting!", 'warning');

        try {
            const resp = await fetch(`${API_BASE}/sync/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ syncCode: enteredCode, webUserId: userId })
            });
            const data = await resp.json();
            if (data.success && data.account) {
                userId = data.account.id;
                userName = data.account.name;
                syncCode = data.account.syncCode;
                disciplineScore = data.account.disciplineScore;
                tasks = data.account.tasks;

                localStorage.setItem('chrono_userid', userId);
                localStorage.setItem('chrono_username', userName);
                localStorage.setItem('chrono_synccode', syncCode);

                syncModalBackdrop.classList.remove('active');
                updateUserNameUI();
                updateStatsUI();
                renderTasks();
                renderFocusCard();
                showToast("✅ Muvaffaqiyatli sinxronlandi! Telegram botingizdagi ma'lumotlar yuklandi.", 'success');
            } else {
                showToast("❌ Yaroqsiz kod! Tekshirib qayta kiriting.", 'danger');
            }
        } catch (e) {
            showToast("Server bilan aloqa xatosi!", 'danger');
        }
    });



    // Real-time Location Search Listener
    let mapSearchTimeout = null;
    taskLocationInput.addEventListener('input', () => {
        clearTimeout(mapSearchTimeout);
        mapSearchTimeout = setTimeout(() => {
            updateFormMapRoute(taskLocationInput.value.trim());
        }, 500);
    });

    presetLocBtn.addEventListener('click', () => {
        const presets = [
            "Gold's Gym Fitness, Toshkent",
            "Najot Ta'lim Universiteti, Chilonzor",
            "Toshkent IT Park, Mirzo Ulug'bek",
            "Magic City Park, Toshkent"
        ];
        const selected = presets[Math.floor(Math.random() * presets.length)];
        taskLocationInput.value = selected;
        updateFormMapRoute(selected);
        showToast(`Manzil tanlandi: ${selected}`, 'info');
    });

    editNameBtn.addEventListener('click', () => {
        nameInputModal.value = userName;
        nameModalBackdrop?.classList.add('active');
    });

    closeNameModal?.addEventListener('click', () => {
        nameModalBackdrop?.classList.remove('active');
    });

    saveNameBtn?.addEventListener('click', () => {
        const newName = nameInputModal.value.trim();
        if (newName) {
            userName = newName;
            localStorage.setItem('chrono_username', userName);
            updateUserNameUI();
            nameModalBackdrop?.classList.remove('active');
            showToast(`Ismingiz saqlandi: ${userName}`, 'info');
        }
    });

    logoutBtn?.addEventListener('click', () => {
        if (confirm("Hisobdan chiqishni xohlaysizmi?")) {
            localStorage.removeItem('chrono_userid');
            localStorage.removeItem('chrono_username');
            localStorage.removeItem('chrono_synccode');
            localStorage.removeItem('chrono_tasks');
            localStorage.removeItem('chrono_score');
            localStorage.removeItem('chrono_saved_accounts'); // BUG #1 FIX: clear saved accounts on logout
            location.reload();
        }
    });

    closeMapModal.addEventListener('click', () => {
        mapModalBackdrop.classList.remove('active');
    });

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const locationText = taskLocationInput.value.trim();
        const coords = await geocodeLocation(locationText);

        const newTask = {
            id: 'task_' + Date.now(),
            title: taskTitleInput.value.trim(),
            time: taskTimeInput.value,
            location: locationText,
            lat: coords.lat,
            lng: coords.lng,
            bufferTime: parseInt(bufferTimeSelect.value),
            strictness: strictnessLevelSelect.value,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Send to Express API
        try {
            const resp = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, task: newTask })
            });
            const data = await resp.json();
            if (data.success && data.account) {
                tasks = data.account.tasks;
            }
        } catch (e) {
            tasks.push(newTask);
            saveTasksLocal();
        }

        renderTasks();
        renderFocusCard();
        updateStatsUI();

        taskForm.reset();
        updateFormMapRoute("Gold's Gym Fitness, Toshkent");
        showToast("Yangi reja qo'shildi va Telegram botga sinxronlandi!", 'success');
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    arrivedNowBtn.addEventListener('click', () => {
        if (activeWarningTaskId) {
            completeTask(activeWarningTaskId);
            closeWarningModal();
            showToast("Ball saqlandi! Mas'uliyatli ekaningiz uchun tasanno!", 'success');
        }
    });

    onMyWayBtn.addEventListener('click', () => {
        if (activeWarningTaskId) {
            const task = tasks.find(t => t.id === activeWarningTaskId);
            if (task) {
                task.status = 'on_the_way';
                saveTasksLocal();
                renderTasks();
                renderFocusCard();
            }
            closeWarningModal();
            showToast("5 daqiqa bufer berildi. Shoshiling!", 'warning');
        }
    });

    missedEventBtn.addEventListener('click', () => {
        if (activeWarningTaskId) {
            const task = tasks.find(t => t.id === activeWarningTaskId);
            if (task) {
                task.status = 'missed';
                deductScore(15);
                saveTasksLocal();
                renderTasks();
                renderFocusCard();
                updateStatsUI();
            }
            closeWarningModal();
            showToast("Uchrashuv o'tkazib yuborildi. Intizom balli ayirildi (-15%).", 'danger');
        }
    });

    function openCurrentGoogleMapsRoute(targetQuery) {
        const destQuery = targetQuery || taskLocationInput.value.trim() || "Gold's Gym Fitness, Toshkent";
        const originStr = `${userCoords[0]},${userCoords[1]}`;
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${encodeURIComponent(destQuery)}`;
        window.open(gmapsUrl, '_blank');
        showToast(`🗺️ Google Maps'da "${destQuery}" marshruti ochilmoqda...`, "info");
    }

    // --- Form Map Logic (Leaflet) ---
    function initFormMap() {
        if (typeof L === 'undefined') return;

        formMap = L.map('formLiveMap', { zoomControl: false }).setView(userCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(formMap);

        // Click ONCE on map to open Google Maps route directly!
        formMap.on('click', () => {
            openCurrentGoogleMapsRoute();
        });

        const formMapContainer = document.getElementById('formMapContainer');
        if (formMapContainer) {
            formMapContainer.addEventListener('click', (e) => {
                if (e.target.closest('#presetLocBtn')) return;
                openCurrentGoogleMapsRoute();
            });
        }

        const greenIcon = L.divIcon({
            className: 'custom-map-pin-user',
            html: `<div style="background:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 15px #10b981;"></div>`
        });
        formUserMarker = L.marker(userCoords, { icon: greenIcon }).addTo(formMap).bindPopup("Sizning joylashuvingiz");

        updateFormMapRoute(taskLocationInput.value || "Golds Gym");
    }

    async function updateFormMapRoute(query) {
        if (!formMap || !query) return;

        try {
            // Force Leaflet map container to recalculate layout size!
            try { formMap.invalidateSize(); } catch(e){}

            const dest = await geocodeLocation(query);
            const destCoords = [dest.lat, dest.lng];

            if (formUserMarker && typeof formMap.removeLayer === 'function') {
                try { formMap.removeLayer(formUserMarker); } catch(e){}
            }
            if (formDestMarker && typeof formMap.removeLayer === 'function') {
                try { formMap.removeLayer(formDestMarker); } catch(e){}
            }
            if (formRouteLine && typeof formMap.removeLayer === 'function') {
                try { formMap.removeLayer(formRouteLine); } catch(e){}
            }

            if (typeof L !== 'undefined' && L.marker) {
                const userIcon = L.divIcon({
                    className: 'custom-map-pin-user',
                    html: `<div style="background:#10b981; width:20px; height:20px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 15px #10b981; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px;"><i class="fa-solid fa-user"></i></div>`
                });

                const destIcon = L.divIcon({
                    className: 'custom-map-pin-dest',
                    html: `<div style="background:#ef4444; width:22px; height:22px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 20px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px;"><i class="fa-solid fa-flag-checkered"></i></div>`
                });

                if (typeof formMap.addLayer === 'function') {
                    formUserMarker = L.marker(userCoords, { icon: userIcon }).addTo(formMap).bindPopup("<b>Sizning GPS Joylashuvingiz</b>");
                    formDestMarker = L.marker(destCoords, { icon: destIcon }).addTo(formMap).bindPopup(`<b>Manzil: ${dest.name}</b>`);

                    formRouteLine = L.polyline([userCoords, destCoords], {
                        color: '#10b981',
                        weight: 4,
                        dashArray: '8, 8',
                        opacity: 0.85
                    }).addTo(formMap);

                    const distKmVal = parseFloat(calculateDistance(userCoords[0], userCoords[1], dest.lat, dest.lng));
                    if (distKmVal > 50) {
                        formMap.setView(destCoords, 13);
                    } else if (formMap.fitBounds && L.latLngBounds) {
                        const bounds = L.latLngBounds([userCoords, destCoords]);
                        formMap.fitBounds(bounds, { padding: [30, 30] });
                    }
                }
            }

            const distKm = calculateDistance(userCoords[0], userCoords[1], dest.lat, dest.lng).toFixed(1);
            const trafficFactor = Math.floor(Math.random() * 11) + 5; 
            const baseMins = Math.ceil(distKm * 2.5);
            const travelMins = baseMins + trafficFactor;

            // Fetch Weather
            let weatherStr = "";
            try {
                const wResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${dest.lat}&longitude=${dest.lng}&current_weather=true`);
                const wData = await wResp.json();
                if (wData && wData.current_weather) {
                    weatherStr = ` | 🌡️ ${wData.current_weather.temperature}°C`;
                }
            } catch(e){}

            if (routeInfoText) {
                routeInfoText.innerHTML = `
                    <span><i class="fa-solid fa-location-crosshairs" style="color:var(--primary);"></i> Siz ➔ <strong style="color:var(--text-main);">${dest.name}</strong></span>
                    <span style="color:var(--primary); font-weight:700;">${distKm} km (~${travelMins} min, tirbandlik bilan)${weatherStr}</span>
                `;
            }
        } catch(err) {
            console.log("Form map route update error:", err);
        }
    }

    function openRouteModal(task) {
        mapModalTitle.innerHTML = `<i class="fa-solid fa-route" style="color:var(--primary);"></i> ${escapeHtml(task.title)}`;
        mapModalSubtitle.textContent = `Manzil: ${task.location}`;

        const destLat = task.lat || 41.3111;
        const destLng = task.lng || 69.2797;

        const distKm = calculateDistance(userCoords[0], userCoords[1], destLat, destLng).toFixed(1);
        const travelMins = Math.ceil(distKm * 2.5);

        modalRouteStats.innerHTML = `
            <div><i class="fa-solid fa-map-pin" style="color:var(--primary);"></i> <strong>Manzil:</strong> ${escapeHtml(task.location)}</div>
            <div><i class="fa-solid fa-arrows-left-right"></i> <strong>Masofa:</strong> ${distKm} km</div>
            <div><i class="fa-solid fa-car"></i> <strong>Yo'l vaqti:</strong> ~${travelMins} daqiqa</div>
        `;

        const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${userCoords[0]},${userCoords[1]}&destination=${encodeURIComponent(task.location)}`;
        openGoogleMapsDirectBtn.href = googleMapsDirUrl;

        mapModalBackdrop.classList.add('active');

        setTimeout(() => {
            if (!modalMap) {
                modalMap = L.map('modalInteractiveMap').setView([destLat, destLng], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
            }

            if (modalUserMarker) modalMap.removeLayer(modalUserMarker);
            if (modalDestMarker) modalMap.removeLayer(modalDestMarker);
            if (modalRouteLine) modalMap.removeLayer(modalRouteLine);

            const userIcon = L.divIcon({
                html: `<div style="background:#10b981; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 15px #10b981;"></div>`
            });
            modalUserMarker = L.marker(userCoords, { icon: userIcon }).addTo(modalMap).bindPopup("Sizning GPS Joylashuvingiz");

            const destIcon = L.divIcon({
                html: `<div style="background:#ef4444; width:22px; height:22px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 20px #ef4444;"></div>`
            });
            modalDestMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(modalMap).bindPopup(task.location);

            modalRouteLine = L.polyline([userCoords, [destLat, destLng]], {
                color: '#10b981',
                weight: 5,
                dashArray: '10, 8'
            }).addTo(modalMap);

            const bounds = L.latLngBounds([userCoords, [destLat, destLng]]);
            modalMap.fitBounds(bounds, { padding: [40, 40] });
            modalMap.invalidateSize();
        }, 200);
    }

    // --- Core Ticker Logic ---
    function tick() {
        const now = new Date();

        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        liveTimeEl.textContent = `${hours}:${mins}:${secs}`;
        
        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' };
        liveDateEl.textContent = now.toLocaleDateString('uz-UZ', dateOptions);



        let updated = false;

        tasks.forEach(task => {
            try {
                if (task.status === 'completed' || task.status === 'missed') return;
                
                if (!task.time) return; // Safely skip if time missing

                const [taskH, taskM] = task.time.split(':').map(Number);
                const taskDate = new Date();
                taskDate.setHours(taskH, taskM, 0, 0);

                const diffMs = now - taskDate;
                const diffMins = Math.floor(diffMs / 60000);

                const bufferMs = task.bufferTime * 60 * 1000;
                if (now >= (taskDate - bufferMs) && now < taskDate && !task.departureNotified) {
                    task.departureNotified = true;
                    showToast(`🚗 Yo'lga chiqish vaqti! ${task.location} manziliga yetib borish uchun ${task.bufferTime} min qoldi.`, 'warning');
                    updated = true;
                }

                if (diffMins >= 1 && task.status !== 'late') {
                    task.status = 'late';
                    deductScore(5);
                    updated = true;
                    triggerStrictWarning(task);
                }
            } catch (err) {
                console.error("Task tick error", err);
            }
        });

        if (updated) {
            saveTasksLocal();
            renderTasks();
            renderFocusCard();
            updateStatsUI();
        }

        if (activeWarningTaskId && warningModalBackdrop.classList.contains('active')) {
            const task = tasks.find(t => t.id === activeWarningTaskId);
            if (task) {
                const [taskH, taskM] = task.time.split(':').map(Number);
                const taskDate = new Date();
                taskDate.setHours(taskH, taskM, 0, 0);
                const diffMs = Math.max(0, now - taskDate);
                const lMins = String(Math.floor(diffMs / 60000)).padStart(2, '0');
                const lSecs = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
                lateTimerDisplay.textContent = `${lMins} daqiqa ${lSecs} soniya`;
            }
        }
    }

    function triggerStrictWarning(task) {
        activeWarningTaskId = task.id;

        warningSpeechText.innerHTML = `
            <strong>"${userName}, bugun soat ${task.time} da <u style="color:#ef4444">${task.location}</u>da 
            '${task.title}' uchrashuvingiz bor ediku! Nimaga kech qolyapsiz?!"</strong>
        `;

        warningTaskDetails.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span><strong>Manzil:</strong> ${task.location}</span>
                <span><strong>Boshlanishi:</strong> ${task.time}</span>
            </div>
            <div><strong>Qattiqqo'llik Rejimi:</strong> ${getStrictnessBadge(task.strictness)}</div>
        `;

        warningModalBackdrop.classList.add('active');
        playBeepAlert();
    }

    function closeWarningModal() {
        warningModalBackdrop.classList.remove('active');
        activeWarningTaskId = null;
    }

    function playBeepAlert() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) {
            console.log("Audio play policy");
        }
    }

    async function completeTask(id) {
        try {
            await fetch(`${API_BASE}/tasks/${id}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
        } catch (e) {}

        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = 'completed';
            task.completedAt = new Date().toISOString();

            // Calculate completion timing for scoring (+35% on-time, +65% early)
            const now = new Date();
            const [tH, tM] = task.time.split(':').map(Number);
            const taskDate = new Date();
            taskDate.setHours(tH, tM, 0, 0);
            
            const bufferMs = (task.bufferTime || 30) * 60 * 1000;
            const bufferStartDate = new Date(taskDate.getTime() - bufferMs);

            if (now < bufferStartDate) {
                // Ertaroq bajarildi (Early)! +65%
                disciplineScore = Math.min(100, disciplineScore + 65);
                showToast(`🚀 Topshiriq ertaroq bajarildi! Intizomingizga +65% ball berildi!`, 'success');
            } else if (now <= new Date(taskDate.getTime() + 15 * 60 * 1000)) {
                // O'z vaqtida bajarildi (On-Time)! +35%
                disciplineScore = Math.min(100, disciplineScore + 35);
                showToast(`✅ Topshiriq o'z vaqtida bajarildi! Intizomingizga +35% ball berildi!`, 'success');
            } else {
                // Kechikib bajarildi
                disciplineScore = Math.max(0, disciplineScore - 15);
                showToast(`⚠️ Topshiriq kechikib bajarildi. Intizomdan -15% ayirildi.`, 'warning');
            }
        }

        saveTasksLocal();
        renderTasks();
        renderFocusCard();
        updateStatsUI();
        renderLeaderboard();
    }

    async function deleteTask(id) {
        try {
            await fetch(`${API_BASE}/tasks/${id}?userId=${userId}`, { method: 'DELETE' });
        } catch (e) {}

        tasks = tasks.filter(t => t.id !== id);
        saveTasksLocal();
        renderTasks();
        renderFocusCard();
        updateStatsUI();
        showToast("Reja o'chirildi", 'info');
    }

    function deductScore(pts) {
        disciplineScore = Math.max(0, disciplineScore - pts);
        localStorage.setItem('chrono_score', disciplineScore);
    }

    // BUG #4 FIX: Filter tasks by calendar selected date
    function renderTasksByDate(dateStr) {
        tasksListEl.innerHTML = '';

        let filteredTasks;
        if (!dateStr) {
            // No date selected: show all based on currentFilter
            renderTasks();
            return;
        }

        // Filter tasks by the selected calendar date (local timezone)
        filteredTasks = tasks.filter(t => {
            if (!t.createdAt) return false;
            const d = new Date(t.createdAt);
            const localStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return localStr === dateStr;
        });

        if (filteredTasks.length === 0) {
            tasksListEl.innerHTML = `
                <div style="text-align:center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>${dateStr} kuni uchun hech qanday reja yo'q.</p>
                </div>
            `;
            return;
        }

        filteredTasks.sort((a, b) => a.time.localeCompare(b.time));
        filteredTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-item-card state-${task.status}`;
            card.innerHTML = `
                <div class="task-left">
                    <div class="task-time-pill">
                        <div class="time-val">${task.time}</div>
                        <div class="buffer-val">-${task.bufferTime} min</div>
                    </div>
                    <div class="task-main-info">
                        <h4>${escapeHtml(task.title)}</h4>
                        <div class="task-location-text">
                            <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i>
                            ${escapeHtml(task.location)}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    ${getStatusBadge(task.status)}
                    <button class="btn-icon btn-view-route" data-id="${task.id}">
                        <i class="fa-solid fa-map-location-dot"></i>
                    </button>
                    ${task.status !== 'completed' ? `
                        <button class="btn-arrive" data-id="${task.id}">
                            <i class="fa-solid fa-check"></i> Yetib bordim
                        </button>
                        <button class="btn-icon btn-edit-task" data-id="${task.id}" title="Tahrirlash">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon btn-delete" data-id="${task.id}">
                        <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i>
                    </button>
                </div>
            `;
            const routeBtn = card.querySelector('.btn-view-route');
            if (routeBtn) routeBtn.addEventListener('click', () => openRouteModal(task));
            const arriveBtn = card.querySelector('.btn-arrive');
            if (arriveBtn) arriveBtn.addEventListener('click', () => completeTask(task.id));
            const editBtn = card.querySelector('.btn-edit-task');
            if (editBtn) editBtn.addEventListener('click', () => openEditTaskModal(task));
            const deleteBtn = card.querySelector('.btn-delete');
            if (deleteBtn) deleteBtn.addEventListener('click', () => deleteTask(task.id));
            tasksListEl.appendChild(card);
        });
    }

    function renderTasks() {
        if (!tasksListEl) return;
        tasksListEl.innerHTML = '';

        if (!Array.isArray(tasks)) tasks = [];

        let filteredTasks = tasks;
        if (currentFilter === 'pending') filteredTasks = tasks.filter(t => t && (t.status === 'pending' || t.status === 'on_the_way'));
        if (currentFilter === 'late') filteredTasks = tasks.filter(t => t && t.status === 'late');
        if (currentFilter === 'completed') filteredTasks = tasks.filter(t => t && t.status === 'completed');

        if (!Array.isArray(filteredTasks) || filteredTasks.length === 0) {
            tasksListEl.innerHTML = `
                <div style="text-align:center; padding: 30px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>Ushbu bo'limda hech qanday reja topilmadi.</p>
                </div>
            `;
            return;
        }

        filteredTasks.sort((a, b) => a.time.localeCompare(b.time));

        filteredTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-item-card state-${task.status}`;

            card.innerHTML = `
                <div class="task-left">
                    <div class="task-time-pill">
                        <div class="time-val">${task.time}</div>
                        <div class="buffer-val">-${task.bufferTime} min</div>
                    </div>
                    <div class="task-main-info">
                        <h4>${escapeHtml(task.title)}</h4>
                        <div class="task-location-text">
                            <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i>
                            ${escapeHtml(task.location)}
                        </div>
                    </div>
                </div>

                <div class="task-actions">
                    ${getStatusBadge(task.status)}
                    <button class="btn-icon btn-view-route" data-id="${task.id}" title="Real-time Marshrutni ko'rish">
                        <i class="fa-solid fa-map-location-dot"></i>
                    </button>
                    ${task.status !== 'completed' ? `
                        <button class="btn-arrive" data-id="${task.id}">
                            <i class="fa-solid fa-check"></i> Yetib bordim
                        </button>
                        <button class="btn-icon btn-edit-task" data-id="${task.id}" title="Tahrirlash">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon btn-delete" data-id="${task.id}" title="O'chirish">
                        <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i>
                    </button>
                </div>
            `;

            const routeBtn = card.querySelector('.btn-view-route');
            if (routeBtn) {
                routeBtn.addEventListener('click', () => openRouteModal(task));
            }

            const arriveBtn = card.querySelector('.btn-arrive');
            if (arriveBtn) {
                arriveBtn.addEventListener('click', () => completeTask(task.id));
            }

            const editBtn = card.querySelector('.btn-edit-task');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditTaskModal(task));
            }

            const deleteBtn = card.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteTask(task.id));
            }

            tasksListEl.appendChild(card);
        });
    }

    function renderFocusCard() {
        const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'on_the_way' || t.status === 'late');

        if (pendingTasks.length === 0) {
            focusContentEl.innerHTML = `
                <p class="empty-focus-msg"><i class="fa-solid fa-circle-check" style="color:var(--primary);"></i> Barcha rejalar bajarildi! Bugun a'lo intizom ko'rsatdingiz!</p>
            `;
            return;
        }

        pendingTasks.sort((a, b) => a.time.localeCompare(b.time));
        const activeTask = pendingTasks[0];

        const destLat = activeTask.lat || 41.3111;
        const destLng = activeTask.lng || 69.2797;
        const distKm = calculateDistance(userCoords[0], userCoords[1], destLat, destLng).toFixed(1);
        const travelMins = Math.ceil(distKm * 2.5);

        focusContentEl.innerHTML = `
            <div class="active-focus-content">
                <div class="focus-details">
                    <h2>${escapeHtml(activeTask.title)}</h2>
                    <div class="focus-meta">
                        <span><i class="fa-regular fa-clock" style="color:var(--primary);"></i> ${activeTask.time}</span>
                        <span><i class="fa-solid fa-location-dot" style="color:var(--secondary);"></i> ${escapeHtml(activeTask.location)}</span>
                        <span><i class="fa-solid fa-route" style="color:var(--primary);"></i> ${distKm} km (~${travelMins} min)</span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <button class="submit-btn view-route-focus-btn" style="padding: 10px 18px; font-size: 0.9rem;">
                        <i class="fa-solid fa-map-location-dot"></i> Xaritada Marshrut
                    </button>
                    <button class="submit-btn arrive-focus-btn" style="padding: 10px 18px; font-size: 0.9rem; background: linear-gradient(135deg, #10b981, #059669); color:#fff;">
                        <i class="fa-solid fa-circle-check"></i> Yetib bordim
                    </button>
                </div>
            </div>
        `;

        const viewRouteFocusBtn = focusContentEl.querySelector('.view-route-focus-btn');
        if (viewRouteFocusBtn) {
            viewRouteFocusBtn.addEventListener('click', () => openRouteModal(activeTask));
        }

        const arriveFocusBtn = focusContentEl.querySelector('.arrive-focus-btn');
        if (arriveFocusBtn) {
            arriveFocusBtn.addEventListener('click', () => completeTask(activeTask.id));
        }
    }

    async function geocodeLocation(query) {
        if (!query) return { name: "Toshkent", lat: 41.2995, lng: 69.2401 };
        window.geocodeLocation = geocodeLocation;

        const cleanQ = query.toLowerCase().trim();

        // 1. Predefined Popular Locations Dictionary
        const knownLocations = {
            'golds gym': { name: "Gold's Gym Fitness", lat: 41.3111, lng: 69.2797 },
            'toshkent': { name: "Toshkent Shahri", lat: 41.2995, lng: 69.2401 },
            'chilonzor': { name: "Chilonzor tumani", lat: 41.2778, lng: 69.2023 },
            'yunusobod': { name: "Yunusobod tumani", lat: 41.3644, lng: 69.2882 },
            'mirzo ulugbek': { name: "Mirzo Ulug'bek tumani", lat: 41.3275, lng: 69.3324 },
            'chorsu': { name: "Chorsu Bozori", lat: 41.3271, lng: 69.2342 },
            'samarqand darvoza': { name: "Samarqand Darvoza TMM", lat: 41.3164, lng: 69.2299 },
            'magic city': { name: "Magic City Park", lat: 41.3042, lng: 69.2467 },
            'tashkent city': { name: "Tashkent City Park", lat: 41.3139, lng: 69.2558 },
            'najot talim': { name: "Najot Ta'lim", lat: 41.2785, lng: 69.2052 },
            'it park': { name: "IT Park Toshkent", lat: 41.3392, lng: 69.3351 },
            'samarqand': { name: "Samarqand Shahri", lat: 39.6542, lng: 66.9597 },
            'buxoro': { name: "Buxoro Shahri", lat: 39.7747, lng: 64.4286 },
            'namangan': { name: "Namangan Shahri", lat: 41.0011, lng: 71.6683 },
            'andijon': { name: "Andijon Shahri", lat: 40.7821, lng: 72.3442 },
            'urganch': { name: "Urganch Shahri", lat: 41.5503, lng: 60.6314 },
            'fargona': { name: "Farg'ona Shahri", lat: 40.3842, lng: 71.7843 }
        };

        for (const key in knownLocations) {
            if (cleanQ.includes(key)) {
                return knownLocations[key];
            }
        }

        // 2. OpenStreetMap Nominatim Live Geocoding (Stage 1: Direct query)
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                return {
                    name: data[0].display_name.split(',')[0],
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (e) {}

        // 3. Stage 2: Appending Uzbekistan for local places
        try {
            const resp2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Uzbekistan")}&limit=1`);
            const data2 = await resp2.json();
            if (Array.isArray(data2) && data2.length > 0) {
                return {
                    name: data2[0].display_name.split(',')[0],
                    lat: parseFloat(data2[0].lat),
                    lng: parseFloat(data2[0].lon)
                };
            }
        } catch (e) {}

        // 4. Smart Hashing Fallback for ANY custom place (Generates unique, realistic coordinates per place!)
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            hash = query.charCodeAt(i) + ((hash << 5) - hash);
        }
        const latOffset = ((Math.abs(hash) % 100) - 50) * 0.0015;
        const lngOffset = ((Math.abs(hash * 13) % 100) - 50) * 0.0015;

        return {
            name: query,
            lat: 41.2995 + latOffset,
            lng: 69.2401 + lngOffset
        };
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function updateUserNameUI() {
        userNameDisplay.textContent = userName;
    }

    function updateStatsUI() {
        disciplineScoreEl.textContent = `${disciplineScore}%`;
        scoreProgressBar.style.width = `${disciplineScore}%`;

        if (disciplineScore >= 85) {
            scoreStatusBadge.className = 'stat-badge badge-success';
            scoreStatusBadge.textContent = 'A\'lo Intizom';
        } else if (disciplineScore >= 60) {
            scoreStatusBadge.className = 'stat-badge badge-warning';
            scoreStatusBadge.textContent = 'O\'rtacha';
        } else {
            scoreStatusBadge.className = 'stat-badge badge-danger';
            scoreStatusBadge.textContent = 'Past Intizom!';
        }

        totalTasksCountEl.textContent = tasks.length;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        completedTasksCountEl.textContent = `${completedCount} ta bajarildi`;

        const lateCount = tasks.filter(t => t.status === 'late' || t.status === 'missed').length;
        lateTasksCountEl.textContent = lateCount;
        updateDisciplineChart();
        renderLeaderboard();
        if (typeof renderCalendar === 'function') renderCalendar();
    }

    function updateDisciplineChart() {
        try {
            const canvas = document.getElementById('disciplineChart');
            if (!canvas) return;

            const labels = ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Bugun'];
            const data = [100, 95, 90, 85, 92, 98, disciplineScore];

            // If Chart.js library loaded, use Chart.js
            if (typeof Chart !== 'undefined') {
                if (disciplineChartInstance) {
                    disciplineChartInstance.data.datasets[0].data[6] = disciplineScore;
                    disciplineChartInstance.update();
                } else {
                    disciplineChartInstance = new Chart(canvas, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Intizom Darajasi (%)',
                                data: data,
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { min: 0, max: 100 }
                            },
                            plugins: {
                                legend: { display: false }
                            }
                        }
                    });
                }
                return;
            }

            // Fallback: Pure HTML5 Canvas renderer (Zero CDN dependency!)
            renderPureCanvasChart(canvas, data, labels);

        } catch (e) {
            console.log("Discipline chart update error:", e);
        }
    }

    function renderPureCanvasChart(canvas, data, labels) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = 180;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const padding = { top: 25, right: 25, bottom: 30, left: 45 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        // Grid lines
        const gridSteps = [0, 25, 50, 75, 100];
        ctx.font = '500 11px Outfit, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';

        gridSteps.forEach(step => {
            const y = padding.top + chartH - (step / 100) * chartH;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
            ctx.lineWidth = 1;
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.fillText(`${step}%`, padding.left - 8, y + 4);
        });

        // X-axis & Data points
        const stepX = chartW / (labels.length - 1);
        const points = data.map((val, i) => ({
            x: padding.left + i * stepX,
            y: padding.top + chartH - (val / 100) * chartH,
            val: val,
            label: labels[i]
        }));

        // Draw X labels
        ctx.textAlign = 'center';
        points.forEach(p => {
            ctx.fillText(p.label, p.x, height - 8);
        });

        // Gradient Fill
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartH);
        points.forEach((p, i) => {
            if (i === 0) ctx.lineTo(p.x, p.y);
            else {
                const prev = points[i - 1];
                const cpX1 = prev.x + stepX / 2;
                const cpY1 = prev.y;
                const cpX2 = p.x - stepX / 2;
                const cpY2 = p.y;
                ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p.x, p.y);
            }
        });
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke Line
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else {
                const prev = points[i - 1];
                const cpX1 = prev.x + stepX / 2;
                const cpY1 = prev.y;
                const cpX2 = p.x - stepX / 2;
                const cpY2 = p.y;
                ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p.x, p.y);
            }
        });
        ctx.stroke();

        // Dots & Values
        points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = i === points.length - 1 ? '#059669' : '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#475569';
            ctx.font = '600 11px Outfit, sans-serif';
            ctx.fillText(`${p.val}%`, p.x, p.y - 9);
        });
    }

    // --- LEADERBOARD & RATING LOGIC ---
    function renderLeaderboard() {
        const userRankPos = document.getElementById('userRankPos');
        const userRankScore = document.getElementById('userRankScore');
        const userRankTitle = document.getElementById('userRankTitle');
        const rankBadge = document.getElementById('rankBadge');
        const leaderboardList = document.getElementById('leaderboardList');
        const rankPeriodLabel = document.getElementById('rankPeriodLabel');
        if (!leaderboardList) return;

        if (rankPeriodLabel) {
            rankPeriodLabel.textContent = rankMode === 'weekly' ? 'Haftalik Ball' : 'Oylik Ball';
        }

        // Competitors simulation with user's real live score
        const competitors = [
            { name: userName + " (Siz)", score: disciplineScore, isUser: true },
            { name: "Jasur M.", score: rankMode === 'weekly' ? 82 : 88, isUser: false },
            { name: "Rayhona S.", score: rankMode === 'weekly' ? 60 : 75, isUser: false },
            { name: "Bobur T.", score: rankMode === 'weekly' ? 35 : 45, isUser: false }
        ];

        competitors.sort((a, b) => b.score - a.score);
        const userIndex = competitors.findIndex(c => c.isUser);
        const userPos = userIndex + 1;

        let medal = userPos === 1 ? '🥇' : userPos === 2 ? '🥈' : userPos === 3 ? '🥉' : '🎗️';
        if (userRankPos) userRankPos.textContent = `#${userPos} ${medal}`;
        if (userRankScore) userRankScore.textContent = `${disciplineScore}%`;

        let title = "🌱 Boshlang'ich";
        if (disciplineScore >= 85) title = "👑 Intizom Qahramoni";
        else if (disciplineScore >= 65) title = "🥇 Oltin Daraja";
        else if (disciplineScore >= 35) title = "⚡ Intizomli";

        if (userRankTitle) userRankTitle.textContent = title;
        if (rankBadge) rankBadge.textContent = `${medal} Top #${userPos} Participant`;

        leaderboardList.innerHTML = competitors.map((comp, idx) => `
            <div class="leaderboard-row-item ${comp.isUser ? 'is-user' : ''}">
                <div class="leaderboard-user-info">
                    <span class="leaderboard-rank-num">#${idx + 1}</span>
                    <span>${escapeHtml(comp.name)}</span>
                </div>
                <strong style="color:${comp.isUser ? 'var(--primary)' : 'var(--text-main)'}">${comp.score}%</strong>
            </div>
        `).join('');
    }

    const rankWeeklyBtn = document.getElementById('rankWeeklyBtn');
    const rankMonthlyBtn = document.getElementById('rankMonthlyBtn');
    if (rankWeeklyBtn) {
        rankWeeklyBtn.addEventListener('click', () => {
            rankMode = 'weekly';
            rankWeeklyBtn.classList.add('active');
            rankMonthlyBtn?.classList.remove('active');
            renderLeaderboard();
        });
    }
    if (rankMonthlyBtn) {
        rankMonthlyBtn.addEventListener('click', () => {
            rankMode = 'monthly';
            rankMonthlyBtn.classList.add('active');
            rankWeeklyBtn?.classList.remove('active');
            renderLeaderboard();
        });
    }

    function getStatusBadge(status) {
        switch (status) {
            case 'pending':
                return `<span class="stat-badge badge-warning"><i class="fa-solid fa-hourglass-half"></i> Kutilmoqda</span>`;
            case 'on_the_way':
                return `<span class="stat-badge badge-success"><i class="fa-solid fa-person-walking-luggage"></i> Yo'lda</span>`;
            case 'late':
                return `<span class="stat-badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> KECHIKMOQDA</span>`;
            case 'completed':
                return `<span class="stat-badge badge-success"><i class="fa-solid fa-check"></i> Bajarildi</span>`;
            case 'missed':
                return `<span class="stat-badge badge-danger" style="opacity:0.6;"><i class="fa-solid fa-xmark"></i> O'tkazib yuborildi</span>`;
            default:
                return '';
        }
    }

    function getStrictnessBadge(level) {
        if (level === 'hardcore') return `<span style="color:#ef4444; font-weight:700;">⚡ Qattiqqo'l Coach Mode</span>`;
        if (level === 'strict') return `<span style="color:#d97706; font-weight:700;">🔥 Jiddiy Rejim</span>`;
        return `<span style="color:var(--primary); font-weight:700;">🍃 Yumshoq Rejim</span>`;
    }

    function saveTasksLocal() {
        localStorage.setItem('chrono_tasks', JSON.stringify(tasks));
        localStorage.setItem('chrono_tasks_' + userName, JSON.stringify(tasks));
        localStorage.setItem('chrono_score', disciplineScore);
        localStorage.setItem('chrono_score_' + userName, disciplineScore);
    }

    // --- Pomodoro Logic ---
    let pomodoroInterval;
    let pomodoroTime = 25 * 60;
    let isPomodoroRunning = false;
    
    const pomodoroDisplay = document.getElementById('pomodoroDisplay');
    const pomodoroStartBtn = document.getElementById('pomodoroStartBtn');
    const pomodoroResetBtn = document.getElementById('pomodoroResetBtn');
    const pomodoroStatus = document.getElementById('pomodoroStatus');
    
    function updatePomodoroDisplay() {
        if (!pomodoroDisplay) return;
        const m = String(Math.floor(pomodoroTime / 60)).padStart(2, '0');
        const s = String(pomodoroTime % 60).padStart(2, '0');
        pomodoroDisplay.textContent = `${m}:${s}`;
    }
    
    if (pomodoroStartBtn) {
        pomodoroStartBtn.addEventListener('click', () => {
            if (isPomodoroRunning) {
                clearInterval(pomodoroInterval);
                pomodoroStartBtn.innerHTML = '<i class="fa-solid fa-play"></i> Boshlash';
            } else {
                pomodoroInterval = setInterval(() => {
                    pomodoroTime--;
                    updatePomodoroDisplay();
                    if (pomodoroTime <= 0) {
                        clearInterval(pomodoroInterval);
                        isPomodoroRunning = false;
                        playBeepAlert();
                        showToast("Pomodoro yakunlandi! Dam oling.", 'success');
                        pomodoroStartBtn.innerHTML = '<i class="fa-solid fa-play"></i> Boshlash';
                        pomodoroTime = 5 * 60; 
                        if (pomodoroStatus) pomodoroStatus.textContent = "Dam olish vaqti";
                        updatePomodoroDisplay();
                    }
                }, 1000);
                pomodoroStartBtn.innerHTML = '<i class="fa-solid fa-pause"></i> To\'xtatish';
            }
            isPomodoroRunning = !isPomodoroRunning;
        });
    }
    
    if (pomodoroResetBtn) {
        pomodoroResetBtn.addEventListener('click', () => {
            clearInterval(pomodoroInterval);
            isPomodoroRunning = false;
            pomodoroTime = 25 * 60;
            if (pomodoroStatus) pomodoroStatus.textContent = "Fokus vaqti";
            if (pomodoroStartBtn) pomodoroStartBtn.innerHTML = '<i class="fa-solid fa-play"></i> Boshlash';
            updatePomodoroDisplay();
        });
    }

    // --- EDIT TASK MODAL LOGIC ---
    const editTaskModalBackdrop = document.getElementById('editTaskModalBackdrop');
    const closeEditTaskModal = document.getElementById('closeEditTaskModal');
    const editTaskForm = document.getElementById('editTaskForm');
    const editTaskId = document.getElementById('editTaskId');
    const editTaskTitle = document.getElementById('editTaskTitle');
    const editTaskTime = document.getElementById('editTaskTime');
    const editBufferTime = document.getElementById('editBufferTime');
    const editTaskLocation = document.getElementById('editTaskLocation');

    function openEditTaskModal(task) {
        if (!editTaskModalBackdrop) return;
        editTaskId.value = task.id;
        editTaskTitle.value = task.title;
        editTaskTime.value = task.time;
        editBufferTime.value = task.bufferTime || 30;
        editTaskLocation.value = task.location;
        editTaskModalBackdrop.classList.add('active');
    }

    closeEditTaskModal?.addEventListener('click', () => {
        editTaskModalBackdrop?.classList.remove('active');
    });

    editTaskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editTaskId.value;
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.title = editTaskTitle.value.trim();
            task.time = editTaskTime.value;
            task.bufferTime = parseInt(editBufferTime.value);
            const locationText = editTaskLocation.value.trim();
            if (task.location !== locationText) {
                task.location = locationText;
                const coords = await geocodeLocation(locationText);
                task.lat = coords.lat;
                task.lng = coords.lng;
            }
            saveTasksLocal();
            renderTasks();
            renderFocusCard();
            updateStatsUI();
            if (typeof renderCalendar === 'function') renderCalendar();
            editTaskModalBackdrop?.classList.remove('active');
            showToast("✏️ Reja muvaffaqiyatli tahrirlandi!", 'success');
        }
    });

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'warning') icon = 'fa-triangle-exclamation';
        if (type === 'danger') icon = 'fa-circle-xmark';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
        if (toastContainer) toastContainer.appendChild(toast);

        // Send push notification if tab is hidden or for warnings/danger
        if (type === 'warning' || type === 'danger' || document.hidden) {
            sendPushNotification("ChronoGuard", message);
        }

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }
});

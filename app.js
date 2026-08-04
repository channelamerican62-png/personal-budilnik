/* ==========================================================================
   ChronoGuard - Web App Frontend API & Telegram Bot Real-Time Sync
   API Endpoint: https://sizning-botingiz.onrender.com/api
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    // DIQQAT: Render.com ga ulaganingizdan so'ng, o'zingizning API havolangizni shu yerga kiriting!
    const API_BASE = 'https://chronoguard-backend.onrender.com/api'; 
    // const API_BASE = 'http://localhost:3000/api'; // (Lokal test uchun)

    // --- AUTHENTICATION MOCK LOGIC ---
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
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
                alert("Email kiritdingiz! Endi iltimos, uning parolini ham kiriting (Parol xavfsizlik uchun shart).");
                return;
            }
            if (pwd.length < 4) {
                alert("Parolingiz juda qisqa! Kamida 4 ta belgi (harf yoki raqam) bo'lishi kerak.");
                return;
            }
            
            // Generate basic username from email
            const newUserName = email.split('@')[0];
            userName = newUserName;
            localStorage.setItem('chrono_username', userName);
            
            const userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) userNameDisplay.textContent = userName;
        }

        // Mock successful login transition
        loginScreen.style.animation = "fadeOut 0.5s forwards";
        setTimeout(() => {
            loginScreen.style.display = 'none';
            appScreen.style.display = 'block';
            appScreen.style.animation = "fadeIn 0.5s forwards";
        }, 500);
    }

    const mockSignInBtn = document.getElementById('mockSignInBtn');
    if(mockSignInBtn) mockSignInBtn.addEventListener('click', handleLogin);

    // --- GOOGLE IDENTITY SERVICES ---
    window.handleCredentialResponse = function(response) {
        const responsePayload = decodeJwtResponse(response.credential);
        const googleId = responsePayload.sub;
        const name = responsePayload.name;
        
        localStorage.setItem('chrono_userid', googleId);
        localStorage.setItem('chrono_username', name);
        
        userId = googleId;
        userName = name;
        
        handleLogin();
        
        initServerAccount().then(() => {
            updateUserNameUI();
            updateStatsUI();
            renderTasks();
            renderFocusCard();
            if (typeof showToast === 'function') {
                showToast(`Xush kelibsiz, ${name}!`, 'success');
            }
        });
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
    let userId = localStorage.getItem('chrono_userid') || ('user_' + Date.now());
    let userName = localStorage.getItem('chrono_username') || 'Ali';
    let syncCode = localStorage.getItem('chrono_synccode') || '';
    let tasks = [];
    let disciplineScore = parseInt(localStorage.getItem('chrono_score')) || 100;
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

    // Start 1-second interval ticker IMMEDIATELY
    setInterval(tick, 1000);
    setInterval(fetchTasksFromAPI, 4000);
    tick();

    // --- Init Account API Sync (Non-blocking) ---
    initServerAccount();

    // --- Geolocation Init ---
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                updateFormMapRoute(taskLocationInput.value || "Gold's Gym Fitness, Toshkent");
            },
            () => console.log("User GPS fallback")
        );
    }

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
    telegramSyncBtn.addEventListener('click', () => {
        syncCodeDisplay.textContent = syncCode || '782-910';
        syncModalBackdrop.classList.add('active');
    });

    closeSyncModal.addEventListener('click', () => {
        syncModalBackdrop.classList.remove('active');
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

    // --- Form Map Logic (Leaflet) ---
    function initFormMap() {
        if (typeof L === 'undefined') return;

        formMap = L.map('formLiveMap', { zoomControl: false }).setView(userCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(formMap);

        const greenIcon = L.divIcon({
            className: 'custom-map-pin-user',
            html: `<div style="background:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 15px #10b981;"></div>`
        });
        formUserMarker = L.marker(userCoords, { icon: greenIcon }).addTo(formMap).bindPopup("Sizning joylashuvingiz");

        updateFormMapRoute(taskLocationInput.value || "Golds Gym");
    }

    async function updateFormMapRoute(query) {
        if (!formMap || !query) return;

        const dest = await geocodeLocation(query);
        const destCoords = [dest.lat, dest.lng];

        if (formDestMarker) formMap.removeLayer(formDestMarker);
        if (formRouteLine) formMap.removeLayer(formRouteLine);

        const destIcon = L.divIcon({
            className: 'custom-map-pin-dest',
            html: `<div style="background:#ef4444; width:20px; height:20px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 20px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px;"><i class="fa-solid fa-flag-checkered"></i></div>`
        });

        formDestMarker = L.marker(destCoords, { icon: destIcon }).addTo(formMap).bindPopup(`<b>${dest.name}</b>`);

        formRouteLine = L.polyline([userCoords, destCoords], {
            color: '#10b981',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.85
        }).addTo(formMap);

        const bounds = L.latLngBounds([userCoords, destCoords]);
        formMap.fitBounds(bounds, { padding: [30, 30] });

        const distKm = calculateDistance(userCoords[0], userCoords[1], dest.lat, dest.lng).toFixed(1);
        
        // Traffic Simulation (+ 5 to 15 mins)
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

        routeInfoText.innerHTML = `
            <span><i class="fa-solid fa-location-crosshairs" style="color:var(--primary);"></i> Siz ➔ <strong style="color:var(--text-main);">${dest.name}</strong></span>
            <span style="color:var(--primary); font-weight:700;">${distKm} km (~${travelMins} min, tirbandlik bilan) ${weatherStr}</span>
        `;
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
            disciplineScore = Math.min(100, disciplineScore + 2);
        }

        saveTasksLocal();
        renderTasks();
        renderFocusCard();
        updateStatsUI();
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

    function renderTasks() {
        tasksListEl.innerHTML = '';

        let filteredTasks = tasks;
        if (currentFilter === 'pending') filteredTasks = tasks.filter(t => t.status === 'pending' || t.status === 'on_the_way');
        if (currentFilter === 'late') filteredTasks = tasks.filter(t => t.status === 'late');
        if (currentFilter === 'completed') filteredTasks = tasks.filter(t => t.status === 'completed');

        if (filteredTasks.length === 0) {
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

        const cleanQ = query.toLowerCase().trim();
        for (const key in knownLocations) {
            if (cleanQ.includes(key)) {
                return knownLocations[key];
            }
        }

        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Tashkent")}`);
            const data = await resp.json();
            if (data && data.length > 0) {
                return {
                    name: data[0].display_name.split(',')[0],
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (e) {}

        return { name: query, lat: 41.3111, lng: 69.2797 };
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
    }

    function updateDisciplineChart() {
        const ctx = document.getElementById('disciplineChart');
        if (!ctx) return;
        
        const labels = ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Bugun'];
        const data = [100, 95, 90, 85, 92, 98, disciplineScore];
        
        if (disciplineChartInstance) {
            disciplineChartInstance.data.datasets[0].data[6] = disciplineScore;
            disciplineChartInstance.update();
        } else {
            disciplineChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Intizom Darajasi (%)',
                        data: data,
                        borderColor: '#678B6D',
                        backgroundColor: 'rgba(103, 139, 109, 0.2)',
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
        localStorage.setItem('chrono_score', disciplineScore);
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

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'warning') icon = 'fa-triangle-exclamation';
        if (type === 'danger') icon = 'fa-circle-xmark';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

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

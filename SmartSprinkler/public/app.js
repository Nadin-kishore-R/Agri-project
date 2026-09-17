// 🔥 FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};


if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentMode = "auto";
let currentMotorStatus = "OFF";

// User provided plant data
const DEFAULT_PLANTS = {
    "Wheat": { threshold: 650, depth: 80, fieldCapacity: 30, wiltingPoint: 12, soil: "Loamy" },
    "Maize": { threshold: 680, depth: 120, fieldCapacity: 25, wiltingPoint: 10, soil: "Sandy Loam" },
    "Groundnut": { threshold: 700, depth: 45, fieldCapacity: 20, wiltingPoint: 8, soil: "Sandy" },
    "Sunflower": { threshold: 650, depth: 120, fieldCapacity: 30, wiltingPoint: 12, soil: "Loamy" },
    "Potato": { threshold: 680, depth: 40, fieldCapacity: 25, wiltingPoint: 10, soil: "Sandy Loam" },
    "Tomato": { threshold: 650, depth: 50, fieldCapacity: 30, wiltingPoint: 12, soil: "Loamy" },
    "Onion": { threshold: 680, depth: 30, fieldCapacity: 25, wiltingPoint: 10, soil: "Sandy Loam" },
    "Carrot": { threshold: 680, depth: 45, fieldCapacity: 25, wiltingPoint: 10, soil: "Sandy Loam" },
    "Cabbage": { threshold: 650, depth: 40, fieldCapacity: 30, wiltingPoint: 12, soil: "Loamy" },
    "Napier Grass": { threshold: 600, depth: 150, fieldCapacity: 40, wiltingPoint: 20, soil: "Clay" }
};

const soilDB = {
    "Loamy": { fc: 30, wp: 12 },
    "Sandy": { fc: 20, wp: 8 },
    "Clay": { fc: 40, wp: 20 },
    "Sandy Loam": { fc: 25, wp: 10 }
};

// ================= UI ELEMENTS =================
const authContainer = document.getElementById("authContainer");
const dashboard = document.getElementById("dashboard");
const authError = document.getElementById("authError");
const userEmailDisplay = document.getElementById("userEmailDisplay");

// ================= PROFILE POPUP TOGGLE =================
const profileIconToggle = document.getElementById("profileIconToggle");
const profilePopup = document.getElementById("profilePopup");

if (profileIconToggle && profilePopup) {
    profileIconToggle.onclick = (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle("hidden");
    };

    document.addEventListener("click", (e) => {
        if (!profilePopup.contains(e.target) && !profileIconToggle.contains(e.target)) {
            profilePopup.classList.add("hidden");
        }
    });
}

// ================= AUTH & ONBOARDING =================
document.getElementById("signupBtn").onclick = async () => {
    const u = document.getElementById("username").value;
    const e = document.getElementById("email").value;
    const p = document.getElementById("password").value;
    if (!u) { authError.innerText = "Username required for signup"; return; }
    try {
        const cred = await auth.createUserWithEmailAndPassword(e, p);
        await db.ref(`users/${cred.user.uid}/profile`).set({ username: u });
    } catch (err) {
        let errStr = (err.message || "") + " " + (err.code || "");
        if (errStr.includes("EMAIL_EXISTS") || errStr.includes("email-already-in-use")) {
            authError.innerText = "Email already in use. Please login instead.";
        } else if (errStr.includes("WEAK_PASSWORD") || errStr.includes("weak-password")) {
            authError.innerText = "Password should be at least 6 characters.";
        } else {
            try {
                let parsed = JSON.parse(err.message);
                authError.innerText = parsed.error ? parsed.error.message : "Signup failed.";
            } catch (e) {
                authError.innerText = err.message || "Signup failed.";
            }
        }
    }
};

document.getElementById("loginBtn").onclick = () => {
    const e = document.getElementById("email").value;
    const p = document.getElementById("password").value;
    auth.signInWithEmailAndPassword(e, p).catch(err => {
        let errStr = (err.message || "") + " " + (err.code || "");

        if (errStr.includes("INVALID_LOGIN_CREDENTIALS") ||
            errStr.includes("invalid-credential") ||
            errStr.includes("user-not-found") ||
            errStr.includes("wrong-password")) {
            authError.innerText = "Invalid email or password. Please try again.";
        } else {
            try {
                let parsed = JSON.parse(err.message);
                authError.innerText = parsed.error ? parsed.error.message : "Login failed.";
            } catch (e) {
                authError.innerText = err.message || "Login failed.";
            }
        }
    });
};

document.getElementById("logoutBtn").onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authContainer.style.display = "none";
        dashboard.style.display = "flex";

        db.ref(`users/${user.uid}/profile`).once("value", snap => {
            let uname = "Unknown";
            if (snap.exists() && snap.val().username) {
                uname = snap.val().username;
                userEmailDisplay.innerText = uname + " (" + user.email + ")";
            } else {
                userEmailDisplay.innerText = user.email;
            }
            if (document.getElementById("profileUsername")) document.getElementById("profileUsername").innerText = uname;
            if (document.getElementById("profileEmail")) document.getElementById("profileEmail").innerText = user.email;
            if (document.getElementById("profileInitials")) document.getElementById("profileInitials").innerText = uname.charAt(0).toUpperCase();
        });

        initDashboard();
    } else {
        currentUser = null;
        authContainer.style.display = "block";
        dashboard.style.display = "none";
        document.getElementById("email").value = "";
        document.getElementById("password").value = "";
        document.getElementById("username").value = "";
        authError.innerText = "";
    }
});

document.getElementById("completeOnboardingBtn").onclick = async () => {
    try {
        const count = parseInt(document.getElementById("sprinklerCount").value) || 1;
        let updates = {};
        for (let i = 1; i <= count; i++) {
            let id = `Sprinkler-${i}`;
            updates[id] = true;
        }
        await db.ref(`users/${currentUser.uid}/registered_sprinklers`).set(updates);

        const listUI = document.getElementById("generatedIdsList");
        listUI.innerHTML = "";
        Object.keys(updates).forEach(id => {
            listUI.innerHTML += `<li>#define SPRINKLER_ID "${id}"</li>`;
        });
        document.getElementById("generatedIdsContainer").classList.remove("hidden");
        document.getElementById("completeOnboardingBtn").classList.add("hidden");
    } catch (err) {
        alert("Error saving sprinklers: " + err.message + "\n\n(Check your Firebase Database Rules!)");
    }
};

document.getElementById("closeOnboardingBtn").onclick = () => {
    document.getElementById("onboardingModal").classList.add("hidden");
    listenToHistory();
};

document.getElementById("addSprinklerBtn").onclick = async () => {
    try {
        const msgUI = document.getElementById("newSprinklerMsg");
        msgUI.style.color = "var(--text-main)";
        msgUI.innerText = "Generating...";

        const regRef = db.ref(`users/${currentUser.uid}/registered_sprinklers`);

        // Timeout to prevent hanging
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 8000));
        const snap = await Promise.race([regRef.once("value"), timeout]);

        let count = snap.exists() ? Object.keys(snap.val()).length : 0;
        let newId = `Sprinkler-${count + 1}`;

        await Promise.race([regRef.child(newId).set(true), timeout]);

        if (document.getElementById("profileSprinklerCount")) document.getElementById("profileSprinklerCount").innerText = count + 1;

        msgUI.style.color = "var(--success)";
        msgUI.innerText = `Added! Please use #define SPRINKLER_ID "${newId}" in your ESP code.`;
        setTimeout(() => { msgUI.innerText = ""; }, 15000);
    } catch (err) {
        console.error(err);
        const msgUI = document.getElementById("newSprinklerMsg");
        msgUI.style.color = "var(--danger)";
        msgUI.innerText = "Error: Database offline or permission denied.";
        alert("FIREBASE ERROR: " + err.message + "\n\n1. Check your internet connection.\n2. Verify Realtime Database is created in your project.\n3. Update your Database Rules to true.");
    }
};

// ================= INITIALIZE DASHBOARD =================
async function initDashboard() {
    loadPlantsDropdown();
    listenToConfig();
    listenToSprinklers();

    // Check Onboarding
    try {
        const regRef = db.ref(`users/${currentUser.uid}/registered_sprinklers`);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 8000));
        const snap = await Promise.race([regRef.once("value"), timeout]);

        if (!snap.exists()) {
            document.getElementById("onboardingModal").classList.remove("hidden");
            if (document.getElementById("profileSprinklerCount")) document.getElementById("profileSprinklerCount").innerText = "0";
        } else {
            if (document.getElementById("profileSprinklerCount")) document.getElementById("profileSprinklerCount").innerText = Object.keys(snap.val()).length;
            listenToHistory();
        }
    } catch (e) {
        console.error("Error checking onboarding:", e);
        alert("FIREBASE ERROR: The database connection failed!\n\nDetails: " + e.message + "\n\n1. Ensure Realtime Database is enabled in your Firebase Console.\n2. Ensure your Firebase Rules are updated.\n3. Check your internet connection.");
        listenToHistory(); // Fallback
    }
}

// ================= PLANT CONFIGURATION (Local State -> Save) =================
let localConfigState = {};

const plantSelect = document.getElementById("plantSelect");
const soilSelect = document.getElementById("soilSelect");
const thresholdInput = document.getElementById("thresholdInput");

function loadPlantsDropdown() {
    plantSelect.innerHTML = "<option value=''>-- Select Crop --</option>";
    for (let key in DEFAULT_PLANTS) {
        let opt = document.createElement("option");
        opt.value = key;
        opt.innerText = key;
        plantSelect.appendChild(opt);
    }

    plantSelect.onchange = () => {
        const selected = plantSelect.value;
        if (!selected) return;

        const p = DEFAULT_PLANTS[selected];
        let s = soilDB[soilSelect.value] || soilDB[p.soil] || { fc: p.fieldCapacity, wp: p.wiltingPoint };

        soilSelect.value = p.soil;
        thresholdInput.value = p.threshold;
        document.getElementById("depthUI").innerText = p.depth;
        document.getElementById("fcUI").innerText = s.fc;
        document.getElementById("wpUI").innerText = s.wp;

        localConfigState = {
            plant: selected,
            soil: p.soil,
            thresholdMoisture: Number(p.threshold),
            rootDepth: Number(p.depth),
            fieldCapacity: Number(s.fc),
            wiltingPoint: Number(s.wp)
        };
    };

    soilSelect.onchange = () => {
        let s = soilDB[soilSelect.value];
        if (s) {
            document.getElementById("fcUI").innerText = s.fc;
            document.getElementById("wpUI").innerText = s.wp;
            localConfigState.soil = soilSelect.value;
            localConfigState.fieldCapacity = Number(s.fc);
            localConfigState.wiltingPoint = Number(s.wp);
        }
    };

    thresholdInput.onchange = () => {
        localConfigState.thresholdMoisture = Number(thresholdInput.value);
    };

    document.getElementById("saveConfigBtn").onclick = () => {
        if (Object.keys(localConfigState).length > 0) {
            const btn = document.getElementById("saveConfigBtn");
            btn.innerText = "Saving...";

            db.ref(`users/${currentUser.uid}/config`).update(localConfigState)
                .then(() => {
                    btn.innerText = "Saved!";
                    btn.style.backgroundColor = "var(--success)";
                    setTimeout(() => {
                        btn.innerText = "Save Configuration";
                        btn.style.backgroundColor = "var(--accent)";
                    }, 2000);
                })
                .catch(e => {
                    btn.innerText = "Save Failed";
                    btn.style.backgroundColor = "var(--danger)";
                    alert("FIREBASE ERROR: " + e.message + "\n\nPlease fix your Firebase Rules.");
                    setTimeout(() => {
                        btn.innerText = "Save Configuration";
                        btn.style.backgroundColor = "var(--accent)";
                    }, 3000);
                });
        }
    };
}


// ================= CONTROL PANEL LOGIC =================
const autoBtn = document.getElementById("autoBtn");
const manualBtn = document.getElementById("manualBtn");
const manualControls = document.getElementById("manualControls");

function updateModeUI(mode) {
    currentMode = mode;
    if (mode === "manual") {
        autoBtn.classList.remove("active");
        manualBtn.classList.add("active");
        manualControls.classList.remove("hidden");
    } else {
        manualBtn.classList.remove("active");
        autoBtn.classList.add("active");
        manualControls.classList.add("hidden");
    }
}

autoBtn.onclick = () => {
    updateModeUI("auto");
    db.ref(`users/${currentUser.uid}/config/mode`).set("auto").catch(e => alert("Database Error: " + e.message));
};
manualBtn.onclick = () => {
    updateModeUI("manual");
    db.ref(`users/${currentUser.uid}/config/mode`).set("manual").catch(e => alert("Database Error: " + e.message));
};
function updateMotorButtonsUI(status) {
    const onBtn = document.getElementById("motorOnBtn");
    const offBtn = document.getElementById("motorOffBtn");
    if (status === "ON") {
        onBtn.style.opacity = "1";
        onBtn.style.boxShadow = "0 0 15px rgba(22, 163, 74, 0.4)";
        offBtn.style.opacity = "0.4";
        offBtn.style.boxShadow = "none";
    } else {
        onBtn.style.opacity = "0.4";
        onBtn.style.boxShadow = "none";
        offBtn.style.opacity = "1";
        offBtn.style.boxShadow = "0 0 15px rgba(220, 38, 38, 0.4)";
    }
}

document.getElementById("motorOnBtn").onclick = () => {
    currentMotorStatus = "ON";
    updateMotorButtonsUI("ON");
    db.ref(`users/${currentUser.uid}/config/motor`).set("ON").catch(e => alert("Database Error: " + e.message));
};
document.getElementById("motorOffBtn").onclick = () => {
    currentMotorStatus = "OFF";
    updateMotorButtonsUI("OFF");
    db.ref(`users/${currentUser.uid}/config/motor`).set("OFF").catch(e => alert("Database Error: " + e.message));
};

document.getElementById("windDirection").onchange = (e) => {
    db.ref(`users/${currentUser.uid}/config/windDirection`).set(e.target.value).catch(e => alert("Database Error: " + e.message));
};

function listenToConfig() {
    db.ref(`users/${currentUser.uid}/config`).on("value", snap => {
        const c = snap.val() || {};
        currentMode = c.mode || "auto";
        currentMotorStatus = c.motor || "OFF";

        // Don't overwrite local config changes if the user is actively editing them
        // Only load initially or if not touched
        if (Object.keys(localConfigState).length === 0) {
            if (c.plant) plantSelect.value = c.plant;
            if (c.soil) soilSelect.value = c.soil;
            if (c.thresholdMoisture !== undefined) thresholdInput.value = c.thresholdMoisture;
            document.getElementById("depthUI").innerText = c.rootDepth || "--";
            document.getElementById("fcUI").innerText = c.fieldCapacity || "--";
            document.getElementById("wpUI").innerText = c.wiltingPoint || "--";
        }

        if (c.windDirection !== undefined) {
            document.getElementById("windDirection").value = c.windDirection;
        }

        if (c.telegram) {
            tgToken = c.telegram.token || "";
            tgChatId = c.telegram.chatId || "";
            if (document.getElementById("tgTokenInput")) document.getElementById("tgTokenInput").value = tgToken;
            if (document.getElementById("tgChatIdInput")) document.getElementById("tgChatIdInput").value = tgChatId;
        }

        updateModeUI(currentMode);
        updateMotorButtonsUI(currentMotorStatus);
    });
}

// ================= SPRINKLER & LIVE SYSTEM SUMMARY LOGIC =================
let sprinklersDataCache = {};
let serverTimeOffset = 0;
let sprinklerCheckInterval;
let isSystemOnline = false;

// Telegram Variables
let tgToken = "";
let tgChatId = "";
let lastAlertSentTime = 0;
let lastAlertSentMsg = "";

// Save Telegram Config
if (document.getElementById("saveTgBtn")) {
    document.getElementById("saveTgBtn").onclick = () => {
        const btn = document.getElementById("saveTgBtn");
        btn.innerText = "Saving...";
        let t = document.getElementById("tgTokenInput").value;
        let c = document.getElementById("tgChatIdInput").value;
        db.ref(`users/${currentUser.uid}/config/telegram`).set({ token: t, chatId: c })
            .then(() => {
                btn.innerText = "Saved!";
                btn.style.backgroundColor = "var(--success)";
                setTimeout(() => {
                    btn.innerText = "Save Alerts Config";
                    btn.style.backgroundColor = "var(--accent)";
                }, 2000);
            })
            .catch(e => {
                btn.innerText = "Error";
                btn.style.backgroundColor = "var(--danger)";
                setTimeout(() => {
                    btn.innerText = "Save Alerts Config";
                    btn.style.backgroundColor = "var(--accent)";
                }, 2000);
            });
    };
}

function listenToSprinklers() {
    db.ref(".info/serverTimeOffset").on("value", snap => {
        serverTimeOffset = snap.val() || 0;
    });

    db.ref(`users/${currentUser.uid}/sprinklers`).on("value", snap => {
        const data = snap.val();
        sprinklersDataCache = data || {};
        renderSprinklerCardsAndSummary(sprinklersDataCache);
        updateOtaDropdown(sprinklersDataCache);
    });

    if (sprinklerCheckInterval) clearInterval(sprinklerCheckInterval);
    sprinklerCheckInterval = setInterval(() => {
        if (Object.keys(sprinklersDataCache).length > 0) {
            renderSprinklerCardsAndSummary(sprinklersDataCache);
            updateOtaDropdown(sprinklersDataCache);
            if (document.getElementById("otaSprinklerSelect").value) {
                document.getElementById("otaSprinklerSelect").onchange(); // Force UI update for OTA status
            }
        }
    }, 5000);
}

function renderSprinklerCardsAndSummary(data) {
    const sprinklerList = document.getElementById("sprinklerList");
    const globalMsg = document.getElementById("globalMessageText");
    const globalMsgBanner = document.getElementById("systemMessageBanner");

    if (!data || Object.keys(data).length === 0) {
        sprinklerList.innerHTML = `<p class="empty-state">No sprinklers currently connected.</p>`;
        document.getElementById("connectedCountUI").innerText = "0";
        document.getElementById("avgTimeUI").innerText = "0 min";
        document.getElementById("avgMoistureUI").innerText = "0";
        document.getElementById("avgFlowUI").innerText = "0.0";
        document.getElementById("totalTimeUI").innerText = "0 min";
        document.getElementById("waterUsageUI").innerText = "0 L";

        globalMsg.innerText = "CRITICAL: All sprinklers are offline";
        globalMsgBanner.className = "message-banner health-critical";
        globalMsgBanner.style.borderColor = "var(--danger)";

        document.getElementById("systemHealthUI").innerText = "OFFLINE";
        document.getElementById("systemHealthUI").className = "health-critical";

        // Force motor status UI to OFF
        const motorUI = document.getElementById("liveMotorStateUI");
        if (motorUI) {
            motorUI.innerText = "OFF (System Offline)";
            motorUI.style.color = "var(--danger)";
        }

        return;
    }

    sprinklerList.innerHTML = "";

    let totalMoisture = 0;
    let totalFlow = 0;
    let totalTime = 0;
    let waterUsage = 0;
    let count = 0;
    let onlineCount = 0;

    let latestAlert = "All sprinklers working properly";
    let alertLevel = "health-good"; // good, warning, critical

    let offlineSprinklers = [];
    let criticalSprinklers = [];
    let warningSprinklers = [];

    for (let id in data) {
        let s = data[id];

        let isOnline = true;
        if (s.lastUpdated) {
            let estimatedServerTime = Date.now() + serverTimeOffset;
            let timeDiff = estimatedServerTime - s.lastUpdated;
            if (timeDiff > 15000) { // 15 seconds threshold
                isOnline = false;
            }
        } else {
            isOnline = false; // Legacy or non-reporting sprinklers default to offline
        }

        if (isOnline) {
            onlineCount++;
        } else {
            offlineSprinklers.push(id);
        }

        let m = Number(s.moisture) || 0;
        let f = Number(s.flow) || 0;
        let t = Number(s.time) || 0;

        totalMoisture += m;
        totalFlow += f;
        totalTime += t;
        waterUsage += (f * t); // Flow (L/min) * Time (min) = Liters

        count++;

        // Track alerts for this loop
        if (s.message) {
            let msg = s.message.toLowerCase();
            if (msg.includes("clog") || msg.includes("halt") || msg.includes("overflow") || msg.includes("failed") || msg.includes("stop")) {
                criticalSprinklers.push(`${id}: ${s.message}`);
            } else if (msg.includes("low flow")) {
                warningSprinklers.push(id);
            }
        }

        let moistureDisplay = s.moisture || 0;
        let flowDisplay = s.flow || 0;
        let timeDisplay = s.time ? Number(s.time).toFixed(1) : 0;

        let cardHtml = `
            <div class="sprinkler-card ${isOnline ? 'online' : 'offline'}">
                <div class="sp-header">
                    <span class="sp-id">${id}</span>
                    <span class="sp-status">${isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <div class="sp-data">
                    <div class="sp-data-item">
                        <span>Flow(L/min)</span>
                        <strong>${flowDisplay}</strong>
                    </div>
                    <div class="sp-data-item">
                        <span>Moisture</span>
                        <strong>${moistureDisplay}</strong>
                    </div>
                    <div class="sp-data-item" style="grid-column: span 2;">
                        <span>Irrigation Time</span>
                        <strong>${timeDisplay} min</strong>
                    </div>
                </div>
                <div class="sp-msg-panel">
                    <div class="msg-label">Message from Esp:</div>
                    <div class="msg-content">${s.message || "Idle"}</div>
                </div>
            </div>
        `;
        sprinklerList.innerHTML += cardHtml;
    }

    // Update Control Panel & Summary Metrics
    document.getElementById("connectedCountUI").innerText = count;

    let avgM = count > 0 ? (totalMoisture / count).toFixed(0) : "0";
    let avgF = count > 0 ? (totalFlow / count).toFixed(1) : "0.0";
    let avgT = count > 0 ? (totalTime / count).toFixed(1) : "0";

    document.getElementById("avgMoistureUI").innerText = avgM;
    document.getElementById("avgFlowUI").innerText = avgF;
    document.getElementById("avgTimeUI").innerText = avgT + " min";
    document.getElementById("totalTimeUI").innerText = totalTime.toFixed(1) + " min";
    document.getElementById("waterUsageUI").innerText = waterUsage.toFixed(1) + " L";

    // Determine System Messages Priorities (Combining all active issues)
    let allAlerts = [];

    if (offlineSprinklers.length === count && count > 0) {
        allAlerts = ["All sprinklers are offline"];
    } else {
        if (criticalSprinklers.length > 0) {
            allAlerts.push(`${criticalSprinklers.join(" | ")}`);
        }
        if (offlineSprinklers.length > 0) {
            allAlerts.push(`${offlineSprinklers.length} offline (${offlineSprinklers.join(", ")})`);
        }
        if (warningSprinklers.length > 0) {
            allAlerts.push(`Low flow on ${warningSprinklers.join(", ")}`);
        }
    }

    if (allAlerts.length > 0) {
        latestAlert = "⚠ " + allAlerts.join(" • ");
        if (criticalSprinklers.length > 0 || (offlineSprinklers.length === count && count > 0)) {
            alertLevel = "health-critical";
        } else {
            alertLevel = "health-warning";
        }
    } else {
        latestAlert = "✔ All sprinklers working properly";
        alertLevel = "health-good";
    }

    // Update System Message
    globalMsg.innerText = latestAlert;

    let healthUI = document.getElementById("systemHealthUI");
    if (alertLevel === "health-critical") {
        globalMsgBanner.style.borderColor = "var(--danger)";
        healthUI.innerText = (offlineSprinklers.length === count && count > 0) ? "OFFLINE" : "ISSUE DETECTED";
        healthUI.className = "health-critical";
    } else if (alertLevel === "health-warning") {
        globalMsgBanner.style.borderColor = "#fbbf24";
        healthUI.innerText = "WARNING";
        healthUI.className = "health-warning";
    } else {
        globalMsgBanner.style.borderColor = "var(--success)";
        healthUI.innerText = "GOOD";
        healthUI.className = "health-good";
    }

    // Calculate Live Motor Status
    let motorStatusUI = document.getElementById("liveMotorStateUI");
    if (motorStatusUI) {
        if (onlineCount === 0 && count > 0) {
            motorStatusUI.innerText = "OFF (System Offline)";
            motorStatusUI.style.color = "var(--danger)";
        } else if (currentMode === "manual") {
            let isMotorOn = (currentMotorStatus === "ON");
            motorStatusUI.innerText = isMotorOn ? "ON (Manual)" : "OFF (Manual)";
            motorStatusUI.style.color = isMotorOn ? "var(--accent)" : "var(--danger)";
        } else {
            let threshold = Number(document.getElementById("thresholdInput").value) || 500;
            let avgM = count > 0 ? (totalMoisture / count) : 0;

            let hasSoilWet = false;
            let errorCount = 0;
            for (let id in data) {
                if (data[id] && data[id].message) {
                    let m = data[id].message.toLowerCase();
                    if (m.includes("soil wet")) {
                        hasSoilWet = true;
                    }
                    if (m.includes("stop") || m.includes("halt") || m.includes("failed") || m.includes("clog")) {
                        errorCount++;
                    }
                }
            }

            let allHaveErrors = (count > 0 && errorCount === count);

            if (typeof window.motorOnTime === 'undefined') window.motorOnTime = 0;
            if (typeof window.lastMotorState === 'undefined') window.lastMotorState = "OFF";

            let newMotorState = "OFF";

            if (count > 0 && avgM > threshold && !hasSoilWet) {
                newMotorState = "ON"; // Assume we want it ON

                if (allHaveErrors) {
                    if (window.lastMotorState === "ON") {
                        if (Date.now() - window.motorOnTime < 45000) {
                            newMotorState = "ON"; // Grace period
                        } else {
                            newMotorState = "OFF"; // Halted
                        }
                    } else {
                        newMotorState = "OFF"; // Stay halted permanently
                    }
                }
            }

            if (newMotorState === "ON" && window.lastMotorState === "OFF") {
                window.motorOnTime = Date.now();
            }
            window.lastMotorState = newMotorState;

            let isGracePeriod = window.lastMotorState === "ON" && (Date.now() - window.motorOnTime < 45000);

            if (newMotorState === "ON") {
                if (isGracePeriod) {
                    let secondsLeft = Math.ceil((45000 - (Date.now() - window.motorOnTime)) / 1000);
                    motorStatusUI.innerText = `ON (Priming... ${secondsLeft}s)`;
                } else {
                    motorStatusUI.innerText = "ON (Auto)";
                }
                motorStatusUI.style.color = "var(--accent)";
            } else {
                if (allHaveErrors && count > 0 && avgM > threshold) {
                    motorStatusUI.innerText = "OFF (Halted)";
                    motorStatusUI.style.color = "var(--danger)";
                } else if (hasSoilWet) {
                    motorStatusUI.innerText = "OFF (Irrigation Completed)";
                    motorStatusUI.style.color = "var(--danger)";
                } else {
                    motorStatusUI.innerText = "OFF (Auto)";
                    motorStatusUI.style.color = "var(--danger)";
                }
            }
        }
    }
}

// ================= OTA / DEVICE STATUS =================
const otaSprinklerSelect = document.getElementById("otaSprinklerSelect");
const otaUpdateBtn = document.getElementById("otaUpdateBtn");

function updateOtaDropdown(data) {
    let currentSelection = otaSprinklerSelect.value;

    // Check if we actually need to rebuild the dropdown to avoid interrupting user clicks
    let currentOptions = Array.from(otaSprinklerSelect.options).map(o => o.value).filter(v => v !== "");
    let newDataKeys = Object.keys(data);
    let needsUpdate = currentOptions.length !== newDataKeys.length || currentOptions.some(k => !newDataKeys.includes(k));

    if (needsUpdate) {
        otaSprinklerSelect.innerHTML = "<option value=''>-- Select Sprinkler --</option>";
        for (let id in data) {
            let opt = document.createElement("option");
            opt.value = id;
            opt.innerText = id;
            otaSprinklerSelect.appendChild(opt);
        }
        if (data[currentSelection]) {
            otaSprinklerSelect.value = currentSelection;
        } else {
            resetOtaPanel();
        }
    }
}

otaSprinklerSelect.onchange = () => {
    let id = otaSprinklerSelect.value;
    if (!id || !sprinklersDataCache[id]) {
        resetOtaPanel();
        return;
    }

    let s = sprinklersDataCache[id];

    // Evaluate if it's currently online
    let isOnline = true;
    if (s.lastUpdated) {
        let estimatedServerTime = Date.now() + serverTimeOffset;
        let timeDiff = estimatedServerTime - s.lastUpdated;
        if (timeDiff > 15000) { // 15 seconds threshold
            isOnline = false;
        }
    } else {
        isOnline = false;
    }

    if (isOnline) {
        document.getElementById("otaStatusUI").innerText = "ONLINE";
        document.getElementById("otaStatusUI").style.color = "var(--success)";
    } else {
        document.getElementById("otaStatusUI").innerText = "OFFLINE";
        document.getElementById("otaStatusUI").style.color = "var(--danger)";
    }

    if (s.ip && isOnline) {
        document.getElementById("otaIpUI").innerText = s.ip;
        otaUpdateBtn.href = `http://${s.ip}/update`;
        otaUpdateBtn.style.pointerEvents = "auto";
        otaUpdateBtn.style.opacity = "1";
    } else {
        document.getElementById("otaIpUI").innerText = s.ip ? s.ip : "Not Reported";
        otaUpdateBtn.href = "#";
        otaUpdateBtn.style.pointerEvents = "none";
        otaUpdateBtn.style.opacity = "0.5";
    }
};

function resetOtaPanel() {
    document.getElementById("otaStatusUI").innerText = "--";
    document.getElementById("otaStatusUI").style.color = "white";
    document.getElementById("otaIpUI").innerText = "--";
    otaUpdateBtn.href = "#";
    otaUpdateBtn.style.pointerEvents = "none";
    otaUpdateBtn.style.opacity = "0.5";
}

// ================= HISTORY / PREVIOUS RECORDS =================
function listenToHistory() {
    db.ref(`users/${currentUser.uid}/history`).limitToLast(15).on("value", snap => {
        const historyList = document.getElementById("historyList");
        if (!snap.exists()) {
            historyList.innerHTML = `<tr><td colspan="6" class="empty-state">No records yet. System will log automatically.</td></tr>`;
            return;
        }

        historyList.innerHTML = "";
        let records = [];
        snap.forEach(child => { records.push(child.val()); });
        records.reverse(); // Newest first

        records.forEach(r => {
            let date = new Date(r.timestamp).toLocaleString();
            let statusColor = (r.status.includes("STOP") || r.status.includes("HALT") || r.status.includes("Failed")) ? "var(--danger)" : "var(--success)";

            historyList.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td><strong>${r.sprinklerId || "Unknown"}</strong></td>
                    <td style="color: ${statusColor}">${r.status}</td>
                    <td>${r.moisture ? Number(r.moisture).toFixed(0) : 0}</td>
                    <td>${r.flow ? Number(r.flow).toFixed(1) : 0}</td>
                    <td>${r.time ? Number(r.time).toFixed(1) : 0}</td>
                </tr>
            `;
        });
    });
}

// ==========================================
// CUSTOM CURSOR ANIMATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Check if on a mobile device, disable custom cursor if so to save battery/performance
    if (window.innerWidth <= 768 || ('ontouchstart' in window)) return;

    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    document.body.appendChild(glow);
    document.body.appendChild(dot);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let glowX = mouseX;
    let glowY = mouseY;

    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Show cursor if it was hidden
        if (dot.style.opacity === '0' || dot.style.opacity === '') {
            dot.style.opacity = '1';
            glow.style.opacity = '1';
        }
    });

    document.addEventListener("mouseleave", () => {
        dot.style.opacity = '0';
        glow.style.opacity = '0';
    });

    function animateCursor() {
        // Dot follows instantly (with tiny smoothing)
        dotX += (mouseX - dotX) * 0.8;
        dotY += (mouseY - dotY) * 0.8;

        // Glow has a spring/delay effect
        glowX += (mouseX - glowX) * 0.15;
        glowY += (mouseY - glowY) * 0.15;

        dot.style.left = dotX + "px";
        dot.style.top = dotY + "px";
        glow.style.left = glowX + "px";
        glow.style.top = glowY + "px";

        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effect for interactive elements
    const setupHoverEffects = () => {
        const interactiveElements = document.querySelectorAll('button, a, input, select, .glass-panel, .sprinkler-card, .profile-icon, .toggle-btn, .action-btn');
        interactiveElements.forEach(el => {
            // Avoid adding multiple listeners
            if (el.hasAttribute('data-cursor-hover')) return;
            el.setAttribute('data-cursor-hover', 'true');

            el.addEventListener('mouseenter', () => {
                glow.style.width = '60px';
                glow.style.height = '60px';
                glow.style.borderColor = 'rgba(21, 128, 61, 0.8)';
                glow.style.backgroundColor = 'rgba(21, 128, 61, 0.15)';
                dot.style.transform = 'translate(-50%, -50%) scale(0.5)';
            });
            el.addEventListener('mouseleave', () => {
                glow.style.width = '40px';
                glow.style.height = '40px';
                glow.style.borderColor = 'rgba(21, 128, 61, 0.4)';
                glow.style.backgroundColor = 'rgba(21, 128, 61, 0.1)';
                dot.style.transform = 'translate(-50%, -50%) scale(1)';
            });
        });
    };

    // Initial setup
    setTimeout(setupHoverEffects, 1000);

    // Setup on clicks to catch dynamic elements
    document.addEventListener('click', () => {
        setTimeout(setupHoverEffects, 500);
    });
});
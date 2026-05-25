// app.js - Monolithic version to bypass file:/// CORS block

// --- 1. STATE (db.js) ---
const state = {
    profile: JSON.parse(localStorage.getItem('nutriflow_profile')) || null,
    catalog: JSON.parse(localStorage.getItem('nutriflow_catalog')) || [],
    currentScan: null,
    adminApiKey: localStorage.getItem('nutriflow_admin_apikey') || null,
    guestScanCount: parseInt(localStorage.getItem('nutriflow_guest_scans')) || 0
};

function saveProfile(profileData) {
    state.profile = profileData;
    localStorage.setItem('nutriflow_profile', JSON.stringify(state.profile));
}

function saveAdminKey(key) {
    state.adminApiKey = key;
    localStorage.setItem('nutriflow_admin_apikey', key);
}

function saveToCatalog(verifiedData) {
    let score = 100;
    if (verifiedData.sodium > 800) score -= 30;
    else if (verifiedData.sodium > 400) score -= 15;
    
    if (verifiedData.sugar > 20) score -= 25;
    else if (verifiedData.sugar > 10) score -= 10;
    
    if (verifiedData.protein > 15) score += 10;
    
    score = Math.max(0, Math.min(100, score));
    verifiedData.healthScore = score;

    state.catalog.push(verifiedData);
    localStorage.setItem('nutriflow_catalog', JSON.stringify(state.catalog));
    return verifiedData;
}

// --- 2. PRESETS (presets.js) ---
const PRESETS = [
    { id: 1, name: 'มาม่าต้มยำกุ้ง', calories: 260, protein: 5, carbs: 36, fat: 11, sugar: 4, sodium: 1860, vitamins: '', ai_summary: 'โซเดียมสูงมาก ระวังโรคไต' },
    { id: 2, name: 'ชาเขียวโออิชิ (ต้นตำรับ)', calories: 120, protein: 0, carbs: 30, fat: 0, sugar: 29, sodium: 30, vitamins: '', ai_summary: 'ระวังปริมาณน้ำตาลที่สูงเกินความต้องการต่อมื้อ' },
    { id: 3, name: 'มันฝรั่งเลย์แผ่นหยัก', calories: 160, protein: 2, carbs: 16, fat: 10, sugar: 1, sodium: 150, vitamins: '', ai_summary: 'ขนมขบเคี้ยวให้พลังงานสูง ควรบริโภคแต่น้อย' },
    { id: 4, name: 'อกไก่พร้อมทาน 7-11', calories: 90, protein: 20, carbs: 0, fat: 1, sugar: 0, sodium: 340, vitamins: '', ai_summary: 'แหล่งโปรตีนชั้นดี เหมาะสำหรับสร้างกล้ามเนื้อ' },
    { id: 5, name: 'นมเปรี้ยวดัชมิลล์', calories: 140, protein: 4, carbs: 22, fat: 3, sugar: 18, sodium: 60, vitamins: 'Calcium 15%', ai_summary: 'มีแคลเซียม แต่ควรระวังน้ำตาล' }
];

// --- 3. UI (ui.js) ---
function logSQL(query) {
    const terminal = document.getElementById('sql-logs');
    if (!terminal) return;
    const line = document.createElement('div');
    line.className = 'sql-line';
    let formattedQuery = query
        .replace(/^(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|VALUES|WHERE|SET)/gi, '<span style="color:var(--sql-keyword)">$1</span>')
        .replace(/('[^']*')/g, '<span style="color:var(--sql-string)">$1</span>')
        .replace(/\b(\d+(\.\d+)?)\b/g, '<span style="color:var(--sql-number)">$1</span>');
    line.innerHTML = `> ${formattedQuery}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function writeAILog(message, color = 'var(--text-main)') {
    const aiLogs = document.getElementById('ai-logs');
    const p = document.createElement('p');
    p.className = 'log-line';
    p.innerHTML = `<span style="color:${color}">${message}</span>`;
    aiLogs.appendChild(p);
    aiLogs.scrollTop = aiLogs.scrollHeight;
}

function calculateTDEE(p) {
    let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
    bmr += (p.gender === 'male') ? 5 : -161;
    let tdee = bmr * 1.55; 
    if (p.goal === 'lose') tdee -= 500;
    if (p.goal === 'gain') tdee += 500;
    return {
        calories: Math.round(tdee),
        sodium: 2300, 
        sugar: Math.round((tdee * 0.1) / 4) 
    };
}

function updateBudgetUI() {
    if(!state.profile) return;
    const limits = calculateTDEE(state.profile);
    document.getElementById('budget-cal').querySelector('.value').textContent = `0 / ${limits.calories}`;
    document.getElementById('budget-sodium').querySelector('.value').textContent = `0 / ${limits.sodium}mg`;
    document.getElementById('budget-sugar').querySelector('.value').textContent = `0 / ${limits.sugar}g`;
}

function populateVerificationForm(data) {
    state.currentScan = data;
    document.getElementById('input-name').value = data.name || '';
    document.getElementById('input-cal').value = data.calories || 0;
    document.getElementById('input-protein').value = data.protein || 0;
    document.getElementById('input-carbs').value = data.carbs || 0;
    document.getElementById('input-fat').value = data.fat || 0;
    document.getElementById('input-vitamins').value = data.vitamins || '';
    document.getElementById('input-summary').value = data.ai_summary || '';
    
    const sugarInput = document.getElementById('input-sugar');
    const sodiumInput = document.getElementById('input-sodium');
    
    if(data.name && data.name.includes('มาม่า')) {
        document.getElementById('group-sodium').classList.add('warning-state');
        document.getElementById('group-sodium').querySelector('.badge').classList.remove('hidden');
        sodiumInput.value = (data.sodium || 0) + 200; 
        writeAILog(`[Warning] Low confidence on Sodium value.`, 'var(--amber-500)');
    } else {
        document.getElementById('group-sodium').classList.remove('warning-state');
        document.getElementById('group-sodium').querySelector('.badge').classList.add('hidden');
        sodiumInput.value = data.sodium || 0;
    }

    if(data.name && data.name.includes('โออิชิ')) {
        document.getElementById('group-sugar').classList.add('warning-state');
        document.getElementById('group-sugar').querySelector('.badge').classList.remove('hidden');
        sugarInput.value = (data.sugar || 0) + 10;
        writeAILog(`[Warning] Low confidence on Sugar value.`, 'var(--amber-500)');
    } else {
        document.getElementById('group-sugar').classList.remove('warning-state');
        document.getElementById('group-sugar').querySelector('.badge').classList.add('hidden');
        sugarInput.value = data.sugar || 0;
    }

    logSQL(`INSERT INTO scanning_buffer (name, calories) VALUES ('${data.name}', ${data.calories});`);
    document.getElementById('modal-verification').classList.remove('hidden');
}

function showHealthProfiler(data) {
    state.currentScan = data;
    const profiler = document.getElementById('health-profiler');
    profiler.classList.remove('hidden');
    
    document.getElementById('result-name').textContent = data.name;
    document.getElementById('ai-summary-display').textContent = data.ai_summary || 'No summary available.';
    
    const scoreCircle = document.getElementById('health-score-display');
    scoreCircle.querySelector('.score-value').textContent = data.healthScore;
    
    if(data.healthScore >= 80) {
        scoreCircle.style.borderColor = 'var(--emerald-500)';
        scoreCircle.style.color = 'var(--emerald-500)';
    } else if(data.healthScore >= 50) {
        scoreCircle.style.borderColor = 'var(--amber-500)';
        scoreCircle.style.color = 'var(--amber-500)';
    } else {
        scoreCircle.style.borderColor = 'var(--red-500)';
        scoreCircle.style.color = 'var(--red-500)';
    }

    const badgeKeto = document.getElementById('badge-keto');
    const badgeSodium = document.getElementById('badge-low-sodium');
    
    badgeKeto.textContent = (data.carbs < 10) ? '✅ Keto Friendly' : '❌ Not Keto';
    badgeKeto.style.color = (data.carbs < 10) ? 'var(--emerald-500)' : 'var(--text-muted)';
    
    badgeSodium.textContent = (data.sodium < 140) ? '✅ Low Sodium' : '❌ High Sodium';
    badgeSodium.style.color = (data.sodium < 140) ? 'var(--emerald-500)' : 'var(--red-500)';
}

function renderCatalog() {
    const list = document.getElementById('catalog-list');
    list.innerHTML = '';
    if (state.catalog.length === 0) {
        list.innerHTML = '<li class="text-muted text-sm">No items verified yet.</li>';
        return;
    }
    [...state.catalog].reverse().forEach(item => {
        const li = document.createElement('li');
        li.className = 'catalog-item';
        li.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <div class="text-muted text-sm">${item.calories} kcal | Pro: ${item.protein}g</div>
            </div>
            <div style="display:flex; align-items:center; font-weight:bold; color:var(--emerald-500);">
                Score: ${item.healthScore}
            </div>
        `;
        list.appendChild(li);
    });
}

// --- 4. API (api.js) ---
async function analyzeImageWithGemini(base64DataUrl, fallbackName) {
    const apiKeyRaw = state.adminApiKey;
    if (!apiKeyRaw) {
        writeAILog(`[Error] No API Key provided in Admin settings.`, 'var(--red-500)');
        return fallbackSimulation(fallbackName);
    }
    
    const apiKey = apiKeyRaw.trim();
    writeAILog(`[Gemini] Sending image base64 to generative-language API...`);
    const base64Content = base64DataUrl.split(',')[1];

    const prompt = `You are an expert nutritionist AI. Analyze the attached image (which is a food/drink nutrition label).
Extract the following information exactly in a JSON format. If a value is missing or unknown, use 0 or leave empty. 
Do not output markdown block wrappers (like \`\`\`json), just raw JSON string.
{
  "name": "Product Name (guess from image or use 'Unknown Product')",
  "calories": (number),
  "protein": (number),
  "carbs": (number),
  "fat": (number),
  "sugar": (number),
  "sodium": (number),
  "vitamins": "List of vitamins and their % or amount (e.g. Calcium 20%, Vitamin C 10%)",
  "ai_summary": "A short 2-3 sentence explanation in Thai about why this is good or what to be careful of based on the macros."
}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Content } } ] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const result = await response.json();
        let textResult = result.candidates[0].content.parts[0].text;
        
        textResult = textResult.replace(/^```json/g, '').replace(/```$/g, '').trim();
        const data = JSON.parse(textResult);
        
        writeAILog(`[Gemini] Analysis complete! Parsing JSON response...`, 'var(--emerald-500)');
        logSQL(`-- Gemini API Returned: ${JSON.stringify(data).substring(0,50)}...`);
        
        if(data.name === 'Unknown Product' || !data.name) data.name = fallbackName;
        data.timestamp = new Date().toISOString();
        
        document.getElementById('scan-overlay').classList.add('hidden');
        
        const savedData = saveToCatalog(data);
        renderCatalog();
        showHealthProfiler(savedData);
        
    } catch (err) {
        writeAILog(`[Error] Gemini API Failed: ${err.message}`, 'var(--red-500)');
        document.getElementById('scan-overlay').classList.add('hidden');
        fallbackSimulation(fallbackName);
    }
}

function runScannerSimulation(preset, base64Image = null) {
    document.getElementById('health-profiler').classList.add('hidden');
    
    logSQL(`SELECT * FROM items WHERE item_name = '${preset.name}';`);
    
    const aiLogs = document.getElementById('ai-logs');
    aiLogs.innerHTML = ''; 
    writeAILog(`[System] Loading image for: ${preset.name}...`);
    
    const overlay = document.getElementById('scan-overlay');
    overlay.classList.remove('hidden');
    
    if (base64Image && state.adminApiKey) {
        writeAILog(`[Vision AI] API Key found. Connecting to Gemini API...`);
        analyzeImageWithGemini(base64Image, preset.name);
        return; 
    }

    if(base64Image && (!state.adminApiKey)) {
        writeAILog(`[System] No Gemini API key found. Falling back to local simulation.`, 'var(--amber-500)');
    }

    setTimeout(() => writeAILog(`[Vision AI] Locating Nutrition Facts panel...`), 500);
    setTimeout(() => writeAILog(`[Vision AI] Panel found. Running OCR grid scan...`), 1200);
    setTimeout(() => writeAILog(`[Smart Parser] Extracting numeric values...`), 2200);
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        writeAILog(`[Smart Parser] Data extracted automatically.`, 'var(--emerald-500)');
        
        preset.timestamp = new Date().toISOString();
        preset.ai_summary = preset.ai_summary || 'Mocked simulation analysis.';
        
        const savedData = saveToCatalog(preset);
        renderCatalog();
        showHealthProfiler(savedData);
    }, 3500);
}

function fallbackSimulation(fallbackName) {
    const data = {
        name: fallbackName, calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, vitamins: '', ai_summary: 'Failed to connect to API or No Key Provided.', timestamp: new Date().toISOString()
    };
    const savedData = saveToCatalog(data);
    renderCatalog();
    showHealthProfiler(savedData);
}

// --- 5. CAMERA (camera.js) ---
let localMediaStream = null;

function initCameraControls() {
    const videoElement = document.getElementById('camera-stream');
    const canvasElement = document.getElementById('snapshot-canvas');
    const shutterBtn = document.getElementById('btn-snap');
    const shutterControl = document.getElementById('shutter-control');
    const btnCamera = document.getElementById('btn-camera');
    const btnUpload = document.getElementById('btn-upload');
    const fileInput = document.getElementById('file-input');

    btnCamera.addEventListener('click', async () => {
        if (!checkFreemiumAccess()) return;
        try {
            logSQL("-- Requesting WebRTC camera access");
            writeAILog("[System] Initializing camera stream...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            localMediaStream = stream;
            videoElement.srcObject = stream;
            videoElement.classList.remove('hidden');
            canvasElement.classList.add('hidden');
            shutterControl.classList.remove('hidden');
            document.querySelector('.viewfinder-placeholder').classList.add('hidden');
        } catch (err) {
            writeAILog(`[Error] Camera access denied: ${err.message}`, 'var(--red-500)');
            logSQL(`-- ERROR: navigator.mediaDevices.getUserMedia failed.`);
        }
    });

    shutterBtn.addEventListener('click', () => {
        if (!localMediaStream) return;
        const context = canvasElement.getContext('2d');
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        localMediaStream.getTracks().forEach(track => track.stop());
        videoElement.classList.add('hidden');
        canvasElement.classList.remove('hidden');
        shutterControl.classList.add('hidden');
        
        writeAILog("[System] Photo captured. Starting analysis...");
        const base64 = canvasElement.toDataURL('image/jpeg');
        runScannerSimulation({ name: 'Live Camera Capture' }, base64);
    });

    btnUpload.addEventListener('click', () => {
        if (!checkFreemiumAccess()) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.querySelector('.viewfinder-placeholder').classList.add('hidden');
                videoElement.classList.add('hidden');
                canvasElement.classList.remove('hidden');
                shutterControl.classList.add('hidden');
                
                const img = new Image();
                img.onload = () => {
                    const context = canvasElement.getContext('2d');
                    canvasElement.width = img.width;
                    canvasElement.height = img.height;
                    context.drawImage(img, 0, 0, canvasElement.width, canvasElement.height);
                    
                    writeAILog("[System] Image uploaded. Starting analysis...");
                    const base64 = canvasElement.toDataURL('image/jpeg');
                    runScannerSimulation({ name: 'Uploaded Photo' }, base64);
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(e.target.files[0]);
        }
    });
}

// --- 6. AUTH (auth.js) ---
function checkFreemiumAccess() { return true; } // Bypassed

function initAuthListeners() {
    document.getElementById('btn-login-header').addEventListener('click', () => alert('Bypassed during testing!'));
    document.getElementById('btn-google-login').addEventListener('click', () => alert('Bypassed during testing!'));
    document.getElementById('btn-close-login').addEventListener('click', () => document.getElementById('modal-login').classList.add('hidden'));
}

// --- 7. MAIN ORCHESTRATOR ---
document.addEventListener('DOMContentLoaded', () => {
    initAuthListeners();

    if (!state.profile) {
        document.getElementById('modal-onboarding').classList.remove('hidden');
        logSQL("SELECT * FROM user_profile LIMIT 1; -- 0 rows returned");
    } else {
        document.getElementById('modal-onboarding').classList.add('hidden');
        updateBudgetUI();
        logSQL("SELECT * FROM user_profile LIMIT 1;");
    }
    
    renderCatalog();
    initCameraControls();
    
    // Render presets
    const gallery = document.getElementById('presets-gallery');
    gallery.innerHTML = '<span class="text-muted text-sm" style="margin-right:10px;">Presets:</span>';
    PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'preset-chip';
        btn.textContent = p.name;
        btn.addEventListener('click', () => { if (checkFreemiumAccess()) runScannerSimulation(p); });
        gallery.appendChild(btn);
    });

    // Event Listeners
    document.getElementById('btn-skip-profile').addEventListener('click', () => {
        document.getElementById('modal-onboarding').classList.add('hidden');
        logSQL("-- Onboarding skipped");
    });
    
    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfile({
            gender: document.getElementById('profile-gender').value,
            age: parseInt(document.getElementById('profile-age').value),
            weight: parseFloat(document.getElementById('profile-weight').value),
            height: parseFloat(document.getElementById('profile-height').value),
            goal: document.getElementById('profile-goal').value
        });
        document.getElementById('modal-onboarding').classList.add('hidden');
        updateBudgetUI();
        logSQL(`INSERT INTO user_profile (gender, age, weight, height, goal) VALUES ('${state.profile.gender}', ${state.profile.age}, ${state.profile.weight}, ${state.profile.height}, '${state.profile.goal}');`);
    });

    document.getElementById('btn-open-profile').addEventListener('click', () => {
        if(state.profile) {
            document.getElementById('profile-gender').value = state.profile.gender;
            document.getElementById('profile-age').value = state.profile.age;
            document.getElementById('profile-weight').value = state.profile.weight;
            document.getElementById('profile-height').value = state.profile.height;
            document.getElementById('profile-goal').value = state.profile.goal;
        }
        document.getElementById('modal-onboarding').classList.remove('hidden');
    });

    document.getElementById('btn-verify').addEventListener('click', () => {
        const verifiedData = {
            name: document.getElementById('input-name').value,
            calories: parseFloat(document.getElementById('input-cal').value),
            protein: parseFloat(document.getElementById('input-protein').value),
            carbs: parseFloat(document.getElementById('input-carbs').value),
            fat: parseFloat(document.getElementById('input-fat').value),
            sugar: parseFloat(document.getElementById('input-sugar').value),
            sodium: parseFloat(document.getElementById('input-sodium').value),
            vitamins: document.getElementById('input-vitamins').value,
            ai_summary: document.getElementById('input-summary').value,
            timestamp: state.currentScan ? state.currentScan.timestamp : new Date().toISOString()
        };

        if (state.currentScan && state.currentScan.timestamp) {
            state.catalog = state.catalog.filter(item => item.timestamp !== state.currentScan.timestamp);
        }

        const result = saveToCatalog(verifiedData);
        logSQL(`INSERT INTO verified_catalog (product_name, calories, health_score, ...) VALUES ('${result.name}', ${result.calories}, ${result.healthScore}, ...);`);
        renderCatalog();
        showHealthProfiler(result);
        writeAILog(`[System] Human verification confirmed. Saved to catalog.`, 'var(--emerald-500)');
        document.getElementById('modal-verification').classList.add('hidden');
    });

    document.getElementById('btn-cancel-verify').addEventListener('click', () => {
        document.getElementById('modal-verification').classList.add('hidden');
        writeAILog(`[System] Verification cancelled by user.`, 'var(--amber-500)');
    });
    
    document.getElementById('btn-edit-scan').addEventListener('click', () => {
        if(state.currentScan) populateVerificationForm(state.currentScan);
    });

    document.getElementById('logo-admin-trigger').addEventListener('dblclick', () => {
        document.getElementById('admin-apikey').value = state.adminApiKey || '';
        document.getElementById('modal-admin').classList.remove('hidden');
    });
    
    document.getElementById('btn-close-admin').addEventListener('click', () => {
        document.getElementById('modal-admin').classList.add('hidden');
    });

    document.getElementById('btn-save-admin').addEventListener('click', () => {
        saveAdminKey(document.getElementById('admin-apikey').value);
        document.getElementById('modal-admin').classList.add('hidden');
        logSQL("-- Secret Admin API Key updated.");
    });
});

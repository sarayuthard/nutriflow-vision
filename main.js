// main.js
import { state, saveProfile, saveAdminKey, saveToCatalog } from './db.js';
import { logSQL, updateBudgetUI, renderCatalog, showHealthProfiler, writeAILog, populateVerificationForm } from './ui.js';
import { runScannerSimulation } from './api.js';
import { initCameraControls } from './camera.js';
import { initAuthListeners, checkFreemiumAccess } from './auth.js';
import { PRESETS } from './presets.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Auth
    initAuthListeners();

    // 2. Init UI (Budgets, Catalog)
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
    renderPresets();

    // 3. Profile Form Handlers
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

    // 4. Verification Submit Handler
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
        
        document.querySelectorAll('.warning-state').forEach(el => el.classList.remove('warning-state'));
        document.querySelectorAll('.badge').forEach(el => el.classList.add('hidden'));
        
        document.getElementById('modal-verification').classList.add('hidden');
    });

    document.getElementById('btn-cancel-verify').addEventListener('click', () => {
        document.getElementById('modal-verification').classList.add('hidden');
        writeAILog(`[System] Verification cancelled by user.`, 'var(--amber-500)');
    });
    
    document.getElementById('btn-edit-scan').addEventListener('click', () => {
        if(state.currentScan) {
            populateVerificationForm(state.currentScan);
        }
    });

    // 5. Secret Admin Trigger
    document.getElementById('logo-admin-trigger').addEventListener('dblclick', () => {
        document.getElementById('admin-apikey').value = state.adminApiKey || '';
        document.getElementById('modal-admin').classList.remove('hidden');
    });
    
    document.getElementById('btn-close-admin').addEventListener('click', () => {
        document.getElementById('modal-admin').classList.add('hidden');
    });

    document.getElementById('btn-save-admin').addEventListener('click', () => {
        const key = document.getElementById('admin-apikey').value;
        saveAdminKey(key);
        document.getElementById('modal-admin').classList.add('hidden');
        logSQL("-- Secret Admin API Key updated.");
    });
});

function renderPresets() {
    const gallery = document.getElementById('presets-gallery');
    gallery.innerHTML = '<span class="text-muted text-sm" style="margin-right:10px;">Presets:</span>';
    
    PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'preset-chip';
        btn.textContent = p.name;
        btn.addEventListener('click', () => {
            if (!checkFreemiumAccess()) return;
            runScannerSimulation(p)
        });
        gallery.appendChild(btn);
    });
}

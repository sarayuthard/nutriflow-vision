// db.js
export const state = {
    profile: JSON.parse(localStorage.getItem('nutriflow_profile')) || null,
    catalog: JSON.parse(localStorage.getItem('nutriflow_catalog')) || [],
    currentScan: null,
    adminApiKey: localStorage.getItem('nutriflow_admin_apikey') || null,
    guestScanCount: parseInt(localStorage.getItem('nutriflow_guest_scans')) || 0
};

export function saveProfile(profileData) {
    state.profile = profileData;
    localStorage.setItem('nutriflow_profile', JSON.stringify(state.profile));
}

export function saveAdminKey(key) {
    state.adminApiKey = key;
    localStorage.setItem('nutriflow_admin_apikey', key);
}

export function incrementGuestScan() {
    state.guestScanCount++;
    localStorage.setItem('nutriflow_guest_scans', state.guestScanCount);
}

export function saveToCatalog(verifiedData) {
    // Calculate Custom Health Score (0-100)
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

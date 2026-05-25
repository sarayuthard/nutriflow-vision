// ui.js
import { state } from './db.js';

export function logSQL(query) {
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

export function writeAILog(message, color = 'var(--text-main)') {
    const aiLogs = document.getElementById('ai-logs');
    const p = document.createElement('p');
    p.className = 'log-line';
    p.innerHTML = `<span style="color:${color}">${message}</span>`;
    aiLogs.appendChild(p);
    aiLogs.scrollTop = aiLogs.scrollHeight;
}

export function calculateTDEE(p) {
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

export function updateBudgetUI() {
    if(!state.profile) return;
    const limits = calculateTDEE(state.profile);
    const consumedCal = 0; 
    const consumedSod = 0;
    const consumedSug = 0;

    document.getElementById('budget-cal').querySelector('.value').textContent = `${consumedCal} / ${limits.calories}`;
    document.getElementById('budget-sodium').querySelector('.value').textContent = `${consumedSod} / ${limits.sodium}mg`;
    document.getElementById('budget-sugar').querySelector('.value').textContent = `${consumedSug} / ${limits.sugar}g`;
}

export function populateVerificationForm(data) {
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
    
    // Warn if simulated uncertainty (Mock logic)
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
}

export function showHealthProfiler(data) {
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

export function renderCatalog() {
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

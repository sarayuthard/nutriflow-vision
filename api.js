// api.js
import { state } from './db.js';
import { logSQL, writeAILog, populateVerificationForm } from './ui.js';

export async function analyzeImageWithGemini(base64DataUrl, fallbackName) {
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
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Content } }
                    ]
                }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        let textResult = result.candidates[0].content.parts[0].text;
        
        textResult = textResult.replace(/^```json/g, '').replace(/```$/g, '').trim();
        const data = JSON.parse(textResult);
        
        writeAILog(`[Gemini] Analysis complete! Parsing JSON response...`, 'var(--emerald-500)');
        logSQL(`-- Gemini API Returned: ${JSON.stringify(data).substring(0,50)}...`);
        
        if(data.name === 'Unknown Product' || !data.name) data.name = fallbackName;
        data.timestamp = new Date().toISOString();
        
        document.getElementById('scan-overlay').classList.add('hidden');
        
        // Auto-save and show result immediately
        const { saveToCatalog } = await import('./db.js');
        const { renderCatalog, showHealthProfiler } = await import('./ui.js');
        
        const result = saveToCatalog(data);
        renderCatalog();
        showHealthProfiler(result);
        
    } catch (err) {
        writeAILog(`[Error] Gemini API Failed: ${err.message}`, 'var(--red-500)');
        document.getElementById('scan-overlay').classList.add('hidden');
        fallbackSimulation(fallbackName);
    }
}

export function runScannerSimulation(preset, base64Image = null) {
    document.getElementById('health-profiler').classList.add('hidden');
    document.getElementById('btn-verify').disabled = true;
    
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

    // Simulate OCR delay
    setTimeout(() => writeAILog(`[Vision AI] Locating Nutrition Facts panel...`), 500);
    setTimeout(() => writeAILog(`[Vision AI] Panel found. Running OCR grid scan...`), 1200);
    setTimeout(() => writeAILog(`[Smart Parser] Extracting numeric values...`), 2200);
    
    setTimeout(async () => {
        overlay.classList.add('hidden');
        writeAILog(`[Smart Parser] Data extracted automatically.`, 'var(--emerald-500)');
        
        preset.timestamp = new Date().toISOString();
        preset.ai_summary = preset.ai_summary || 'Mocked simulation analysis.';
        
        const { saveToCatalog } = await import('./db.js');
        const { renderCatalog, showHealthProfiler } = await import('./ui.js');
        
        const result = saveToCatalog(preset);
        renderCatalog();
        showHealthProfiler(result);
        
    }, 3500);
}

async function fallbackSimulation(fallbackName) {
    const data = {
        name: fallbackName, calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, vitamins: '', ai_summary: 'Failed to connect to API or No Key Provided.', timestamp: new Date().toISOString()
    };
    
    const { saveToCatalog } = await import('./db.js');
    const { renderCatalog, showHealthProfiler } = await import('./ui.js');
    
    const result = saveToCatalog(data);
    renderCatalog();
    showHealthProfiler(result);
}

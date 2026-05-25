// auth.js
import { state, incrementGuestScan } from './db.js';
import { logSQL, writeAILog } from './ui.js';

// Firebase imports removed entirely to prevent module resolution crashes (importmap errors)
let auth = null; 

export const GUEST_LIMIT = 3;

export function checkFreemiumAccess() {
    // TEMPORARILY BYPASSED FOR TESTING
    return true;
}

export function initAuthListeners() {
    document.getElementById('btn-login-header').addEventListener('click', signInWithGoogle);
    document.getElementById('btn-google-login').addEventListener('click', signInWithGoogle);
    
    document.getElementById('btn-close-login').addEventListener('click', () => {
        document.getElementById('modal-login').classList.add('hidden');
    });
}

export function signInWithGoogle() {
    alert("Firebase Auth is currently bypassed during testing!");
}

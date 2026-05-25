// camera.js
import { writeAILog, logSQL } from './ui.js';
import { runScannerSimulation } from './api.js';
import { checkFreemiumAccess } from './auth.js';

let localMediaStream = null;

export function initCameraControls() {
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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, 
                audio: false 
            });
            
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

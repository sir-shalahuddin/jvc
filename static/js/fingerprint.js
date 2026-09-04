// ==========================================
// Anti-Tamper Hardware Fingerprinting
// ==========================================
function getDeviceFingerprint() {
            try {
                if (window._retro_dev_fp) return window._retro_dev_fp;
                
                // 1. WebGL Core GPU Hardware Identification (Normalized across browsers)
                let gpuInfo = '';
                try {
                    const canvasGL = document.createElement('canvas');
                    const gl = canvasGL.getContext('webgl') || canvasGL.getContext('experimental-webgl');
                    if (gl) {
                        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                        if (debugInfo) {
                            const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
                            // Normalize GPU across browsers (extract core physical GPU name)
                            gpuInfo = unmasked.replace(/ANGLE \(/i, '').replace(/\,.*Direct3D.*|\,.*OpenGL.*/i, '').trim();
                        }
                    }
                } catch(e) {}

                // 2. Raw Pixel Buffer Geometry Analysis (OS Font Rasterizer)
                let pixelSum = 0;
                try {
                    const c = document.createElement('canvas');
                    c.width = 120;
                    c.height = 30;
                    const ctx = c.getContext('2d', { willReadFrequently: true });
                    ctx.textBaseline = 'top';
                    ctx.font = '16px monospace';
                    ctx.fillStyle = '#ff6600';
                    ctx.fillText('Retro2026', 4, 4);
                    const imgData = ctx.getImageData(0, 0, 120, 30).data;
                    for (let i = 0; i < imgData.length; i += 4) {
                        pixelSum += imgData[i] + imgData[i+1] + imgData[i+2];
                    }
                } catch(e) {}

                // 3. Audio DSP Silicon / Sample Rate
                let audioSig = '';
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioContextClass) {
                        const actx = new AudioContextClass();
                        audioSig = actx.sampleRate + '_' + (actx.destination ? actx.destination.maxChannelCount : 2);
                        if (actx.close) actx.close();
                    }
                } catch(e) {}

                // 4. Hardware System Topology (Screen, CPU Cores, Timezone, Device Pixel Ratio)
                const timezone = (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
                const hardwareTraits = [
                    gpuInfo,
                    pixelSum,
                    audioSig,
                    screen.width + 'x' + screen.height,
                    screen.colorDepth || 24,
                    window.devicePixelRatio || 1,
                    navigator.hardwareConcurrency || 4,
                    timezone,
                    new Date().getTimezoneOffset(),
                    navigator.maxTouchPoints || 0
                ].join('###');
                
                let hash = 0;
                for (let i = 0; i < hardwareTraits.length; i++) {
                    hash = ((hash << 5) - hash) + hardwareTraits.charCodeAt(i);
                    hash |= 0;
                }
                const fp = 'hw_' + Math.abs(hash).toString(16);
                window._retro_dev_fp = fp;
                return fp;
            } catch(e) {
                return 'hw_fallback_' + (screen.width || 1024);
            }
        }
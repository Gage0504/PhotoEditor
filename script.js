let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d', { willReadFrequently: true });

let originalImage = null;
let imgWidth = 0;
let imgHeight = 0;
let originalImageData = null;
let isMobile = window.innerWidth <= 768;
let processingScheduled = false;
let currentPresetName = null;

// Mobile filter group handling
function initMobileFilters() {
    if (window.innerWidth > 768) return;
    
    const filterGroups = {
        upload: ['uploadSection', 'header'],
        distortion: ['section-distortion'],
        color: ['section-color'],
        tint: ['section-tint'],
        effects: ['section-effects'],
        actions: ['actionBtns']
    };
    
    // Add IDs to sections for easier reference
    document.querySelectorAll('.section').forEach((section, index) => {
        const heading = section.querySelector('h3');
        if (heading) {
            const text = heading.textContent.toLowerCase();
            if (text.includes('distortion') || text.includes('shift')) {
                section.id = 'section-distortion';
            } else if (text.includes('color') || text.includes('light')) {
                section.id = 'section-color';
            } else if (text.includes('tint')) {
                section.id = 'section-tint';
            } else if (text.includes('effects') || text.includes('glitch')) {
                section.id = 'section-effects';
            }
        }
    });
    
    const filterBtns = document.querySelectorAll('.filter-group-btn');
    const mobilePanel = document.getElementById('mobileFilterPanel');
    const mobilePanelContent = document.getElementById('mobilePanelContent');
    const mobilePanelTitle = document.getElementById('mobilePanelTitle');
    const closeBtn = document.getElementById('closeMobilePanel');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const group = this.getAttribute('data-group');
            
            // Toggle active state
            filterBtns.forEach(b => b.classList.remove('active'));
            
            if (mobilePanel.classList.contains('hidden') || !this.classList.contains('active')) {
                this.classList.add('active');
                
                // Clear previous content
                mobilePanelContent.innerHTML = '';
                
                // Set title
                mobilePanelTitle.textContent = this.textContent;
                
                // Clone and add relevant sections
                const sections = filterGroups[group] || [];
                sections.forEach(sectionId => {
                    const section = document.getElementById(sectionId);
                    if (section) {
                        const clone = section.cloneNode(true);
                        // Save and remove IDs from clone and all its children to avoid duplicates
                        if (clone.id) {
                            clone.setAttribute('data-original-id', clone.id);
                            clone.removeAttribute('id');
                        }
                        clone.querySelectorAll('[id]').forEach(el => {
                            el.setAttribute('data-original-id', el.id);
                            el.removeAttribute('id');
                        });
                        // Re-attach event listeners for cloned inputs
                        attachInputListeners(clone);
                        mobilePanelContent.appendChild(clone);
                    }
                });
                
                // Show panel
                mobilePanel.classList.remove('hidden');
            } else {
                mobilePanel.classList.add('hidden');
            }
        });
    });
    
    closeBtn.addEventListener('click', function() {
        mobilePanel.classList.add('hidden');
        filterBtns.forEach(b => b.classList.remove('active'));
    });
}

function attachInputListeners(container) {
    // Attach slider listeners
    container.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', function() {
            const originalId = this.getAttribute('data-original-id');
            const originalInput = originalId ? document.getElementById(originalId) : null;
            if (originalInput && originalInput !== this) {
                originalInput.value = this.value;
                // Update the corresponding number input for the original
                const numberInput = document.querySelector(`#controls input[type="number"][data-slider="${originalId}"]`);
                if (numberInput) {
                    numberInput.value = this.value;
                }
                scheduleRender();
            }
        });
    });
    
    // Attach number input listeners
    container.querySelectorAll('input[type="number"][data-slider]').forEach(input => {
        input.addEventListener('input', function() {
            const sliderId = this.getAttribute('data-slider');
            const originalSlider = document.getElementById(sliderId);
            if (originalSlider) {
                let value = parseFloat(this.value);
                let min = parseFloat(originalSlider.min);
                let max = parseFloat(originalSlider.max);
                if (value < min) value = min;
                if (value > max) value = max;
                originalSlider.value = value;
                this.value = value;
                // Update the corresponding number input for the original
                const numberInput = document.querySelector(`#controls input[type="number"][data-slider="${sliderId}"]`);
                if (numberInput) {
                    numberInput.value = value;
                }
                scheduleRender();
            }
        });
    });
    
    // Attach file input listener
    const fileInput = container.querySelector('input[type="file"][data-original-id="upload"]');
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            // Delegate to the original upload handler
            const originalUpload = document.getElementById('upload');
            if (originalUpload && e.target.files[0]) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(e.target.files[0]);
                originalUpload.files = dataTransfer.files;
                originalUpload.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    
    // Attach button listeners
    const resetBtn = container.querySelector('button[onclick*="resetSliders"]');
    if (resetBtn) {
        resetBtn.removeAttribute('onclick');
        resetBtn.addEventListener('click', resetSliders);
    }
    
    const downloadBtn = container.querySelector('button[onclick*="downloadImage"]');
    if (downloadBtn) {
        downloadBtn.removeAttribute('onclick');
        downloadBtn.addEventListener('click', downloadImage);
    }
    
    const savePresetBtn = container.querySelector('[data-original-id="savePresetBtn"]');
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', openSavePresetModal);
    }
    
    const loadPresetBtn = container.querySelector('[data-original-id="loadPresetBtn"]');
    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', openLoadPresetModal);
    }
}

// Initialize mobile filters on load
if (typeof window !== 'undefined') {
    if (window.innerWidth <= 768) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMobileFilters);
        } else {
            initMobileFilters();
        }
    }
}

// Re-initialize on resize
window.addEventListener('resize', function() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;
    if (isMobile && !wasMobile) {
        initMobileFilters();
    }
});


// Real-time value display updates for sliders
document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', function(e) {
        // Update corresponding number input
        let numberInput = document.querySelector(`input[type="number"][data-slider="${this.id}"]`);
        if (numberInput) {
            numberInput.value = this.value;
        }
        scheduleRender();
    });
});

// Real-time value updates for number inputs
document.querySelectorAll('input[type="number"][data-slider]').forEach(input => {
    input.addEventListener('input', function() {
        let sliderId = this.getAttribute('data-slider');
        let slider = document.getElementById(sliderId);
        if (slider) {
            // Clamp value to slider's min/max
            let value = parseFloat(this.value);
            let min = parseFloat(slider.min);
            let max = parseFloat(slider.max);
            if (value < min) value = min;
            if (value > max) value = max;
            slider.value = value;
            this.value = value; // Update input to clamped value
        }
        scheduleRender();
    });
});

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    if(originalImage) scheduleRender();
}

window.addEventListener('resize', resizeCanvas);

// File input with HEIC support
document.getElementById('upload').addEventListener('change', async function(e){
    let file = e.target.files[0];
    if(!file) return;
    
    let fileName = file.name.substring(0, 30);
    document.getElementById('fileName').textContent = fileName;
    
    // Handle HEIC/HEIF files
    if (['image/heic', 'image/heif'].includes(file.type)) {
        try {
            const convertedBlob = await heic2any({ blob: file });
            file = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        } catch(err) {
            alert('Could not convert HEIC file');
            return;
        }
    }
    
    let img = new Image();
    img.onload = function(){
        originalImage = img;
        imgWidth = img.width;
        imgHeight = img.height;
        
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        let tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        originalImageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
        
        resizeCanvas();
    }
    img.src = URL.createObjectURL(file);
});

function getSliderValue(id){
    let elem = document.getElementById(id);
    return elem ? parseFloat(elem.value) : 0;
}

function scheduleRender() {
    if (processingScheduled) return;
    processingScheduled = true;
    requestAnimationFrame(() => {
        drawImage();
        processingScheduled = false;
    });
}

function drawImage(){
    if(!originalImage || !originalImageData) return;

    // Process at reduced resolution for speed
    let maxSize = isMobile ? 600 : 1200;
    let processWidth = Math.min(imgWidth, maxSize);
    let processHeight = Math.round(imgHeight * processWidth / imgWidth);
    let scale = processWidth / imgWidth;

    let srcCanvas = document.createElement('canvas');
    srcCanvas.width = imgWidth;
    srcCanvas.height = imgHeight;
    let srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(originalImageData.data), imgWidth, imgHeight), 0, 0);
    
    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = processWidth;
    tempCanvas.height = processHeight;
    let tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(srcCanvas, 0, 0, imgWidth, imgHeight, 0, 0, processWidth, processHeight);
    
    let imgData = tempCtx.getImageData(0, 0, processWidth, processHeight);
    let data = imgData.data;

    // Get all slider values at once
    let s = {
        displace: getSliderValue('displace'),
        freq: getSliderValue('frequency'),
        rgbShift: getSliderValue('rgbShift'),
        noise: getSliderValue('noise'),
        random: getSliderValue('random'),
        block: getSliderValue('block'),
        edge: getSliderValue('edge'),
        sat: getSliderValue('saturation'),
        bright: getSliderValue('brightness'),
        contrast: getSliderValue('contrast'),
        tint: getSliderValue('tintStrength') / 100,
        red: getSliderValue('red'),
        green: getSliderValue('green'),
        blue: getSliderValue('blue'),
        pix: getSliderValue('pixelate'),
        vig: getSliderValue('vignette'),
        chrom: getSliderValue('chromatic'),
        post: getSliderValue('posterize')
    };

    // Pixelate
    if (s.pix > 1) {
        let ps = Math.floor(s.pix);
        let nd = new Uint8ClampedArray(data.length);
        for(let y = 0; y < processHeight; y += ps) {
            for(let x = 0; x < processWidth; x += ps) {
                let r=0, g=0, b=0, a=0, c=0;
                for(let py = 0; py < ps && y+py < processHeight; py++) {
                    for(let px = 0; px < ps && x+px < processWidth; px++) {
                        let idx = ((y+py)*processWidth + (x+px))*4;
                        r += data[idx]; g += data[idx+1]; b += data[idx+2]; a += data[idx+3];
                        c++;
                    }
                }
                r/=c; g/=c; b/=c; a/=c;
                for(let py = 0; py < ps && y+py < processHeight; py++) {
                    for(let px = 0; px < ps && x+px < processWidth; px++) {
                        let idx = ((y+py)*processWidth + (x+px))*4;
                        nd[idx] = r; nd[idx+1] = g; nd[idx+2] = b; nd[idx+3] = a;
                    }
                }
            }
        }
        for(let i = 0; i < data.length; i++) data[i] = nd[i];
    }

    // Displace
    if (s.displace > 0) {
        let nd = new Uint8ClampedArray(data.length);
        for (let y = 0; y < processHeight; y++) {
            for (let x = 0; x < processWidth; x++) {
                let dx = Math.floor(s.displace * scale * Math.sin(y * s.freq));
                let dy = Math.floor(s.displace * scale * Math.cos(x * s.freq));
                let sx = (x + dx) % processWidth;
                let sy = (y + dy) % processHeight;
                if (sx < 0) sx += processWidth;
                if (sy < 0) sy += processHeight;
                
                let si = (sy * processWidth + sx) * 4;
                let di = (y * processWidth + x) * 4;
                nd[di] = data[si];
                nd[di+1] = data[si+1];
                nd[di+2] = data[si+2];
                nd[di+3] = data[si+3];
            }
        }
        for (let i = 0; i < data.length; i++) data[i] = nd[i];
    }

    // RGB Shift
    if (s.rgbShift > 0) {
        let shift = Math.floor(s.rgbShift * scale);
        let nd = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i++) nd[i] = data[i];
        
        for (let y = 0; y < processHeight; y++) {
            for (let x = 0; x < processWidth; x++) {
                nd[(y * processWidth + x) * 4 + 1] = data[(y * processWidth + ((x + shift) % processWidth)) * 4 + 1];
                nd[(y * processWidth + x) * 4 + 2] = data[(((y - shift + processHeight) % processHeight) * processWidth + x) * 4 + 2];
            }
        }
        
        for (let i = 0; i < data.length; i++) data[i] = nd[i];
    }

    // Random Pixels - shuffles actual image pixels
    if (s.random > 0) {
        let t = s.random / 100;
        let totalPixels = processWidth * processHeight;
        let pixelsToRandomize = Math.floor(totalPixels * t);
        
        // Create array of all pixel indices
        let indices = [];
        for (let i = 0; i < totalPixels; i++) {
            indices.push(i);
        }
        
        // Shuffle indices using Fisher-Yates algorithm
        for (let i = indices.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // Take subset of pixels to randomize and swap them pairwise
        let pixelsToSwap = indices.slice(0, pixelsToRandomize);
        
        // Swap pixels at selected indices with each other
        for (let i = 0; i < pixelsToSwap.length - 1; i += 2) {
            let idx1 = pixelsToSwap[i] * 4;
            let idx2 = pixelsToSwap[i + 1] * 4;
            
            // Swap the pixels using temporary storage
            for (let j = 0; j < 4; j++) {
                let temp = data[idx1 + j];
                data[idx1 + j] = data[idx2 + j];
                data[idx2 + j] = temp;
            }
        }
    }

    // Random Pixels - shuffles actual image pixels
    if (s.random > 0) {
        let t = s.random / 100;
        let totalPixels = processWidth * processHeight;
        let pixelsToRandomize = Math.floor(totalPixels * t);
        
        // Create array of all pixel indices
        let indices = [];
        for (let i = 0; i < totalPixels; i++) {
            indices.push(i);
        }
        
        // Shuffle indices using Fisher-Yates algorithm
        for (let i = indices.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // Take subset of pixels to randomize and swap them pairwise
        let pixelsToSwap = indices.slice(0, pixelsToRandomize);
        
        // Swap pixels at selected indices with each other
        for (let i = 0; i < pixelsToSwap.length - 1; i += 2) {
            let idx1 = pixelsToSwap[i] * 4;
            let idx2 = pixelsToSwap[i + 1] * 4;
            
            // Swap the pixels using temporary storage
            for (let j = 0; j < 4; j++) {
                let temp = data[idx1 + j];
                data[idx1 + j] = data[idx2 + j];
                data[idx2 + j] = temp;
            }
        }
    }

    // Strip-Based Pixel Randomization
    let stripDir = document.getElementById('stripDirection')?.value || 'none';
    let stripSize = getSliderValue('stripSize');
    let stripCount = getSliderValue('stripCount');
    let stripIntensity = getSliderValue('stripIntensity');

    if (stripDir !== 'none' && stripIntensity > 0) {
        if (stripDir === 'horizontal') {
            randomizeHorizontalStrips(data, processWidth, processHeight, stripSize, stripCount, stripIntensity);
        } else if (stripDir === 'vertical') {
            randomizeVerticalStrips(data, processWidth, processHeight, stripSize, stripCount, stripIntensity);
        } else if (stripDir === 'grid') {
            randomizeGridStrips(data, processWidth, processHeight, stripSize, stripCount, stripIntensity);
        }
    }

    // Block Glitch
    if (s.block > 0) {

    // Block Glitch
    if (s.block > 0) {
        for (let b = 0; b < s.block; b++) {
            let x = Math.floor(Math.random() * (processWidth - 50));
            let y = Math.floor(Math.random() * (processHeight - 20));
            let w = Math.floor(Math.random() * 80 + 20);
            let h = Math.floor(Math.random() * 50 + 10);
            let shift = Math.floor(Math.random() * 45 + 5);
            
            for (let by = y; by < y + h && by < processHeight; by++) {
                let rd = [];
                for (let bx = x; bx < x + w && bx < processWidth; bx++) {
                    let idx = (by * processWidth + bx) * 4;
                    rd.push(data[idx], data[idx+1], data[idx+2], data[idx+3]);
                }
                
                let nr = new Array(rd.length);
                for (let i = 0; i < rd.length; i += 4) {
                    let ni = ((i + shift * 4) % rd.length);
                    nr[ni] = rd[i];
                    nr[ni+1] = rd[i+1];
                    nr[ni+2] = rd[i+2];
                    nr[ni+3] = rd[i+3];
                }
                
                for (let bx = x; bx < x + w && bx < processWidth; bx++) {
                    let idx = (by * processWidth + bx) * 4;
                    data[idx] = nr[(bx - x) * 4];
                    data[idx+1] = nr[(bx - x) * 4 + 1];
                    data[idx+2] = nr[(bx - x) * 4 + 2];
                    data[idx+3] = nr[(bx - x) * 4 + 3];
                }
            }
        }
    }

    // Noise
    if (s.noise > 0) {
        for (let i = 0; i < data.length; i += 4) {
            let nv = (Math.random() - 0.5) * 2 * s.noise;
            data[i] = Math.max(0, Math.min(255, data[i] + nv));
            data[i+1] = Math.max(0, Math.min(255, data[i+1] + nv));
            data[i+2] = Math.max(0, Math.min(255, data[i+2] + nv));
        }
    }

    // Chromatic Aberration
    if (s.chrom > 0) {
        let nd = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i++) nd[i] = data[i];
        let shift = Math.floor(s.chrom * scale);
        for (let y = 0; y < processHeight; y++) {
            for (let x = 0; x < processWidth; x++) {
                let idx = (y * processWidth + x) * 4;
                if (x + shift < processWidth) {
                    nd[idx] = data[(y * processWidth + (x + shift)) * 4];
                }
                if (x - shift >= 0) {
                    nd[idx + 2] = data[(y * processWidth + (x - shift)) * 4 + 2];
                }
            }
        }
        for (let i = 0; i < data.length; i++) data[i] = nd[i];
    }

    // Edge Blend
    if (s.edge > 0) {
        let edges = new Uint8ClampedArray(processWidth * processHeight);
        for (let y = 1; y < processHeight - 1; y++) {
            for (let x = 1; x < processWidth - 1; x++) {
                let gx = 0, gy = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        let idx = ((y + dy) * processWidth + (x + dx)) * 4;
                        let l = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
                        gx += l * (dx === -1 ? -1 : dx === 1 ? 1 : 0);
                        gy += l * (dy === -1 ? -1 : dy === 1 ? 1 : 0);
                    }
                }
                edges[y * processWidth + x] = Math.min(255, Math.sqrt(gx*gx + gy*gy));
            }
        }
        
        let eb = s.edge / 100;
        for (let y = 1; y < processHeight - 1; y++) {
            for (let x = 1; x < processWidth - 1; x++) {
                let idx = (y * processWidth + x) * 4;
                let e = edges[y * processWidth + x];
                data[idx] = data[idx] * (1 - eb) + e * eb;
                data[idx+1] = data[idx+1] * (1 - eb) + e * eb;
                data[idx+2] = data[idx+2] * (1 - eb) + e * eb;
            }
        }
    }

    // Posterize
    if (s.post < 256) {
        let levels = Math.floor(s.post);
        let factor = 256 / levels;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.floor(data[i] / factor) * factor;
            data[i+1] = Math.floor(data[i+1] / factor) * factor;
            data[i+2] = Math.floor(data[i+2] / factor) * factor;
        }
    }

    // Color adjustments
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];
        
        r *= s.bright;
        g *= s.bright;
        b *= s.bright;
        
        r = ((r - 128) * s.contrast) + 128;
        g = ((g - 128) * s.contrast) + 128;
        b = ((b - 128) * s.contrast) + 128;
        
        if (s.sat !== 1) {
            let gray = r * 0.299 + g * 0.587 + b * 0.114;
            r = gray + (r - gray) * s.sat;
            g = gray + (g - gray) * s.sat;
            b = gray + (b - gray) * s.sat;
        }
        
        if (s.tint > 0) {
            r = r * (1 - s.tint) + s.red * s.tint;
            g = g * (1 - s.tint) + s.green * s.tint;
            b = b * (1 - s.tint) + s.blue * s.tint;
        }
        
        data[i] = Math.max(0, Math.min(255, r));
        data[i+1] = Math.max(0, Math.min(255, g));
        data[i+2] = Math.max(0, Math.min(255, b));
    }

    // Vignette
    if (s.vig > 0) {
        let v = s.vig / 100;
        for (let y = 0; y < processHeight; y++) {
            for (let x = 0; x < processWidth; x++) {
                let nx = (x - processWidth / 2) / (processWidth / 2);
                let ny = (y - processHeight / 2) / (processHeight / 2);
                let dist = Math.sqrt(nx*nx + ny*ny);
                let vf = Math.max(0, 1 - dist * v);
                
                let idx = (y * processWidth + x) * 4;
                data[idx] *= vf;
                data[idx+1] *= vf;
                data[idx+2] *= vf;
            }
        }
    }

    tempCtx.putImageData(imgData, 0, 0);
    
    // Draw to canvas
    let ds = Math.min(canvas.width / processWidth, canvas.height / processHeight);
    let dw = processWidth * ds;
    let dh = processHeight * ds;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
}

// Preset save/load
function saveCurrentSettings() {
    let settings = {};
    ['displace','frequency','rgbShift','noise','random','block','edge','saturation','brightness','contrast','tintStrength','red','green','blue','pixelate','vignette','chromatic','posterize'].forEach(id => {
        settings[id] = getSliderValue(id);
    });
    return settings;
}

function loadSettings(settings) {
    Object.keys(settings).forEach(id => {
        let elem = document.getElementById(id);
        if (elem) {
            elem.value = settings[id];
            // Update corresponding number input
            let numberInput = document.querySelector(`input[type="number"][data-slider="${id}"]`);
            if (numberInput) {
                numberInput.value = settings[id];
            }
        }
    });
    scheduleRender();
}

function getPresets() {
    return JSON.parse(localStorage.getItem('photoEditorPresets') || '{}');
}

function savePreset(name, settings) {
    let presets = getPresets();
    presets[name] = settings;
    localStorage.setItem('photoEditorPresets', JSON.stringify(presets));
}

function deletePreset(name) {
    let presets = getPresets();
    delete presets[name];
    localStorage.setItem('photoEditorPresets', JSON.stringify(presets));
}

function openSavePresetModal() {
    currentPresetName = null;
    document.getElementById('modalTitle').textContent = 'Save Preset';
    document.getElementById('presetName').value = '';
    document.getElementById('presetName').style.display = 'block';
    document.getElementById('presetList').innerHTML = '';
    document.getElementById('confirmBtn').textContent = 'Save';
    document.getElementById('confirmBtn').onclick = () => {
        let name = document.getElementById('presetName').value.trim();
        if (!name) {
            alert('Please enter a preset name');
            return;
        }
        savePreset(name, saveCurrentSettings());
        closePresetModal();
    };
    document.getElementById('presetModal').classList.remove('hidden');
}

function openLoadPresetModal() {
    currentPresetName = null;
    document.getElementById('modalTitle').textContent = 'Load Preset';
    document.getElementById('presetName').style.display = 'none';
    let presets = getPresets();
    let list = document.getElementById('presetList');
    list.innerHTML = '';
    
    if (Object.keys(presets).length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No presets saved yet</p>';
    } else {
        Object.keys(presets).forEach(name => {
            let item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `
                <span onclick="loadPresetFromModal('${name}')">${name}</span>
                <button onclick="deletePresetItem('${name}')">Delete</button>
            `;
            list.appendChild(item);
        });
    }
    
    document.getElementById('confirmBtn').textContent = 'Close';
    document.getElementById('confirmBtn').onclick = closePresetModal;
    document.getElementById('presetModal').classList.remove('hidden');
}

function loadPresetFromModal(name) {
    loadSettings(getPresets()[name]);
    closePresetModal();
}

function deletePresetItem(name) {
    if (confirm(`Delete preset "${name}"?`)) {
        deletePreset(name);
        openLoadPresetModal();
    }
}

function closePresetModal() {
    document.getElementById('presetModal').classList.add('hidden');
}

document.getElementById('savePresetBtn').addEventListener('click', openSavePresetModal);
document.getElementById('loadPresetBtn').addEventListener('click', openLoadPresetModal);

function resetSliders() {
    let defaults = {
        displace: 0, frequency: 0.001, rgbShift: 0, noise: 0, random: 0, block: 0, edge: 0,
        saturation: 1, brightness: 1, contrast: 1, tintStrength: 0, red: 128, green: 128, blue: 128,
        pixelate: 1, vignette: 0, chromatic: 0, posterize: 256
    };
    loadSettings(defaults);
}

function downloadImage(){
    let link = document.createElement('a');
    link.download = "edited_image.png";
    link.href = canvas.toDataURL();
    link.click();
}

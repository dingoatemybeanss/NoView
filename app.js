import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const supabaseUrl = "https://wswpmifhidycyaseamyf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3BtaWZoaWR5Y3lhc2VhbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Mjc5MzQsImV4cCI6MjEwMjUwMzkzNH0.zr1Kibn5R6UEz8TEm1KwqBpTfSxNA6Di-eFhic17kR8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DOM refs ---
const homeView = document.getElementById('homeView');
const captureView = document.getElementById('captureView');
const previewView = document.getElementById('previewView');
const cropView = document.getElementById('cropView');
const mapView = document.getElementById('mapView');
const routeView = document.getElementById('routeView');
const backBtn = document.getElementById('backBtn');
const goCameraBtn = document.getElementById('goCameraBtn');
const goMapBtn = document.getElementById('goMapBtn');
const goRouteBtn = document.getElementById('goRouteBtn');

const video = document.getElementById('videoPreview');
const canvas = document.getElementById('cropCanvas');
const ctx = canvas.getContext('2d');
const openCameraBtn = document.getElementById('openCameraBtn');
const shutterBtn = document.getElementById('shutterBtn');
const captureStatus = document.getElementById('captureStatus');
const previewImg = document.getElementById('previewImg');
const retakeBtn = document.getElementById('retakeBtn');
const cropBtn = document.getElementById('cropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const cropStatus = document.getElementById('cropStatus');
const status = document.getElementById('status');
const mapContainer = document.getElementById('map');
const heatmapToggle = document.getElementById('heatmapToggle');
const exportBtn = document.getElementById('exportBtn');

const routeStart = document.getElementById('routeStart');
const routeEnd = document.getElementById('routeEnd');
const calcRouteBtn = document.getElementById('calcRouteBtn');
const refreshRouteBtn = document.getElementById('refreshRouteBtn');
const routeResult = document.getElementById('routeResult');
const startLocBtn = document.getElementById('startLocBtn');
const endLocBtn = document.getElementById('endLocBtn');

let stream = null;
let capturedImageData = null;
let croppedBlob = null;
let map = null;
let markerCluster = null;
let heatLayer = null;
let isHeatmapOn = false;
let allPins = [];
let cropStart = null, cropEnd = null, isCropping = false;
let cropRAF = null;

// --- NAVIGATION ---
function showView(viewId) {
  [homeView, captureView, previewView, cropView, mapView, routeView].forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (viewId === 'homeView') backBtn.style.display = 'none';
  else backBtn.style.display = 'inline-block';
  if (viewId === 'routeView' && allPins.length === 0) {
    routeResult.innerHTML = '⚠️ No cameras in database. Upload some photos first!';
  }
}

goCameraBtn.addEventListener('click', () => {
  showView('captureView');
  if (!stream) startCamera();
  else { video.srcObject = stream; video.play(); captureStatus.textContent = '📷 Ready'; }
});
goMapBtn.addEventListener('click', () => {
  showView('mapView');
  if (!map) initMap();
  else map.invalidateSize();
});
goRouteBtn.addEventListener('click', () => {
  showView('routeView');
});

backBtn.addEventListener('click', () => {
  if (captureView.classList.contains('active') && stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  showView('homeView');
});

// --- CAMERA ---
async function startCamera() {
  try {
    captureStatus.textContent = '📸 Requesting camera...';
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await video.play();
    captureStatus.textContent = '📷 Frame the camera and tap the shutter';
    openCameraBtn.style.display = 'none';
    shutterBtn.style.display = 'block';
  } catch (err) {
    captureStatus.textContent = '❌ ' + err.message;
    status.textContent = '❌ Camera error: ' + err.message;
  }
}
openCameraBtn.addEventListener('click', startCamera);

// --- SHUTTER ---
shutterBtn.addEventListener('click', () => {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tctx = tmpCanvas.getContext('2d');
  tctx.drawImage(video, 0, 0, w, h);
  capturedImageData = tctx.getImageData(0, 0, w, h);
  const dataUrl = tmpCanvas.toDataURL('image/jpeg', 0.95);
  previewImg.src = dataUrl;
  showView('previewView');
});

// --- PREVIEW ---
retakeBtn.addEventListener('click', () => {
  showView('captureView');
  if (stream) { video.srcObject = stream; video.play(); captureStatus.textContent = '📷 Retake — frame it again'; }
});
cropBtn.addEventListener('click', () => {
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    canvas._img = img;
    cropStart = null; cropEnd = null;
    cropStatus.textContent = '✂️ Drag a rectangle around the camera';
    showView('cropView');
  };
  img.src = previewImg.src;
});

// --- CROP (optimized with requestAnimationFrame) ---
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const ev = e.touches ? e.touches[0] : e;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;
  return { x: Math.min(Math.max(x, 0), canvas.width), y: Math.min(Math.max(y, 0), canvas.height) };
}

function drawCropOverlay() {
  if (!canvas._img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas._img, 0, 0, canvas.width, canvas.height);
  if (!cropStart || !cropEnd) return;
  const sx = Math.min(cropStart.x, cropEnd.x);
  const sy = Math.min(cropStart.y, cropEnd.y);
  const sw = Math.abs(cropEnd.x - cropStart.x);
  const sh = Math.abs(cropEnd.y - cropStart.y);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(sx, sy, sw, sh);
  ctx.drawImage(canvas._img, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;
  ctx.strokeRect(sx, sy, sw, sh);
}

function requestCropUpdate() {
  if (cropRAF) cancelAnimationFrame(cropRAF);
  cropRAF = requestAnimationFrame(() => {
    drawCropOverlay();
    cropRAF = null;
  });
}

canvas.addEventListener('mousedown', (e) => {
  isCropping = true;
  const p = getCanvasCoords(e);
  cropStart = { x: p.x, y: p.y };
  cropEnd = { x: p.x, y: p.y };
  requestCropUpdate();
});
window.addEventListener('mousemove', (e) => {
  if (!isCropping) return;
  const p = getCanvasCoords(e);
  cropEnd = { x: p.x, y: p.y };
  requestCropUpdate();
});
window.addEventListener('mouseup', () => {
  if (isCropping) {
    isCropping = false;
    if (cropStart && cropEnd) {
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);
      if (w < 10 || h < 10) {
        cropStatus.textContent = '⚠️ Selection too small, try again';
        cropStart = null; cropEnd = null;
        drawCropOverlay();
      } else {
        cropStatus.textContent = '✅ Ready. Tap "Crop & Upload"';
      }
    }
  }
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isCropping = true;
  const p = getCanvasCoords(e);
  cropStart = { x: p.x, y: p.y };
  cropEnd = { x: p.x, y: p.y };
  requestCropUpdate();
}, { passive: false });
window.addEventListener('touchmove', (e) => {
  if (!isCropping) return;
  e.preventDefault();
  const p = getCanvasCoords(e);
  cropEnd = { x: p.x, y: p.y };
  requestCropUpdate();
}, { passive: false });
window.addEventListener('touchend', (e) => {
  if (isCropping) {
    isCropping = false;
    if (cropStart && cropEnd) {
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);
      if (w < 10 || h < 10) {
        cropStatus.textContent = '⚠️ Selection too small, try again';
        cropStart = null; cropEnd = null;
        drawCropOverlay();
      } else {
        cropStatus.textContent = '✅ Ready. Tap "Crop & Upload"';
      }
    }
  }
}, { passive: false });

// --- CONFIRM CROP & UPLOAD ---
confirmCropBtn.addEventListener('click', async () => {
  if (!cropStart || !cropEnd) { cropStatus.textContent = '⚠️ Drag a rectangle first!'; return; }
  const sx = Math.min(cropStart.x, cropEnd.x);
  const sy = Math.min(cropStart.y, cropEnd.y);
  const sw = Math.abs(cropEnd.x - cropStart.x);
  const sh = Math.abs(cropEnd.y - cropStart.y);
  if (sw < 10 || sh < 10) { cropStatus.textContent = '⚠️ Selection too small'; return; }
  cropStatus.textContent = '✂️ Cropping...';
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cctx = cropCanvas.getContext('2d');
  cctx.drawImage(canvas._img, sx, sy, sw, sh, 0, 0, sw, sh);
  cropCanvas.toBlob(async (blob) => {
    if (!blob) { cropStatus.textContent = '❌ Crop failed'; return; }
    await uploadPhoto(blob);
  }, 'image/jpeg', 0.92);
});

cancelCropBtn.addEventListener('click', () => { showView('previewView'); });

// --- GPS with averaging ---
function getAccuratePosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 18.4861, lng: -69.9312 });
      return;
    }
    let readings = [];
    let watchId = navigator.geolocation.watchPosition(
      (pos) => {
        readings.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        if (readings.length >= 5) {
          navigator.geolocation.clearWatch(watchId);
          let totalWeight = 0;
          let avgLat = 0, avgLng = 0;
          readings.forEach(r => {
            const w = 1 / (r.acc + 1);
            avgLat += r.lat * w;
            avgLng += r.lng * w;
            totalWeight += w;
          });
          avgLat /= totalWeight;
          avgLng /= totalWeight;
          resolve({ lat: avgLat, lng: avgLng });
        }
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        resolve({ lat: 18.4861, lng: -69.9312 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
    setTimeout(() => {
      if (readings.length < 3) {
        navigator.geolocation.clearWatch(watchId);
        resolve({ lat: 18.4861, lng: -69.9312 });
      }
    }, 12000);
  });
}

// --- UPLOAD with duplicate check ---
async function uploadPhoto(blob) {
  status.textContent = '📍 Getting GPS...';
  const pos = await getAccuratePosition();

  status.textContent = '🔍 Checking for duplicates...';
  const { data: nearby, error: nearbyError } = await supabase
    .from('intel')
    .select('id, lat, lng')
    .filter('lat', 'gte', pos.lat - 0.00015)
    .filter('lat', 'lte', pos.lat + 0.00015)
    .filter('lng', 'gte', pos.lng - 0.00015)
    .filter('lng', 'lte', pos.lng + 0.00015);
  if (!nearbyError && nearby && nearby.length > 0) {
    const close = nearby.filter(p => {
      const d = turf.distance(turf.point([pos.lng, pos.lat]), turf.point([p.lng, p.lat]), { units: 'meters' });
      return d < 15;
    });
    if (close.length > 0) {
      const confirm = confirm(`⚠️ Found ${close.length} camera(s) within 15m. Still upload?`);
      if (!confirm) {
        status.textContent = '❌ Upload cancelled (duplicate)';
        cropStatus.textContent = '❌ Cancelled – duplicate nearby';
        return;
      }
    }
  }

  status.textContent = '⬆️ Uploading...';
  try {
    const filename = `cam_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('intel')
      .upload(filename, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('intel').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;
    const { error: insertError } = await supabase
      .from('intel')
      .insert([{
        lat: pos.lat,
        lng: pos.lng,
        image_url: publicUrl,
        filename: filename,
        timestamp: new Date().toISOString()
      }]);
    if (insertError) throw insertError;
    status.textContent = `✅ Uploaded! (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`;
    cropStart = null; cropEnd = null;
    if (map) loadPins();
    showView('homeView');
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  } catch (err) {
    status.textContent = '❌ Error: ' + err.message;
    cropStatus.textContent = '❌ ' + err.message;
  }
}

// --- GEOCODING (address -> lat,lng) using Nominatim ---
async function geocodeAddress(query) {
  if (!query || query.trim() === '') return null;
  // Check if it's already lat,lng
  const parts = query.split(',').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await resp.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// --- ROUTE SCORER ---
async function calculateRoute() {
  routeResult.innerHTML = '⏳ Geocoding addresses...';
  const startAddr = routeStart.value.trim();
  const endAddr = routeEnd.value.trim();
  if (!startAddr || !endAddr) {
    routeResult.innerHTML = '❌ Please enter both start and end.';
    return;
  }

  const startCoords = await geocodeAddress(startAddr);
  const endCoords = await geocodeAddress(endAddr);
  if (!startCoords || !endCoords) {
    routeResult.innerHTML = '❌ Could not find coordinates for one of the addresses. Try lat,lng.';
    return;
  }

  routeResult.innerHTML = '⏳ Fetching route...';
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) { routeResult.innerHTML = '❌ No route found.'; return; }
    const routeGeo = data.routes[0].geometry;
    const routeLine = turf.lineString(routeGeo.coordinates);
    const buffered = turf.buffer(routeLine, 50, { units: 'meters' });
    let inside = 0;
    allPins.forEach(p => {
      const pt = turf.point([p.lng, p.lat]);
      if (turf.booleanPointInPolygon(pt, buffered)) inside++;
    });
    const total = allPins.length;
    routeResult.innerHTML = `
      <div><strong>📍 Start:</strong> ${startAddr}</div>
      <div><strong>📍 End:</strong> ${endAddr}</div>
      <div>Route length: <strong>${(data.routes[0].distance / 1000).toFixed(2)} km</strong></div>
      <div>Cameras within 50m: <span class="route-result-score">${inside}</span></div>
      <div>Total cameras in DB: ${total}</div>
      <div class="route-result-small">Exposure density: ${total > 0 ? (inside / total * 100).toFixed(1) : 0}% of all cameras</div>
    `;
  } catch (err) {
    routeResult.innerHTML = '❌ Error: ' + err.message;
  }
}

calcRouteBtn.addEventListener('click', calculateRoute);
refreshRouteBtn.addEventListener('click', () => {
  if (routeView.classList.contains('active')) {
    loadPinsSilent();
    routeResult.innerHTML = '⟳ Data refreshed. ' + allPins.length + ' cameras loaded.';
  }
});

async function loadPinsSilent() {
  const { data, error } = await supabase.from('intel').select('*').order('timestamp', { ascending: false });
  if (error) { console.error(error); return; }
  allPins = [];
  data.forEach((row) => {
    if (!row.lat || !row.lng) return;
    allPins.push({ lat: row.lat, lng: row.lng, imageUrl: row.image_url, timestamp: row.timestamp });
  });
}

// --- Current Location buttons for route ---
function setLocationToInput(input) {
  if (!navigator.geolocation) {
    alert('Geolocation not supported.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      input.value = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
    },
    () => { alert('Could not get location.'); },
    { enableHighAccuracy: true }
  );
}
startLocBtn.addEventListener('click', () => setLocationToInput(routeStart));
endLocBtn.addEventListener('click', () => setLocationToInput(routeEnd));

// --- MAP with custom dark tile layer ---
function initMap() {
  const defaultLat = 18.4861;
  const defaultLng = -69.9312;
  map = L.map(mapContainer).setView([defaultLat, defaultLng], 14);
  
  // Custom dark map (looks like a surveillance control room)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
  }).addTo(map);

  const clusterIcon = function(cluster) {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div style="background:#2563eb;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 0 0 3px #0a0a0a;">${count}</div>`,
      className: '',
      iconSize: [40, 40]
    });
  };

  markerCluster = L.markerClusterGroup({
    iconCreateFunction: clusterIcon,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    spiderfyDistanceMultiplier: 1.5
  });
  map.addLayer(markerCluster);
  loadPins();
}

async function loadPins() {
  if (!map) return;
  const { data, error } = await supabase.from('intel').select('*').order('timestamp', { ascending: false });
  if (error) { console.error(error); return; }
  markerCluster.clearLayers();
  allPins = [];
  data.forEach((row) => {
    if (!row.lat || !row.lng) return;
    allPins.push({ lat: row.lat, lng: row.lng, imageUrl: row.image_url, timestamp: row.timestamp });
    const marker = L.marker([row.lat, row.lng], {
      icon: L.divIcon({ html: '📷', className: '', iconSize: [24, 24], iconAnchor: [12, 12] })
    });
    marker.bindPopup(`
      <div class="custom-popup">
        <strong>${row.timestamp ? new Date(row.timestamp).toLocaleString() : 'N/A'}</strong><br/>
        <img src="${row.image_url}" alt="camera" />
      </div>
    `);
    markerCluster.addLayer(marker);
  });
  if (allPins.length > 0) {
    const bounds = markerCluster.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }
  if (isHeatmapOn) toggleHeatmap();
}

function toggleHeatmap() {
  if (!map) return;
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  isHeatmapOn = !isHeatmapOn;
  heatmapToggle.textContent = isHeatmapOn ? '❄️ Hide Heatmap' : '🔥 Heatmap';
  heatmapToggle.classList.toggle('active', isHeatmapOn);
  if (isHeatmapOn && allPins.length > 0) {
    const points = allPins.map(p => [p.lat, p.lng, 1]);
    heatLayer = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 });
    heatLayer.addTo(map);
  }
}
heatmapToggle.addEventListener('click', toggleHeatmap);

// --- EXPORT GeoJSON ---
exportBtn.addEventListener('click', () => {
  if (allPins.length === 0) { alert('No cameras to export.'); return; }
  const features = allPins.map(p => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { image_url: p.imageUrl, timestamp: p.timestamp }
  }));
  const geojson = { type: 'FeatureCollection', features };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `surveillance_cameras_${new Date().toISOString().slice(0,10)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- INIT ---
status.textContent = '🔵 App ready. Choose an option.';
console.log('✅ Modular Surveillance Census loaded.');
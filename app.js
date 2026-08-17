import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';

// --- Firebase config (your actual keys) ---
const firebaseConfig = {
  apiKey: "AIzaSyCKaSaIEcfiavKQxcgONvQ_efokk6M36-w",
  authDomain: "spiderman-e0fcf.firebaseapp.com",
  projectId: "spiderman-e0fcf",
  storageBucket: "spiderman-e0fcf.firebasestorage.app",
  messagingSenderId: "1007889124490",
  appId: "1:1007889124490:web:8f381aeb08f5d711fd3173",
  measurementId: "G-FRNY8GY7CK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- Supabase config (unchanged) ---
const supabaseUrl = "https://wswpmifhidycyaseamyf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzd3BtaWZoaWR5Y3lhc2VhbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Mjc5MzQsImV4cCI6MjEwMjUwMzkzNH0.zr1Kibn5R6UEz8TEm1KwqBpTfSxNA6Di-eFhic17kR8";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DOM refs (same as before) ---
const homeView = document.getElementById('homeView');
const captureView = document.getElementById('captureView');
const previewView = document.getElementById('previewView');
const cropView = document.getElementById('cropView');
const mapView = document.getElementById('mapView');
const routeView = document.getElementById('routeView');
const adminView = document.getElementById('adminView');
const backBtn = document.getElementById('backBtn');
const goCameraBtn = document.getElementById('goCameraBtn');
const goMapBtn = document.getElementById('goMapBtn');
const goRouteBtn = document.getElementById('goRouteBtn');
const goAdminBtn = document.getElementById('goAdminBtn');
const authBtn = document.getElementById('authBtn');
const aboutBtn = document.getElementById('aboutBtn');

// Auth modal
const authModal = document.getElementById('authModal');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSignin = document.getElementById('authSignin');
const authSignup = document.getElementById('authSignup');
const authClose = document.getElementById('authClose');
const authError = document.getElementById('authError');

const modal = document.getElementById('aboutModal');
const modalClose = document.getElementById('modalClose');
const modalCloseBtn = document.getElementById('modalCloseBtn');

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
const cameraTypeSelect = document.getElementById('cameraTypeSelect');
const status = document.getElementById('status');
const mapContainer = document.getElementById('map');
const heatmapToggle = document.getElementById('heatmapToggle');
const mapStatus = document.getElementById('mapStatus');

const routeStart = document.getElementById('routeStart');
const routeEnd = document.getElementById('routeEnd');
const calcRouteBtn = document.getElementById('calcRouteBtn');
const refreshRouteBtn = document.getElementById('refreshRouteBtn');
const routeResult = document.getElementById('routeResult');
const startLocBtn = document.getElementById('startLocBtn');
const endLocBtn = document.getElementById('endLocBtn');

const adminTableBody = document.getElementById('adminTableBody');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const selectAll = document.getElementById('selectAll');
const statTotal = document.getElementById('statTotal');
const statDome = document.getElementById('statDome');
const statBullet = document.getElementById('statBullet');
const statAlpr = document.getElementById('statAlpr');
const statsChartCanvas = document.getElementById('statsChart');

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
let currentUser = null;
let statsChart = null;
let gpsTrack = [];
let trackLayer = null;
let isCoverageOn = false;

// --- AUTH ---
function openAuthModal() { authModal.classList.add('active'); }
function closeAuthModal() { authModal.classList.remove('active'); authError.textContent = ''; }
authClose.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

authBtn.addEventListener('click', () => {
  if (currentUser) {
    auth.signOut();
  } else {
    openAuthModal();
  }
});

authSignin.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) { authError.textContent = 'Enter email and password.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (err) {
    authError.textContent = err.message;
  }
});

authSignup.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) { authError.textContent = 'Enter email and password.'; return; }
  if (password.length < 6) { authError.textContent = 'Password must be at least 6 characters.'; return; }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (err) {
    authError.textContent = err.message;
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
  if (currentUser) goAdminBtn.style.display = 'inline-flex';
  else goAdminBtn.style.display = 'none';
  if (map) loadPins();
});

function updateAuthUI() {
  if (currentUser) {
    authBtn.textContent = `👤 ${currentUser.email?.split('@')[0] || 'User'}`;
    authBtn.classList.add('logged-in');
    mapStatus.textContent = '🔒 Full precision (logged in)';
    mapView.classList.remove('public');
  } else {
    authBtn.textContent = 'Sign In';
    authBtn.classList.remove('logged-in');
    mapStatus.textContent = '🔒 Public view: aggregated only';
    mapView.classList.add('public');
  }
}

// --- MODAL ---
aboutBtn.addEventListener('click', () => modal.classList.add('active'));
modalClose.addEventListener('click', () => modal.classList.remove('active'));
modalCloseBtn.addEventListener('click', () => modal.classList.remove('active'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

// --- NAVIGATION ---
function showView(viewId) {
  [homeView, captureView, previewView, cropView, mapView, routeView, adminView].forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (viewId === 'homeView') backBtn.style.display = 'none';
  else backBtn.style.display = 'inline-block';
  if (viewId === 'adminView' && currentUser) loadAdminPanel();
  if (viewId === 'mapView' && !map) initMap();
  else if (viewId === 'mapView' && map) map.invalidateSize();
}

goCameraBtn.addEventListener('click', () => {
  showView('captureView');
  if (!stream) startCamera();
  else { video.srcObject = stream; video.play(); captureStatus.textContent = '📷 Ready'; }
});
goMapBtn.addEventListener('click', () => showView('mapView'));
goRouteBtn.addEventListener('click', () => showView('routeView'));
goAdminBtn.addEventListener('click', () => showView('adminView'));

backBtn.addEventListener('click', () => {
  if (captureView.classList.contains('active') && stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  showView('homeView');
});

// --- CAMERA (unchanged from previous) ---
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

// --- CROP (optimized) ---
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
  cropRAF = requestAnimationFrame(() => { drawCropOverlay(); cropRAF = null; });
}

canvas.addEventListener('mousedown', (e) => { isCropping = true; const p = getCanvasCoords(e); cropStart = { x: p.x, y: p.y }; cropEnd = { x: p.x, y: p.y }; requestCropUpdate(); });
window.addEventListener('mousemove', (e) => { if (!isCropping) return; const p = getCanvasCoords(e); cropEnd = { x: p.x, y: p.y }; requestCropUpdate(); });
window.addEventListener('mouseup', () => { if (isCropping) { isCropping = false; validateCrop(); } });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isCropping = true; const p = getCanvasCoords(e); cropStart = { x: p.x, y: p.y }; cropEnd = { x: p.x, y: p.y }; requestCropUpdate(); }, { passive: false });
window.addEventListener('touchmove', (e) => { if (!isCropping) return; e.preventDefault(); const p = getCanvasCoords(e); cropEnd = { x: p.x, y: p.y }; requestCropUpdate(); }, { passive: false });
window.addEventListener('touchend', (e) => { if (isCropping) { isCropping = false; validateCrop(); } }, { passive: false });

function validateCrop() {
  if (cropStart && cropEnd) {
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);
    if (w < 10 || h < 10) { cropStatus.textContent = '⚠️ Selection too small'; cropStart = null; cropEnd = null; drawCropOverlay(); }
    else { cropStatus.textContent = '✅ Ready. Tap "Crop & Upload"'; }
  }
}

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
    const camType = cameraTypeSelect.value;
    await uploadPhoto(blob, camType);
  }, 'image/jpeg', 0.92);
});

cancelCropBtn.addEventListener('click', () => { showView('previewView'); });

// --- GPS ---
function getAccuratePosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: 18.4861, lng: -69.9312 }); return; }
    let readings = [];
    let watchId = navigator.geolocation.watchPosition(
      (pos) => {
        readings.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        if (readings.length >= 5) {
          navigator.geolocation.clearWatch(watchId);
          let totalWeight = 0; let avgLat = 0, avgLng = 0;
          readings.forEach(r => { const w = 1 / (r.acc + 1); avgLat += r.lat * w; avgLng += r.lng * w; totalWeight += w; });
          avgLat /= totalWeight; avgLng /= totalWeight;
          resolve({ lat: avgLat, lng: avgLng });
        }
      },
      () => { navigator.geolocation.clearWatch(watchId); resolve({ lat: 18.4861, lng: -69.9312 }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
    setTimeout(() => { if (readings.length < 3) { navigator.geolocation.clearWatch(watchId); resolve({ lat: 18.4861, lng: -69.9312 }); } }, 12000);
  });
}

// --- GPS track for coverage ---
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      gpsTrack.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() });
      if (gpsTrack.length > 10000) gpsTrack.shift();
      if (isCoverageOn && map) updateCoverage();
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

// --- UPLOAD (uses Firebase UID) ---
async function uploadPhoto(blob, camType) {
  if (!currentUser) { alert('Please sign in first!'); return; }
  status.textContent = '📍 Getting GPS...';
  const pos = await getAccuratePosition();
  status.textContent = '🔍 Checking duplicates...';
  const { data: nearby } = await supabase
    .from('intel')
    .select('id, lat, lng')
    .filter('lat', 'gte', pos.lat - 0.00015).filter('lat', 'lte', pos.lat + 0.00015)
    .filter('lng', 'gte', pos.lng - 0.00015).filter('lng', 'lte', pos.lng + 0.00015);
  if (nearby && nearby.length > 0) {
    const close = nearby.filter(p => turf.distance(turf.point([pos.lng, pos.lat]), turf.point([p.lng, p.lat]), { units: 'meters' }) < 15);
    if (close.length > 0 && !confirm(`⚠️ ${close.length} camera(s) within 15m. Still upload?`)) {
      status.textContent = '❌ Cancelled'; cropStatus.textContent = '❌ Cancelled'; return;
    }
  }
  status.textContent = '⬆️ Uploading...';
  try {
    const filename = `cam_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from('intel').upload(filename, blob, { contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('intel').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;
    const { error: insertError } = await supabase
      .from('intel')
      .insert([{
        lat: pos.lat, lng: pos.lng, image_url: publicUrl, filename: filename,
        timestamp: new Date().toISOString(),
        camera_type: camType,
        user_id: currentUser.uid
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

// --- GEOCODING ---
async function geocodeAddress(query) {
  if (!query || query.trim() === '') return null;
  const parts = query.split(',').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await resp.json();
    if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch (e) { return null; }
}

// --- ROUTE SCORER (kernel density) ---
async function calculateRoute() {
  routeResult.innerHTML = '⏳ Geocoding...';
  const startAddr = routeStart.value.trim(), endAddr = routeEnd.value.trim();
  if (!startAddr || !endAddr) { routeResult.innerHTML = '❌ Enter both.'; return; }
  const startCoords = await geocodeAddress(startAddr);
  const endCoords = await geocodeAddress(endAddr);
  if (!startCoords || !endCoords) { routeResult.innerHTML = '❌ Address not found.'; return; }
  routeResult.innerHTML = '⏳ Fetching route...';
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) { routeResult.innerHTML = '❌ No route.'; return; }
    const routeLine = turf.lineString(data.routes[0].geometry.coordinates);
    const totalLength = data.routes[0].distance;
    let totalWeight = 0;
    const bandwidth = 30;
    allPins.forEach(p => {
      const pt = turf.point([p.lng, p.lat]);
      const distance = turf.pointToLineDistance(pt, routeLine, { units: 'meters' });
      const weight = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth));
      totalWeight += weight;
    });
    const density = (totalWeight / totalLength) * 100;
    const buffered = turf.buffer(routeLine, 50, { units: 'meters' });
    let countInside = 0;
    allPins.forEach(p => {
      if (turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), buffered)) countInside++;
    });

    routeResult.innerHTML = `
      <div><strong>📍 Start:</strong> ${startAddr}</div>
      <div><strong>📍 End:</strong> ${endAddr}</div>
      <div>Route: <strong>${(totalLength / 1000).toFixed(2)} km</strong></div>
      <div>Cameras within 50m: <strong>${countInside}</strong></div>
      <div>Weighted exposure density: <span class="route-result-score">${density.toFixed(2)}</span> cameras/100m</div>
      <div class="route-result-small">(Gaussian kernel, σ = 30m)</div>
    `;
  } catch (err) { routeResult.innerHTML = '❌ Error: ' + err.message; }
}

calcRouteBtn.addEventListener('click', calculateRoute);
refreshRouteBtn.addEventListener('click', () => { if (routeView.classList.contains('active')) { loadPinsSilent(); routeResult.innerHTML = '⟳ Refreshed. ' + allPins.length + ' cameras.'; } });

async function loadPinsSilent() {
  const { data, error } = await supabase.from('intel').select('*').order('timestamp', { ascending: false });
  if (!error) { allPins = data.filter(r => r.lat && r.lng).map(r => ({ lat: r.lat, lng: r.lng, imageUrl: r.image_url, timestamp: r.timestamp, camera_type: r.camera_type })); }
}

function setLocationToInput(input) {
  if (!navigator.geolocation) { alert('No GPS.'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => { input.value = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`; },
    () => alert('Could not get location.'),
    { enableHighAccuracy: true }
  );
}
startLocBtn.addEventListener('click', () => setLocationToInput(routeStart));
endLocBtn.addEventListener('click', () => setLocationToInput(routeEnd));

// --- MAP (chill tiles, removed zoom controls) ---
function initMap() {
  map = L.map(mapContainer, { zoomControl: false }).setView([18.4861, -69.9312], 14);
  // Chill, light tile layer (CartoDB Voyager)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, CartoDB'
  }).addTo(map);

  const clusterIcon = (cluster) => L.divIcon({
    html: `<div style="background:#2563eb;color:white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;box-shadow:0 0 0 3px #0a0a0a;">${cluster.getChildCount()}</div>`,
    className: '', iconSize: [40, 40]
  });
  markerCluster = L.markerClusterGroup({ iconCreateFunction: clusterIcon, spiderfyOnMaxZoom: true, maxClusterRadius: 50 });
  map.addLayer(markerCluster);

  // Coverage toggle
  const coverageToggle = L.Control.extend({
    onAdd: function() {
      const btn = L.DomUtil.create('button', 'coverage-btn');
      btn.innerHTML = '📍 Coverage';
      btn.style.cssText = 'background:rgba(20,20,30,0.8);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.08);color:white;padding:8px 16px;border-radius:30px;cursor:pointer;font-size:13px;margin:10px;';
      btn.onclick = function() {
        isCoverageOn = !isCoverageOn;
        updateCoverage();
        btn.innerHTML = isCoverageOn ? '📍 Hide Coverage' : '📍 Coverage';
      };
      return btn;
    }
  });
  map.addControl(new coverageToggle());

  loadPins();
}

function updateCoverage() {
  if (!map) return;
  if (trackLayer) { map.removeLayer(trackLayer); trackLayer = null; }
  if (!isCoverageOn || gpsTrack.length < 2) return;
  const points = gpsTrack.map(p => [p.lat, p.lng]);
  const polyline = L.polyline(points, { color: '#2563eb', weight: 2, opacity: 0.6, dashArray: '5,5' });
  trackLayer = polyline.addTo(map);
}

// --- Load pins (public aggregation) ---
async function loadPins() {
  if (!map) return;
  markerCluster.clearLayers();
  allPins = [];

  if (currentUser) {
    const { data, error } = await supabase.from('intel').select('*').order('timestamp', { ascending: false });
    if (error) { console.error(error); return; }
    data.forEach((row) => {
      if (!row.lat || !row.lng) return;
      allPins.push({ lat: row.lat, lng: row.lng, imageUrl: row.image_url, timestamp: row.timestamp, camera_type: row.camera_type });
      const marker = L.marker([row.lat, row.lng], { icon: L.divIcon({ html: '📷', className: '', iconSize: [24, 24], iconAnchor: [12, 12] }) });
      marker.bindPopup(`<div class="custom-popup"><strong>${row.timestamp ? new Date(row.timestamp).toLocaleString() : 'N/A'}</strong><br/>${row.camera_type ? 'Type: ' + row.camera_type : ''}<br/><img src="${row.image_url}" alt="camera" /></div>`);
      markerCluster.addLayer(marker);
    });
  } else {
    const { data, error } = await supabase.rpc('get_public_heatmap');
    if (error) { console.error(error); return; }
    data.forEach((row) => {
      allPins.push({ lat: row.lat, lng: row.lng });
      const marker = L.marker([row.lat, row.lng], {
        icon: L.divIcon({ html: `${row.count}`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] }),
        opacity: 0.7
      });
      marker.bindPopup(`<div style="color:#111;text-align:center;"><strong>${row.count}</strong> cameras in this grid square<br/><span style="font-size:11px;color:#666;">~1km²</span></div>`);
      markerCluster.addLayer(marker);
    });
  }

  if (allPins.length > 0) {
    const bounds = markerCluster.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }
  if (isHeatmapOn) toggleHeatmap();
}

// --- HEATMAP ---
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

// --- ADMIN PANEL ---
async function loadAdminPanel() {
  if (!currentUser) return;
  const { data, error } = await supabase.from('intel').select('*').order('timestamp', { ascending: false });
  if (error) { console.error(error); return; }
  const total = data.length;
  const dome = data.filter(r => r.camera_type === 'dome').length;
  const bullet = data.filter(r => r.camera_type === 'bullet').length;
  const alpr = data.filter(r => r.camera_type === 'alpr').length;
  const cctv = data.filter(r => r.camera_type === 'cctv').length;
  statTotal.textContent = total;
  statDome.textContent = dome;
  statBullet.textContent = bullet;
  statAlpr.textContent = alpr;

  const ctxChart = statsChartCanvas.getContext('2d');
  if (statsChart) statsChart.destroy();

  const typeCounts = { dome:0, bullet:0, alpr:0, cctv:0, doorbell:0, traffic:0, unknown:0 };
  data.forEach(r => { if (typeCounts[r.camera_type] !== undefined) typeCounts[r.camera_type]++; else typeCounts.unknown++; });

  statsChart = new Chart(ctxChart, {
    type: 'bar',
    data: {
      labels: ['Dome', 'Bullet', 'ALPR', 'CCTV', 'Doorbell', 'Traffic', 'Unknown'],
      datasets: [{
        label: 'Camera types',
        data: [typeCounts.dome, typeCounts.bullet, typeCounts.alpr, typeCounts.cctv, typeCounts.doorbell, typeCounts.traffic, typeCounts.unknown],
        backgroundColor: ['#2563eb','#60a5fa','#8b5cf6','#10b981','#f59e0b','#ef4444','#6b7280']
      }]
    },
    options: { plugins: { legend: { labels: { color: '#aaa' } } }, scales: { y: { beginAtZero: true, ticks: { color: '#888' } }, x: { ticks: { color: '#888' } } } }
  });

  adminTableBody.innerHTML = data.map(row => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${row.id}" /></td>
      <td>${row.id.slice(0,8)}</td>
      <td>${row.lat?.toFixed(5)}</td>
      <td>${row.lng?.toFixed(5)}</td>
      <td>${row.camera_type || 'unknown'}</td>
      <td>${row.timestamp ? new Date(row.timestamp).toLocaleDateString() : 'N/A'}</td>
      <td><button class="delete-btn" data-id="${row.id}">Delete</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this entry?')) {
        await supabase.from('intel').delete().eq('id', btn.dataset.id);
        loadAdminPanel();
        if (map) loadPins();
      }
    });
  });

  bulkDeleteBtn.onclick = async () => {
    const checked = document.querySelectorAll('.row-check:checked');
    if (checked.length === 0) return;
    if (confirm(`Delete ${checked.length} entries?`)) {
      const ids = Array.from(checked).map(cb => cb.dataset.id);
      await supabase.from('intel').delete().in('id', ids);
      loadAdminPanel();
      if (map) loadPins();
    }
  };

  selectAll.onchange = () => {
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = selectAll.checked);
  };
}

refreshAdminBtn.addEventListener('click', loadAdminPanel);

status.textContent = '🔵 App ready. Sign in with Firebase.';
console.log('✅ Firebase Auth + chill map + no zoom controls.');
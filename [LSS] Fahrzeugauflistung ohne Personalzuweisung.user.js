// ==UserScript==
// @name         [LSS] Fahrzeugauflistung ohne Personalzuweisung
// @namespace    https://leitstellenspiel.de
// @version      1.2
// @description  Listet alle Fahrzeuge ohne Personal an. Konfigurierbare Fahrzeugtypen im Overlay.
// @author       Paul
// @match        https://www.leitstellenspiel.de/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---- Einstellungen laden/speichern ----
  function loadIds() {
    const saved = localStorage.getItem('vehicleTypeIds');
    return saved ? JSON.parse(saved) : [];
  }

  function saveIds(ids) {
    localStorage.setItem('vehicleTypeIds', JSON.stringify(ids));
  }

  function loadMode() {
    return localStorage.getItem('filterMode') || 'ignore'; // "ignore" oder "only"
  }

  function saveMode(mode) {
    localStorage.setItem('filterMode', mode);
  }

  let vehicleTypeIds = loadIds();
  let filterMode = loadMode();
  let trailerTypeIds = [];

  async function fetchTrailerTypes() {
    try {
      const res = await fetch('https://api.lss-manager.de/de_DE/vehicles');
      const data = await res.json();
      trailerTypeIds = Object.entries(data)
        .filter(([, val]) => val.isTrailer)
        .map(([id]) => parseInt(id));
    } catch (e) {
      console.warn("Trailer-Daten nicht geladen:", e);
      trailerTypeIds = [];
    }
  }

  // ---- Popup-Hinweis (Toast) ----
  function showMessage(msg, color = '#28a745') {
    const note = document.createElement('div');
    Object.assign(note.style, {
      position: 'fixed',
      bottom: '90px',
      right: '30px',
      background: color,
      color: 'white',
      padding: '8px 14px',
      borderRadius: '6px',
      fontWeight: 'bold',
      zIndex: '10001',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      opacity: '0',
      transition: 'opacity 0.3s ease'
    });
    note.textContent = msg;
    document.body.appendChild(note);

    setTimeout(() => note.style.opacity = '1', 50);
    setTimeout(() => {
      note.style.opacity = '0';
      setTimeout(() => note.remove(), 300);
    }, 2500);
  }

  // ---- Fahrzeug-IDs kopieren ----
  function copyVehicleIds() {
    const listItems = document.querySelectorAll('#vehicle-list li');
    const ids = Array.from(listItems).map(li => {
      const text = li.textContent;
      const match = text.match(/\(ID: (\d+)\)/);
      return match ? match[1] : null;
    }).filter(id => id !== null);

    navigator.clipboard.writeText(ids.join(',')).then(() => {
      showMessage('✅ Fahrzeug-IDs in die Zwischenablage kopiert!');
    });
  }

  // ---- Button unten rechts ----
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Fahrzeuge ohne Personal';
  Object.assign(toggleButton.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '10000',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 8px rgba(0,0,0,0.25)',
    transition: 'background-color 0.25s ease'
  });
  toggleButton.onmouseenter = () => toggleButton.style.backgroundColor = '#0056b3';
  toggleButton.onmouseleave = () => toggleButton.style.backgroundColor = '#007bff';
  document.body.appendChild(toggleButton);

  // ---- Popup ----
  const popup = document.createElement('div');
  Object.assign(popup.style, {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    width: '400px',
    maxHeight: '500px',
    overflowY: 'auto',
    backgroundColor: '#fdfdfd',
    border: '1px solid #ccc',
    borderRadius: '10px',
    zIndex: '9999',
    boxShadow: '0 6px 15px rgba(0,0,0,0.3)',
    display: 'none',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px'
  });
  document.body.appendChild(popup);

  popup.innerHTML = `
    <div style="background:#007bff; color:white; padding:10px 15px;
                border-top-left-radius:10px; border-top-right-radius:10px;
                display:flex; justify-content:space-between; align-items:center">
      <span style="font-weight:bold; font-size:15px"> Fahrzeuge ohne Personal</span>
      <button id="close-popup" style="background:none; border:none; color:white; font-size:18px; cursor:pointer;">✖</button>
    </div>
    <div style="padding:12px;">
      <p id="vehicle-count" style="margin: 5px 0; font-weight:bold; color:red;"></p>

      <label for="vehicle-ids" style="font-weight:bold; display:block; margin-top:10px; color:black;">Fahrzeugtypen-IDs (z.b. 2,3,50)</label>
      <textarea id="vehicle-ids" rows="2"
                style="width:100%; margin:6px 0; padding:6px; border-radius:5px; border:1px solid #ccc; font-family:monospace;"></textarea>

      <label for="filter-mode" style="font-weight:bold; display:block; margin-top:8px; color:black;">Filtermodus</label>
      <select id="filter-mode" style="width:100%; margin:6px 0; padding:6px; border-radius:5px; border:1px solid #ccc;">
        <option value="ignore">❌ Diese IDs ignorieren</option>
        <option value="only">✅ Nur diese IDs anzeigen</option>
      </select>

      <button id="save-settings" style="padding:5px 12px; border-radius:5px; background:#28a745; border:none; color:white; font-weight:bold; cursor:pointer;">Speichern</button>

      <button id="copy-ids" style="margin-top:10px; padding:5px 12px; border-radius:5px; background:#28a745; border:none; color:white; font-weight:bold; cursor:pointer;">IDs kopieren</button>

      <hr style="margin:15px 0;">
      <ul id="vehicle-list" style="padding-left:18px; margin:0; list-style-type:disc; line-height:1.5;"></ul>
    </div>
  `;

  // ---- Events ----
  toggleButton.addEventListener('click', async () => {
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    toggleButton.style.display = popup.style.display === 'block' ? 'none' : 'block';
    if (popup.style.display === 'block') {
      document.getElementById('vehicle-ids').value = vehicleTypeIds.join(',');
      document.getElementById('filter-mode').value = filterMode;
      await fetchTrailerTypes();
      await loadVehicles();
    }
  });

  document.getElementById('close-popup').addEventListener('click', () => {
    popup.style.display = 'none';
    toggleButton.style.display = 'block';
  });

  document.getElementById('save-settings').addEventListener('click', () => {
    const raw = document.getElementById('vehicle-ids').value;
    vehicleTypeIds = raw.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
    filterMode = document.getElementById('filter-mode').value;
    saveIds(vehicleTypeIds);
    saveMode(filterMode);
    loadVehicles();
  });

  document.getElementById('copy-ids').addEventListener('click', copyVehicleIds);

  // ---- Fahrzeuge laden ----
  async function loadVehicles() {
    const list = document.getElementById('vehicle-list');
    const countField = document.getElementById('vehicle-count');
    list.innerHTML = '';
    countField.textContent = 'Fahrzeuge werden geladen!';

    try {
      const res = await fetch('/api/vehicles');
      const vehicles = await res.json();

      const filtered = vehicles.filter(v => {
        const noPersonal = !v.assigned_personnel_count || v.assigned_personnel_count === 0;
        const isTrailer = trailerTypeIds.includes(v.vehicle_type);
        if (!noPersonal || isTrailer) return false;

        if (filterMode === 'ignore') {
          return !vehicleTypeIds.includes(v.vehicle_type);
        } else if (filterMode === 'only') {
          return vehicleTypeIds.includes(v.vehicle_type);
        }
        return true;
      });

      countField.textContent = ` ${filtered.length} Fahrzeuge ohne Personal gefunden.`;

      const fragment = document.createDocumentFragment();
      filtered.forEach(v => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `/vehicles/${v.id}/zuweisung`;
        link.target = '_blank';
        link.textContent = `${v.caption} (ID: ${v.id})`;
        li.appendChild(link);
        fragment.appendChild(li);
      });
      list.appendChild(fragment);

    } catch (e) {
      countField.textContent = '❌ Fehler beim Laden der Fahrzeugdaten.';
      console.error(e);
    }
  }
})();

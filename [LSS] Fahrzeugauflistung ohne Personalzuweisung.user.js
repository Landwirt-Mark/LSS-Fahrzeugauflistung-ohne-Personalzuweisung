// ==UserScript==
// @name         [LSS] Fahrzeugauflistung ohne Personalzuweisung
// @namespace    https://leitstellenspiel.de
// @version      1.1
// @description  Listet alle fahrzeuge ohne Personal an.
// @author       Paul
// @match        https://www.leitstellenspiel.de/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Fahrzeugtypen die NICHT angezeigt werden sollen werden hier Eintragen. Zwischen diese [ ] klammern (die IDs findet man in der API)
  const ignoredVehicleTypeIds = [];


  let trailerTypeIds = [];

  async function fetchTrailerTypes() {
    const res = await fetch('https://api.lss-manager.de/de_DE/vehicles');
    const data = await res.json();
    trailerTypeIds = Object.entries(data)
      .filter(([, val]) => val.isTrailer)
      .map(([id]) => parseInt(id));
  }

  // Button unten rechts
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

  // Popup-Fenster
  const popup = document.createElement('div');
  Object.assign(popup.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '400px',
    maxHeight: '550px',
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
      <button id="copy-ids" class="btn btn-sm btn-primary" style="margin-bottom: 10px; padding:5px 12px; border-radius:5px; background:#28a745; border:none; color:white; font-weight:bold; cursor:pointer;">📋 IDs kopieren</button>
      <p id="vehicle-count" style="margin: 5px 0; font-weight:bold; color:#b00;"></p>
      <textarea id="vehicle-id-output" rows="4" readonly
                style="width:100%; margin-bottom:10px; padding:8px; border-radius:5px; border:1px solid #ccc; font-family:monospace;"></textarea>
      <ul id="vehicle-list" style="padding-left:18px; margin:0; list-style-type:disc; line-height:1.5;"></ul>
    </div>
  `;

  // Toggle öffnen / schließen
  toggleButton.addEventListener('click', async () => {
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    if (popup.style.display === 'block') {
      await fetchTrailerTypes();
      await loadVehicles();
    }
  });

  document.getElementById('close-popup').addEventListener('click', () => {
    popup.style.display = 'none';
  });

  // Fahrzeuge laden und filtern
  async function loadVehicles() {
    const list = document.getElementById('vehicle-list');
    const idField = document.getElementById('vehicle-id-output');
    const countField = document.getElementById('vehicle-count');
    list.innerHTML = '';
    idField.value = '';
    countField.textContent = 'Fahrzeuge werden geladen!';

    try {
      const res = await fetch('/api/vehicles');
      const vehicles = await res.json();

      const filtered = vehicles.filter(v =>
        (!v.assigned_personnel_count || v.assigned_personnel_count === 0) &&
        !ignoredVehicleTypeIds.includes(v.vehicle_type) &&
        !trailerTypeIds.includes(v.vehicle_type)
      );

      countField.textContent = ` ${filtered.length} Fahrzeuge ohne Personal gefunden.`;
      idField.value = filtered.map(v => v.id).join(',');

      filtered.forEach(v => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `/vehicles/${v.id}/zuweisung`;
        link.target = '_blank';
        link.textContent = `${v.caption} (ID: ${v.id})`;
        li.appendChild(link);
        list.appendChild(li);
      });

    } catch (e) {
      countField.textContent = '❌ Fehler beim Laden der Fahrzeugdaten.';
      console.error(e);
    }
  }

  // Kopieren
  popup.addEventListener('click', e => {
    if (e.target && e.target.id === 'copy-ids') {
      const ids = document.getElementById('vehicle-id-output').value;
      navigator.clipboard.writeText(ids).then(() => {
        alert('Fahrzeug-IDs wurden in die Zwischenablage kopiert.');
      });
    }
  });
})();

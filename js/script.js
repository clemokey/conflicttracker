// Initialize variables
var events, map, abj, clusters, points, heatmap, baseMaps = null;
// Initialize charts
var eventTypeChart, timelineChart, subEventTypeChart, eventsByAdmin2Chart = null;

var fatalitiesByTypeChart, yearMonthHeatmapChart, sankeyDisorderTypeChart, stackedDisorderAreaChart = null;

let dowRadarChart = null;

// Global layer index for all event features
const layerIndex = new Map();
const coordsIndex  = new Map(); // OBJECTID -> {lat,lng}
const featureIndex = new Map(); // OBJECTID -> feature (for popup fallback)

// let autoId = 1;
// color pallette for events
const TYPE_STYLE = {
  "Protests": { fill:"#8e44ad", stroke:"rgba(142,68,173,0.4)" },       // purple
  "Violence against civilians": { fill:"#2ecc71", stroke:"rgba(231,76,60,0.4)" },
  "Riots": { fill:"#f39c12", stroke:"rgba(243,156,18,0.4)" },
  "Battles": { fill:"#3498db", stroke:"rgba(52,152,219,0.4)" },
  "Explosions/Remote violence": { fill:"#e62222ff", stroke:"rgba(230,126,34,0.4)" },
  "Other": { fill:"#404241ff", stroke:"rgba(46,204,113,0.4)" }
};

// Display welcom dialog
var filterContainer = null;
const FIT_PAD = { padding: [20, 20] };
const LS_KEY = 'splash_hide';

setupSplash();


// setup filtering
// srt events to the data from events.js
events = geoev;
let currentFilter = { type: 'All', disorder: 'All', year: 'All' };
var filteredEvents = events;

// Load the map
initMap(filteredEvents);
// Load other elements and layers
renderAll(filteredEvents);

// Add legend
addLegend();
// Add locate me button
addLocateMe();
// Tab switcher
activateTabs();

// drawing on the map to filter data
const drawLayer = L.featureGroup().addTo(map);
let spatialGeom = null; // GeoJSON geometry to filter with

setupDrawings()

// Build layer list
var features = {
    "Abuja": abj,
    "Events": clusters,
    "Event hotspot": heatmap
};

// Add a layer control with base maps and feature layers
L.control.layers(baseMaps, features, { position: 'topright' }).addTo(map);

// Add filter pills for DISORDER_TYPE
setupPills(events);
initYearFilter(events);

// handle user change
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'yearFilter') {
    const v = e.target.value;
    setFilter({ year: v === 'All' ? 'All' : Number(v) });
  }
});

// (optional) keep the UI in sync when you reset programmatically
function syncYearSelect() {
  const sel = document.getElementById('yearFilter');
  if (sel) sel.value = String(currentFilter.year);
}

// Add the custom clear control to the map
new ClearDrawControl().addTo(map);

function initYearDropdown(fc) {
    const wrap  = document.getElementById('yearFilterWrap');
    const btn   = document.getElementById('yearBtn');
    const btnTxt= document.getElementById('yearBtnText');
    const menu  = document.getElementById('yearMenu');

    // Collect years (prefer YEAR, fallback EVENT_DATE)
    const years = Array.from(new Set(
      (fc.features || []).map(f => {
        let y = Number(f.properties?.YEAR);
        if (!y || isNaN(y)) {
          const d = new Date(f.properties?.EVENT_DATE);
          if (!isNaN(d)) y = d.getFullYear();
        }
        return y;
      }).filter(Boolean)
    )).sort((a,b) => b - a); // newest first

    // Build menu
    const items = ['All', ...years];
    menu.innerHTML = items.map((y, i) =>
      `<li role="option" tabindex="-1" data-value="${y}">${y === 'All' ? 'All years' : y}</li>`
    ).join('');

    // Helpers
    const open  = () => { wrap.classList.add('open'); btn.setAttribute('aria-expanded','true'); menu.focus(); focusSelectedOrFirst(); };
    const close = () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };

    function focusSelectedOrFirst() {
      const current = Array.from(menu.children).find(li => li.getAttribute('aria-selected') === 'true');
      (current || menu.firstElementChild).focus();
    }

    // Click on button toggles
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      wrap.classList.contains('open') ? close() : open();
    });

    // Click outside closes
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) close();
    });

    // Click on item selects + filters
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-value]');
      if (!li) return;
      selectValue(li.getAttribute('data-value'));
    });

    // Keyboard navigation
    menu.addEventListener('keydown', (e) => {
      const focusable = Array.from(menu.querySelectorAll('li[role="option"]'));
      const idx = focusable.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (focusable[idx+1] || focusable[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (focusable[idx-1] || focusable.at(-1)).focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
    });

    function selectValue(v) {
      // Update UI
      btnTxt.textContent = (v === 'All') ? 'All years' : v;
      menu.querySelectorAll('li').forEach(li => li.removeAttribute('aria-selected'));
      const selLi = menu.querySelector(`li[data-value="${CSS.escape(String(v))}"]`);
      if (selLi) selLi.setAttribute('aria-selected','true');

      // Apply filter
      setFilter({ year: (v === 'All') ? 'All' : Number(v) });

      // Close
      close(); btn.focus();
    }

    // Initial UI state
    selectValue('All'); // or keep currentFilter.year if you want to sync
  }

  // If you reset filters elsewhere, sync the dropdown:
  function syncYearDropdown() {
    const wrap  = document.getElementById('yearFilterWrap');
    if (!wrap) return;
    const value = (window.currentFilter?.year ?? 'All');
    const btnTxt= document.getElementById('yearBtnText');
    const menu  = document.getElementById('yearMenu');
    btnTxt.textContent = (value === 'All') ? 'All years' : value;
    menu?.querySelectorAll('li').forEach(li => {
      li.toggleAttribute('aria-selected', li.dataset.value == String(value));
    });
  }
initYearDropdown(events);

function setupSplash() {
	const overlay  = document.getElementById('splash-overlay');
	const dialog   = document.getElementById('splash-dialog');
	const btnClose = document.getElementById('closeSplash');
	const chk      = document.getElementById('dontShowAgain');
	const helpBtn  = document.getElementById('helpBtn');

	if (!overlay || !dialog) {
		console.warn('Splash elements not found. Check IDs: #splash-overlay and #splash-dialog.');
		return;
	}

	const openSplash = (force = false) => {
		if (!force && localStorage.getItem(LS_KEY) === '1') return;
		overlay.style.display = 'flex';
		overlay.setAttribute('aria-hidden', 'false');
	};

	const closeSplash = () => {
		overlay.style.display = 'none';
		overlay.setAttribute('aria-hidden', 'true');
		if (chk && chk.checked) localStorage.setItem(LS_KEY, '1');
	};

	// expose for Help button / external calls
	window.showSplash = () => openSplash(true);

	// events
	btnClose?.addEventListener('click', closeSplash);

	overlay.addEventListener('click', (e) => {
	if (e.target === overlay) shakeDialog(dialog);
	});

	// Clean up class after animation finishes
	dialog.addEventListener('animationend', (e) => {
	if (e.animationName === 'shake') dialog.classList.remove('dialog-shake');
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && overlay.style.display === 'flex') closeSplash();
	});

	// help button (optional)
	helpBtn?.addEventListener('click', () => {
		if (chk) chk.checked = false;
		openSplash(true);
	});

	// show on load if not opted out
	openSplash(false);
}

function shakeDialog(dialog) {
  if (!dialog) return;
  dialog.classList.remove('dialog-shake'); 
  void dialog.offsetWidth;  
  dialog.classList.add('dialog-shake');
}

function makeDotIcon(type){
  const sty = TYPE_STYLE[type] || { fill:"#7f8c8d", stroke:"rgba(127,140,141,0.4)" };
  const html = `
    <div class="dot" style="
      background:${sty.fill};
      border:3px solid ${sty.stroke};
    "></div>`;
  return L.divIcon({ html, className:"dot-wrap", iconSize:[18,18] });
}

function parseCustomDate(dateStr) {
  if (!dateStr) return null;
  const [day, monthName, year] = dateStr.split('-');
  const monthIndex = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ].indexOf(monthName);
  if (monthIndex === -1) return null;
  return new Date(parseInt(year), monthIndex, parseInt(day));
}

function initMap(){
    // Initialize Leaflet map and add controls for interacting with the map
    map = L.map('map').setView([9.05785, 7.49508], 12);

    var osmap = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a target="_blank" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    var google = L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',{
            attribution: '&copy; <a target="_blank" href="https://www.google.com/maps">Google</a>',
            maxZoom: 21
        }
    ).addTo(map);;

    var Topographic = L.esri.basemapLayer('Topographic')
    var Streets = L.esri.basemapLayer('Streets');
    var imagery = L.esri.basemapLayer('Imagery');

    baseMaps = {
        "Google": google,
        "Topographic": Topographic,
        "Streets": Streets,
        "Imagery": imagery,
        "OpenStreetMap": osmap
    };

    // Define the style for abuja city boundary
    var myStyle = {
        color: 'var(--primary-color)',
        weight: 4,
        fillColor: 'var(--primary-color)',
        fillOpacity: 0.1
    };

    abj = L.geoJson(abuja, { style: myStyle});
    abj.addTo(map);

    map.fitBounds(abj.getBounds());
    // Add a scale bar
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

	// add data attribution
    map.attributionControl.addAttribution('| Data © <a target="_blank" href="https://acleddata.com/">ACLED</a>');
}

function loadEvents(events) {
	if (points && clusters) {
		clusters.removeLayer(points);
		try { points.remove(); } catch (e) {}
		points = null;
	}

	autoId = 1;
	layerIndex.clear();

	points = L.geoJSON(events, {
		pointToLayer: (feature, latlng) => {
		return L.marker(latlng, { icon: makeDotIcon(feature.properties?.EVENT_TYPE) });
		},
		onEachFeature: (feature, layer) => {
		const fid = feature.id ?? feature.properties?.OBJECTID ?? autoId++;
		feature.__fid = String(fid);
		layerIndex.set(String(fid), layer);
		layer.bindPopup(buildPopupHTML(feature.properties), { maxWidth: 250 });
		}
	});

	if (!clusters) {
		clusters = L.markerClusterGroup({
		spiderfyOnMaxZoom: true,
		showCoverageOnHover: false,
		disableClusteringAtZoom: 24,
		iconCreateFunction: (cluster) => {
			const count = cluster.getChildCount();
			let size = 34;
			if (count >= 10 && count < 100) size = 40;
			else if (count >= 100) size = 50;
			const html = `
			<div class="cluster-bubble" style="width:${size}px;height:${size}px;line-height:${size}px;">
				${count}
			</div>`;
			return L.divIcon({ html, className: "cluster-wrap", iconSize: [size, size] });
		}
		}).addTo(map);
	}

	clusters.addLayer(points);

	if (typeof layersControl !== 'undefined' && layersControl) {
		try { layersControl.removeLayer(clusters); } catch (e) {}
		layersControl.addOverlay(clusters, `Events (${(events.features?.length ?? 0).toLocaleString()})`);
	}
}

function buildPopupHTML(p) {
  const t  = p.EVENT_TYPE ?? "Unknown";
  const s  = p.SUB_EVENT_TYPE ?? "";
  const fat = Number.isFinite(p.FATALITIES) ? p.FATALITIES : null;
  const d  = p.EVENT_DATE ?? "";
  const dis = p.DISORDER_TYPE ?? "";
  const inter = p.INTERACTION ?? "";
  const admin2 = p.ADMIN2 ?? "";
  const src = p.SOURCE ?? "";
  const a1 = p.ACTOR1 ?? "";
  const a2 = p.ACTOR2 ?? "";
  const notes = p.NOTES ?? "";

  return `
    <div class="popup-card">
      <div class="popup-title">
        <h3>${t}${s ? ` — ${s}` : ""}</h3>
      </div>

      <div class="popup-body">
        ${d ? `<div><b>Date:</b> ${d}</div>` : ""}
        ${fat ? `<div><b>Deaths:</b> ${fat}</div>` : ""}
        ${dis ? `<div><b>Disorder:</b> ${dis}</div>` : ""}
        ${inter ? `<div><b>Interaction:</b> ${inter}</div>` : ""}
        ${admin2 ? `<div><b>Location:</b> ${admin2}</div>` : ""}
        ${src ? `<div><b>Source:</b> ${src}</div>` : ""}
        ${a1 ? `<div><b>Actor 1:</b> ${a1}</div>` : ""}
        ${a2 ? `<div><b>Actor 2:</b> ${a2}</div>` : ""}
        ${notes ? `<p class="popup-notes">${notes}</p>` : ""}
      </div>
    </div>
  `;
}

function loadHeatmap(fc) {
  const TYPE_WEIGHT = {
    "Protest": 0.6,
    "Violence": 1.0,
    "Riot": 0.9,
    "Strategic Development": 0.4,
    "Battle": 0.8,
    "Explosions/Remote violence": 0.9
  };

  const heatPoints = fc.features
    .filter(f => f.geometry && f.geometry.type === "Point")
    .map(f => {
      const [lng, lat] = f.geometry.coordinates;
      const w = TYPE_WEIGHT[f.properties?.EVENT_TYPE] ?? 0.7;
      return [lat, lng, w];
    });

  if (!heatmap) {
    // create once
    heatmap = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      minOpacity: 0.2
    }).addTo(map);
  } else {
    // update in place (no recreate)
    heatmap.setLatLngs(heatPoints).redraw();
  }

    // freeze (will misalign if you pan/zoom while frozen)
    map.off('moveend', heatmap._reset, heatmap);
    map.off('zoomanim', heatmap._animateZoom, heatmap);

    // ... later, unfreeze
    map.on('moveend', heatmap._reset, heatmap);
    if (map.options.zoomAnimation) map.on('zoomanim', heatmap._animateZoom, heatmap);
    heatmap._reset(); // force one redraw

}
function addLegend() {
    const legend = L.control({ position: "topright" });
    legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.style.background = "white";
    div.style.padding = "8px 10px";
    div.style.borderRadius = "6px";
    div.style.border = "2px solid rgba(0,0,0,0.2)";

    const cats = Object.keys(TYPE_STYLE);
    div.innerHTML = "<div style='margin-bottom:6px;font-weight:600;'>Event Type</div>";

    // Event type circles
    cats.forEach(c => {
        const col = TYPE_STYLE[c];
        div.innerHTML += `
        <div style="display:flex;align-items:center;margin:4px 0;">
            <span style="
            display:inline-block;width:14px;height:14px;border-radius:50%;
            background:${col.fill};border:3px solid ${col.fill};opacity:0.85;
            margin-right:8px;">
            </span>${c}
        </div>`;
    });

    // Heatmap entry
    div.innerHTML += `
        <div style="margin-top:10px;font-weight:600;">Event Hotspot</div>
        <div style="
        height:14px;
        background:linear-gradient(to right, #4facfe, #ffeb3b, #ff0000);
        border-radius:4px;
        margin-top:4px;">
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;">
        <span>Low</span><span>High</span>
        </div>
    `;

    return div;
    };
    legend.addTo(map);
}

function addLocateMe() {
    L.Control.LocateButton = L.Control.extend({
        onAdd: function(map) {
            var btn = L.DomUtil.create('button', 'leaflet-control-locate-button');
            btn.innerHTML = '<i class="fa fa-crosshairs"></i>';
            btn.style.padding = '0';
            btn.style.fontSize = '25px';
            btn.style.width = '40px'; 
            btn.style.height = '40px';
            btn.style.backgroundColor = '#007bff';
            btn.style.color = 'white';
            btn.style.border = '3px solid #ffffff';
            btn.style.borderRadius = '50%';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex'; 
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.transition = 'background-color 0.3s ease';

            // Add event listeners for hover effect
            btn.onmouseover = function() {
                btn.style.backgroundColor = '#0056b3'; // Darken background color on hover
            };
            btn.onmouseout = function() {
                btn.style.backgroundColor = '#007bff'; // Reset background color when not hovered
            };

            btn.onclick = function(e) {
                e.stopPropagation(); // Prevent the map click event from firing
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        var latlng = L.latLng(position.coords.latitude, position.coords.longitude);
                        // send the latlng to the create buffer function
                        
                        // pan and zoom the map to the user's location
                        map.panTo(latlng, { animate: true, duration: 0.5 });
                        setTimeout(function() {
                            map.setView(latlng, 14);
                        }, 500);
                    }, function(error) {
                        console.error("Error getting location: " + error.message);
                        alert("Error getting location. Please enable location services.");
                    });
                } else {
                    alert("Geolocation is not supported by this browser.");
                }
            };
            return btn;
        },
    });

    // Add the custom control to the map
    L.control.locateButton = function(opts) {
        return new L.Control.LocateButton(opts);
    };

    // Add the Locate button to the bottom left of the map
    L.control.locateButton({ position: 'bottomright' }).addTo(map);

}

function activateTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            // Activate the clicked tab and its pane
            btn.classList.add('active');
            const tabName = btn.dataset.tab;
            document.getElementById(tabName + '-tab').classList.add('active');
        });
    });
}

function addEventChart(events) {
    // If a chart exists, destroy it first
    if (eventTypeChart) {
        eventTypeChart.destroy();
    }
    const typeCounts = {};
    events.features.forEach(f => {
        const type = f.properties?.EVENT_TYPE ?? "Unknown";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Prepare data
    const labels = Object.keys(typeCounts);
    const counts = Object.values(typeCounts);
    const backgroundColors = labels.map(l => TYPE_STYLE[l]?.fill || "#7f8c8d");

    // Get canvas context
    const ctx = document.getElementById('eventTypeChart').getContext('2d');

    // Create the doughnut chart without legend or title
    eventTypeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: labels,
        datasets: [{
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false, // important for flexbox centering
        plugins: {
        legend: {
            display: false
        },
        title: {
            display: false
        }
        },
        // click a slice => filter by that label
        onClick: (evt, elements, chart) => {
            if (!elements.length) return;
            const idx = elements[0].index;
            const label = chart.data.labels[idx];

            // toggle: click the same slice again to reset to All (optional)
            const nextType = (currentFilter?.type === label) ? 'All' : label;
            setFilter({ type: nextType }); 
        },
        hover: { mode: 'nearest', intersect: true }
    }
    });

    // make the canvas look clickable
    eventTypeChart.canvas.style.cursor = 'pointer';
}

function addTimelineChart(events) {
    // If a chart exists, destroy it first
    if (timelineChart) {
        timelineChart.destroy();
    }

    // 1) Aggregate events by YEAR
    const yearCounts = new Map();

    events.features.forEach(f => {
    const year = Number(f.properties?.YEAR);
    if (!year || isNaN(year)) return;
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    });

    // 2) Sort data
    const sortedYears = Array.from(yearCounts.keys()).sort((a, b) => a - b);
    const yearLabels = sortedYears;
    const yearValues = sortedYears.map(year => yearCounts.get(year));

    // 3) Render Chart.js bar chart
    const tCtx = document.getElementById("timelineChart").getContext("2d");
    tCtx.canvas.style.backgroundColor = "transparent";

    timelineChart = new Chart(tCtx, {
    type: "line",
    data: {
        labels: yearLabels,
        datasets: [{
            data: yearValues,
        
            // Line style
            borderColor: "#287ee4",
            borderWidth: 4,      // thicker line
            tension: 0.2,        // optional smoothing
            fill: false,

            // Point style (same color as line, bigger)
            pointBackgroundColor: "#287ee4",
            pointBorderColor: "#287ee4",
            pointBorderWidth: 0,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHitRadius: 10
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
        x: {
            grid: { display: false },
            ticks: { precision: 0 }
        },
        y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { drawBorder: false }
        }
        },
        plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
            callbacks: {
            title: (items) => items[0]?.label || "",
            label: (item) => `Events: ${item.raw}`
            }
        }
        }
    }
    });
}

function addSubEventChart(events) {
    // If a chart exists, destroy it first
    if (subEventTypeChart) {
        subEventTypeChart.destroy();
    }
    
    // Count SUB_EVENT_TYPE occurrences
    const subTypeCounts = {};
    events.features.forEach(f => {
    const subType = f.properties?.SUB_EVENT_TYPE ?? "Unknown";
    subTypeCounts[subType] = (subTypeCounts[subType] || 0) + 1;
    });

    // Group those less than 10 into "Others"
    const groupedCounts = {};
    let othersCount = 0;
    Object.entries(subTypeCounts).forEach(([label, count]) => {
    if (count < 10) {
        othersCount += count;
    } else {
        groupedCounts[label] = count;
    }
    });
    if (othersCount > 0) {
    groupedCounts["Others"] = othersCount;
    }

    // Prepare data for Chart.js
    const subLabels = Object.keys(groupedCounts);
    const subCounts = Object.values(groupedCounts);

    // Colors — one color or varied
    const subColors = subLabels.map(() => "#287ee4"); // default blue

    // Get canvas context
    const subCtx = document.getElementById('subEventTypeChart').getContext('2d');

    // Create horizontal bar chart
    subEventTypeChart = new Chart(subCtx, {
    type: 'bar',
    data: {
        labels: subLabels,
        datasets: [{
        data: subCounts,
        backgroundColor: subColors,
        borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // horizontal
        scales: {
        x: {
            beginAtZero: true,
            ticks: {
            stepSize: 1
            }
        }
        },
        plugins: {
        legend: { display: false },
        title: { display: false }
        }
    }
    });
}

function addEventsByLGAChart(events) {
    // If a chart exists, destroy it first
    if (eventsByAdmin2Chart) {
        eventsByAdmin2Chart.destroy();
    }
    
    const admin2Counts = {};
    events.features.forEach(f => {
    const admin2 = f.properties?.ADMIN2 ?? "Unknown";
    admin2Counts[admin2] = (admin2Counts[admin2] || 0) + 1;
    });

    // Sort by count, take top N (e.g., top 10)
    const topAdmin2 = Object.entries(admin2Counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

    const admin2Labels = topAdmin2.map(([name]) => name);
    const admin2Values = topAdmin2.map(([_, count]) => count);

    // Colors (single or gradient)
    const admin2Colors = admin2Labels.map(() => "#287ee4");

    // Create the chart
    const admin2Ctx = document.getElementById('eventsByAdmin2Chart').getContext('2d');
    eventsByAdmin2Chart = new Chart(admin2Ctx, {
    type: 'bar',
    data: {
        labels: admin2Labels,
        datasets: [{
        data: admin2Values,
        backgroundColor: admin2Colors,
        borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // horizontal bars
        scales: {
        x: {
            beginAtZero: true,
            ticks: { precision: 0 }
        }
        },
        plugins: {
        legend: { display: false },
        title: { display: false }
        }
    }
    });
}
function addDowRadar(events) {
    if (dowRadarChart) { dowRadarChart.destroy(); }

    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = new Array(7).fill(0);
    events.features.forEach(f => {
        const d = new Date(f.properties?.EVENT_DATE);
        if (!isNaN(d)) counts[d.getDay()]++;
    });

    const ctx = document.getElementById('dowRadar').getContext('2d');
    dowRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
        labels: days,
        datasets: [{
            data: counts,
            borderColor: '#e42828ff',
            backgroundColor: '#e4282833',
            borderWidth: 2,
            pointBackgroundColor: '#e42828ff',
            pointRadius: 4
        }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}
function addSankeyDisorderType(fc) {
  if (sankeyDisorderTypeChart) { sankeyDisorderTypeChart.canvas.onclick = null; sankeyDisorderTypeChart.destroy(); }

  const flows = new Map(); // 'from|to' -> count
  fc.features.forEach(f => {
    const from = f.properties?.DISORDER_TYPE ?? 'Unknown';
    const to = f.properties?.EVENT_TYPE ?? 'Unknown';
    const k = `${from}|${to}`;
    flows.set(k, (flows.get(k) || 0) + 1);
  });
  const data = [...flows.entries()].map(([k,v]) => {
    const [from,to] = k.split('|'); return { from, to, flow: v };
  });

  const ctx = document.getElementById('sankeyDisorderType').getContext('2d');
  sankeyDisorderTypeChart = new Chart(ctx, {
    type: 'sankey',
    data: { datasets: [{ data, colorMode: 'gradient' }] },
    options: {
        responsive: true,
        maintainAspectRatio: false,  // let CSS height win
        layout: { padding: 0 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (i)=>`${i.raw.from} → ${i.raw.to}: ${i.raw.flow}` } }
      }
    }
  });
}
function addFatalitiesByTypeChart(fc) {
  if (fatalitiesByTypeChart) {
    fatalitiesByTypeChart.canvas.onclick = null;
    fatalitiesByTypeChart.destroy();
  }

  // Roll up fatalities by EVENT_TYPE
  const sums = {};
  fc.features.forEach(f => {
    const t = f.properties?.EVENT_TYPE ?? 'Unknown';
    const v = Number(f.properties?.FATALITIES);
    if (!isNaN(v)) sums[t] = (sums[t] || 0) + v;
  });

  // Sort descending
  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([t]) => t);
  const values = entries.map(([, v]) => v);
  const colors = labels.map(l => TYPE_STYLE[l]?.fill || '#287ee4');

  const ctx = document.getElementById('fatalitiesByTypeChart').getContext('2d');

  fatalitiesByTypeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',                 // horizontal bars (better for long labels)
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (i) => `Fatalities: ${i.raw}` }
        }
      },
      scales: {
        x: { beginAtZero: true, grid: { drawBorder: false } },
        y: { grid: { display: false } }
      }
    }
  });
}

function addYearMonthHeatmap(fc) {
  if (yearMonthHeatmapChart) { yearMonthHeatmapChart.destroy(); }

  const counts = new Map(); // `${y}-${m}` -> count
  fc.features.forEach(f => {
    const d = new Date(f.properties?.EVENT_DATE);
    if (isNaN(d)) return;
    const y = d.getFullYear(), m = d.getMonth();
    const key = `${y}-${m}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years = [...new Set([...counts.keys()].map(k => +k.split('-')[0]))].sort((a,b)=>a-b);
  const maxV = Math.max(1, ...counts.values());
  const cells = [];
  years.forEach(y => months.forEach((_, m) => {
    const v = counts.get(`${y}-${m}`) || 0;
    cells.push({ x: months[m], y: String(y), v });
  }));
  
  const ctx = document.getElementById('yearMonthHeatmap').getContext('2d');
  yearMonthHeatmapChart = new Chart(ctx, {
    type: 'matrix',
    data: {
      datasets: [{
        label: 'Events',
        data: cells,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        width: ({chart}) => (chart.chartArea?.width || 0) / months.length - 2,
        height: ({chart}) => (chart.chartArea?.height || 0) / years.length - 2,
        backgroundColor: (c) => {
          const t = (c.raw?.v || 0) / maxV;
          return `rgba(239, 68, 68, ${0 + 0.85*t})`;
        },
        borderWidth: 0,
        borderColor: 'rgba(0,0,0,0.05)'
      }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,  // let CSS height win
        layout: { padding: 0 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (i)=>`${i[0].raw.y} – ${i[0].raw.x}`,
            label: (i)=>`Count: ${i.raw.v}`
          }
        }
      },
      scales: {
        x: { type: 'category', labels: months, grid:{display:false} },
        y: { type: 'category', labels: years.map(String), grid:{display:false}  }
      }
    }
  });
}
function setIndicators(events) {
    // Calculate totals
    const totalEvents = events.features.length;
    const totalFatalities = events.features.reduce((sum, f) => {
    return sum + (Number(f.properties?.FATALITIES) || 0);
    }, 0);

    // Format numbers with commas
    const formatNumber = num => num.toLocaleString();

    // Update indicators
    document.getElementById('eventsIndicator').textContent = formatNumber(totalEvents);
    document.getElementById('fatalitiesIndicator').textContent = formatNumber(totalFatalities);
}

function buildRecentList(events, limit) {

  const feats = events.features
    .map(f => ({
      f,
      d: new Date(f.properties?.EVENT_DATE) // parse directly
    }))
    .filter(x => !isNaN(x.d)) // keep only valid dates
    .sort((a, b) => b.d - a.d) // newest first
    .slice(0, limit);

  const area = document.querySelector('.list-card .list-area');
  area.innerHTML = '';

  feats.forEach(({ f, d }) => {
    const fid = f.__fid || f.id || f.properties?.OBJECTID || '';
    const title = f.properties?.SUB_EVENT_TYPE || f.properties?.EVENT_TYPE || 'Event';
    const isoDate = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const eventType = f.properties?.EVENT_TYPE || 'Unknown';
    const color = TYPE_STYLE[eventType]?.fill || '#7f8c8d';

    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.fid = String(fid);
    row.innerHTML = `
      <span class="list-icon" style="
        display:inline-block;
        width:14px;
        height:14px;
        border-radius:50%;
        background:${color};
        border: 2px solid rgba(0,0,0,0.15);
      "></span>
      <div>
        <div class="event-date">${isoDate}</div>
        <div class="event-title">${title}</div>
      </div>
    `;
    area.appendChild(row);
  });

  area.addEventListener('click', (e) => { 
	const item = e.target.closest('.list-item'); 
	if (!item) return; 
	const fid = item.dataset.fid; 
	const layer = layerIndex.get(fid); 
	if (!layer) return; 
	const latlng = layer.getLatLng?.() || (layer.getBounds && layer.getBounds().getCenter()); 
	if (!latlng) return; 
	if (typeof clusters?.zoomToShowLayer === 'function') { 
		clusters.zoomToShowLayer(layer, () => { 
			map.setView(latlng, Math.max(map.getZoom(), 10), { animate: true }); 
			layer.openPopup(); }); 
		} else { 
			map.setView(latlng, Math.max(map.getZoom(), 10), { animate: true }); 
			layer.openPopup(); 
		} 
	}
);
  
}

function setupPills(events) {

    if (filterContainer) {
        while (filterContainer.firstChild) {
            filterContainer.removeChild(filterContainer.firstChild);
        }
    }
    // Get unique DISORDER_TYPE values, put "All" first
    const disorderTypes = ["All", ...new Set(events.features.map(f => f.properties?.DISORDER_TYPE || "Unknown"))];

    // Container
    filterContainer = document.getElementById('disorderTypeFilters');

    // Create pills
    disorderTypes.forEach((type, index) => {
        const pill = document.createElement('div');
        pill.className = 'filter-pill';
        pill.textContent = type;

        // Make "All" active by default
        if (index === 0) {
            pill.classList.add('active');
        }

        // Click event for toggling active class
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            setFilter({ disorder: type });

        });

        filterContainer.appendChild(pill);
    });
}

function initYearFilter(fc) {
  const sel = document.getElementById('yearFilter');
  if (!sel) return;

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

  sel.innerHTML = `<option value="All">All years</option>` +
                  years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function renderAll(filteredEvents) {
    // Load event type chart
    addEventChart(filteredEvents);
    // Timeline chart
    addTimelineChart(filteredEvents);
    // Sub Event Type Chart
    addSubEventChart(filteredEvents);
    // Indicators
    setIndicators(filteredEvents);
    // Count of events by LGA
    addEventsByLGAChart(filteredEvents);
    // Add events to map
    loadEvents(filteredEvents);
    // Add heatmap
    loadHeatmap(filteredEvents);
    // Events list
    buildRecentList(filteredEvents, 1875);
    // Add day of week radar
    addDowRadar(filteredEvents);
    // Disorder chart
    addSankeyDisorderType(filteredEvents);
    // Fatalities box plot
    addFatalitiesByTypeChart(filteredEvents);
    // Disorder Area chart
    addYearMonthHeatmap(filteredEvents);
}

function setFilter(partial = {}) {
	currentFilter = { ...currentFilter, ...partial };

	const keep = (f) => {
		const p = f.properties || {};

		// attribute filters
		if (currentFilter.type !== 'All' && p.EVENT_TYPE !== currentFilter.type) return false;
		if (currentFilter.disorder !== 'All' && p.DISORDER_TYPE !== currentFilter.disorder) return false;

		// year filter (uses YEAR if present; falls back to EVENT_DATE)
		if (currentFilter.year !== 'All') {
		const yearProp = Number(p.YEAR);
		let featYear = !isNaN(yearProp) ? yearProp : NaN;
		if (isNaN(featYear)) {
			const d = new Date(p.EVENT_DATE);
			if (!isNaN(d)) featYear = d.getFullYear();
		}
		if (featYear !== currentFilter.year) return false;
		}

		// spatial filter (if you’ve added it earlier)
		if (spatialGeom) {
		if (!f.geometry) return false;
		return f.geometry.type === 'Point'
			? turf.booleanPointInPolygon(f, spatialGeom)
			: turf.booleanIntersects(f, spatialGeom);
		}

		return true;
	};

	filteredEvents = {
		type: "FeatureCollection",
		features: (events.features || []).filter(keep)
	};

	renderAll(filteredEvents);
	// Fit map to filtered results if you want:
	fitToFeatureCollection(filteredEvents);

	// keep the dropdown in sync if filter changed programmatically
	syncYearSelect();
}

function setupDrawings() {
    // Keep one group for drawn shapes
    map.addControl(new L.Control.Draw({
    draw: {
        polygon: true,
        rectangle: true,
        circle: true,
        polyline: false,
        marker: false,
        circlemarker: false
    },
    edit: { featureGroup: drawLayer, edit: false, remove: false }
    }));

    

    map.on(L.Draw.Event.CREATED, (e) => {
        drawLayer.clearLayers();
        drawLayer.addLayer(e.layer);

        if (e.layer instanceof L.Circle) {
            const c = e.layer.getLatLng();
            const rKm = e.layer.getRadius() / 1000;
            spatialGeom = turf.circle([c.lng, c.lat], rKm, { units: 'kilometers', steps: 64 }).geometry;
        } else {
            spatialGeom = e.layer.toGeoJSON().geometry; // rectangle/polygon
        }

        setFilter({});
        fitToLayer(e.layer);
    });

}

function fitToLayer(layer) {
  if (!layer || !layer.getBounds) return;
  const b = layer.getBounds();
  if (b && b.isValid()) map.fitBounds(b, FIT_PAD);
}

function fitToFeatureCollection(fc) {
  if (!fc || !fc.features || fc.features.length === 0) return;
  const [minX, minY, maxX, maxY] = turf.bbox(fc);
  map.fitBounds([[minY, minX], [maxY, maxX]], FIT_PAD);
}

const ClearDrawControl = L.Control.extend({
	options: { position: 'topleft' }, // same corner as Leaflet.draw
	onAdd: function(map) {
		const container = L.DomUtil.create('div', 'leaflet-bar my-clear-bar');
		const link = L.DomUtil.create('a', 'leaflet-draw-clear', container);

		link.href = '#';
		link.title = 'Clear drawings & reset filters';
		link.setAttribute('aria-label', 'Clear drawings & reset filters');
		link.innerHTML = '<i class="fa fa-trash" style="color: #e53935" aria-hidden="true"></i>';

		// Prevent map clicks/scroll on the button
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.on(link, 'click', (e) => {
		L.DomEvent.stop(e);

		// 1) remove drawn shapes
		drawLayer.clearLayers();

		// 2) clear spatial + attribute filters
		spatialGeom = null;
		currentFilter = { type: 'All', disorder: 'All' };

		// 3) reload with full dataset
		filteredEvents = events;
		// inside the clear button handler:
		drawLayer.clearLayers();
		spatialGeom = null;
		currentFilter = { type: 'All', disorder: 'All', year: 'All' };
		filteredEvents = events;

		
		autoId = 1;
		layerIndex.clear();

		renderAll(filteredEvents);
		fitToFeatureCollection(filteredEvents);
		setupPills(filteredEvents);
		syncYearDropdown();
		});

		return container;
	}
});
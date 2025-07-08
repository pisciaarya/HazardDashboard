// static/js/spatial-tools.js

document.addEventListener('DOMContentLoaded', function() {
    // This script should only run on the map page and when the spatial tools are active
    if (document.body.getAttribute('data-current-page') === 'map') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('layer') === 'spatial') {
            // A brief delay to ensure dynamic-content.js has rendered the panel
            setTimeout(initializeSpatialTools, 500);
        }
    }
});

let analysisResultsLayer = L.featureGroup();
let currentAnalysisData = null;
let accessibilityLegend = null; // To hold the legend control

function initializeSpatialTools() {
    const toolSelect = document.getElementById('spatial-tool-select');
    const inputsContainer = document.getElementById('spatial-tool-inputs');
    const runButton = document.getElementById('run-spatial-analysis');
    const resultsContainer = document.getElementById('spatial-analysis-results-container');
    const summaryContainer = document.getElementById('spatial-analysis-summary');
    const downloadButton = document.getElementById('download-spatial-results');

    if (!toolSelect) return; // Exit if the panel isn't on the page

    // Add the results layer to the map
    analysisResultsLayer.addTo(map);

    toolSelect.addEventListener('change', () => {
        const selectedTool = toolSelect.value;
        renderToolInputs(selectedTool, inputsContainer);
        runButton.disabled = !selectedTool;
        resultsContainer.style.display = 'none'; // Hide old results
        analysisResultsLayer.clearLayers(); // Clear old layers from map
        
        // Remove legend if it exists from a previous analysis
        if (accessibilityLegend) {
            map.removeControl(accessibilityLegend);
            accessibilityLegend = null;
        }
    });

    runButton.addEventListener('click', async () => {
        const selectedTool = toolSelect.value;
        if (!selectedTool) return;

        runButton.disabled = true;
        runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
        
        // Clear previous results before running new analysis
        analysisResultsLayer.clearLayers();
        if (accessibilityLegend) {
            map.removeControl(accessibilityLegend);
            accessibilityLegend = null;
        }
        
        const params = getToolParameters(selectedTool);
        
        try {
            const response = await fetch(`/api/spatial/${selectedTool}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Analysis failed');
            }

            const results = await response.json();
            currentAnalysisData = results; // Store for download
            displayAnalysisResults(results, selectedTool);

        } catch (error) {
            summaryContainer.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            resultsContainer.style.display = 'block';
        } finally {
            runButton.disabled = false;
            runButton.innerHTML = '<i class="fas fa-play-circle"></i> Run Analysis';
        }
    });
    
    downloadButton.addEventListener('click', () => {
        if (!currentAnalysisData) {
            alert('No data to download.');
            return;
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAnalysisData.geojson || currentAnalysisData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `analysis_results.geojson`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
}

async function renderToolInputs(tool, container) {
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading options...</div>';
    let content = '';

    switch (tool) {
        case 'earthquake-impact':
            try {
                const response = await fetch('/api/spatial/list-earthquakes');
                const earthquakes = await response.json();
                content = `
                    <label class="form-label"><strong>2. Select Earthquake Event</strong></label>
                    <select id="earthquake-select" class="form-select">
                        ${earthquakes.map(eq => `<option value='${JSON.stringify({coords: eq.coords, mag: eq.mag})}'>${eq.title}</option>`).join('')}
                    </select>
                `;
            } catch (e) { content = '<div class="alert alert-danger">Could not load earthquakes.</div>'; }
            break;
        case 'infrastructure-accessibility':
            content = `
                <label class="form-label"><strong>2. Select Infrastructure to Measure Distance To</strong></label>
                <select id="infrastructure-select" class="form-select mb-2">
                    <option value="roads">Roads</option>
                    <option value="rivers">Rivers</option>
                </select>
                <label class="form-label"><strong>3. Select Area to Analyze</strong></label>
                <select id="accessibility-admin-type-select" class="form-select mb-2">
                    <option value="districts">District</option>
                    <option value="local_units">Local Unit</option>
                </select>
                <select id="accessibility-admin-unit-select" class="form-select" disabled></select>
            `;
            break;
        case 'risk-profiler':
             content = `
                <label class="form-label"><strong>2. Select Boundary Type</strong></label>
                <select id="profiler-admin-type-select" class="form-select mb-2">
                    <option value="districts">Districts</option>
                    <option value="local_units">Local Units</option>
                </select>
                <label class="form-label"><strong>3. Select Specific Unit</strong></label>
                <select id="profiler-admin-unit-select" class="form-select" disabled></select>
            `;
            break;
        case 'multi-hazard-exposure':
            content = `
                <label class="form-label"><strong>2. Define Exposure Proximity (meters)</strong></label>
                <input type="number" id="buffer-m-input" class="form-control mb-2" value="500">
                <label class="form-label"><strong>3. Select Hazards to Include</strong></label>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="flood" id="hazard-flood-check" checked>
                    <label class="form-check-label" for="hazard-flood-check">Flood Risk (River Proximity)</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="fire" id="hazard-fire-check" checked>
                    <label class="form-check-label" for="hazard-fire-check">Fire Risk (Recent Fire Incidents)</label>
                </div>
            `;
            break;
        case 'aqi-vulnerability':
            content = `
                <label for="aqi-threshold-input" class="form-label"><strong>2. AQI Threshold (Unhealthy if >)</strong></label>
                <input type="range" class="form-range" min="50" max="200" value="101" id="aqi-threshold-input" oninput="this.nextElementSibling.value = this.value">
                <output class="badge bg-secondary">101</output>
                <label for="radius-km-input" class="form-label mt-2"><strong>3. Impact Radius (km)</strong></label>
                <input type="number" id="radius-km-input" class="form-control" value="10">
            `;
            break;
        default:
            content = '<p class="text-muted">Select a tool to see its options.</p>';
    }
    container.innerHTML = content;
    
    // --- CORRECTED LOGIC ---
    // Add event listeners for cascading dropdowns after they are added to the DOM
    if (tool === 'risk-profiler') {
        const typeSelect = document.getElementById('profiler-admin-type-select');
        const unitSelect = document.getElementById('profiler-admin-unit-select');
        typeSelect.addEventListener('change', () => populateAdminUnits(typeSelect.value, unitSelect));
        populateAdminUnits(typeSelect.value, unitSelect); // Initial population
    }
    if (tool === 'infrastructure-accessibility') {
        const typeSelect = document.getElementById('accessibility-admin-type-select');
        const unitSelect = document.getElementById('accessibility-admin-unit-select');
        typeSelect.addEventListener('change', () => populateAdminUnits(typeSelect.value, unitSelect));
        populateAdminUnits(typeSelect.value, unitSelect); // Initial population
    }
}

async function populateAdminUnits(type, unitSelect) {
    unitSelect.disabled = true;
    unitSelect.innerHTML = '<option>Loading...</option>';
    try {
        const response = await fetch(`/api/spatial/list-admin-units?type=${type}`);
        const units = await response.json();
        unitSelect.innerHTML = units.map(u => `<option value="${u.fid}">${u.name}</option>`).join('');
        unitSelect.disabled = false;
    } catch (e) {
        unitSelect.innerHTML = '<option>Error loading data</option>';
    }
}


function getToolParameters(tool) {
    switch (tool) {
        case 'earthquake-impact':
            return JSON.parse(document.getElementById('earthquake-select').value);
        case 'infrastructure-accessibility':
            return {
                infrastructure: document.getElementById('infrastructure-select').value,
                admin_unit_type: document.getElementById('accessibility-admin-type-select').value,
                admin_unit_fid: document.getElementById('accessibility-admin-unit-select').value
            };
        case 'risk-profiler':
            return {
                unit_type: document.getElementById('profiler-admin-type-select').value,
                unit_fid: document.getElementById('profiler-admin-unit-select').value
            };
        case 'multi-hazard-exposure':
            const hazards = [];
            if (document.getElementById('hazard-flood-check').checked) hazards.push('flood');
            if (document.getElementById('hazard-fire-check').checked) hazards.push('fire');
            return {
                buffer_m: parseInt(document.getElementById('buffer-m-input').value),
                hazards: hazards
            };
        case 'aqi-vulnerability':
            return {
                aqi_threshold: parseInt(document.getElementById('aqi-threshold-input').value),
                radius_km: parseInt(document.getElementById('radius-km-input').value)
            };
        default:
            return {};
    }
}

function displayAnalysisResults(results, tool) {
    const resultsContainer = document.getElementById('spatial-analysis-results-container');
    const summaryContainer = document.getElementById('spatial-analysis-summary');
    
    analysisResultsLayer.clearLayers();
    let summaryHTML = '';

    const geojson = results.geojson || results;

    if (geojson && geojson.features && geojson.features.length > 0) {
        L.geoJSON(geojson, {
            style: function(feature) {
                // Dynamic styling based on results
                if (feature.properties.risk_zone === 'High Risk') return { color: "#d9534f", weight: 2, fillOpacity: 0.4 };
                if (feature.properties.risk_zone === 'Medium Risk') return { color: "#f0ad4e", weight: 2, fillOpacity: 0.3 };
                return { color: "#5bc0de", weight: 3, fillOpacity: 0.5 };
            },
            pointToLayer: function(feature, latlng) {
                 if (feature.properties.exposure_score) {
                    const score = feature.properties.exposure_score;
                    const marker = L.circleMarker(latlng, { color: score > 1 ? '#d9534f' : '#f0ad4e', radius: 6, fillOpacity: 0.8, weight: 1 });
                    marker.bindPopup(`<b>Settlement:</b> ${feature.properties.vdc_name}<br><b>Hazard Score:</b> ${score}`);
                    return marker;
                }
                 if (feature.properties.distance_to_roads_m || feature.properties.distance_to_rivers_m) {
                    const dist = feature.properties.distance_to_roads_m || feature.properties.distance_to_rivers_m;
                    const infra = feature.properties.distance_to_roads_m ? 'road' : 'river';
                    let color = '#5cb85c'; // green
                    if (dist > 5000) color = '#d9534f'; // red
                    else if (dist > 1000) color = '#f0ad4e'; // yellow
                    const marker = L.circleMarker(latlng, { color: color, weight: 1, fillColor: color, fillOpacity: 0.7, radius: 5 });
                    marker.bindPopup(`<b>Settlement:</b> ${feature.properties.vdc_name}<br><b>Distance to nearest ${infra}:</b> ${dist.toFixed(0)} m`);
                    return marker;
                }
                return L.marker(latlng);
            }
        }).addTo(analysisResultsLayer);
        map.fitBounds(analysisResultsLayer.getBounds());
    }

    // Generate summary report and legend based on the tool
    if (tool === 'earthquake-impact') {
        summaryHTML = '<h4>Impact Summary</h4>';
        for (const zone in results.summary) {
            summaryHTML += `
                <div class="alert alert-warning">
                    <strong>${zone}:</strong> ${results.summary[zone].settlements_affected} settlements affected across districts: 
                    ${results.summary[zone].districts_affected.join(', ') || 'None'}.
                </div>`;
        }
    } else if (tool === 'risk-profiler') {
        const p = results.profile;
        summaryHTML = `
            <h4>Risk Profile</h4>
            <ul class="list-group">
                <li class="list-group-item d-flex justify-content-between align-items-center">Settlements Count <span class="badge bg-primary rounded-pill">${p.settlements_count}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Road Length <span class="badge bg-primary rounded-pill">${p.road_length_km} km</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">River Length <span class="badge bg-primary rounded-pill">${p.river_length_km} km</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Fire Incidents <span class="badge bg-danger rounded-pill">${p.fire_incidents}</span></li>
            </ul>`;
    } else if (tool === 'infrastructure-accessibility') {
        // --- NEW SUMMARY AND LEGEND LOGIC ---
        const features = geojson.features;
        const low_risk = features.filter(f => (f.properties.distance_to_roads_m || f.properties.distance_to_rivers_m) <= 1000).length;
        const med_risk = features.filter(f => (f.properties.distance_to_roads_m || f.properties.distance_to_rivers_m) > 1000 && (f.properties.distance_to_roads_m || f.properties.distance_to_rivers_m) <= 5000).length;
        const high_risk = features.filter(f => (f.properties.distance_to_roads_m || f.properties.distance_to_rivers_m) > 5000).length;
        
        summaryHTML = `
            <h4>Accessibility Summary</h4>
            <p>Analysis complete. Found ${features.length} settlements.</p>
            <ul class="list-group">
                <li class="list-group-item d-flex justify-content-between align-items-center" style="color: #d9534f;">High Vulnerability (>5km) <span class="badge bg-danger rounded-pill">${high_risk}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center" style="color: #f0ad4e;">Medium Vulnerability (1-5km) <span class="badge bg-warning rounded-pill">${med_risk}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center" style="color: #5cb85c;">Low Vulnerability (<1km) <span class="badge bg-success rounded-pill">${low_risk}</span></li>
            </ul>`;
        addAccessibilityLegend();
    } else {
        summaryHTML = `<div class="alert alert-success">Analysis complete. Found ${geojson.features.length} features.</div>`;
    }

    summaryContainer.innerHTML = summaryHTML;
    resultsContainer.style.display = 'block';
}

function addAccessibilityLegend() {
    if (accessibilityLegend) {
        map.removeControl(accessibilityLegend);
    }
    accessibilityLegend = L.control({ position: 'bottomright' });
    accessibilityLegend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        const grades = [0, 1000, 5000];
        const colors = ['#5cb85c', '#f0ad4e', '#d9534f'];
        const labels = ['<strong>Accessibility</strong>'];
        
        for (let i = 0; i < grades.length; i++) {
            labels.push(
                '<i style="background:' + colors[i] + '"></i> ' +
                grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + ' m' : '+ m')
            );
        }
        div.innerHTML = labels.join('<br>');
        return div;
    };
    accessibilityLegend.addTo(map);
}

// static/js/hazard-tools.js

// Global variables to store active hazard layers so they can be cleared
let activeFloodLayers = L.featureGroup();
let activeWildfireLayers = L.markerClusterGroup();
let activeRoadDisruptionLayers = L.featureGroup();

// Variable to store the currently selected road for disruption analysis
let selectedRoadFeature = null;
let selectedRoadLayer = null; // To store the Leaflet layer of the selected road

// This function is now globally accessible to be called by dynamic-content.js
function initHazardTools() {
    console.log("Initializing hazard tools...");

    // UI Logic for Toggling Hazard Tool Details
    const hazardToolToggleButtons = document.querySelectorAll('.hazard-tool-toggle-btn');
    const hazardToolDetailSections = document.querySelectorAll('.hazard-tool-details');

    hazardToolToggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            hazardToolDetailSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.toggle('d-none');
                } else {
                    section.classList.add('d-none');
                }
            });
            // Clear layers and selections when switching tools
            clearAllHazardLayers();
        });
    });

    // Attach event listeners to all hazard tool buttons
    setupFloodAnalysis();
    setupWildfireAnalysis();
    setupRoadDisruptionAnalysis();
}

function clearAllHazardLayers() {
    activeFloodLayers.clearLayers();
    activeWildfireLayers.clearLayers();
    activeRoadDisruptionLayers.clearLayers();
    if (selectedRoadLayer) {
        map.removeLayer(selectedRoadLayer);
        selectedRoadLayer = null;
        selectedRoadFeature = null;
    }
    // Clear any text in results divs
    const resultsDivs = document.querySelectorAll('#flood-analysis-results, #wildfire-analysis-results, #road-disruption-results');
    resultsDivs.forEach(div => div.innerHTML = '');
}


// --- Flood Exposure Analysis ---
function setupFloodAnalysis() {
    const runBtn = document.getElementById('run-flood-analysis');
    if (!runBtn) return;

    runBtn.addEventListener('click', async () => {
        const bufferDistance = document.getElementById('flood-buffer-distance').value;
        const unitType = document.getElementById('flood-unit-type').value;
        const resultsDiv = document.getElementById('flood-analysis-results');

        if (!bufferDistance || isNaN(bufferDistance) || bufferDistance <= 0) {
            alert('Please enter a valid positive buffer distance.');
            return;
        }

        resultsDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Running analysis...';
        activeFloodLayers.clearLayers();

        try {
            const response = await fetch(`/api/hazard/flood-exposure?buffer_distance_meters=${bufferDistance}&unit_type=${unitType}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Display buffer
            if (data.flood_buffers && data.flood_buffers.features.length > 0) {
                L.geoJSON(data.flood_buffers, { style: { color: "#1E90FF", weight: 1, opacity: 0.7, fillColor: "#ADD8E6", fillOpacity: 0.3 } }).addTo(activeFloodLayers);
            }

            // Display affected features
            if (data.affected_features && data.affected_features.features.length > 0) {
                L.geoJSON(data.affected_features, {
                    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, fillColor: "#FF4500", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8 }),
                    onEachFeature: (feature, layer) => {
                        let props = feature.properties;
                        let content = `<b>Affected ${unitType === 'settlement' ? 'Settlement' : 'Local Unit'}</b><br>`;
                        content += `Name: ${props.vdc_name || props.gapa_napa || 'N/A'}<br>`;
                        content += `District: ${props.dist_name || props.district || 'N/A'}`;
                        if(props.percentage_affected) {
                            content += `<br>Area Affected: ${props.percentage_affected.toFixed(2)}%`;
                        }
                        layer.bindPopup(content);
                    }
                }).addTo(activeFloodLayers);
            }
            
            activeFloodLayers.addTo(map);
            if (activeFloodLayers.getLayers().length > 0) {
                map.fitBounds(activeFloodLayers.getBounds());
            }

            // --- DETAILED SUMMARY LOGIC ---
            let summaryCount = data.affected_features ? data.affected_features.features.length : 0;
            let summaryHTML = `<div class="alert alert-success"><h4>Flood Analysis Complete!</h4><p>Found <strong>${summaryCount}</strong> ${unitType === 'settlement' ? 'settlements' : 'local units'} affected by a <strong>${bufferDistance}m</strong> river buffer.</p>`;
            if (summaryCount > 0) {
                summaryHTML += `<p><strong>Details of Affected ${unitType === 'settlement' ? 'Settlements' : 'Local Units'}:</strong></p><ul>`;
                const affectedDistricts = {};
                data.affected_features.features.forEach(feature => {
                    const districtName = feature.properties.district || feature.properties.dist_name || 'Unknown District';
                    if (!affectedDistricts[districtName]) {
                        affectedDistricts[districtName] = { count: 0, names: [] };
                    }
                    affectedDistricts[districtName].count++;
                    const featureName = feature.properties.gapa_napa || feature.properties.vdc_name || 'Unnamed Unit';
                    if (affectedDistricts[districtName].names.length < 5) {
                       affectedDistricts[districtName].names.push(featureName);
                    }
                });
                for (const district in affectedDistricts) {
                    summaryHTML += `<li><strong>${district}:</strong> ${affectedDistricts[district].count} ${unitType === 'settlement' ? 'settlements' : 'local units'}`;
                    if (affectedDistricts[district].names.length > 0) {
                        summaryHTML += ` (e.g., ${affectedDistricts[district].names.join(', ')})`;
                    }
                    summaryHTML += `</li>`;
                }
                summaryHTML += `</ul>`;
            }
            summaryHTML += `</div>`;
            resultsDiv.innerHTML = summaryHTML;

        } catch (error) {
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}. Please try again.</div>`;
        }
    });
}


// --- Wildfire Hotspot Analysis ---
function setupWildfireAnalysis() {
    const runBtn = document.getElementById('run-wildfire-analysis');
    if (!runBtn) return;
    
    const confidenceInput = document.getElementById('wildfire-min-confidence');
    const confidenceValueSpan = document.getElementById('wildfire-confidence-value');
    confidenceInput.addEventListener('input', () => {
        confidenceValueSpan.textContent = `${confidenceInput.value}%`;
    });

    runBtn.addEventListener('click', async () => {
        const daysAgo = document.getElementById('wildfire-days-ago').value;
        const minConfidence = confidenceInput.value;
        const resultsDiv = document.getElementById('wildfire-analysis-results');

        resultsDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Running analysis...';
        activeWildfireLayers.clearLayers();

        try {
            const response = await fetch(`/api/hazard/wildfire-hotspots?days_ago=${daysAgo}&min_confidence=${minConfidence}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.features.length > 0) {
                L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: L.divIcon({ html: '<i class="fa-solid fa-fire-flame-curved" style="color: #ff4500; font-size: 24px;"></i>', className: 'custom-div-icon' }) }),
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties;
                        layer.bindPopup(`<b>Wildfire Hotspot</b><br>Date: ${props.acq_date}<br>Confidence: ${props.confidence}%<br>Satellite: ${props.satellite}`);
                    }
                }).addTo(activeWildfireLayers);
                
                activeWildfireLayers.addTo(map);
                map.fitBounds(activeWildfireLayers.getBounds());
                
                const satelliteCounts = {};
                let minDate = new Date();
                let maxDate = new Date(0);

                data.features.forEach(f => {
                    const sat = f.properties.satellite || 'Unknown';
                    satelliteCounts[sat] = (satelliteCounts[sat] || 0) + 1;
                    const d = new Date(f.properties.acq_date);
                    if (d < minDate) minDate = d;
                    if (d > maxDate) maxDate = d;
                });

                let summaryHTML = `<div class="alert alert-success"><h4>Wildfire Analysis Complete</h4><p>Found <strong>${data.features.length}</strong> hotspots between ${minDate.toLocaleDateString()} and ${maxDate.toLocaleDateString()}.</p>`;
                summaryHTML += `<h6>Detections by Satellite:</h6><ul>`;
                for (const sat in satelliteCounts) {
                    summaryHTML += `<li><strong>${sat}:</strong> ${satelliteCounts[sat]} hotspots</li>`;
                }
                summaryHTML += `</ul></div>`;
                resultsDiv.innerHTML = summaryHTML;

            } else {
                resultsDiv.innerHTML = `<div class="alert alert-info">No wildfire hotspots found matching the criteria.</div>`;
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}. Please try again.</div>`;
        }
    });
}


// --- Road Disruption Analysis ---
function setupRoadDisruptionAnalysis() {
    const runBtn = document.getElementById('run-road-disruption-analysis');
    if (!runBtn) return;
    
    const resultsDiv = document.getElementById('road-disruption-results');
    const selectedInfoDiv = document.getElementById('selected-road-info');
    const displayFidSpan = document.getElementById('display-road-fid');
    const clearBtn = document.getElementById('clear-selected-road');

    map.on('click', async (e) => {
        const toolSection = document.getElementById('road-disruption-tool-section');
        if (toolSection && !toolSection.classList.contains('d-none') && !selectedRoadFeature) {
            resultsDiv.innerHTML = '<div class="spinner-border text-secondary spinner-border-sm"></div> Finding nearest road...';
            try {
                const response = await fetch(`/api/query/closest-road?lat=${e.latlng.lat}&lon=${e.latlng.lng}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.feature) {
                    selectedRoadFeature = data.feature;
                    displayFidSpan.textContent = selectedRoadFeature.properties.fid || 'N/A';
                    selectedInfoDiv.classList.remove('d-none');
                    runBtn.disabled = false;
                    if (selectedRoadLayer) map.removeLayer(selectedRoadLayer);
                    selectedRoadLayer = L.geoJSON(selectedRoadFeature, { style: { color: '#FFD700', weight: 8, opacity: 0.7, dashArray: '10, 5' } }).addTo(map);
                    resultsDiv.innerHTML = '<div class="alert alert-info">Road FID ' + selectedRoadFeature.properties.fid + ' selected. Click \'Simulate Disruption\'.</div>';
                } else {
                    resultsDiv.innerHTML = '<div class="alert alert-warning">No road found at the clicked location.</div>';
                }
            } catch (error) {
                resultsDiv.innerHTML = '<div class="alert alert-danger">Error selecting road: ' + error.message + '.</div>';
            }
        }
    });

    clearBtn.addEventListener('click', () => {
        if (selectedRoadLayer) map.removeLayer(selectedRoadLayer);
        selectedRoadFeature = null;
        selectedRoadLayer = null;
        selectedInfoDiv.classList.add('d-none');
        runBtn.disabled = true;
        resultsDiv.innerHTML = '';
    });

    runBtn.addEventListener('click', async () => {
        if (!selectedRoadFeature) return;
        const roadFid = selectedRoadFeature.properties.fid;
        const impactRadius = document.getElementById('disruption-impact-radius').value;
        resultsDiv.innerHTML = '<div class="spinner-border text-primary"></div> Simulating disruption...';
        activeRoadDisruptionLayers.clearLayers();

        try {
            const response = await fetch(`/api/hazard/road-disruption-impact?road_fid=${roadFid}&impact_radius_meters=${impactRadius}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            const affectedSettlements = data.features.filter(f => f.properties.analysis_type === 'affected_settlement');
            const affectedCount = affectedSettlements.length;
            const affectedSettlementNames = affectedSettlements.slice(0, 10).map(f => f.properties.vdc_name || 'Unnamed');

            if (data.features && data.features.length > 0) {
                 L.geoJSON(data, {
                    style: function(feature) {
                        if (feature.properties.analysis_type === 'disrupted_road') {
                            return { color: '#FF0000', weight: 10, opacity: 0.8 };
                        }
                        return {};
                    },
                    pointToLayer: function(feature, latlng) {
                        if (feature.properties.analysis_type === 'affected_settlement') {
                            return L.circleMarker(latlng, { radius: 8, fillColor: "#FFC107", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8 });
                        }
                        return null;
                    },
                    onEachFeature: (f, layer) => {
                        if (f.properties.analysis_type === 'affected_settlement') {
                            layer.bindPopup('<b>Affected Settlement:</b> ' + (f.properties.vdc_name || 'N/A'));
                        }
                    }
                }).addTo(activeRoadDisruptionLayers);
            }
            
            activeRoadDisruptionLayers.addTo(map);
            if (activeRoadDisruptionLayers.getLayers().length > 0) {
                map.fitBounds(activeRoadDisruptionLayers.getBounds());
            }
            
            let summaryHTML = `<div class="alert alert-success"><h4>Disruption Analysis Complete</h4><p>Found <strong>${affectedCount}</strong> settlements potentially affected.</p>`;
            if (affectedCount > 0) {
                summaryHTML += `<h6>Affected Settlements Include:</h6><ul>`;
                affectedSettlementNames.forEach(name => {
                    summaryHTML += `<li>${name}</li>`;
                });
                if (affectedCount > 10) {
                    summaryHTML += `<li>... and ${affectedCount - 10} more.</li>`;
                }
                summaryHTML += `</ul>`;
            }
            summaryHTML += `</div>`;
            resultsDiv.innerHTML = summaryHTML;
            
            // Clear selection after analysis
            clearBtn.click();

        } catch (error) {
            resultsDiv.innerHTML = '<div class="alert alert-danger">Error: ' + error.message + '. Please try again.</div>';
        }
    });
}

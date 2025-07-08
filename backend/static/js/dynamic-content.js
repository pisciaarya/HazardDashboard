// static/js/dynamic-content.js

document.addEventListener('DOMContentLoaded', function() {
    const dynamicContentPanel = document.getElementById('dynamic-content-panel');
    const urlParams = new URLSearchParams(window.location.search);
    const layer = urlParams.get('layer');

    let contentHTML = '';

    switch (layer) {
        case 'realtime':
            contentHTML = `
                <div class="content-section">
                    <h3>Real-Time Data Overview</h3>
                    <p>Explore up-to-the-minute data on various environmental factors and potential hazards across Nepal. This section provides insights into live monitoring stations, recent incidents, and real-time sensor readings.</p>
                    <div class="content-buttons">
                        <a href="/map?layer=realtime" class="btn btn-info"><i class="fas fa-chart-line"></i> View Live Dashboard</a>
                    </div>
                    <div class="content-paragraph-section">
                      <h5>Sources:</h5>
                      <p>AQI data: World Air Quality Index</p>
                      <p>Weather Stations: OpenWeatherMap & OpenMeteo</p>
                      <p>Earthquake: USGS Earthquake</p>
                    </div>
                </div>
            `;
            break;
        case 'hazards':
            contentHTML = `
                    <div class="content-section">
                    <h3>Hazard Mapping and Analysis</h3>
                    <hr class="my-4">
                    <h5>Select the one you want to analyze:</h5>
                    <div class="d-grid gap-2">
                        <button class="btn btn-primary btn-lg mb-2 hazard-tool-toggle-btn" data-target="flood-tool-section">
                            <i class="fas fa-water"></i> Flood Exposure in Settlements
                        </button>
                        <button class="btn btn-warning btn-lg mb-2 hazard-tool-toggle-btn" data-target="wildfire-tool-section">
                            <i class="fas fa-fire-alt"></i> Wildfire Hotspot Analysis
                        </button>
                        <button class="btn btn-danger btn-lg mb-2 hazard-tool-toggle-btn" data-target="road-disruption-tool-section">
                            <i class="fas fa-road-barrier"></i> Road Disruption Impact
                        </button>
                    </div>

                    <div id="hazard-tool-details-container" class="mt-4">
                        <div id="flood-tool-section" class="hazard-tool-details d-none">
                            <h5>Flood Exposure in Settlements</h5>
                            <p>Identify settlements and local units exposed to potential flooding based on river proximity.</p>
                            <div class="mb-3">
                                <label for="flood-buffer-distance" class="form-label">Buffer Distance (meters):</label>
                                <input type="number" class="form-control" id="flood-buffer-distance" value="250" min="10" step="50">
                            </div>
                            <div class="mb-3">
                                <label for="flood-unit-type" class="form-label">Aggregate By:</label>
                                <select class="form-select" id="flood-unit-type">
                                    <option value="settlement">Settlements</option>
                                    <option value="local_unit">Local Units</option>
                                </select>
                            </div>
                            <button id="run-flood-analysis" class="btn btn-success"><i class="fas fa-play"></i> Run Flood Analysis</button>
                            <div id="flood-analysis-results" class="mt-3"></div>
                        </div>

                        <div id="wildfire-tool-section" class="hazard-tool-details d-none">
                            <h5>Wildfire Hotspot Analysis</h5>
                            <p>Visualize recent wildfire hotspots with confidence levels using satellite data.</p>
                            <div class="mb-3">
                                <label for="wildfire-days-ago" class="form-label">Days Ago:</label>
                                <select class="form-select" id="wildfire-days-ago">
                                    <option value="1">Last 24 Hours</option>
                                    <option value="3">Last 3 Days</option>
                                    <option value="7" selected>Last 7 Days</option>
                                    <option value="14">Last 14 Days</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="wildfire-min-confidence" class="form-label">Minimum Confidence: <span id="wildfire-confidence-value">70%</span></label>
                                <input type="range" class="form-range" id="wildfire-min-confidence" min="0" max="100" value="70">
                            </div>
                            <button id="run-wildfire-analysis" class="btn btn-success"><i class="fas fa-play"></i> Run Wildfire Analysis</button>
                            <div id="wildfire-analysis-results" class="mt-3"></div>
                        </div>

                        <div id="road-disruption-tool-section" class="hazard-tool-details d-none">
                            <h5>Road Disruption Impact</h5>
                            <p>Simulate road disruption and assess the impact on nearby settlements.</p>
                            <p class="alert alert-info"><strong>Instructions:</strong> Click on any road segment on the map to select it for analysis. A yellow dashed line will appear indicating the selected road.</p>
                            <div id="selected-road-info" class="mb-3 d-none">
                                <p><strong>Selected Road FID:</strong> <span id="display-road-fid"></span></p>
                                <button id="clear-selected-road" class="btn btn-secondary btn-sm"><i class="fas fa-times"></i> Clear Selection</button>
                            </div>
                            <div class="mb-3">
                                <label for="disruption-impact-radius" class="form-label">Impact Radius (meters):</label>
                                <input type="number" class="form-control" id="disruption-impact-radius" value="5000" min="100" step="100">
                            </div>
                            <button id="run-road-disruption-analysis" class="btn btn-success" disabled><i class="fas fa-play"></i> Simulate Disruption</button>
                            <div id="road-disruption-results" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'spatial':
            contentHTML = `
                <div class="content-section" id="spatial-tools-main">
                    <h3>Spatial Analysis Tools</h3>
                    <p>Perform advanced analysis to understand risk and vulnerability. Select a tool to begin.</p>
                    
                    <div class="mb-3">
                        <label for="spatial-tool-select" class="form-label"><strong>1. Select Analysis Tool</strong></label>
                        <select id="spatial-tool-select" class="form-select form-select-lg">
                            <option value="">-- Choose a tool --</option>
                            <option value="earthquake-impact">Earthquake Impact Zone Analysis</option>
                            <option value="infrastructure-accessibility">Critical Infrastructure Accessibility</option>
                            <option value="risk-profiler">Administrative Unit Risk Profiler</option>
                            <option value="aqi-vulnerability">Air Quality (AQI) Vulnerability</option>
                        </select>
                    </div>

                    <div id="spatial-tool-inputs" class="mt-3">
                        <!-- Dynamic inputs for the selected tool will appear here -->
                    </div>

                    <div class="d-grid mt-4">
                         <button id="run-spatial-analysis" class="btn btn-success btn-lg" disabled>
                            <i class="fas fa-play-circle"></i> Run Analysis
                        </button>
                    </div>
                </div>

                <div id="spatial-analysis-results-container" class="content-section mt-4" style="display: none;">
                    <h3>Analysis Results</h3>
                    <div id="spatial-analysis-summary"></div>
                    <div class="d-grid mt-3">
                        <button id="download-spatial-results" class="btn btn-secondary">
                            <i class="fas fa-download"></i> Download Results (GeoJSON)
                        </button>
                    </div>
                </div>
            `;
            break;
        case 'attribute':
            contentHTML = `
                <div class="content-section">
                    <h3>Attribute Tools</h3>
                    <p>This feature is currently under development.</p>
                </div>
            `;
            break;
        default:
            contentHTML = `
                <div class="content-section">
                    <h3>Unveiling Vulnerability: Risk Zonation for a Resilient Nepal</h3>
                    <p style: 'text-align: justify'>This platform is your dedicated resource for understanding and addressing natural hazard risks in Nepal's diverse settlements, empowering communities, local governments, and humanitarian organizations with critical, actionable insights.</p>

                    <div class="content-buttons">
                        <a href="https://youtu.be/RHvHoyZbJrs?si=tZi2Xin7sYoWcUim" target="_blank" class="btn btn-success"><i class="fas fa-play-circle"></i> Watch Introduction Video</a>
                        <a href="/documentation" class="btn btn-info"><i class="fas fa-book-open"></i> Explore Documentation</a>
                    </div>
                    <div>
                    <p> </p>
                    <p>Our portal visualizes essential data to identify at-risk populations and infrastructure, fostering proactive disaster preparedness and targeted mitigation strategies for a safer future.</p>
                    </div>
                    <div class="content-paragraph-section">
                        <p>Together, we can build a safer, more resilient Nepal.</p>
                    </div>
                </div>
            `;
            break;
    }

    if (dynamicContentPanel) {
        dynamicContentPanel.innerHTML = contentHTML;

        // Explicitly call the initialization function for the correct toolset
        // after its HTML has been injected into the page.
        if (layer === 'hazards') {
            // Check if the function exists before calling to avoid errors
            if (typeof initHazardTools === 'function') {
                initHazardTools();
            }
        } else if (layer === 'spatial') {
            if (typeof initializeSpatialTools === 'function') {
                initializeSpatialTools();
            }
        }
    }
});

// map.js
console.log("map.js is running!");

// Main Map Controller
let map;
let layerControl;
const filterState = {
    province: null,
    district: null,
    hazardType: null
};

// --- API Keys and URLs for Real-time Data ---
const WAQI_API_KEY = "2442d98dd891dbb9d5e21bfdea20fd18e4bdfeae";
const WAQI_NEPAL_BOUNDS_API_URL = `https://api.waqi.info/map/bounds/?latlng=27.3,80.0,30.5,88.2&token=${WAQI_API_KEY}`;

const OPENWEATHER_API_KEY = "7f09b2a738a1d65908e2ca4e002d9259";
const OPENMETEO_API_URL = "https://api.open-meteo.com/v1/forecast?latitude=27.7&longitude=85.3&hourly=temperature_2m,rain,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m&current=temperature_2m,rain,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m&forecast_days=1";

const NEPAL_CITIES_FOR_WEATHER = [
    { name: "Kathmandu", lat: 27.7172, lon: 85.3240 },
    { name: "Pokhara", lat: 28.2096, lon: 83.9856 },
    { name: "Biratnagar", lat: 26.45, lon: 87.28 },
    { name: "Bharatpur", lat: 27.68, lon: 84.43 },
    { name: "Lalitpur", lat: 27.67, lon: 85.32 },
    { name: "Butwal", lat: 27.67, lon: 83.45 },
    { name: "Dharan", lat: 26.81, lon: 87.28 },
    { name: "Janakpur", lat: 26.73, lon: 85.92 },
    { name: "Hetauda", lat: 27.43, lon: 85.03 },
    { name: "Nepalgunj", lat: 28.05, lon: 81.67 },
    { name: "Dhangadhi", lat: 28.70, lon: 80.58 },
    { name: "Bhimdatta", lat: 28.95, lon: 80.17 },
    { name: "Surkhet", lat: 28.58, lon: 81.62 }, 
    { name: "Damak", lat: 26.65, lon: 87.66 },  
    { name: "Tulsipur", lat: 28.11, lon: 82.23 }, 
    { name: "Birtamod", lat: 26.65, lon: 87.97 }  
];

const USGS_EARTHQUAKE_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2025-07-07&minlatitude=28&maxlatitude=30&minlongitude=81&maxlongitude=88.0";

const FIRMS_MAP_KEY = "db5f5b957c7bd588be9bdf778d4d7f6b";
const FIRMS_API_URL_MODIS = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${FIRMS_MAP_KEY}/MODIS_NRT/NPL/1/24`;
const FIRMS_API_URL_VIIRS = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/NPL/1/24`;


document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded fired.");
    const urlParams = new URLSearchParams(window.location.search);
    const viewType = urlParams.get('layer') || 'overview';
    console.log("Initial viewType determined:", viewType);
    initMap(viewType);
});

function initMap(viewType) {
    console.log("initMap called with viewType:", viewType);
    map = L.map('map').setView([27.7, 85.3], 8); // Start with a broader view for context
    console.log("Leaflet map initialized.");

    // --- Base Layers ---
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '© Google Satellite' });
    const terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)' });

    // Add a default base layer immediately
    osm.addTo(map);
    console.log("Default OSM base layer added to map.");

    // --- Define Custom Icons using Font Awesome ---
    const settlementIcon = L.divIcon({ html: '<i class="fa-solid fa-house" style="color: #ff9800; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    const fireIcon = L.divIcon({ html: '<i class="fa-solid fa-fire" style="color: #ff4500; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    const waqiIcon = L.divIcon({ html: '<i class="fa-solid fa-wind" style="color: #FF8C00; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
   
    const weatherIcon = L.divIcon({ html: '<i class="fa-solid fa-cloud-sun" style="color: #87CEEB; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    const earthquakeIcon = L.divIcon({ html: '<i class="fa-solid fa-house-crack" style="color: #7a0099; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    const firmsFireIcon = L.divIcon({ html: '<i class="fa-solid fa-fire-flame-curved" style="color: #ff0000; font-size: 28px;"></i>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });

    // --- Create Layer Groups (empty initially) ---
    const riverLayer = L.layerGroup();
    const roadLayer = L.layerGroup();
    const settlementLayer = L.markerClusterGroup();
    const boundaryLayer = L.layerGroup();
    const districtLayer = L.layerGroup();
    const fireLayer = L.markerClusterGroup();
    const localUnitLayer = L.layerGroup();
    const provinceLayer = L.layerGroup();
    const indexSheetLayer = L.layerGroup();

    const waqiLayer = L.markerClusterGroup();
    const openMeteoLayer = L.layerGroup();
    const openWeatherStationsLayer = L.markerClusterGroup();
    const usgsEarthquakeLayer = L.markerClusterGroup();
    const firmsLayer = L.markerClusterGroup();

    // Store all layer groups in an object for easy access
    const allLayerGroups = {
        riverLayer, roadLayer, settlementLayer, boundaryLayer,
        districtLayer, fireLayer, localUnitLayer, provinceLayer, indexSheetLayer,
        waqiLayer, openMeteoLayer, openWeatherStationsLayer, usgsEarthquakeLayer, firmsLayer
    };

    // Define base layers for the control
    const baseLayers = {
        "Street Map": osm,
        "Satellite": satellite,
        "Terrain": terrain
    };

    // Initialize an empty object for overlay layers to be populated dynamically
    const overlayLayers = {};

    // Initialize layer control immediately with defined base layers and an empty overlay object
    layerControl = L.control.layers(baseLayers, overlayLayers, {
        collapsed: true,
        position: 'topright'
    }).addTo(map);
    console.log("Layer control initialized.");

    // --- Array of promises for loading all data layers ---
    const loadPromises = [];

    // Helper function to add a layer to loadPromises and update layerControl
    const addLayerToLoadQueue = (
        url,
        layerGroup,
        layerName,
        options = {},
        loadFunction = loadGeoJSON,
        viewTypesToShow = ['overview', 'realtime', 'hazards', 'spatial', 'attribute'] // Default to all
    ) => {
        // Check if the current viewType is among those that should display this layer
        if (viewTypesToShow.includes(viewType)) {
            loadPromises.push(
                loadFunction(url, layerGroup, options).then(success => {
                    if (success && layerGroup.getLayers().length > 0) {
                        // Only add to control if data was successfully loaded
                        if (!overlayLayers[layerName]) { // Prevent duplicate additions if called multiple times (e.g., FIRMS)
                            layerControl.addOverlay(layerGroup, layerName);
                            // Add layers to map initially based on viewType
                            switch (viewType) {
                                case 'realtime':
                                    if (['Air Quality (WAQI)', 'Weather Forecast (Central)', 'Weather Stations (OWM)', 'Earthquakes (USGS)', 'Real-time Fires (FIRMS)'].includes(layerName)) {
                                        layerGroup.addTo(map);
                                    }
                                    break;
                                case 'hazards':
                                    if (['Rivers', 'Roads', 'Earthquakes (USGS)', 'Settlements', 'Backend Fire Zones', 'Local Units', 'Boundary'].includes(layerName)) {
                                        layerGroup.addTo(map);
                                    }
                                    break;
                                case 'spatial':
                                case 'attribute':
                                    // For spatial/attribute, we want all relevant layers added by default if present
                                    layerGroup.addTo(map);
                                    break;
                                default: // overview
                                    if (['Boundary', 'Provinces', 'Districts', 'Local Units', 'Index Sheet', 'Roads'].includes(layerName)) {
                                        layerGroup.addTo(map);
                                    }
                                    break;
                            }
                        }
                    }
                    return { layerName, success }; // Return status for Promise.allSettled
                })
            );
        } else {
             // If a layer is not configured for the current viewType, ensure it's not added to the load queue.
             // We'll still add to the layerControl if needed later (e.g., in spatial/attribute view where all are available).
        }
    };


    // --- Load GeoJSON data from Flask API (Existing Backend Data) ---
    addLayerToLoadQueue('/api/rivers', riverLayer, "Rivers", { style: { color: "#1E90FF", weight: 2 } }, loadGeoJSON, ['hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/roads', roadLayer, "Roads", { style: { color: "#555", weight: 1.5 } }, loadGeoJSON, ['overview', 'hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/settlements', settlementLayer, "Settlements", { pointToLayer: (feature, latlng) => L.marker(latlng, { icon: settlementIcon }) }, loadGeoJSON, ['hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/boundary', boundaryLayer, "Boundary", { style: { color: "#000", weight: 3, fill: false } }, loadGeoJSON, ['overview', 'realtime', 'hazards', 'spatial', 'attribute']);        
    addLayerToLoadQueue('/api/districts', districtLayer, "Districts", { style: { color: "#6a5acd", weight: 2, dashArray: '5,5' } }, loadGeoJSON, ['overview', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/fire1', fireLayer, "Backend Fire Zones", { pointToLayer: (feature, latlng) => L.marker(latlng, { icon: fireIcon }) }, loadGeoJSON, ['hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/fire2', fireLayer, "Backend Fire Zones", { pointToLayer: (feature, latlng) => L.marker(latlng, { icon: fireIcon }) }, loadGeoJSON, ['hazards', 'spatial', 'attribute']); // Fire layers will merge into one group
    addLayerToLoadQueue('/api/local_units_all', localUnitLayer, "Local Units", { style: { color: "#228b22", weight: 1 } }, loadGeoJSON, ['overview', 'hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/provinces', provinceLayer, "Provinces", { style: { color: "#4682b4", weight: 3, fill: false } }, loadGeoJSON, ['overview', 'spatial', 'attribute']);
    addLayerToLoadQueue('/api/index_sheet', indexSheetLayer, "Index Sheet", { style: { color: "#FFFF00", weight: 1, fill: false } }, loadGeoJSON, ['overview', 'spatial', 'attribute']);
    
    // --- Load Real-time Data ---
    addLayerToLoadQueue(WAQI_NEPAL_BOUNDS_API_URL, waqiLayer, "Air Quality (WAQI)", waqiIcon, loadRealtimeWAQI, ['realtime', 'spatial', 'attribute']);
    addLayerToLoadQueue(OPENMETEO_API_URL, openMeteoLayer, "Weather Forecast (Central)", weatherIcon, loadRealtimeOpenMeteo, ['realtime', 'spatial', 'attribute']);
    addLayerToLoadQueue(NEPAL_CITIES_FOR_WEATHER, openWeatherStationsLayer, "Weather Stations (OWM)", { icon: weatherIcon, apiKey: OPENWEATHER_API_KEY }, loadRealtimeOpenWeatherStations, ['realtime', 'spatial', 'attribute']);
    addLayerToLoadQueue(USGS_EARTHQUAKE_API_URL, usgsEarthquakeLayer, "Earthquakes (USGS)", earthquakeIcon, loadRealtimeUSGSEarthquake, ['realtime', 'hazards', 'spatial', 'attribute']);
    addLayerToLoadQueue(FIRMS_API_URL_MODIS, firmsLayer, "Real-time Fires (FIRMS)", firmsFireIcon, loadRealtimeFIRMS, ['realtime', 'spatial', 'attribute']);
    addLayerToLoadQueue(FIRMS_API_URL_VIIRS, firmsLayer, "Real-time Fires (FIRMS)", firmsFireIcon, loadRealtimeFIRMS, ['realtime', 'spatial', 'attribute']);


    // Execute all load promises and update layer control and map after each finishes
    Promise.allSettled(loadPromises).then(results => {
        console.log("All data loading attempts finished.");
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const { layerName, success } = result.value;
                if (success) {
                    console.log(`Layer '${layerName}' loaded and processed successfully.`);
                } else {
                    console.warn(`Layer '${layerName}' load or processing indicated failure.`);
                }
            } else {
                console.error(`Layer loading failed for one promise:`, result.reason);
            }
        });

        // Specific actions after all data is loaded and potentially added to map/layer control
        if (viewType === 'attribute') {
            const attributeToolsPanel = document.getElementById('attribute-tools-panel');
            if (attributeToolsPanel) {
                attributeToolsPanel.style.display = 'block';
                console.log("Attribute tools panel displayed.");
            } else {
                console.warn("Attribute tools panel not found.");
            }
            if (window.MapFilters) {
                // Pass all layer groups to MapFilters, it will handle what to filter
                new MapFilters(map, allLayerGroups, filterState);
                console.log("MapFilters initialized.");
            } else {
                console.warn("MapFilters class not found. Is filters.js loaded correctly?");
            }
        }
        
        map.invalidateSize();
        console.log("map.invalidateSize() called after all data attempts.");
    });
}

// --- Generic loadGeoJSON function for backend data ---
function loadGeoJSON(url, layerGroup, options = {}) {
    console.log(`Attempting to load GeoJSON from: ${url}`);
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} from ${url}`);
            }
            return response.json();
        })
        .then(apiResponse => {
            const dataToProcess = apiResponse.data || apiResponse;
            console.log(`Received data for ${url}:`, dataToProcess.length, "features.");

            if (!Array.isArray(dataToProcess)) {
                console.error(`Data for ${url} is not an array. Received:`, dataToProcess);
                return false;
            }

            const geojsonFeatures = dataToProcess.map(item => {
                if (!item.geometry || typeof item.geometry !== 'object') {
                    console.warn(`Feature from ${url} missing valid geometry:`, item);
                    return null;
                }
                return {
                    type: "Feature",
                    properties: item,
                    geometry: item.geometry
                };
            }).filter(feature => feature !== null);

            if (geojsonFeatures.length === 0) {
                console.warn(`No valid GeoJSON features to add for ${url}.`);
                return false;
            }

            L.geoJSON(geojsonFeatures, {
                ...options,
                onEachFeature: (feature, layer) => {
                    let content = `<b>${feature.properties.name || feature.properties.NAME || feature.properties.gapa_napa || feature.properties.district || 'Feature'}</b>`;
                    for (const key in feature.properties) {
                        if (key.toLowerCase() !== 'name' && key.toLowerCase() !== 'geometry' && key.toLowerCase() !== 'geom' && key.toLowerCase() !== 'fid' && key.toLowerCase() !== 'id') {
                            content += `<br><b>${key}:</b> ${feature.properties[key]}`;
                        }
                    }
                    layer.bindPopup(content);
                    layerGroup.addLayer(layer);
                },
                pointToLayer: options.pointToLayer || undefined
            });

            console.log(`Successfully added ${geojsonFeatures.length} features to ${url} layerGroup. Current layerGroup size: ${layerGroup.getLayers().length}`);
            return true;
        })
        .catch(error => {
            console.error(`Error loading or processing GeoJSON from ${url}:`, error);
            return false;
        });
}

// --- Functions to Load Real-time Data ---

async function loadRealtimeWAQI(url, layerGroup, icon) {
    console.log(`Attempting to load WAQI data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const data = await response.json();
        
        if (data.status === 'ok' && Array.isArray(data.data)) {
            data.data.forEach(station => {
                const lat = station.lat;
                const lon = station.lon;
                const aqi = station.aqi;
                const stationName = station.station.name;

                let popupContent = `<h3>Air Quality: ${stationName}</h3>`;
                popupContent += `<p>AQI: <b>${aqi}</b></p>`;
                
                const marker = L.marker([lat, lon], { icon: icon }).bindPopup(popupContent);
                layerGroup.addLayer(marker);
            });
            console.log(`Successfully added ${data.data.length} WAQI stations.`);
            return true;
        } else {
            console.warn(`No valid WAQI data (or empty array) received from ${url}. Status: ${data.status}. This might be due to a non-premium API key for /map/bounds.`);
            return false;
        }
    } catch (error) {
        console.error(`Error loading WAQI data from ${url}:`, error);
        return false;
    }
}

async function loadRealtimeOpenMeteo(url, layerGroup, icon) {
    console.log(`Attempting to load OpenMeteo data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const data = await response.json();

        if (data.current && data.latitude && data.longitude) {
            const lat = data.latitude;
            const lon = data.longitude;
            const current = data.current;

            let popupContent = `<h3>Current Weather (Central Nepal)</h3>`;
            popupContent += `<p>Temperature: ${current.temperature_2m}°C</p>`;
            popupContent += `<p>Rain: ${current.rain} mm</p>`;
            popupContent += `<p>Precipitation: ${current.precipitation} mm</p>`;
            popupContent += `<p>Cloud Cover: ${current.cloud_cover}%</p>`;
            popupContent += `<p>Wind Speed: ${current.wind_speed_10m} m/s</p>`;
            popupContent += `<p>Wind Direction: ${current.wind_direction_10m}°</p>`;
            
            if (data.hourly && data.hourly.time && data.hourly.temperature_2m) {
                popupContent += `<h4>Hourly Forecast (Next 24h):</h4><ul>`;
                for (let i = 0; i < Math.min(24, data.hourly.time.length); i++) {
                    const time = new Date(data.hourly.time[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const temp = data.hourly.temperature_2m[i];
                    popupContent += `<li>${time}: ${temp}°C</li>`;
                }
                popupContent += `</ul>`;
            }

            const marker = L.marker([lat, lon], { icon: icon }).bindPopup(popupContent);
            layerGroup.addLayer(marker);
            console.log(`Successfully added OpenMeteo weather data.`);
            return true;
        } else {
            console.warn(`No valid OpenMeteo data received from ${url}.`);
            return false;
        }
    } catch (error) {
        console.error(`Error loading OpenMeteo data from ${url}:`, error);
        return false;
    }
}

async function loadRealtimeOpenWeatherStations(cities, layerGroup, options) { // options now carries icon and apiKey
    const { icon, apiKey } = options;
    console.log(`Attempting to load OpenWeatherMap station data for ${cities.length} cities.`);
    const promises = cities.map(async city => {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${apiKey}&units=metric`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`HTTP error! status: ${response.status} for ${city.name} from ${url}`);
                return null;
            }
            const data = await response.json();

            if (data.main && data.wind) {
                let popupContent = `<h3>Weather: ${data.name}</h3>`;
                popupContent += `<p>Temperature: <b>${data.main.temp}°C</b></p>`;
                popupContent += `<p>Feels Like: ${data.main.feels_like}°C</p>`;
                popupContent += `<p>Pressure: ${data.main.pressure} hPa</p>`;
                popupContent += `<p>Humidity: ${data.main.humidity}%</p>`;
                popupContent += `<p>Wind Speed: ${data.wind.speed} m/s</p>`;
                popupContent += `<p>Wind Direction: ${data.wind.deg}°</p>`;
                if (data.weather && data.weather.length > 0) {
                    popupContent += `<p>Conditions: ${data.weather[0].description}</p>`;
                }

                const marker = L.marker([data.coord.lat, data.coord.lon], { icon: icon }).bindPopup(popupContent);
                layerGroup.addLayer(marker);
                return true;
            } else {
                console.warn(`No valid weather data for ${city.name} from ${url}.`);
                return null;
            }
        } catch (error) {
            console.error(`Error loading OpenWeatherMap data for ${city.name} from ${url}:`, error);
            return null;
        }
    });

    const results = await Promise.all(promises);
    const successfulLoads = results.filter(r => r === true).length;
    console.log(`Successfully added ${successfulLoads} OpenWeatherMap stations.`);
    return successfulLoads > 0;
}


async function loadRealtimeUSGSEarthquake(url, layerGroup, icon) {
    console.log(`Attempting to load USGS Earthquake data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const data = await response.json();

        if (data.type === "FeatureCollection" && data.features) {
            L.geoJSON(data, {
                pointToLayer: (feature, latlng) => {
                    const magnitude = feature.properties.mag;
                    const radius = Math.max(4, magnitude * 2);
                    return L.circleMarker(latlng, {
                        radius: radius,
                        fillColor: "#FF0000",
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.7
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    // CORRECTED: Defined popupContent before using it.
                    let popupContent = `<h3>Earthquake</h3>`;
                    popupContent += `<p>Magnitude: <b>${props.mag}</b></p>`;
                    popupContent += `<p>Location: ${props.place}</p>`;
                    popupContent += `<p>Time: ${new Date(props.time).toLocaleString()}</p>`;
                    popupContent += `<p>Depth: ${props.cdi || 'N/A'}</p>`;
                    popupContent += `<p><a href="${props.url}" target="_blank">More Info</a></p>`;
                    layer.bindPopup(popupContent);
                    layerGroup.addLayer(layer);
                }
            });
            console.log(`Successfully added ${data.features.length} USGS Earthquake features.`);
            return true;
        } else {
            console.warn(`No valid USGS Earthquake data received from ${url}.`);
            return false;
        }
    } catch (error) {
        console.error(`Error loading USGS Earthquake data from ${url}:`, error);
        return false;
    }
}

async function loadRealtimeFIRMS(url, layerGroup, icon) {
    console.log(`Attempting to load FIRMS data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${url}`);
        }
        const csvText = await response.text();
        
        const lines = csvText.trim().split('\n');
        if (lines.length <= 1) {
            console.warn(`No FIRMS data or only header received from ${url}.`);
            return false;
        }
        const headers = lines[0].split(',');
        const featuresAdded = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const feature = {};
            headers.forEach((header, index) => {
                feature[header.trim()] = values[index].trim();
            });

            const lat = parseFloat(feature.latitude);
            const lon = parseFloat(feature.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
                let popupContent = `<h3>FIRMS Fire Detection</h3>`;
                popupContent += `<p>Latitude: ${lat}</p>`;
                popupContent += `<p>Longitude: ${lon}</p>`;
                popupContent += `<p>Brightness: ${feature.brightness || 'N/A'}</p>`;
                popupContent += `<p>Confidence: ${feature.confidence || 'N/A'}</p>`;
                popupContent += `<p>Date: ${feature.acq_date || 'N/A'}</p>`;
                popupContent += `<p>Time: ${feature.acq_time || 'N/A'}</p>`;
                popupContent += `<p>Satellite: ${feature.satellite || 'N/A'}</p>`;

                const marker = L.marker([lat, lon], { icon: icon }).bindPopup(popupContent);
                layerGroup.addLayer(marker);
                featuresAdded.push(marker);
            }
        }
        console.log(`Successfully added ${featuresAdded.length} FIRMS fire features from ${url}.`);
        return true;
    } catch (error) {
        console.error(`Error loading FIRMS data from ${url}:`, error);
        return false;
    }
}

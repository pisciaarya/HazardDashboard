from flask import Flask, jsonify, request, send_from_directory, render_template
from models import db, LocalUnits, Provinces, Rivers, Settlements, Roads, \
                    IndexSheet, Fire1, Fire2, Districts, Boundary
from config import Config
from sqlalchemy import func, cast, or_
import json, os, requests
from geoalchemy2.shape import to_shape
from geoalchemy2.types import Geometry as GeometryType
from geoalchemy2.functions import ST_Buffer, ST_Transform, ST_Intersects, ST_AsGeoJSON, ST_Union, ST_Area, ST_DWithin, ST_Intersection, ST_Distance, ST_Length, ST_CollectionExtract
from shapely.geometry import mapping
from flask_cors import CORS
from datetime import datetime, timedelta, UTC

# ========== Flask App Initialization ==========
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config.from_object(Config)
db.init_app(app)

# ========== CORS ==========
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ========== API Keys (Keep these secure, e.g., in environment variables) ==========
USGS_EARTHQUAKE_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=26&maxlatitude=31&minlongitude=80&maxlongitude=89"
WAQI_API_KEY = "2442d98dd891dbb9d5e21bfdea20fd18e4bdfeae" # Replace with your actual key
WAQI_NEPAL_BOUNDS_API_URL = f"https://api.waqi.info/map/bounds/?latlng=26.3,80.0,30.5,88.2&token={WAQI_API_KEY}"


# ========== Frontend Serving ==========
@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/map')
def serve_map():
    return render_template('map.html')

@app.route('/info')
def serve_info():
    return render_template('info.html')

@app.route('/about')
def serve_about():
    return render_template('about.html')

@app.route('/documentation')
def serve_documentation():
    return render_template('documentation.html')

# ========== Helper Functions ==========
def model_to_dict(instance):
    if not instance:
        return None
    data = {}
    for column in instance.__table__.columns:
        if isinstance(column.type, GeometryType):
            continue
        data[column.name] = getattr(instance, column.name)
    return data

def create_model_endpoint(model):
    def endpoint():
        try:
            records = db.session.query(model).all()
            result = []
            for record in records:
                item = model_to_dict(record)
                if hasattr(record, 'geom') and record.geom:
                    shape = to_shape(record.geom)
                    item['geometry'] = mapping(shape)
                result.append(item)
            return jsonify(result)
        except Exception as e:
            app.logger.error(f"Error fetching {model.__tablename__}: {e}")
            return jsonify({'error': str(e)}), 500
    endpoint.__name__ = f"endpoint_{model.__tablename__}"
    return endpoint

def _calculate_stat(query, stat_name):
    """Helper to run a query and log errors, returning a default value."""
    try:
        return query.scalar() or 0
    except Exception as e:
        app.logger.error(f"Error calculating {stat_name}: {e}")
        return -1 # Return an error indicator

# ========== Existing API Endpoints ==========
endpoints = [
    (LocalUnits, 'local_units_all'), (Provinces, 'provinces'), (Rivers, 'rivers'),
    (Settlements, 'settlements'), (Roads, 'roads'), (IndexSheet, 'index_sheet'),
    (Fire1, 'fire1'), (Fire2, 'fire2'), (Districts, 'districts'), (Boundary, 'boundary')
]
for model, endpoint_name in endpoints:
    app.add_url_rule(f'/api/{endpoint_name}', view_func=create_model_endpoint(model), methods=['GET'])

# ========== Hazard Analysis Endpoints ==========
@app.route('/api/hazard/flood-exposure', methods=['GET'])
def get_flood_exposure():
    try:
        buffer_distance_meters = float(request.args.get('buffer_distance_meters', 250))
        unit_type = request.args.get('unit_type', 'settlement')
        combined_river_buffer_wkt = db.session.query(func.ST_AsText(ST_Transform(ST_Union(ST_Buffer(ST_Transform(Rivers.geom, 32645), buffer_distance_meters)),4326))).scalar()
        flood_buffers_feature_collection = {"type": "FeatureCollection", "features": []}
        combined_river_buffer_geom = None
        if combined_river_buffer_wkt:
            combined_river_buffer_geom = func.ST_GeomFromText(combined_river_buffer_wkt, 4326)
            flood_buffers_feature_collection["features"].append({"type": "Feature","geometry": json.loads(db.session.query(ST_AsGeoJSON(combined_river_buffer_geom)).scalar()),"properties": {"type": "River Buffer", "buffer_m": buffer_distance_meters}})
        affected_features_collection = {"type": "FeatureCollection", "features": []}
        if combined_river_buffer_geom is not None:
            Model = Settlements if unit_type == 'settlement' else LocalUnits
            query = db.session.query(Model).filter(ST_Intersects(Model.geom, combined_river_buffer_geom))
            for row in query.all():
                props = model_to_dict(row)
                if unit_type == 'local_unit':
                    percentage = db.session.query((ST_Area(ST_Intersection(row.geom, combined_river_buffer_geom)) / ST_Area(row.geom) * 100)).scalar()
                    props['percentage_affected'] = round(percentage, 2)
                affected_features_collection["features"].append({"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(row.geom)).scalar()),"properties": props})
        return jsonify({"flood_buffers": flood_buffers_feature_collection, "affected_features": affected_features_collection})
    except Exception as e:
        app.logger.error(f"Error in flood exposure analysis: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/hazard/wildfire-hotspots', methods=['GET'])
def get_wildfire_hotspots():
    try:
        days_ago = int(request.args.get('days_ago', 7))
        min_confidence = int(request.args.get('min_confidence', 70))
        date_threshold_int = int((datetime.now() - timedelta(days=days_ago)).strftime('%Y%m%d'))
        fire1 = db.session.query(Fire1).filter(Fire1.acq_date >= date_threshold_int, Fire1.confidence >= min_confidence).all()
        fire2 = db.session.query(Fire2).filter(Fire2.acq_date >= date_threshold_int, Fire2.confidence >= min_confidence).all()
        features = []
        for row in fire1 + fire2:
            props = model_to_dict(row)
            date_str = str(row.acq_date)
            props['acq_date'] = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            features.append({"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(row.geom)).scalar()), "properties": props})
        return jsonify({"type": "FeatureCollection", "features": features})
    except Exception as e:
        app.logger.error(f"Error in wildfire hotspot analysis: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/query/closest-road', methods=['GET'])
def get_closest_road():
    lat, lon = request.args.get('lat', type=float), request.args.get('lon', type=float)
    if lat is None or lon is None: return jsonify({"error": "Latitude and longitude are required."}), 400
    try:
        user_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        closest_road = db.session.query(Roads).order_by(Roads.geom.distance_centroid(user_point)).limit(1).first()
        if closest_road:
            return jsonify({"feature": {"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(closest_road.geom)).scalar()), "properties": model_to_dict(closest_road)}})
        return jsonify({"feature": None})
    except Exception as e:
        app.logger.error(f"Error finding closest road: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/hazard/road-disruption-impact', methods=['GET'])
def get_road_disruption_impact():
    try:
        road_fid, radius_m = request.args.get('road_fid'), float(request.args.get('impact_radius_meters', 5000))
        disrupted_road = db.session.query(Roads).filter(Roads.fid == road_fid).first()
        if not disrupted_road: return jsonify({"error": "Road not found"}), 404
        buffer_geom = ST_Transform(ST_Buffer(ST_Transform(disrupted_road.geom, 32645), radius_m), 4326)
        affected_settlements = db.session.query(Settlements).filter(ST_Intersects(Settlements.geom, buffer_geom)).all()
        features = []
        road_props = model_to_dict(disrupted_road); road_props['analysis_type'] = 'disrupted_road'
        features.append({"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(disrupted_road.geom)).scalar()), "properties": road_props})
        for s in affected_settlements:
            settlement_props = model_to_dict(s); settlement_props['analysis_type'] = 'affected_settlement'
            features.append({"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(s.geom)).scalar()), "properties": settlement_props})
        return jsonify({"type": "FeatureCollection", "features": features})
    except Exception as e:
        app.logger.error(f"Error in road disruption analysis: {e}")
        return jsonify({"error": str(e)}), 500

# ========== SPATIAL ANALYSIS API ENDPOINTS ==========
@app.route('/api/spatial/list-earthquakes')
def list_earthquakes():
    try:
        start_time = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        url = f"{USGS_EARTHQUAKE_API_URL}&starttime={start_time}&minmagnitude=4.0"
        response = requests.get(url); response.raise_for_status()
        data = response.json()
        earthquakes = [{"id": f["id"], "title": f["properties"]["title"], "mag": f["properties"]["mag"], "time": datetime.fromtimestamp(f["properties"]["time"] / 1000, UTC).isoformat(), "coords": f["geometry"]["coordinates"]} for f in data.get("features", [])]
        return jsonify(sorted(earthquakes, key=lambda x: x['time'], reverse=True))
    except Exception as e:
        app.logger.error(f"Error fetching earthquakes: {e}")
        return jsonify({"error": "Could not fetch earthquake data."}), 500

@app.route('/api/spatial/list-admin-units')
def list_admin_units():
    unit_type = request.args.get('type', 'districts')
    Model = Districts if unit_type == 'districts' else LocalUnits
    name_col = Districts.district if unit_type == 'districts' else LocalUnits.gapa_napa
    units = db.session.query(Model.fid, name_col.label('name')).order_by('name').all()
    return jsonify([{"fid": unit.fid, "name": unit.name} for unit in units])

@app.route('/api/spatial/earthquake-impact', methods=['POST'])
def analyze_earthquake_impact():
    data = request.get_json()
    coords, magnitude = data.get('coords'), data.get('mag')
    if not coords or not magnitude: return jsonify({"error": "Coordinates and magnitude are required."}), 400
    try:
        epicenter = func.ST_SetSRID(func.ST_MakePoint(coords[0], coords[1]), 4326)
        zones = {"High Risk": 15000 * (1.1**(magnitude-5)), "Medium Risk": 40000 * (1.1**(magnitude-5))}
        results, zone_geometries = {}, {}
        for zone, radius in zones.items():
            buffer_geom = ST_Transform(ST_Buffer(ST_Transform(epicenter, 32645), radius), 4326)
            zone_geometries[zone] = buffer_geom
            results[zone] = {
                "settlements_affected": db.session.query(Settlements).filter(ST_Intersects(Settlements.geom, buffer_geom)).count(),
                "districts_affected": [d[0] for d in db.session.query(Districts.district).filter(ST_Intersects(Districts.geom, buffer_geom)).distinct().all()]
            }
        features = [{"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(geom)).scalar()), "properties": {"risk_zone": z, "radius_m": r}} for z, r, geom in zip(zones.keys(), zones.values(), zone_geometries.values())]
        return jsonify({"summary": results, "geojson": {"type": "FeatureCollection", "features": features}})
    except Exception as e:
        app.logger.error(f"Earthquake Impact Error: {e}")
        return jsonify({"error": "Analysis failed."}), 500

@app.route('/api/spatial/infrastructure-accessibility', methods=['POST'])
def analyze_accessibility():
    data = request.get_json()
    infra_layer, admin_unit_type, admin_unit_fid = data.get('infrastructure'), data.get('admin_unit_type'), data.get('admin_unit_fid')
    if infra_layer not in ['roads', 'rivers'] or not admin_unit_fid: return jsonify({"error": "Invalid parameters."}), 400
    TargetModel = Roads if infra_layer == 'roads' else Rivers
    AdminModel = Districts if admin_unit_type == 'districts' else LocalUnits
    try:
        admin_boundary = db.session.query(AdminModel.geom).filter(AdminModel.fid == admin_unit_fid).scalar()
        if not admin_boundary: return jsonify({"error": "Admin unit not found."}), 404
        settlements_in_area = db.session.query(Settlements).filter(ST_Intersects(Settlements.geom, admin_boundary)).all()
        features = []
        for settlement in settlements_in_area:
            closest = db.session.query(TargetModel.fid, ST_Distance(ST_Transform(settlement.geom, 32645), ST_Transform(TargetModel.geom, 32645)).label('distance')).order_by('distance').limit(1).first()
            if closest:
                item = model_to_dict(settlement)
                item['geometry'] = json.loads(db.session.query(ST_AsGeoJSON(settlement.geom)).scalar())
                item[f'distance_to_{infra_layer}_m'] = round(closest.distance, 2)
                features.append({"type": "Feature", "properties": item, "geometry": item['geometry']})
        return jsonify({"type": "FeatureCollection", "features": features})
    except Exception as e:
        app.logger.error(f"Accessibility Analysis Error: {e}")
        return jsonify({"error": "Analysis failed."}), 500

@app.route('/api/spatial/risk-profiler', methods=['POST'])
def generate_risk_profile():
    data = request.get_json()
    if not data: return jsonify({"error": "Invalid JSON payload"}), 400
    unit_type, unit_fid = data.get('unit_type'), data.get('unit_fid')
    AdminModel = Districts if unit_type == 'districts' else LocalUnits
    try:
        boundary = db.session.query(AdminModel.geom).filter(AdminModel.fid == unit_fid).scalar()
        if not boundary: return jsonify({"error": "Admin unit not found."}), 404
        
        road_length_query = db.session.query(func.sum(ST_Length(ST_CollectionExtract(ST_Intersection(Roads.geom, boundary), 2)))).filter(ST_Intersects(Roads.geom, boundary))
        river_length_query = db.session.query(func.sum(ST_Length(ST_CollectionExtract(ST_Intersection(Rivers.geom, boundary), 2)))).filter(ST_Intersects(Rivers.geom, boundary))
        
        profile = {
            "settlements_count": _calculate_stat(db.session.query(func.count(Settlements.fid)).filter(ST_Intersects(Settlements.geom, boundary)), "settlement count"),
            "road_length_km": round(_calculate_stat(road_length_query, "road length") / 1000, 2),
            "river_length_km": round(_calculate_stat(river_length_query, "river length") / 1000, 2),
            "fire_incidents": _calculate_stat(db.session.query(func.count(Fire1.fid)).filter(ST_Intersects(Fire1.geom, boundary)), "fire1 count") + \
                              _calculate_stat(db.session.query(func.count(Fire2.fid)).filter(ST_Intersects(Fire2.geom, boundary)), "fire2 count")
        }
        boundary_geojson = json.loads(db.session.query(ST_AsGeoJSON(boundary)).scalar())
        return jsonify({"profile": profile, "geojson": boundary_geojson})
    except Exception as e:
        app.logger.error(f"Risk Profile Error: {e}")
        return jsonify({"error": "Critical error during analysis."}), 500

@app.route('/api/spatial/multi-hazard-exposure', methods=['POST'])
def analyze_multi_hazard_exposure():
    data = request.get_json()
    buffer_m, hazards = data.get('buffer_m', 500), data.get('hazards', [])
    try:
        settlements = db.session.query(Settlements.fid, Settlements.geom, Settlements.vdc_name).all()
        features = []
        for settlement in settlements:
            exposure_score = 0
            settlement_geom_proj = ST_Transform(settlement.geom, 32645)
            if 'flood' in hazards:
                is_exposed = db.session.query(Rivers.geom).filter(ST_DWithin(ST_Transform(Rivers.geom, 32645), settlement_geom_proj, buffer_m)).first()
                if is_exposed: exposure_score += 1
            if 'fire' in hazards:
                is_exposed = db.session.query(Fire1.geom).filter(ST_DWithin(ST_Transform(Fire1.geom, 32645), settlement_geom_proj, buffer_m)).first() or \
                             db.session.query(Fire2.geom).filter(ST_DWithin(ST_Transform(Fire2.geom, 32645), settlement_geom_proj, buffer_m)).first()
                if is_exposed: exposure_score += 1
            if exposure_score > 0:
                props = model_to_dict(settlement)
                props['exposure_score'] = exposure_score
                features.append({"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(settlement.geom)).scalar()), "properties": props})
        return jsonify({"type": "FeatureCollection", "features": features})
    except Exception as e:
        app.logger.error(f"Multi-Hazard Error: {e}")
        return jsonify({"error": "Analysis failed."}), 500

@app.route('/api/spatial/aqi-vulnerability', methods=['POST'])
def analyze_aqi_vulnerability():
    data = request.get_json()
    aqi_threshold, radius_km = data.get('aqi_threshold', 101), data.get('radius_km', 10)
    try:
        response = requests.get(WAQI_NEPAL_BOUNDS_API_URL)
        response.raise_for_status()
        aqi_data = response.json().get('data', [])
        high_aqi_stations = [s for s in aqi_data if str(s.get('aqi')).isdigit() and int(s.get('aqi')) >= aqi_threshold]
        if not high_aqi_stations: return jsonify({"type": "FeatureCollection", "features": []})
        
        affected_settlement_ids = set()
        all_affected_settlements = []

        for station in high_aqi_stations:
            station_point = func.ST_SetSRID(func.ST_MakePoint(station['lon'], station['lat']), 4326)
            buffer_geom = ST_Transform(ST_Buffer(ST_Transform(station_point, 32645), radius_km * 1000), 4326)
            settlements_in_buffer = db.session.query(Settlements).filter(ST_Intersects(Settlements.geom, buffer_geom)).all()
            for s in settlements_in_buffer:
                if s.fid not in affected_settlement_ids:
                    affected_settlement_ids.add(s.fid)
                    all_affected_settlements.append(s)

        features = [{"type": "Feature", "geometry": json.loads(db.session.query(ST_AsGeoJSON(s.geom)).scalar()), "properties": model_to_dict(s)} for s in all_affected_settlements]
        return jsonify({"type": "FeatureCollection", "features": features})
    except Exception as e:
        app.logger.error(f"AQI Vulnerability Error: {e}")
        return jsonify({"error": "Analysis failed."}), 500

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

# ========== Main ==========
if __name__ == '__main__':
    app.run(debug=True, port=5000)

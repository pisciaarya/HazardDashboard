from flask import Blueprint, jsonify, request
from models import db, LocalUnits, Provinces, Rivers, Settlements, Roads, Fire1, Fire2, Districts
from sqlalchemy import func, cast, or_
from geoalchemy2.functions import ST_Buffer, ST_Transform, ST_Intersects, ST_AsGeoJSON, ST_Union, ST_Area, ST_DWithin, ST_Distance, ST_Centroid, ST_Length, ST_LineLocatePoint, ST_PointN, ST_EndPoint, ST_StartPoint, ST_Intersection
from geoalchemy2.types import Geometry as GeometryType
import json
from datetime import datetime, timedelta, UTC

# Create a Blueprint for spatial tools
spatial_bp = Blueprint('spatial', __name__)

# --- Helper function for common error response ---
def error_response(message, status_code=500):
    """Generates a standardized error JSON response."""
    return jsonify({"error": message, "message": "An internal server error occurred during analysis."}), status_code

# --- Helper function to convert SQLAlchemy row to GeoJSON Feature ---
def row_to_geojson_feature(row, geom_column_name='geojson_geom', properties_to_exclude=None):
    """Converts a SQLAlchemy row with a GeoJSON geometry column to a GeoJSON Feature."""
    if properties_to_exclude is None:
        properties_to_exclude = ['geojson_geom']

    properties = {k: v for k, v in row._asdict().items() if k not in properties_to_exclude}
    return {
        "type": "Feature",
        "geometry": json.loads(getattr(row, geom_column_name)),
        "properties": properties
    }

# ===============================================
# Helper Endpoints for Interactive Selection
# These endpoints are crucial for the frontend to select features on the map
# and send their IDs to the backend for spatial analysis.
# ===============================================

@spatial_bp.route('/query/closest-settlement', methods=['GET'])
def get_closest_settlement():
    """
    API endpoint to find the closest settlement to a given latitude/longitude point.
    Used for selecting an incident settlement in tools like Emergency Response.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        user_point_geom = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        closest_settlement = db.session.query(
            Settlements.fid,
            Settlements.vdc_name,
            Settlements.dist_name,
            ST_AsGeoJSON(Settlements.geom).label('geojson_geom'),
            ST_Distance(
                ST_Transform(Settlements.geom, 32645), # Transform settlement geometry to UTM for accurate distance
                ST_Transform(user_point_geom, 32645) # Transform user point to UTM
            ).label('distance_meters')
        ).order_by('distance_meters').limit(1).first()

        if closest_settlement:
            return jsonify({
                "feature": row_to_geojson_feature(closest_settlement, properties_to_exclude=['geojson_geom', 'distance_meters']),
                "distance_meters": closest_settlement.distance_meters
            })
        else:
            return jsonify({"feature": None, "message": "No settlement found nearby."})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in get_closest_settlement: {e}")
        return error_response(f"Error finding closest settlement: {e}")

@spatial_bp.route('/query/closest-river', methods=['GET'])
def get_closest_river():
    """
    API endpoint to find the closest river segment to a given latitude/longitude point.
    Used for selecting a river segment in the River Morphology tool.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        user_point_geom = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        closest_river = db.session.query(
            Rivers.fid,
            Rivers.river_code,
            Rivers.shape_len,
            ST_AsGeoJSON(Rivers.geom).label('geojson_geom'),
            ST_Distance(
                ST_Transform(Rivers.geom, 32645), # Transform river geometry to UTM
                ST_Transform(user_point_geom, 32645) # Transform user point to UTM
            ).label('distance_meters')
        ).order_by('distance_meters').limit(1).first()

        if closest_river:
            return jsonify({
                "feature": row_to_geojson_feature(closest_river, properties_to_exclude=['geojson_geom', 'distance_meters']),
                "distance_meters": closest_river.distance_meters
            })
        else:
            return jsonify({"feature": None, "message": "No river found nearby."})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in get_closest_river: {e}")
        return error_response(f"Error finding closest river: {e}")

@spatial_bp.route('/query/closest-local-unit', methods=['GET'])
def get_closest_local_unit():
    """
    API endpoint to find the closest Local Unit to a given lat/lon.
    Used for selecting administrative units in Vulnerability Profiling.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        user_point_geom = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        closest_local_unit = db.session.query(
            LocalUnits.fid,
            LocalUnits.gapa_napa,
            LocalUnits.district,
            LocalUnits.province,
            ST_AsGeoJSON(LocalUnits.geom).label('geojson_geom'),
            ST_Distance(
                ST_Transform(LocalUnits.geom, 32645), # Transform local unit geometry to UTM
                ST_Transform(user_point_geom, 32645) # Transform user point to UTM
            ).label('distance_meters')
        ).order_by('distance_meters').limit(1).first()

        if closest_local_unit:
            return jsonify({
                "feature": row_to_geojson_feature(closest_local_unit, properties_to_exclude=['geojson_geom', 'distance_meters']),
                "distance_meters": closest_local_unit.distance_meters
            })
        else:
            return jsonify({"feature": None, "message": "No local unit found nearby."})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in get_closest_local_unit: {e}")
        return error_response(f"Error finding closest local unit: {e}")

@spatial_bp.route('/query/closest-district', methods=['GET'])
def get_closest_district():
    """
    API endpoint to find the closest District to a given lat/lon.
    Used for selecting administrative units in Vulnerability Profiling.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Latitude and longitude are required."}), 400

    try:
        user_point_geom = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        closest_district = db.session.query(
            Districts.fid,
            Districts.district,
            ST_AsGeoJSON(Districts.geom).label('geojson_geom'),
            ST_Distance(
                ST_Transform(Districts.geom, 32645), # Transform district geometry to UTM
                ST_Transform(user_point_geom, 32645) # Transform user point to UTM
            ).label('distance_meters')
        ).order_by('distance_meters').limit(1).first()

        if closest_district:
            return jsonify({
                "feature": row_to_geojson_feature(closest_district, properties_to_exclude=['geojson_geom', 'distance_meters']),
                "distance_meters": closest_district.distance_meters
            })
        else:
            return jsonify({"feature": None, "message": "No district found nearby."})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in get_closest_district: {e}")
        return error_response(f"Error finding closest district: {e}")

# ===============================================
# 1. Dynamic Earthquake Aftershock Probability Mapping
# ===============================================
@spatial_bp.route('/earthquake-intensity', methods=['GET'])
def earthquake_intensity():
    """
    Simulates earthquake intensity zones and identifies exposed settlements.
    For simplicity, this uses a hypothetical earthquake epicenter and magnitude,
    and creates buffer zones to represent intensity.
    Parameters:
        min_magnitude (float): Minimum magnitude to consider for a hypothetical earthquake.
        days_ago (int): Number of days back to consider for hypothetical recent earthquakes.
    Returns:
        GeoJSON FeatureCollection of intensity zones and exposed settlements.
    """
    try:
        min_magnitude = float(request.args.get('min_magnitude', 4.0))
        days_ago = int(request.args.get('days_ago', 7))

        # For demonstration, we'll use a hardcoded hypothetical earthquake epicenter.
        # In a real application, this would come from a real-time earthquake API or database.
        hypothetical_eq_lat = 27.7 # Near Kathmandu
        hypothetical_eq_lon = 85.3 # Near Kathmandu
        hypothetical_eq_mag = max(min_magnitude, 5.5) # Ensure it meets min_magnitude for a significant event

        eq_epicenter_geom = func.ST_SetSRID(func.ST_MakePoint(hypothetical_eq_lon, hypothetical_eq_lat), 4326)

        intensity_zones = {
            "type": "FeatureCollection",
            "features": []
        }
        exposed_settlements = {
            "type": "FeatureCollection",
            "features": []
        }

        # Define intensity zones based on magnitude (simplified model)
        # These buffer distances are illustrative and not seismologically accurate.
        # They represent decreasing intensity with distance from the epicenter.
        intensity_levels = [
            (hypothetical_eq_mag * 5000, 8),  # High intensity (e.g., 5.5 mag -> 27.5 km buffer)
            (hypothetical_eq_mag * 10000, 7), # Moderate-high
            (hypothetical_eq_mag * 20000, 6), # Moderate
            (hypothetical_eq_mag * 40000, 5), # Low
            (hypothetical_eq_mag * 80000, 4)  # Very low
        ]

        # Sort by distance descending to ensure inner buffers are processed first (for visualization)
        intensity_levels.sort(key=lambda x: x[0], reverse=True)

        for buffer_m, intensity_level in intensity_levels:
            # Create buffer around the epicenter, transforming to a projected CRS (UTM 32645) for accurate buffering
            buffer_geom = ST_Transform(
                            ST_Buffer(ST_Transform(eq_epicenter_geom, 32645), buffer_m),
                            4326 # Transform back to WGS84
                          )
            
            # Add intensity zone to feature collection
            intensity_zones["features"].append({
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(buffer_geom)).scalar()),
                "properties": {
                    "intensity_level": intensity_level,
                    "buffer_distance_m": buffer_m
                }
            })

            # Find settlements within this intensity zone
            affected_settlements_query = db.session.query(
                Settlements.fid,
                Settlements.vdc_name,
                Settlements.dist_name,
                ST_AsGeoJSON(Settlements.geom).label('geojson_geom')
            ).filter(
                ST_Intersects(Settlements.geom, buffer_geom)
            ).all()

            for row in affected_settlements_query:
                # Add to exposed settlements if not already added (to avoid duplicates from overlapping buffers)
                if not any(f['properties']['fid'] == row.fid for f in exposed_settlements["features"]):
                    exposed_settlements["features"].append(row_to_geojson_feature(row))

        return jsonify({
            "intensity_zones": intensity_zones,
            "exposed_settlements": exposed_settlements
        })

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in earthquake_intensity: {e}")
        return error_response(f"Error during earthquake intensity analysis: {e}")

# ===============================================
# 2. Real-time Weather-Driven Flash Flood Warning System (Simplified)
# ===============================================
@spatial_bp.route('/flash-flood-warning', methods=['GET'])
def flash_flood_warning():
    """
    Simulates a flash flood warning system.
    Identifies settlements and roads within a defined buffer of rivers,
    which would be at risk during heavy rainfall.
    Parameters:
        rainfall_intensity (str): 'low', 'medium', 'high' (simulated input to adjust buffer).
        buffer_distance_meters (int): Base distance from rivers to consider as flood-prone.
    Returns:
        GeoJSON FeatureCollection of flood risk zones, affected settlements, and affected roads.
    """
    try:
        rainfall_intensity = request.args.get('rainfall_intensity', 'medium')
        buffer_distance_meters = float(request.args.get('buffer_distance_meters', 500)) # Default 500m

        if buffer_distance_meters <= 0:
            return jsonify({"error": "Buffer distance must be a positive number."}), 400

        # Adjust buffer based on simulated rainfall intensity
        if rainfall_intensity == 'low':
            actual_buffer = buffer_distance_meters * 0.5
        elif rainfall_intensity == 'high':
            actual_buffer = buffer_distance_meters * 1.5
        else: # medium
            actual_buffer = buffer_distance_meters

        # Create a unioned buffer around all rivers to represent flood risk zones.
        # This is more efficient than buffering each river segment individually and then unioning.
        combined_river_buffer_wkt = db.session.query(
            func.ST_AsText(
                ST_Transform(
                    ST_Union(
                        ST_Buffer(ST_Transform(Rivers.geom, 32645), actual_buffer)
                    ),
                    4326
                )
            )
        ).scalar()

        flood_risk_zones = {
            "type": "FeatureCollection",
            "features": []
        }
        affected_settlements = {
            "type": "FeatureCollection",
            "features": []
        }
        affected_roads = {
            "type": "FeatureCollection",
            "features": []
        }

        if combined_river_buffer_wkt:
            combined_river_buffer_geom = func.ST_GeomFromText(combined_river_buffer_wkt, 4326)

            flood_risk_zones["features"].append({
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(combined_river_buffer_geom)).scalar()),
                "properties": {
                    "type": "Flood Risk Zone",
                    "buffer_m": actual_buffer,
                    "rainfall_intensity": rainfall_intensity
                }
            })

            # Find settlements within the flood risk zone
            settlements_query = db.session.query(
                Settlements.fid, Settlements.vdc_name, Settlements.dist_name,
                ST_AsGeoJSON(Settlements.geom).label('geojson_geom')
            ).filter(
                ST_Intersects(Settlements.geom, combined_river_buffer_geom)
            ).all()
            for row in settlements_query:
                affected_settlements["features"].append(row_to_geojson_feature(row))

            # Find roads within the flood risk zone
            roads_query = db.session.query(
                Roads.fid, Roads.road_code, Roads.type,
                ST_AsGeoJSON(Roads.geom).label('geojson_geom')
            ).filter(
                ST_Intersects(Roads.geom, combined_river_buffer_geom)
            ).all()
            for row in roads_query:
                affected_roads["features"].append(row_to_geojson_feature(row))

        return jsonify({
            "flood_risk_zones": flood_risk_zones,
            "affected_settlements": affected_settlements,
            "affected_roads": affected_roads,
            "simulated_rainfall_intensity": rainfall_intensity
        })

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in flash_flood_warning: {e}")
        return error_response(f"Error during flash flood warning analysis: {e}")

# ===============================================
# 3. Emergency Response Route Optimization (Simplified)
# ===============================================
# Dummy model for Shelters (for demonstration purposes)
# In a real application, this model would likely be in models.py
# and populated with actual critical facility data.
class Shelters(db.Model):
    __tablename__ = 'shelters'
    fid = db.Column(db.Integer, primary_key=True)
    geom = db.Column(GeometryType('POINT', srid=4326))
    name = db.Column(db.String)
    capacity = db.Column(db.Integer)
    type = db.Column(db.String) # e.g., 'hospital', 'school', 'community_hall', 'district_hq'

# Helper function to add dummy shelters if the table is empty.
# This should be called once, for example, within `app.py`'s `if __name__ == '__main__':` block.
def add_dummy_shelters():
    with db.session.begin_nested():
        if Shelters.query.count() == 0:
            print("Adding dummy shelters...")
            dummy_shelters = [
                Shelters(name="Kathmandu Hospital", capacity=500, type="hospital", geom=func.ST_SetSRID(func.ST_MakePoint(85.3197, 27.7000), 4326)),
                Shelters(name="Pokhara Community Hall", capacity=300, type="community_hall", geom=func.ST_SetSRID(func.ST_MakePoint(83.9856, 28.2096), 4326)),
                Shelters(name="Biratnagar School", capacity=200, type="school", geom=func.ST_SetSRID(func.ST_MakePoint(87.28, 26.45), 4326)),
                Shelters(name="Hetauda District HQ", capacity=100, type="district_hq", geom=func.ST_SetSRID(func.ST_MakePoint(85.03, 27.43), 4326)),
                Shelters(name="Chitwan Police Station", capacity=50, type="police_station", geom=func.ST_SetSRID(func.ST_MakePoint(84.49, 27.68), 4326)),
            ]
            db.session.add_all(dummy_shelters)
            db.session.commit()
            print("Dummy shelters added.")
        else:
            print("Shelters table already has data, skipping dummy data insertion.")

@spatial_bp.route('/accessibility', methods=['GET'])
def accessibility_analysis():
    """
    Calculates simplified accessibility (straight-line route) from a selected settlement
    to the closest critical facility of a specified type.
    This is NOT a true network routing algorithm (which would require pgRouting or similar),
    but provides a basic distance and time approximation.
    Parameters:
        start_fid (int): FID of the starting settlement (incident location).
        facility_type (str): Type of critical facility to find ('hospital', 'school', 'community_hall', 'district_hq').
    Returns:
        GeoJSON FeatureCollection of the calculated route and the target facility.
    """
    try:
        start_fid = request.args.get('start_fid', type=int)
        facility_type = request.args.get('facility_type', 'district_hq')

        if not start_fid:
            return jsonify({"error": "Starting settlement FID is required."}), 400

        start_settlement = db.session.query(Settlements).filter_by(fid=start_fid).first()
        if not start_settlement or not start_settlement.geom:
            return jsonify({"error": "Starting settlement not found or has no geometry."}), 404

        target_facility = None
        target_facility_geom = None
        target_facility_name = "Unknown Facility"
        target_facility_type = facility_type.replace('_', ' ').title() # Format for display

        # Logic to find the closest facility based on type
        if facility_type == 'district_hq':
            # Find the district containing the starting settlement
            district_of_settlement = db.session.query(Districts).filter(
                ST_Intersects(Districts.geom, start_settlement.geom)
            ).first()

            if district_of_settlement:
                # Use the centroid of the district as the "District HQ" location proxy
                target_facility_geom = ST_Centroid(district_of_settlement.geom)
                target_facility_name = f"{district_of_settlement.district} District HQ"
                target_facility_type = "District Headquarters"
                # Create a dummy Shelters object for consistent return structure
                target_facility = Shelters(name=target_facility_name, type=target_facility_type, capacity='N/A', geom=target_facility_geom)
            else:
                # Fallback to nearest dummy District HQ if settlement is not within a known district
                target_facility = db.session.query(Shelters).filter_by(type='district_hq').order_by(
                    ST_Distance(ST_Transform(Shelters.geom, 32645), ST_Transform(start_settlement.geom, 32645))
                ).first()
                if target_facility:
                    target_facility_geom = target_facility.geom
                    target_facility_name = target_facility.name
                    target_facility_type = target_facility.type
        else:
            # Query the Shelters table for other facility types
            target_facility = db.session.query(Shelters).filter_by(type=facility_type).order_by(
                ST_Distance(ST_Transform(Shelters.geom, 32645), ST_Transform(start_settlement.geom, 32645))
            ).first()
            if target_facility and target_facility.geom:
                target_facility_geom = target_facility.geom
                target_facility_name = target_facility.name
                target_facility_type = target_facility.type
        
        if not target_facility_geom:
            return jsonify({"error": f"No suitable {facility_type.replace('_', ' ')} found or could be approximated."}), 404
        
        # Calculate straight-line distance (in meters)
        distance_meters = db.session.query(
            ST_Distance(
                ST_Transform(start_settlement.geom, 32645),
                ST_Transform(target_facility_geom, 32645)
            )
        ).scalar()

        # Assume average travel speed (e.g., 30 km/h or 8.33 m/s) for approximation
        average_speed_mps = 8.33 # meters per second (approx 30 km/h)
        travel_time_seconds = distance_meters / average_speed_mps
        travel_time_minutes = travel_time_seconds / 60

        # Create a straight line (route) between the settlement and the facility
        # Assuming Settlements.geom is MULTIPOINT, taking the first point
        route_geom = func.ST_MakeLine(
            func.ST_GeometryN(start_settlement.geom, 1), 
            target_facility_geom
        )

        routes_collection = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(route_geom)).scalar()),
                "properties": {
                    "from_settlement_fid": start_fid,
                    "to_facility_name": target_facility_name,
                    "to_facility_type": target_facility_type,
                    "distance_meters": round(distance_meters, 2),
                    "travel_time_min": round(travel_time_minutes, 2),
                    "route_type": "straight_line_approximation"
                }
            }]
        }

        facilities_collection = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(target_facility_geom)).scalar()),
                "properties": {
                    "name": target_facility_name,
                    "type": target_facility_type,
                    "capacity": target_facility.capacity if target_facility and hasattr(target_facility, 'capacity') else 'N/A'
                }
            }]
        }

        return jsonify({
            "routes": routes_collection,
            "facilities": facilities_collection
        })

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in accessibility_analysis: {e}")
        return error_response(f"Error during accessibility analysis: {e}")

# ===============================================
# 4. Population Evacuation Planning and Shelter Capacity Assessment (Simplified)
# ===============================================
@spatial_bp.route('/evacuation-planning', methods=['GET'])
def evacuation_planning():
    """
    Identifies nearest shelters for an affected settlement and assesses capacity.
    Requires a 'population_estimate' for the affected settlement (simulated).
    Parameters:
        affected_settlement_fid (int): FID of the settlement requiring evacuation.
        population_estimate (int): Estimated number of people needing shelter.
    Returns:
        GeoJSON FeatureCollection of evacuation routes, available shelters, and capacity assessment.
    """
    try:
        affected_settlement_fid = request.args.get('affected_settlement_fid', type=int)
        estimated_population = int(request.args.get('population_estimate', 1000)) # Default 1000 people

        if not affected_settlement_fid:
            return jsonify({"error": "Affected settlement FID is required."}), 400

        affected_settlement = db.session.query(Settlements).filter_by(fid=affected_settlement_fid).first()
        if not affected_settlement or not affected_settlement.geom:
            return jsonify({"error": "Affected settlement not found or has no geometry."}), 404

        # Find nearby shelters (e.g., within 20km radius)
        # Order by distance to prioritize closest ones for evacuation planning.
        nearby_shelters_query = db.session.query(
            Shelters.fid,
            Shelters.name,
            Shelters.capacity,
            Shelters.type,
            ST_AsGeoJSON(Shelters.geom).label('geojson_geom'),
            ST_Distance(
                ST_Transform(Shelters.geom, 32645),
                ST_Transform(affected_settlement.geom, 32645)
            ).label('distance_meters')
        ).filter(
            ST_DWithin(ST_Transform(Shelters.geom, 32645), ST_Transform(affected_settlement.geom, 32645), 20000) # Within 20 km
        ).order_by('distance_meters').all()

        evacuation_routes = {
            "type": "FeatureCollection",
            "features": []
        }
        available_shelters = {
            "type": "FeatureCollection",
            "features": []
        }
        total_shelter_capacity = 0
        
        for shelter_row in nearby_shelters_query:
            total_shelter_capacity += shelter_row.capacity if shelter_row.capacity else 0
            available_shelters["features"].append(
                row_to_geojson_feature(shelter_row, properties_to_exclude=['geojson_geom', 'distance_meters'])
            )

            # Create a simplified route (straight line) from the affected settlement to each nearby shelter
            route_geom = func.ST_MakeLine(
                func.ST_GeometryN(affected_settlement.geom, 1), # Assuming multipoint, take first point
                func.ST_GeometryN(shelter_row.geom, 1) # Assuming point geometry for shelters
            )
            evacuation_routes["features"].append({
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(route_geom)).scalar()),
                "properties": {
                    "from_settlement_fid": affected_settlement_fid,
                    "to_shelter_name": shelter_row.name,
                    "to_shelter_fid": shelter_row.fid,
                    "distance_meters": round(shelter_row.distance_meters, 2),
                    "shelter_capacity": shelter_row.capacity
                }
            })
        
        capacity_assessment = {
            "estimated_population": estimated_population,
            "total_nearby_shelter_capacity": total_shelter_capacity,
            "capacity_sufficient": total_shelter_capacity >= estimated_population
        }

        return jsonify({
            "affected_settlement": row_to_geojson_feature(affected_settlement, geom_column_name=ST_AsGeoJSON(affected_settlement.geom).label('geojson_geom')),
            "evacuation_routes": evacuation_routes,
            "available_shelters": available_shelters,
            "capacity_assessment": capacity_assessment
        })

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in evacuation_planning: {e}")
        return error_response(f"Error during evacuation planning: {e}")

# ===============================================
# 5. Administrative Unit Comparative Vulnerability Profiling
# ===============================================
@spatial_bp.route('/vulnerability-profiling', methods=['GET'])
def vulnerability_profiling():
    """
    Provides a comparative vulnerability profile for selected administrative units.
    Calculates various metrics like settlement density, road density, river proximity,
    and historical fire incident counts.
    Parameters:
        unit_type (str): 'local_unit' or 'district' to specify the administrative level.
        fids (str): Comma-separated FIDs of the selected units for analysis.
    Returns:
        JSON object containing vulnerability profiles for each selected unit.
    """
    try:
        unit_type = request.args.get('unit_type', 'local_unit')
        fids_str = request.args.get('fids')

        if not fids_str:
            return jsonify({"error": "FIDs of administrative units are required."}), 400
        
        selected_fids = [int(f) for f in fids_str.split(',')]

        if unit_type == 'local_unit':
            UnitModel = LocalUnits
            unit_name_col = LocalUnits.gapa_napa
        elif unit_type == 'district':
            UnitModel = Districts
            unit_name_col = Districts.district
        else:
            return jsonify({"error": "Invalid unit_type. Must be 'local_unit' or 'district'."}), 400

        vulnerability_profiles = []

        for fid in selected_fids:
            unit = db.session.query(UnitModel).filter_by(fid=fid).first()
            if not unit or not unit.geom:
                vulnerability_profiles.append({"fid": fid, "error": f"Unit with FID {fid} not found or has no geometry."})
                continue

            unit_geom_4326 = unit.geom # Geometry in WGS84
            unit_geom_32645 = ST_Transform(unit.geom, 32645) # Geometry in UTM for calculations
            unit_area_sqm = db.session.query(ST_Area(unit_geom_32645)).scalar() # Area in square meters

            # 1. Settlement Density: Count of settlements within the unit's boundary
            settlement_count = db.session.query(Settlements).filter(
                ST_Intersects(Settlements.geom, unit_geom_4326)
            ).count()
            settlement_density = (settlement_count / unit_area_sqm) * 1000000 if unit_area_sqm else 0 # per sq km

            # 2. Road Network Density: Total length of roads within the unit's boundary
            road_length_m = db.session.query(
                func.sum(ST_Length(ST_Intersection(ST_Transform(Roads.geom, 32645), unit_geom_32645)))
            ).filter(
                ST_Intersects(Roads.geom, unit_geom_4326)
            ).scalar() or 0
            road_density = (road_length_m / unit_area_sqm) * 1000 if unit_area_sqm else 0 # km per sq km

            # 3. Proximity to Rivers: Average distance of settlements to the nearest river within the unit
            # This is a complex query, simplified here by averaging distances to *any* river.
            # A more robust approach would be to find the closest river for each settlement and then average those distances.
            avg_dist_to_river = db.session.query(
                func.avg(ST_Distance(ST_Transform(Settlements.geom, 32645), ST_Transform(Rivers.geom, 32645)))
            ).filter(
                ST_Intersects(Settlements.geom, unit_geom_4326)
            ).scalar()
            avg_dist_to_river = round(avg_dist_to_river, 2) if avg_dist_to_river else 'N/A' # in meters

            # 4. Historical Fire Incident Counts (last 365 days): Sum of fire incidents from Fire1 and Fire2 tables
            fire_count_1 = db.session.query(Fire1).filter(
                Fire1.acq_date >= int((datetime.now(UTC) - timedelta(days=365)).timestamp() * 1000), # Filter by timestamp
                ST_Intersects(Fire1.geom, unit_geom_4326)
            ).count()
            fire_count_2 = db.session.query(Fire2).filter(
                Fire2.acq_date >= int((datetime.now(UTC) - timedelta(days=365)).timestamp() * 1000),
                ST_Intersects(Fire2.geom, unit_geom_4326)
            ).count()
            total_fire_incidents = fire_count_1 + fire_count_2

            # 5. Estimated Exposure to Earthquake Intensity / AQI (Simplified Proxies)
            # These are simplified checks. In a real system, you'd query pre-computed hazard layers
            # or run more complex models.
            
            # Proxy for Earthquake Exposure: Check if any settlement within the unit is near a hypothetical earthquake hotspot
            has_earthquake_exposure = db.session.query(Settlements).filter(
                ST_Intersects(Settlements.geom, unit_geom_4326),
                ST_DWithin(ST_Transform(Settlements.geom, 32645), ST_Transform(func.ST_SetSRID(func.ST_MakePoint(85.3, 27.7), 4326), 32645), 20000) # within 20km of Kathmandu (proxy)
            ).first() is not None

            # Proxy for AQI Exposure: Check if any settlement within the unit is near a hypothetical high AQI area
            has_aqi_exposure = db.session.query(Settlements).filter(
                ST_Intersects(Settlements.geom, unit_geom_4326),
                ST_DWithin(ST_Transform(Settlements.geom, 32645), ST_Transform(func.ST_SetSRID(func.ST_MakePoint(85.3, 27.7), 4326), 32645), 10000) # within 10km of Kathmandu (proxy)
            ).first() is not None

            profile = {
                "fid": unit.fid,
                "name": getattr(unit, unit_name_col.name),
                "type": unit_type,
                "area_sq_km": round(unit_area_sqm / 1000000, 2) if unit_area_sqm else 0,
                "settlement_count": settlement_count,
                "settlement_density_per_sqkm": round(settlement_density, 4),
                "road_length_km": round(road_length_m / 1000, 2),
                "road_density_km_per_sqkm": round(road_density, 4),
                "avg_dist_to_river_m": avg_dist_to_river,
                "historical_fire_incidents_last_year": total_fire_incidents,
                "has_earthquake_exposure_proxy": has_earthquake_exposure,
                "has_aqi_exposure_proxy": has_aqi_exposure
            }
            vulnerability_profiles.append(profile)

        return jsonify({"profiles": vulnerability_profiles})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in vulnerability_profiling: {e}")
        return error_response(f"Error during vulnerability profiling: {e}")

# ===============================================
# River Morphology and Hydrological Impact Analysis (Simplified)
# This was originally the 6th tool in the previous list, but now fits as one of the 5.
# ===============================================
@spatial_bp.route('/river-morphology', methods=['GET'])
def river_morphology_analysis():
    """
    Performs simplified river morphology analysis for a selected river segment.
    - Steepness/Gradient: Calculates the slope based on start/end points (requires elevation data, simplified here).
    - Confluence Points: Identifies points where the selected river segment meets another river.
    - Sinuosity: Measures how winding a river is (length of river / straight-line distance).
    Parameters:
        river_fid (int): FID of the selected river segment.
        analysis_type (str): Type of morphological analysis ('steepness', 'confluence', 'sinuosity').
    Returns:
        GeoJSON FeatureCollection of the analysis results.
    """
    try:
        river_fid = request.args.get('river_fid', type=int)
        analysis_type = request.args.get('analysis_type', 'steepness')

        if not river_fid:
            return jsonify({"error": "River FID is required."}), 400

        selected_river = db.session.query(Rivers).filter_by(fid=river_fid).first()
        if not selected_river or not selected_river.geom:
            return jsonify({"error": "Selected river not found or has no geometry."}), 404

        morphology_features = {
            "type": "FeatureCollection",
            "features": []
        }

        if analysis_type == 'steepness':
            # Simplified steepness: requires elevation data which is not in current models.
            # For demonstration, we'll return the river segment with a placeholder steepness based on its length.
            
            river_length_m = db.session.query(ST_Length(ST_Transform(selected_river.geom, 32645))).scalar() or 0
            
            # Simulate a gradient: assume a hypothetical elevation drop (e.g., 1 meter per 1000 meters of length)
            hypothetical_elevation_drop = (river_length_m / 1000) * 1 
            
            # Steepness as a ratio (rise/run)
            steepness_ratio = hypothetical_elevation_drop / river_length_m if river_length_m > 0 else 0

            morphology_features["features"].append({
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(selected_river.geom)).scalar()),
                "properties": {
                    "analysis_type": "steepness",
                    "river_fid": selected_river.fid,
                    "river_length_m": round(river_length_m, 2),
                    "simulated_steepness_ratio": round(steepness_ratio, 4),
                    "steepness_category": "High" if steepness_ratio > 0.005 else ("Medium" if steepness_ratio > 0.001 else "Low")
                }
            })

        elif analysis_type == 'confluence':
            # Identify points where the selected river segment meets another river.
            confluence_points = []
            
            # Get start and end points of the selected river segment
            start_point_geom = db.session.query(ST_StartPoint(selected_river.geom)).scalar()
            end_point_geom = db.session.query(ST_EndPoint(selected_river.geom)).scalar()

            # Check for intersections with other rivers near start/end points using a small buffer
            buffer_size_m = 10 # Buffer to account for slight inaccuracies or near-intersections
            start_buffer = ST_Transform(ST_Buffer(ST_Transform(start_point_geom, 32645), buffer_size_m), 4326)
            end_buffer = ST_Transform(ST_Buffer(ST_Transform(end_point_geom, 32645), buffer_size_m), 4326)

            intersecting_rivers = db.session.query(Rivers).filter(
                Rivers.fid != selected_river.fid, # Exclude the selected river itself
                or_(
                    ST_Intersects(Rivers.geom, start_buffer),
                    ST_Intersects(Rivers.geom, end_buffer)
                )
            ).all()

            for other_river in intersecting_rivers:
                # Find the actual intersection geometry
                intersection_geom = db.session.query(
                    ST_Intersection(selected_river.geom, other_river.geom)
                ).scalar()
                
                if intersection_geom:
                    # If the intersection is a point or multipoint, extract individual points
                    geom_type = db.session.query(func.ST_GeometryType(intersection_geom)).scalar()
                    if geom_type == 'ST_Point':
                        confluence_points.append(json.loads(db.session.query(ST_AsGeoJSON(intersection_geom)).scalar()))
                    elif geom_type == 'ST_MultiPoint':
                        num_points = db.session.query(func.ST_NumGeometries(intersection_geom)).scalar()
                        for i in range(1, num_points + 1):
                            single_point = db.session.query(func.ST_GeometryN(intersection_geom, i)).scalar()
                            confluence_points.append(json.loads(db.session.query(ST_AsGeoJSON(single_point)).scalar()))

            for point_geojson in confluence_points:
                morphology_features["features"].append({
                    "type": "Feature",
                    "geometry": point_geojson,
                    "properties": {
                        "analysis_type": "confluence",
                        "river_fid": selected_river.fid,
                        "description": "Confluence Point"
                    }
                })

        elif analysis_type == 'sinuosity':
            # Sinuosity = actual river length / straight-line distance between endpoints
            river_length_m = db.session.query(ST_Length(ST_Transform(selected_river.geom, 32645))).scalar() or 0

            # Get start and end points and calculate straight line distance between them
            start_point_geom = db.session.query(ST_StartPoint(selected_river.geom)).scalar()
            end_point_geom = db.session.query(ST_EndPoint(selected_river.geom)).scalar()
            
            if start_point_geom and end_point_geom:
                straight_line_dist_m = db.session.query(
                    ST_Distance(
                        ST_Transform(start_point_geom, 32645),
                        ST_Transform(end_point_geom, 32645)
                    )
                ).scalar() or 0
            else:
                straight_line_dist_m = 0 # Handle cases where start/end points might be null or invalid

            sinuosity_ratio = river_length_m / straight_line_dist_m if straight_line_dist_m > 0 else 1.0 # Default to 1 if no length or zero straight-line distance

            morphology_features["features"].append({
                "type": "Feature",
                "geometry": json.loads(db.session.query(ST_AsGeoJSON(selected_river.geom)).scalar()),
                "properties": {
                    "analysis_type": "sinuosity",
                    "river_fid": selected_river.fid,
                    "river_length_m": round(river_length_m, 2),
                    "straight_line_distance_m": round(straight_line_dist_m, 2),
                    "sinuosity_ratio": round(sinuosity_ratio, 2),
                    "sinuosity_category": "Highly Meandering" if sinuosity_ratio > 1.5 else ("Moderately Meandering" if sinuosity_ratio > 1.2 else "Straight")
                }
            })

        return jsonify({"morphology_features": morphology_features})

    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: An error occurred in river_morphology_analysis: {e}")
        return error_response(f"Error during river morphology analysis: {e}")


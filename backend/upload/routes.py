import os
import tempfile
import zipfile
import geopandas as gpd
from flask import Blueprint, request, jsonify, send_file

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/api/upload', methods=['POST'])
def upload_spatial_data():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        filename = file.filename.lower()

        if filename.endswith('.zip'):
            # Save zip to temp file
            temp_dir = tempfile.mkdtemp()
            zip_path = os.path.join(temp_dir, 'upload.zip')
            file.save(zip_path)

            # Extract zip
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # Find .shp file
            shp_files = [f for f in os.listdir(temp_dir) if f.endswith('.shp')]
            if not shp_files:
                return jsonify({"error": "No .shp file found in zip"}), 400

            shp_path = os.path.join(temp_dir, shp_files[0])
            gdf = gpd.read_file(shp_path)

        elif filename.endswith('.geojson') or filename.endswith('.json'):
            gdf = gpd.read_file(file)
        else:
            return jsonify({"error": "Unsupported file format. Upload .zip (shapefile) or .geojson"}), 400

        # For demo: Return basic info about uploaded data
        return jsonify({
            "message": "File uploaded successfully",
            "num_features": len(gdf),
            "columns": list(gdf.columns)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@upload_bp.route('/api/download', methods=['POST'])
def download_analysis_result():
    try:
        geojson_data = request.get_json()

        if not geojson_data:
            return jsonify({"error": "No GeoJSON data received"}), 400

        # Create GeoDataFrame from input GeoJSON
        gdf = gpd.GeoDataFrame.from_features(geojson_data["features"])

        # Save to temp GeoJSON file
        temp_dir = tempfile.mkdtemp()
        geojson_path = os.path.join(temp_dir, "result.geojson")
        gdf.to_file(geojson_path, driver='GeoJSON')

        # Send file for download
        return send_file(geojson_path, as_attachment=True, download_name="result.geojson")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@upload_bp.route('/api/upload/buffer', methods=['POST'])
def upload_and_buffer():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        filename = file.filename.lower()

        if filename.endswith('.zip'):
            temp_dir = tempfile.mkdtemp()
            zip_path = os.path.join(temp_dir, 'upload.zip')
            file.save(zip_path)

            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            shp_files = [f for f in os.listdir(temp_dir) if f.endswith('.shp')]
            if not shp_files:
                return jsonify({"error": "No .shp file found in zip"}), 400

            shp_path = os.path.join(temp_dir, shp_files[0])
            gdf = gpd.read_file(shp_path)

        elif filename.endswith('.geojson') or filename.endswith('.json'):
            gdf = gpd.read_file(file)
        else:
            return jsonify({"error": "Unsupported file format. Upload .zip (shapefile) or .geojson"}), 400

        # Buffer distance (meters) - default 500, can be sent in JSON too
        buffer_dist = request.form.get('buffer_dist', 500, type=float)

        # Check CRS, reproject to metric if needed
        if gdf.crs is None or not gdf.crs.is_projected:
            # Project to UTM zone for Nepal (e.g., EPSG:32645)
            gdf = gdf.to_crs(epsg=32645)

        # Create buffer
        gdf['geometry'] = gdf.geometry.buffer(buffer_dist)

        # Reproject back to WGS84 for GeoJSON output
        gdf = gdf.to_crs(epsg=4326)

        # Convert to GeoJSON features
        geojson = gdf.__geo_interface__

        return jsonify(geojson)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

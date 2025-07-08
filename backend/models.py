from flask_sqlalchemy import SQLAlchemy
from geoalchemy2.types import Geometry as GeometryType
from sqlalchemy import Column, Integer, String, Float, BigInteger

db = SQLAlchemy()

class LocalUnits(db.Model):
    __tablename__ = 'local_units'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOLYGON', srid=4326))
    fid_1 = Column(Integer)
    state_code = Column(Integer)
    district = Column(String)
    gapa_napa = Column(String)
    type_gn = Column(String)
    province = Column(String)

class Provinces(db.Model):
    __tablename__ = 'provinces'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOLYGON', srid=4326))
    fid_1 = Column(Integer)
    first_stat = Column(Integer)

class Rivers(db.Model):
    __tablename__ = 'rivers'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTILINESTRING', srid=4326))
    fnode = Column(Integer)
    tnode = Column(Integer)
    river_code = Column(Integer)
    shape_len = Column(Float)

class Settlements(db.Model):
    __tablename__ = 'settlements'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOINT', srid=4326))
    vdc_name = Column(String)
    dist_name = Column(String)

class Roads(db.Model):
    __tablename__ = 'roads'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTILINESTRING', srid=4326))
    fnode = Column(Integer)
    tnode = Column(Integer)
    road_code = Column(String)
    type = Column(String)
    shape_len = Column(Float)

class IndexSheet(db.Model):
    __tablename__ = 'index_sheet'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOLYGON', srid=4326))
    oid_ = Column(Integer)
    name = Column(String)
    folderpath = Column(String)
    symbolid = Column(Integer)
    altmode = Column(Integer)
    base = Column(Integer)
    clamped = Column(Integer)
    extruded = Column(Integer)
    snippet = Column(Integer)
    popupinfo = Column(String)
    shape_leng = Column(Float)
    shape_area = Column(Float)

class Fire2(db.Model):
    __tablename__ = 'fire2'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOINT', srid=4326))
    latitude = Column(Float)
    longitude = Column(Float)
    brightness = Column(Float)
    scan = Column(Float)
    track = Column(Float)
    acq_date = Column(BigInteger)
    acq_time = Column(String)
    satellite = Column(String)
    instrument = Column(String)
    confidence = Column(Integer)
    version = Column(String)
    bright_t31 = Column(Float)
    frp = Column(Float)
    daynight = Column(String)
    type = Column(Integer)

class Fire1(db.Model):
    __tablename__ = 'fire1'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOINT', srid=4326))
    latitude = Column(Float)
    longitude = Column(Float)
    brightness = Column(Float)
    scan = Column(Float)
    track = Column(Float)
    acq_date = Column(BigInteger)
    acq_time = Column(String)
    satellite = Column(String)
    instrument = Column(String)
    confidence = Column(Integer)
    version = Column(String)
    bright_t31 = Column(Float)
    frp = Column(Float)
    daynight = Column(String)

class Districts(db.Model):
    __tablename__ = 'districts'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOLYGON', srid=4326))
    fid_1 = Column(Integer)
    district = Column(String)
    first_stat = Column(Integer)
    first_dist = Column(String)

class Boundary(db.Model):
    __tablename__ = 'boundary'
    fid = Column(Integer, primary_key=True)
    geom = Column(GeometryType('MULTIPOLYGON', srid=4326))
    fid_1 = Column(Integer)
    id = Column(Integer)
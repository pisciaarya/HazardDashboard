class MapTools {
  constructor(map) {
    this.map = map;
    this.initTools();
  }

  initTools() {
    // Add zoom control
    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    
    // Add scale control
    L.control.scale().addTo(this.map);
    
    // Add locate control
    L.control.locate({
      position: 'topleft',
      strings: { title: "Locate Me" }
    }).addTo(this.map);
  }
}
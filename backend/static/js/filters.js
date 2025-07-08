class MapFilters {
  constructor(map, layers) {
    this.map = map;
    this.layers = layers;
    this.activeFilters = {};
    this.init();
  }

  init() {
    // DOM elements
    this.panel = document.getElementById('filter-panel');
    this.toggleBtn = document.getElementById('filter-toggle');
    this.closeBtn = document.getElementById('close-filters');
    this.applyBtn = document.getElementById('apply-filters');
    this.resetBtn = document.getElementById('reset-filters');
    
    // Filter inputs
    this.provinceSelect = document.getElementById('province-filter');
    this.districtSelect = document.getElementById('district-filter');
    this.hazardSelect = document.getElementById('hazard-filter');
    this.dateSelect = document.getElementById('date-filter');
    this.startDate = document.getElementById('start-date');
    this.endDate = document.getElementById('end-date');
    
    // Event listeners
    this.toggleBtn.addEventListener('click', () => this.togglePanel());
    this.closeBtn.addEventListener('click', () => this.togglePanel(false));
    this.applyBtn.addEventListener('click', () => this.applyFilters());
    this.resetBtn.addEventListener('click', () => this.resetFilters());
    
    this.provinceSelect.addEventListener('change', () => this.onProvinceChange());
    this.dateSelect.addEventListener('change', () => this.toggleCustomDateRange());
    
    // Initialize with sample data (replace with your actual data loading)
    this.loadProvinces();
    this.togglePanel(false); // Start with panel closed
  }

  togglePanel(show = null) {
    if (show === null) {
      this.panel.classList.toggle('active');
    } else {
      show ? this.panel.classList.add('active') : this.panel.classList.remove('active');
    }
  }

  async loadProvinces() {
    try {
      // Replace with your actual data loading
      const response = await fetch('/api/provinces');
      const data = await response.json();
      
      // Clear existing options
      this.provinceSelect.innerHTML = '<option value="">All Provinces</option>';
      
      // Add new options
      data.forEach(province => {
        const option = document.createElement('option');
        option.value = province.id;
        option.textContent = province.name;
        this.provinceSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading provinces:', error);
    }
  }

  async onProvinceChange() {
    const provinceId = this.provinceSelect.value;
    this.districtSelect.disabled = !provinceId;
    this.districtSelect.innerHTML = '<option value="">All Districts</option>';
    
    if (!provinceId) return;
    
    try {
      // Replace with your actual data loading
      const response = await fetch(`/api/districts?province=${provinceId}`);
      const data = await response.json();
      
      data.forEach(district => {
        const option = document.createElement('option');
        option.value = district.id;
        option.textContent = district.name;
        this.districtSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading districts:', error);
    }
  }

  toggleCustomDateRange() {
    const showCustom = this.dateSelect.value === 'custom';
    document.getElementById('custom-date-range').style.display = showCustom ? 'block' : 'none';
  }

  applyFilters() {
    this.activeFilters = {
      province: this.provinceSelect.value,
      district: this.districtSelect.value,
      hazardType: this.hazardSelect.value,
      dateRange: this.getDateRangeFilter()
    };
    
    console.log('Applying filters:', this.activeFilters);
    
    // Apply filters to each layer
    this.filterLayer(this.layers.settlementLayer, this.filterSettlements.bind(this));
    this.filterLayer(this.layers.hazardLayer, this.filterHazards.bind(this));
    this.filterLayer(this.layers.fireLayer, this.filterFires.bind(this));
    
    this.togglePanel(false);
  }

  getDateRangeFilter() {
    const range = this.dateSelect.value;
    if (range === 'custom') {
      return {
        start: this.startDate.value,
        end: this.endDate.value
      };
    }
    
    const now = new Date();
    const start = new Date();
    
    switch (range) {
      case '7days': start.setDate(now.getDate() - 7); break;
      case '30days': start.setDate(now.getDate() - 30); break;
      case '1year': start.setFullYear(now.getFullYear() - 1); break;
      default: return null;
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    };
  }

  filterLayer(layerGroup, filterFn) {
    if (!layerGroup) return;
    
    layerGroup.eachLayer(layer => {
      const feature = layer.feature;
      const matches = filterFn(feature);
      
      if (matches) {
        if (!this.map.hasLayer(layer)) {
          layerGroup.addLayer(layer);
        }
      } else {
        if (this.map.hasLayer(layer)) {
          layerGroup.removeLayer(layer);
        }
      }
    });
  }

  filterSettlements(feature) {
    const props = feature.properties;
    
    // Province filter
    if (this.activeFilters.province && props.province_id !== this.activeFilters.province) {
      return false;
    }
    
    // District filter
    if (this.activeFilters.district && props.district_id !== this.activeFilters.district) {
      return false;
    }
    
    return true;
  }

  filterHazards(feature) {
    const props = feature.properties;
    
    // Hazard type filter
    if (this.activeFilters.hazardType && props.type !== this.activeFilters.hazardType) {
      return false;
    }
    
    // Date filter
    if (this.activeFilters.dateRange && props.date) {
      const featureDate = new Date(props.date).toISOString().split('T')[0];
      if (featureDate < this.activeFilters.dateRange.start || 
          featureDate > this.activeFilters.dateRange.end) {
        return false;
      }
    }
    
    return true;
  }

  filterFires(feature) {
    // Special handling for fire data
    if (this.activeFilters.hazardType && this.activeFilters.hazardType !== 'fire') {
      return false;
    }
    
    // Date filter for fires
    if (this.activeFilters.dateRange && feature.properties.date) {
      const fireDate = new Date(feature.properties.date).toISOString().split('T')[0];
      if (fireDate < this.activeFilters.dateRange.start || 
          fireDate > this.activeFilters.dateRange.end) {
        return false;
      }
    }
    
    return true;
  }

  resetFilters() {
    // Reset form inputs
    this.provinceSelect.value = '';
    this.districtSelect.value = '';
    this.districtSelect.disabled = true;
    this.hazardSelect.value = '';
    this.dateSelect.value = 'all';
    this.startDate.value = '';
    this.endDate.value = '';
    document.getElementById('custom-date-range').style.display = 'none';
    
    // Clear active filters
    this.activeFilters = {};
    
    // Reset all layers
    Object.values(this.layers).forEach(layer => {
      if (layer) layer.eachLayer(l => {
        if (!this.map.hasLayer(l)) layer.addLayer(l);
      });
    });
    
    this.togglePanel(false);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.map && window.layerControl) {
    new MapFilters(window.map, window.allLayerGroups);
  }
});
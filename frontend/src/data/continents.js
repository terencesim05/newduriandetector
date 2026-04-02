/**
 * Country borders from Natural Earth 110m TopoJSON via world-atlas.
 * Exports GeoJSON features with polygon coordinates for globe rendering.
 */
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-50m.json';
import landData from 'world-atlas/land-50m.json';

// Convert TopoJSON -> GeoJSON FeatureCollection
const countries = feature(worldData, worldData.objects.countries);

/**
 * Extract all polygon rings (outer boundaries) from the GeoJSON features.
 * Returns array of arrays of [lat, lon] pairs — one array per border ring.
 */
export function getCountryBorders() {
  const rings = [];
  for (const feat of countries.features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        rings.push(ring.map(([lon, lat]) => [lat, lon]));
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          rings.push(ring.map(([lon, lat]) => [lat, lon]));
        }
      }
    }
  }
  return rings;
}

/**
 * Get merged land polygons for filled rendering (no internal borders).
 * Uses the separate land topology for cleaner shapes.
 */
const land = feature(landData, landData.objects.land);

export function getLandOutlines() {
  const outlines = [];
  for (const feat of land.features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      outlines.push(geom.coordinates[0].map(([lon, lat]) => [lat, lon]));
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        outlines.push(polygon[0].map(([lon, lat]) => [lat, lon]));
      }
    }
  }
  return outlines;
}

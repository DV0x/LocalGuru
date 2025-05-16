'use client'

import * as React from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import Map, { 
  NavigationControl, 
  GeolocateControl, 
  Source, 
  Layer, 
  Popup,
  MapRef 
} from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import type { Feature, FeatureCollection, Geometry, Point, GeoJsonProperties } from 'geojson';
import type { MapboxGeoJSONFeature, MapLayerMouseEvent, PointLike } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapContext } from '../../contexts/map-context';

interface InteractiveMapProps {
  initialLocation?: {
    longitude: number;
    latitude: number;
  };
  initialZoom?: number;
}

// Layer styles
const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  source: 'search-results',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#8A63D2', // Light purple for small clusters
      5,
      '#6F1ED6', // Medium purple for medium clusters
      20,
      '#4A148C'  // Dark purple for large clusters
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      20, // radius for point_count < 5
      5,
      25, // radius for point_count >= 5 and < 20
      20,
      35 // radius for point_count >= 20
    ],
    'circle-stroke-width': 3,
    'circle-stroke-color': 'rgba(255, 255, 255, 0.3)',
    'circle-stroke-opacity': 0.5
  }
};

const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'search-results',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12
  },
  paint: {
    'text-color': '#ffffff'
  }
};

const unclusteredPointLayer: LayerProps = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'search-results',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#6F1ED6',
    'circle-radius': 10,
    'circle-stroke-width': 2,
    'circle-stroke-color': 'white',
    'circle-opacity': 0.9
  }
};

// Add a text layer for unclustered points
const pointLabelLayer: LayerProps = {
  id: 'unclustered-point-label',
  type: 'symbol',
  source: 'search-results',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 11,
    'text-offset': [0, 1.5],
    'text-anchor': 'top',
    'text-allow-overlap': false,
    'text-ignore-placement': false
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1
  }
};

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  initialLocation = { longitude: -122.4, latitude: 37.78 },
  initialZoom = 12
}) => {
  const { 
    mapRef, 
    viewState, 
    updateViewState, 
    searchResultFeatures,
    selectedFeatureId,
    setSelectedFeatureId
  } = useMapContext();
  
  const [popupInfo, setPopupInfo] = useState<{
    longitude: number;
    latitude: number;
    name: string;
    address?: string;
    category?: string;
    price_range?: string;
    hours?: string;
    description?: string;
    highlights?: string;
    source?: string;
  } | null>(null);

  // Create GeoJSON data structure from search result features
  const geojsonData = React.useMemo((): FeatureCollection<Point> => {
    console.log(`Creating GeoJSON data with ${searchResultFeatures.length} features`);
    // Log a few sample features for debugging
    if (searchResultFeatures.length > 0) {
      console.log('Sample feature:', JSON.stringify(searchResultFeatures[0]));
    }
    return {
      type: 'FeatureCollection',
      features: searchResultFeatures
    };
  }, [searchResultFeatures]);

  // Add function to count visible markers
  const countVisibleMarkers = useCallback(() => {
    if (!mapRef.current) return;
    
    try {
      // Check if the layers exist in the map before querying
      const map = mapRef.current.getMap();
      const hasUnclusteredLayer = map.getLayer('unclustered-point');
      const hasClusterLayer = map.getLayer('clusters');
      
      // Skip if the layers don't exist yet
      if (!hasUnclusteredLayer || !hasClusterLayer) {
        console.log('Skipping marker count - layers not yet added to map');
        return;
      }
      
      // Get the map's bounds as the area to query
      const bounds = mapRef.current.getBounds();
      if (!bounds) return;
      
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      if (!sw || !ne) return;
      
      const boundingBox: [PointLike, PointLike] = [
        [sw.lng, sw.lat],
        [ne.lng, ne.lat]
      ];
      
      const unclustered = mapRef.current.queryRenderedFeatures(boundingBox, {
        layers: ['unclustered-point']
      });
      
      const clusters = mapRef.current.queryRenderedFeatures(boundingBox, {
        layers: ['clusters']
      });
      
      console.log(`Visible markers: ${unclustered.length} unclustered points, ${clusters.length} clusters`);
      
      // Log coordinates of unclustered points for debugging
      unclustered.forEach((feature, i) => {
        const coords = (feature.geometry as any).coordinates;
        console.log(`Unclustered point ${i}: [${coords[0]}, ${coords[1]}]`);
      });
    } catch (error) {
      console.error('Error counting markers:', error);
    }
  }, [mapRef]);

  // Use effect to count markers when view state changes
  useEffect(() => {
    // Wait a moment for rendering to complete
    const timer = setTimeout(() => {
      countVisibleMarkers();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [viewState.zoom, countVisibleMarkers]);

  const handleError = useCallback((evt: any) => {
    console.error('Map error:', evt.error);
  }, []);

  const onClick = useCallback((event: MapLayerMouseEvent) => {
    if (!mapRef.current) return;
    
    try {
      // Check if the layers exist in the map before querying
      const map = mapRef.current.getMap();
      const hasUnclusteredLayer = map.getLayer('unclustered-point');
      const hasClusterLayer = map.getLayer('clusters');
      
      // Skip if layers don't exist yet
      if (!hasUnclusteredLayer && !hasClusterLayer) {
        return;
      }
      
      // Check if the click is on a cluster (only if cluster layer exists)
      if (hasClusterLayer) {
        const clusterFeatures = mapRef.current.queryRenderedFeatures(event.point, {
          layers: ['clusters']
        }) as MapboxGeoJSONFeature[] | undefined;
        
        if (clusterFeatures && clusterFeatures.length > 0) {
          // Get the cluster id from the feature
          const clusterId = clusterFeatures[0].properties?.cluster_id;
          
          // Get the mapbox instance
          const mapboxSource = mapRef.current.getMap().getSource('search-results') as any;
          
          // Get cluster expansion zoom
          mapboxSource.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            
            // Fly to the cluster
            mapRef.current?.flyTo({
              center: (clusterFeatures[0].geometry as Point).coordinates as [number, number],
              zoom: zoom + 0.5, // Zoom in a bit more to better see the points
              duration: 500
            });
          });
          
          return;
        }
      }
      
      // Get features at click point (for unclustered points)
      if (hasUnclusteredLayer) {
        const features = mapRef.current.queryRenderedFeatures(event.point, {
          layers: ['unclustered-point']
        }) as MapboxGeoJSONFeature[] | undefined;
        
        if (features && features.length > 0) {
          const feature = features[0];
          setSelectedFeatureId(feature.id as string);
          
          // Show popup for the selected feature
          if (feature.geometry.type === 'Point') {
            const coordinates = feature.geometry.coordinates;
            const props = feature.properties || {};
            
            setPopupInfo({
              longitude: coordinates[0],
              latitude: coordinates[1],
              name: props.name || 'Unknown location',
              address: props.address,
              category: props.category,
              price_range: props.price_range,
              hours: props.hours,
              description: props.description,
              highlights: props.highlights,
              source: props.source
            });
          }
        } else {
          // Clicked outside a feature
          setPopupInfo(null);
        }
      }
    } catch (error) {
      console.error('Error handling map click:', error);
    }
  }, [mapRef, setSelectedFeatureId]);

  return (
    <div className="w-full h-full">
      <Map
        ref={mapRef}
        reuseMaps
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        {...viewState}
        onMove={evt => updateViewState(evt.viewState)}
        onClick={onClick}
        onError={handleError}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
        />
        
        {/* Search results layer */}
        {searchResultFeatures.length > 0 && (
          <Source
            id="search-results"
            type="geojson"
            data={geojsonData}
            cluster={true}
            clusterMaxZoom={9}
            clusterRadius={45}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredPointLayer} />
            <Layer {...pointLabelLayer} />
          </Source>
        )}
        
        {/* Popup for selected location */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            className="map-popup"
            maxWidth="300px"
          >
            <div className="p-2 max-w-[300px]">
              <h3 className="text-sm font-semibold mb-1">{popupInfo.name}</h3>
              
              {/* Category and price range */}
              {(popupInfo.category || popupInfo.price_range) && (
                <div className="flex gap-2 mt-1 mb-1.5">
                  {popupInfo.category && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {popupInfo.category}
                    </span>
                  )}
                  {popupInfo.price_range && (
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">
                      {popupInfo.price_range}
                    </span>
                  )}
                </div>
              )}
              
              {/* Address */}
              {popupInfo.address && (
                <p className="text-xs text-gray-600 mb-1.5 line-clamp-2">{popupInfo.address}</p>
              )}
              
              {/* Hours */}
              {popupInfo.hours && (
                <p className="text-xs text-gray-600 mb-1.5">
                  <span className="font-medium">Hours:</span> {popupInfo.hours}
                </p>
              )}
              
              {/* Description - truncated */}
              {popupInfo.description && (
                <p className="text-xs text-gray-700 mb-1.5 line-clamp-3">{popupInfo.description}</p>
              )}
              
              {/* Highlights */}
              {popupInfo.highlights && (
                <div className="mb-1.5">
                  <div className="text-xs font-medium text-gray-700 mb-0.5">Highlights:</div>
                  <p className="text-xs text-gray-600">{popupInfo.highlights}</p>
                </div>
              )}
              
              {/* Source with link */}
              {popupInfo.source && (
                <div className="text-xs text-gray-500 mt-1.5 overflow-hidden text-ellipsis">
                  <span className="italic">Source: </span>
                  {popupInfo.source.startsWith('http') ? (
                    <a 
                      href={popupInfo.source} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {new URL(popupInfo.source).hostname}
                    </a>
                  ) : (
                    <span>{popupInfo.source}</span>
                  )}
                </div>
              )}
              
              {/* Coordinates */}
              <div className="mt-2 text-xs text-gray-400 flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-600 mr-1"></span>
                {`${popupInfo.longitude.toFixed(5)}, ${popupInfo.latitude.toFixed(5)}`}
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default InteractiveMap; 
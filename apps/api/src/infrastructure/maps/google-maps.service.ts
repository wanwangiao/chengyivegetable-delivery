import { Client, UnitSystem } from '@googlemaps/google-maps-services-js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceMatrixElement {
  distanceInMeters: number;
  durationInSeconds: number;
}

export interface RouteInfo {
  distance: number;
  duration: number;
  polyline: string;
  steps: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
}

export class GoogleMapsService {
  private readonly client: Client;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY_NOT_CONFIGURED');
    }
    this.client = new Client({});
  }

  async geocode(address: string): Promise<LatLng> {
    const response = await this.client.geocode({
      params: {
        address,
        key: this.apiKey,
        language: 'zh-TW' as any
      }
    });

    const location = response.data.results?.[0]?.geometry?.location;
    if (!location) {
      throw new Error('GEOCODE_NOT_FOUND');
    }

    return {
      lat: Number(location.lat),
      lng: Number(location.lng)
    };
  }

  async distanceMatrix(origins: LatLng[], destinations: LatLng[]): Promise<DistanceMatrixElement[][]> {
    if (origins.length === 0 || destinations.length === 0) {
      return [];
    }

    const originStrings = origins.map(coord => `${coord.lat},${coord.lng}`);
    const destinationStrings = destinations.map(coord => `${coord.lat},${coord.lng}`);

    const response = await this.client.distancematrix({
      params: {
        key: this.apiKey,
        origins: originStrings,
        destinations: destinationStrings,
        language: 'zh-TW' as any,
        units: UnitSystem.metric
      }
    });

    const rows = response.data.rows ?? [];

    return rows.map(row =>
      (row.elements ?? []).map(element => ({
        distanceInMeters: element.status === 'OK' ? element.distance?.value ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY,
        durationInSeconds: element.status === 'OK' ? element.duration?.value ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
      }))
    );
  }

  async getRoute(origin: LatLng, destination: LatLng): Promise<RouteInfo> {
    const response = await this.client.directions({
      params: {
        key: this.apiKey,
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        language: 'zh-TW' as any,
        units: UnitSystem.metric
      }
    });

    const route = response.data.routes?.[0];
    if (!route) {
      throw new Error('ROUTE_NOT_FOUND');
    }

    const leg = route.legs?.[0];
    if (!leg) {
      throw new Error('ROUTE_LEG_NOT_FOUND');
    }

    return {
      distance: leg.distance?.value ?? 0,
      duration: leg.duration?.value ?? 0,
      polyline: route.overview_polyline?.points ?? '',
      steps:
        leg.steps?.map(step => ({
          instruction: step.html_instructions ?? '',
          distance: step.distance?.value ?? 0,
          duration: step.duration?.value ?? 0
        })) ?? []
    };
  }

  async getOptimizedRoute(
    origin: LatLng,
    destination: LatLng,
    waypoints: LatLng[]
  ): Promise<RouteInfo> {
    const response = await this.client.directions({
      params: {
        key: this.apiKey,
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        waypoints: waypoints.map(wp => `${wp.lat},${wp.lng}`),
        optimize: true,
        language: 'zh-TW' as any,
        units: UnitSystem.metric
      }
    });

    const route = response.data.routes?.[0];
    if (!route) {
      throw new Error('OPTIMIZED_ROUTE_NOT_FOUND');
    }

    let totalDistance = 0;
    let totalDuration = 0;
    const allSteps: Array<{ instruction: string; distance: number; duration: number }> = [];

    route.legs?.forEach(leg => {
      totalDistance += leg.distance?.value ?? 0;
      totalDuration += leg.duration?.value ?? 0;

      leg.steps?.forEach(step => {
        allSteps.push({
          instruction: step.html_instructions ?? '',
          distance: step.distance?.value ?? 0,
          duration: step.duration?.value ?? 0
        });
      });
    });

    return {
      distance: totalDistance,
      duration: totalDuration,
      polyline: route.overview_polyline?.points ?? '',
      steps: allSteps
    };
  }
}

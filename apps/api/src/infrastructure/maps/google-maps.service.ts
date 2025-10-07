import { Client, UnitSystem } from '@googlemaps/google-maps-services-js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceMatrixElement {
  distanceInMeters: number;
  durationInSeconds: number;
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
        language: 'zh-TW'
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
        language: 'zh-TW',
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
}

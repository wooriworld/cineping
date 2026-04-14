declare namespace naver {
  namespace maps {
    class Map {
      constructor(element: HTMLElement | string, options?: MapOptions);
      setCenter(latlng: LatLng): void;
      setZoom(zoom: number): void;
      destroy(): void;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      getPosition(): LatLng;
    }

    interface MapOptions {
      center?: LatLng;
      zoom?: number;
      mapTypeControl?: boolean;
      scaleControl?: boolean;
      logoControl?: boolean;
      mapDataControl?: boolean;
      zoomControl?: boolean;
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map;
      title?: string;
      icon?: string | MarkerIcon;
    }

    interface MarkerIcon {
      url: string;
      size?: Size;
      anchor?: Point;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    namespace Service {
      const Status: {
        OK: string;
        ERROR: string;
      };

      interface GeocodeAddress {
        roadAddress: string;
        jibunAddress: string;
        x: string; // 경도(lng)
        y: string; // 위도(lat)
      }

      interface GeocodeResponse {
        v2: {
          addresses: GeocodeAddress[];
          meta: { totalCount: number };
        };
      }

      function geocode(
        options: { query: string },
        callback: (status: string, response: GeocodeResponse) => void,
      ): void;
    }
  }
}

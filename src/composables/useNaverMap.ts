import { ref, onUnmounted } from 'vue';

// 스크립트 중복 로드 방지 싱글톤
let scriptPromise: Promise<void> | null = null;

function loadNaverScript(clientId: string): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (typeof naver !== 'undefined' && naver.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}&submodules=geocoder`;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('네이버 지도 스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export interface MapCoords {
  lat: number;
  lng: number;
  roadAddress: string;
}

export function useNaverMap() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const coords = ref<MapCoords | null>(null);

  let mapInstance: naver.maps.Map | null = null;
  let markerInstance: naver.maps.Marker | null = null;

  async function initMap(container: HTMLElement, theaterName: string): Promise<void> {
    const clientId = import.meta.env['VITE_NAVER_MAPS_CLIENT_ID'] as string;
    if (!clientId || clientId.startsWith('여기에')) {
      error.value = 'VITE_NAVER_MAPS_CLIENT_ID가 설정되지 않았습니다.';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      await loadNaverScript(clientId);

      await new Promise<void>((resolve, reject) => {
        naver.maps.Service.geocode({ query: theaterName }, (status, response) => {
          if (status !== naver.maps.Service.Status.OK) {
            reject(new Error('주소를 찾을 수 없습니다.'));
            return;
          }

          const address = response.v2.addresses[0];
          if (!address) {
            reject(new Error('위치 정보가 없습니다.'));
            return;
          }

          const lat = parseFloat(address.y);
          const lng = parseFloat(address.x);
          coords.value = {
            lat,
            lng,
            roadAddress: address.roadAddress || address.jibunAddress || '',
          };

          const position = new naver.maps.LatLng(lat, lng);

          mapInstance?.destroy();
          mapInstance = new naver.maps.Map(container, {
            center: position,
            zoom: 16,
            mapTypeControl: false,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: false,
          });

          markerInstance?.setMap(null);
          markerInstance = new naver.maps.Marker({
            position,
            map: mapInstance,
            title: theaterName,
          });

          resolve();
        });
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : '지도를 불러오지 못했습니다.';
    } finally {
      isLoading.value = false;
    }
  }

  function openNaverMaps(theaterName: string): void {
    const encodedName = encodeURIComponent(theaterName);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && coords.value) {
      const { lat, lng } = coords.value;
      const appScheme = `nmap://place?lat=${lat}&lng=${lng}&name=${encodedName}&appname=cineping`;
      const mobileWebUrl = `https://m.map.naver.com/search.nhn?query=${encodedName}`;

      // 앱 열기 시도 → visibilitychange로 성공 감지, 실패 시 모바일 웹으로 폴백
      const fallbackTimer = setTimeout(() => {
        window.open(mobileWebUrl, '_blank', 'noopener,noreferrer');
      }, 1500);

      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.hidden) clearTimeout(fallbackTimer);
        },
        { once: true },
      );

      window.location.href = appScheme;
    } else {
      const webUrl = `https://map.naver.com/v5/search/${encodedName}`;
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }

  function destroyMap(): void {
    markerInstance?.setMap(null);
    markerInstance = null;
    mapInstance?.destroy();
    mapInstance = null;
    coords.value = null;
    error.value = null;
    isLoading.value = false;
  }

  onUnmounted(destroyMap);

  return {
    isLoading,
    error,
    coords,
    initMap,
    openNaverMaps,
    destroyMap,
  };
}

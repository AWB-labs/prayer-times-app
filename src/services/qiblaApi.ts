const BASE_URL = 'https://api.aladhan.com/v1';

export interface QiblaData {
  latitude: number;
  longitude: number;
  /** Bearing in degrees (0–360, clockwise from North) towards the Qibla. */
  direction: number;
}

interface QiblaApiResponse {
  code: number;
  status: string;
  data: QiblaData;
}

export async function fetchQiblaDirection(
  latitude: number,
  longitude: number
): Promise<QiblaData> {
  const url = `${BASE_URL}/qibla/${latitude}/${longitude}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Qibla API error: ${response.status}`);
  }

  const json: QiblaApiResponse = await response.json();

  if (json.code !== 200) {
    throw new Error(`Qibla API error: ${json.status}`);
  }

  return json.data;
}

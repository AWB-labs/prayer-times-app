import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import MapView, {
  MapPressEvent,
  Marker,
  Region,
  MapViewProps,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { useLocationContext } from '../context/LocationContext';

/* ─────────────────────────────────────────────
   Custom map styles
   ───────────────────────────────────────────── */
const DARK_MAP_STYLE: MapViewProps['customMapStyle'] = [
  { elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e2d50' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9aa0b0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a8b8cc' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6d7a8a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2318' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a4a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2744' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131d34' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8899bb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#243258' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a2744' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#aabbcc' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2d50' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#6d7a8a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071520' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a7a' }] },
];

const LIGHT_MAP_STYLE: MapViewProps['customMapStyle'] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4edda' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5a9a6a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
interface Coords {
  latitude: number;
  longitude: number;
}

interface Props {
  visible: boolean;
  initialCoords?: Coords | null;
  onClose: () => void;
}

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return addr?.city || addr?.district || addr?.region || addr?.country || null;
  } catch {
    return null;
  }
}

function fmt(n: number, decimals = 4) {
  return n.toFixed(decimals);
}

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */
export function LocationPickerScreen({ visible, initialCoords, onClose }: Props) {
  const { theme } = useTheme();
  const { setManualLocation } = useLocationContext();
  const insets = useSafeAreaInsets();

  const DEFAULT_COORDS: Coords = initialCoords ?? { latitude: 21.3891, longitude: 39.8579 }; // Mecca

  const [pin, setPin] = useState<Coords>(DEFAULT_COORDS);
  const [cityName, setCityName] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<MapView>(null);

  /* When modal opens, reset pin & geocode */
  React.useEffect(() => {
    if (visible) {
      const coords = initialCoords ?? DEFAULT_COORDS;
      setPin(coords);
      setCityName(null);
      geocodePin(coords.latitude, coords.longitude);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const geocodePin = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    const name = await reverseGeocode(lat, lng);
    setCityName(name);
    setGeocoding(false);
  }, []);

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ latitude, longitude });
      geocodePin(latitude, longitude);
    },
    [geocodePin]
  );

  const handleMarkerDragEnd = useCallback(
    (e: { nativeEvent: { coordinate: Coords } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ latitude, longitude });
      geocodePin(latitude, longitude);
    },
    [geocodePin]
  );

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    // Ensure we have a city name; try one more time if still null
    let name = cityName;
    if (!name) name = await reverseGeocode(pin.latitude, pin.longitude);
    setManualLocation({ latitude: pin.latitude, longitude: pin.longitude, cityName: name });
    setSaving(false);
    onClose();
  }, [pin, cityName, setManualLocation, onClose]);

  const initialRegion: Region = {
    ...DEFAULT_COORDS,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };

  const bg = theme.bg;
  const card = theme.surface;
  const accent = theme.accent;
  const textPrimary = theme.text;
  const textSub = theme.textSub;
  const textMuted = theme.textMuted;
  const border = theme.border;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* ── Top bar ── */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 14,
            paddingHorizontal: 16,
            backgroundColor: card,
            borderBottomWidth: 1,
            borderBottomColor: border,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 14, padding: 4 }}
          >
            <Ionicons name="close" size={22} color={textSub} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '700' }}>
              Set Location
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: 1 }}>
              Tap or drag the pin to choose your location
            </Text>
          </View>

          {/* GPS button — jump to device location */}
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: accent + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={async () => {
              try {
                const loc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                const coords = {
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                };
                setPin(coords);
                geocodePin(coords.latitude, coords.longitude);
                mapRef.current?.animateToRegion(
                  { ...coords, latitudeDelta: 0.5, longitudeDelta: 0.5 },
                  600
                );
              } catch {
                // permission error or GPS off – silently ignore
              }
            }}
          >
            <Ionicons name="navigate" size={16} color={accent} />
          </TouchableOpacity>
        </View>

        {/* ── Map ── */}
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          customMapStyle={theme.isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
          onPress={handleMapPress}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={pin}
            draggable
            onDragEnd={handleMarkerDragEnd}
            anchor={{ x: 0.5, y: 1 }}
          >
            {/* Custom pin */}
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 8,
                }}
              >
                <Ionicons name="location" size={22} color={theme.accentFg} />
              </View>
              {/* Pin tail */}
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 6,
                  borderRightWidth: 6,
                  borderTopWidth: 10,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: accent,
                  marginTop: -1,
                }}
              />
            </View>
          </Marker>
        </MapView>

        {/* ── Bottom info + confirm sheet ── */}
        <View
          style={{
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
            paddingHorizontal: 16,
            backgroundColor: card,
            borderTopWidth: 1,
            borderTopColor: border,
          }}
        >
          {/* Location info row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
              padding: 14,
              borderRadius: 14,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: accent + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="location-outline" size={18} color={accent} />
            </View>

            <View style={{ flex: 1 }}>
              {geocoding ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={accent} style={{ marginRight: 8 }} />
                  <Text style={{ color: textMuted, fontSize: 13 }}>Looking up location…</Text>
                </View>
              ) : (
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  {cityName ?? 'Unknown location'}
                </Text>
              )}
              <Text style={{ color: textMuted, fontSize: 12, marginTop: 2 }}>
                {fmt(pin.latitude)}°, {fmt(pin.longitude)}°
              </Text>
            </View>
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: accent,
              borderRadius: 16,
              paddingVertical: 15,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              opacity: saving ? 0.7 : 1,
              shadowColor: accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {saving ? (
              <ActivityIndicator color={theme.accentFg} size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.accentFg}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ color: theme.accentFg, fontSize: 16, fontWeight: '700' }}>
                  Use This Location
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

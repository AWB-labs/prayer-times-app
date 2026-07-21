import { requireNativeModule } from 'expo-modules-core';

// Native module registered by ios/WidgetBridgeModule.swift via Name("WidgetBridge").
// Returns undefined-safe access; callers guard for non-iOS platforms.
export default requireNativeModule('WidgetBridge');

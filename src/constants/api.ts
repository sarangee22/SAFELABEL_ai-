import Constants from "expo-constants";

const extraApiUrl =
  (Constants.expoConfig?.extra as { EXPO_PUBLIC_API_BASE_URL?: string } | undefined)
    ?.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.manifest?.extra as { EXPO_PUBLIC_API_BASE_URL?: string } | undefined)
    ?.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL;

const DEFAULT_API_BASE_URL = extraApiUrl || "http://localhost:4000";

export const API_BASE_URL = DEFAULT_API_BASE_URL;

export const API_ENDPOINTS = {
  analyzeOcr: `${API_BASE_URL}/api/ocr/analyze`,
  searchIngredients: `${API_BASE_URL}/api/ingredients/search`,
};

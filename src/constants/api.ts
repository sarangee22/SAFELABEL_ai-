import { Platform } from "react-native";

/**
 * 모바일 기기(Expo Go)에서 실행할 때는 PC의 내부 IP(예: 192.168.x.x)를 사용해야 합니다.
 * 127.0.0.1이나 localhost는 모바일 기기 자신을 가리키므로 연결할 수 없습니다.
 */
export const API_BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.0.x:4000"; // 모바일 대체용

export const API_ENDPOINTS = {
  analyzeOcr: `${API_BASE_URL}/api/ocr/analyze`,
  searchIngredients: `${API_BASE_URL}/api/ingredients/search`,
};
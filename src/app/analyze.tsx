import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const PROFILE_STORAGE_KEY = "safelabel_user_profile";
const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type UserProfile = {
  name: string;
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
};

type MatchedIngredient = {
  originalName: string;
  standardName: string;
  englishName: string;
  description: string;
  isMatched: boolean;
  isRestricted: boolean;
  isAllergen: boolean;
  restrictedReason: string;
  allergenReason: string;
  riskWeight: number;
};

type RiskReason = {
  ingredient: string;
  type: string;
  reason: string;
};

type AnalysisResult = {
  productName: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  cautionIngredients: string[];
  mainIngredients: string[];
  matchedIngredients: MatchedIngredient[];
  riskReasons: RiskReason[];
  summary: string;
  recommendation: string;
};

type AnalysisHistoryItem = AnalysisResult & {
  id: number;
  type: "single";
  date: string;
  imageUri?: string;
};

export default function AnalyzeScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const cameraRef = useRef<CameraView | null>(null);
  const didOpenGalleryRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  const loadUserProfile = async (): Promise<UserProfile> => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

      if (!savedProfile) {
        return {
          name: "",
          skinType: "",
          sensitivity: "",
          allergies: [],
          avoidIngredients: [],
        };
      }

      const parsedProfile = JSON.parse(savedProfile);

      return {
        name: parsedProfile.name || "",
        skinType: parsedProfile.skinType || "",
        sensitivity: parsedProfile.sensitivity || "",
        allergies: parsedProfile.allergies || [],
        avoidIngredients: parsedProfile.avoidIngredients || [],
      };
    } catch (error) {
      console.log("프로필 불러오기 실패:", error);

      return {
        name: "",
        skinType: "",
        sensitivity: "",
        allergies: [],
        avoidIngredients: [],
      };
    }
  };

  const saveAnalysisHistory = async (
    data: AnalysisResult,
    imageUri?: string
  ) => {
    try {
      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const history: AnalysisHistoryItem[] = savedHistory
        ? JSON.parse(savedHistory)
        : [];

      const newHistoryItem: AnalysisHistoryItem = {
        id: Date.now(),
        type: "single",
        date: new Date().toISOString(),
        imageUri,
        ...data,
      };

      const updatedHistory = [newHistoryItem, ...history];

      await AsyncStorage.setItem(
        ANALYSIS_HISTORY_KEY,
        JSON.stringify(updatedHistory)
      );

      console.log("분석 기록 저장 완료:", newHistoryItem);
    } catch (error) {
      console.log("분석 기록 저장 실패:", error);
    }
  };

  const handlePickImage = useCallback(async () => {
    const galleryPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!galleryPermission.granted) {
      Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다.");

      if (mode === "gallery") {
        router.replace("/");
        return;
      }

      setIsCameraOpen(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled) {
      if (mode === "gallery") {
        router.replace("/");
        return;
      }

      setIsCameraOpen(true);
      return;
    }

    const imageUri = result.assets[0]?.uri;

    if (!imageUri) {
      Alert.alert("불러오기 실패", "이미지를 다시 선택해주세요.");

      if (mode === "gallery") {
        router.replace("/");
        return;
      }

      setIsCameraOpen(true);
      return;
    }

    setCapturedImage(imageUri);
    setIsCameraOpen(false);
    setAnalysisResult(null);
  }, [mode]);

  useEffect(() => {
    if (mode === "gallery" && !didOpenGalleryRef.current) {
      didOpenGalleryRef.current = true;
      setIsCameraOpen(false);
      handlePickImage();
    }

    if (mode === "camera") {
      didOpenGalleryRef.current = false;
      setIsCameraOpen(true);
      setCapturedImage(null);
      setAnalysisResult(null);
    }
  }, [mode, handlePickImage]);

  if (mode === "gallery" && !capturedImage && !analysisResult) {
    return <View style={styles.loadingScreen} />;
  }

  if (mode !== "gallery") {
    if (!permission) {
      return <View style={styles.loadingScreen} />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.permissionScreen}>
          <View style={styles.permissionIconBox}>
            <Ionicons name="camera-outline" size={34} color="#5B7CFA" />
          </View>

          <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>

          <Text style={styles.permissionDescription}>
            화장품 성분표를 촬영해 OCR 분석을 진행하려면 카메라 접근 권한이
            필요합니다.
          </Text>

          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>카메라 권한 허용하기</Text>
          </Pressable>
        </View>
      );
    }
  }

  const handleTakePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo?.uri) {
        Alert.alert("촬영 실패", "사진을 다시 촬영해주세요.");
        return;
      }

      setCapturedImage(photo.uri);
      setIsCameraOpen(false);
      setAnalysisResult(null);
    } catch (error) {
      Alert.alert("오류", "사진 촬영 중 문제가 발생했습니다.");
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setIsCameraOpen(true);
  };

  const handleAnalyzeImage = async () => {
    if (!capturedImage) {
      Alert.alert("이미지 필요", "성분표 이미지를 먼저 촬영하거나 선택해주세요.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const profile = await loadUserProfile();

      const formData = new FormData();

      if (Platform.OS === "web") {
        const imageResponse = await fetch(capturedImage);
        const imageBlob = await imageResponse.blob();

        formData.append("image", imageBlob, "ingredient-label.jpg");
      } else {
        formData.append("image", {
          uri: capturedImage,
          name: "ingredient-label.jpg",
          type: "image/jpeg",
        } as any);
      }

      formData.append("skinType", profile.skinType);
      formData.append("sensitivity", profile.sensitivity);
      formData.append("allergies", JSON.stringify(profile.allergies));
      formData.append(
        "avoidIngredients",
        JSON.stringify(profile.avoidIngredients)
      );

      console.log("서버로 이미지 전송 시작:", capturedImage);
      console.log("분석에 반영되는 사용자 프로필:", profile);

      const response = await fetch("http://localhost:4000/api/ocr/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log("OCR 서버 응답 오류:", errorText);
        throw new Error("OCR 분석 요청 실패");
      }

      const data = await response.json();

      const analysisData: AnalysisResult = {
        productName: data.productName,
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        cautionIngredients: data.cautionIngredients || [],
        mainIngredients: data.mainIngredients || [],
        matchedIngredients: data.matchedIngredients || [],
        riskReasons: data.riskReasons || [],
        summary: data.summary,
        recommendation: data.recommendation,
      };

      setAnalysisResult(analysisData);
      await saveAnalysisHistory(analysisData, capturedImage);

      console.log("OCR 원문:", data.ocrText);
      console.log("공공데이터 매칭 결과:", data.matchedIngredients);
      console.log("위험도 판단 근거:", data.riskReasons);
    } catch (error) {
      console.error(error);

      Alert.alert(
        "분석 실패",
        "성분표 분석 중 문제가 발생했습니다. 서버 실행 여부와 이미지 업로드 방식을 확인해주세요."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={styles.screen}>
      {isCameraOpen ? (
        <View style={styles.cameraScreen}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraHeader}>
                <Text style={styles.cameraTitle}>성분표 촬영</Text>
                <Text style={styles.cameraDescription}>
                  성분표 영역만 가까이 맞춰 촬영해주세요. 제품 설명, 사용방법,
                  주의사항은 제외하면 분석 정확도가 올라갑니다.
                </Text>
              </View>

              <View style={styles.guideFrame}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />

                <Text style={styles.guideText}>
                  전성분 영역만 여기에 맞춰주세요
                </Text>
              </View>

              <View style={styles.cameraControls}>
                <Pressable
                  style={styles.subControlButton}
                  onPress={handlePickImage}
                >
                  <Ionicons name="image-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.subControlText}>갤러리</Text>
                </Pressable>

                <Pressable
                  style={styles.captureButton}
                  onPress={handleTakePhoto}
                >
                  <View style={styles.captureInner} />
                </Pressable>

                <Pressable
                  style={styles.subControlButton}
                  onPress={() =>
                    setFacing((current) =>
                      current === "back" ? "front" : "back"
                    )
                  }
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.subControlText}>전환</Text>
                </Pressable>
              </View>
            </View>
          </CameraView>
        </View>
      ) : (
        <ScrollView
          style={styles.resultScreen}
          contentContainerStyle={styles.resultContainer}
        >
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <Ionicons name="scan-outline" size={28} color="#5B7CFA" />
            </View>

            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>성분 분석</Text>
              <Text style={styles.headerDescription}>
                OCR로 읽은 성분을 공공데이터와 매칭해 사용자 맞춤 위험도를
                분석합니다.
              </Text>
            </View>
          </View>

          {capturedImage && (
            <View style={styles.previewCard}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />

              <View style={styles.previewActions}>
                <Pressable style={styles.secondaryButton} onPress={handleRetake}>
                  <Ionicons name="camera-outline" size={18} color="#5B7CFA" />
                  <Text style={styles.secondaryButtonText}>다시 촬영</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={handlePickImage}
                >
                  <Ionicons name="image-outline" size={18} color="#5B7CFA" />
                  <Text style={styles.secondaryButtonText}>다른 이미지</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            style={[styles.analyzeButton, isAnalyzing && styles.disabledButton]}
            onPress={handleAnalyzeImage}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
                <Text style={styles.analyzeButtonText}>OCR 성분 분석하기</Text>
              </>
            )}
          </Pressable>

          {isAnalyzing && (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingTitle}>성분표를 분석 중이에요</Text>
              <Text style={styles.loadingText}>
                OCR로 텍스트를 추출하고, 공공데이터와 사용자 피부 정보를
                비교하고 있습니다.
              </Text>
            </View>
          )}

          {analysisResult && <AnalysisResultCard result={analysisResult} />}
        </ScrollView>
      )}
    </View>
  );
}

function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  const riskColor = getRiskColor(result.riskLevel);
  const riskLabel = getRiskLabel(result.riskLevel);

  return (
    <View style={styles.analysisCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleBox}>
          <Text style={styles.resultLabel}>분석 결과</Text>
          <Text style={styles.resultProductName}>{result.productName}</Text>
        </View>

        <View style={[styles.riskBadge, { backgroundColor: riskColor.bg }]}>
          <Text style={[styles.riskBadgeText, { color: riskColor.text }]}>
            {riskLabel}
          </Text>
        </View>
      </View>

      <View style={styles.riskScoreBox}>
        <Text style={styles.riskScoreLabel}>사용자 맞춤 위험도</Text>
        <Text style={[styles.riskScore, { color: riskColor.text }]}>
          {result.riskScore}점
        </Text>

        <View style={styles.riskBarBackground}>
          <View
            style={[
              styles.riskBarFill,
              {
                width: `${result.riskScore}%`,
                backgroundColor: riskColor.text,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>AI 요약</Text>
        <Text style={styles.infoText}>{result.summary}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>주의 성분</Text>
        <Text style={styles.infoText}>
          {result.cautionIngredients.length > 0
            ? result.cautionIngredients.join(", ")
            : "특별한 주의 성분 없음"}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>주요 성분</Text>
        <Text style={styles.infoText}>
          {result.mainIngredients.length > 0
            ? result.mainIngredients.join(", ")
            : "추출된 성분이 없습니다."}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>공공데이터 매칭 성분</Text>

        {result.matchedIngredients.length > 0 ? (
          result.matchedIngredients.map((item, index) => (
            <View
              key={`${item.standardName}-${index}`}
              style={styles.ingredientAnalysisItem}
            >
              <View style={styles.ingredientTopRow}>
                <Text style={styles.ingredientAnalysisName}>
                  {item.standardName}
                </Text>

                <View
                  style={[
                    styles.matchBadge,
                    item.isMatched ? styles.matchedBadge : styles.unmatchedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.matchBadgeText,
                      item.isMatched
                        ? styles.matchedBadgeText
                        : styles.unmatchedBadgeText,
                    ]}
                  >
                    {item.isMatched ? "매칭됨" : "미매칭"}
                  </Text>
                </View>
              </View>

              {item.englishName ? (
                <Text style={styles.ingredientAnalysisSub}>
                  {item.englishName}
                </Text>
              ) : null}

              {item.description ? (
                <Text style={styles.ingredientAnalysisText}>
                  {item.description}
                </Text>
              ) : null}

              {(item.isRestricted || item.isAllergen) && (
                <View style={styles.warningBox}>
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color="#D94C5F"
                  />
                  <Text style={styles.warningText}>
                    {item.restrictedReason || item.allergenReason}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.infoText}>
            공공데이터와 매칭된 성분이 아직 없습니다.
          </Text>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>위험도 판단 근거</Text>

        {result.riskReasons.length > 0 ? (
          result.riskReasons.map((item, index) => (
            <View key={`${item.ingredient}-${index}`} style={styles.reasonItem}>
              <Text style={styles.reasonIngredient}>{item.ingredient}</Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.infoText}>
            현재 기준에서는 특별한 위험도 상승 근거가 적게 감지되었습니다.
          </Text>
        )}
      </View>

      <View style={styles.recommendBox}>
        <Ionicons name="bulb-outline" size={20} color="#22A06B" />
        <View style={styles.recommendTextBox}>
          <Text style={styles.recommendTitle}>AI 추천</Text>
          <Text style={styles.recommendText}>{result.recommendation}</Text>
        </View>
      </View>
    </View>
  );
}

function getRiskLabel(level: "low" | "medium" | "high") {
  switch (level) {
    case "low":
      return "낮음";
    case "medium":
      return "보통";
    case "high":
      return "높음";
  }
}

function getRiskColor(level: "low" | "medium" | "high") {
  switch (level) {
    case "low":
      return {
        bg: "#DFF4E8",
        text: "#22A06B",
      };
    case "medium":
      return {
        bg: "#FFF2CC",
        text: "#C58A00",
      };
    case "high":
      return {
        bg: "#FBE3E7",
        text: "#D94C5F",
      };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  permissionScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 10,
  },
  permissionDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#7A808C",
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#5B7CFA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  cameraScreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 36,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cameraHeader: {
    alignItems: "center",
  },
  cameraTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  cameraDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#E5E7EB",
    textAlign: "center",
  },

  guideFrame: {
    height: 300,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  guideText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cornerTopLeft: {
    position: "absolute",
    top: -1,
    left: -1,
    width: 42,
    height: 42,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 42,
    height: 42,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: -1,
    left: -1,
    width: 42,
    height: 42,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 42,
    height: 42,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomRightRadius: 24,
  },

  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subControlButton: {
    width: 76,
    alignItems: "center",
  },
  subControlText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 6,
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },

  resultScreen: {
    flex: 1,
  },
  resultContainer: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 6,
  },
  headerDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#7A808C",
  },

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9EDF3",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: 320,
    borderRadius: 18,
    backgroundColor: "#EEF2F7",
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#EEF3FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
  },

  analyzeButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#5B7CFA",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  analyzeButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  loadingCard: {
    backgroundColor: "#E8EEFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  analysisCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  resultTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 6,
  },
  resultProductName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#20222A",
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },

  riskScoreBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  riskScoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A8F98",
    marginBottom: 8,
  },
  riskScore: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 12,
  },
  riskBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5EAF2",
    overflow: "hidden",
  },
  riskBarFill: {
    height: "100%",
    borderRadius: 999,
  },

  infoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  ingredientAnalysisItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  ingredientTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ingredientAnalysisName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 4,
  },
  ingredientAnalysisSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A8F98",
    marginBottom: 6,
  },
  ingredientAnalysisText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },
  matchBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  matchedBadge: {
    backgroundColor: "#E8F7EF",
  },
  unmatchedBadge: {
    backgroundColor: "#EEF2F7",
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  matchedBadgeText: {
    color: "#22A06B",
  },
  unmatchedBadgeText: {
    color: "#8A8F98",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#FBE3E7",
    borderRadius: 12,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#D94C5F",
  },

  reasonItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  reasonIngredient: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 5,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },

  recommendBox: {
    flexDirection: "row",
    backgroundColor: "#E8F7EF",
    borderRadius: 18,
    padding: 16,
    marginTop: 2,
  },
  recommendTextBox: {
    flex: 1,
    marginLeft: 10,
  },
  recommendTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#22A06B",
    marginBottom: 7,
  },
  recommendText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
  },
});
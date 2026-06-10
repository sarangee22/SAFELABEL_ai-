import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { formatRestrictionInfo } from "@/utils/restriction-utils";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { API_ENDPOINTS } from "../constants/api";

const PROFILE_STORAGE_KEY = "safelabel_user_profile";
const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type UserProfile = {
  name: string;
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
  symptoms?: string[];
};

type PublicIngredientInfo = {
  INGR_KOR_NAME?: string | null;
  INGR_ENG_NAME?: string | null;
  CAS_NO?: string | null;
  ORIGIN_MAJOR_KOR_NAME?: string | null;
  INGR_SYNONYM?: string | null;
};

type PublicRestrictedInfo = {
  REGULATE_TYPE?: string | null;
  INGR_STD_NAME?: string | null;
  INGR_ENG_NAME?: string | null;
  CAS_NO?: string | null;
  INGR_SYNONYM?: string | null;
  COUNTRY_NAME?: string | null;
  NOTICE_INGR_NAME?: string | null;
  PROVIS_ATRCL?: string | null;
  LIMIT_COND?: string | null;
};

type PublicRestrictedNationInfo = {
  REGL_CODE?: string | null;
  INGR_CODE?: string | null;
  COUNTRY_NAME?: string | null;
  NOTICE_INGR_NAME?: string | null;
  PROVIS_ATRCL?: string | null;
  LIMIT_COND?: string | null;
  REGULATE_TYPE?: string | null;
};

type PublicRegulationInfo = {
  SN?: string | null;
  INGR_STD_NAME?: string | null;
  INGR_ENG_NAME?: string | null;
  PROH_NATIONAL?: string | null;
  LIMIT_NATIONAL?: string | null;
};

type PublicDataUserSummary = {
  safetyLevel: string;
  englishName: string;
  casNo: string;
  definition: string;
  simpleSummary: string;
  restrictionSummary: string;
  countrySummary: string;
  userAdvice: string;
  hasRestriction: boolean;
};

type PublicDataInfo = {
  ingredientName: string;
  ingredientInfo: PublicIngredientInfo[];
  restrictedInfo: PublicRestrictedInfo[];
  restrictedNationInfo: PublicRestrictedNationInfo[];
  regulationInfo: PublicRegulationInfo[];
  userSummary?: PublicDataUserSummary | null;
  hasPublicData: boolean;
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
  publicData?: PublicDataInfo | null;
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
  aiProvider: "openai" | "fallback";
  aiModel: string | null;
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
    null,
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [isSavingResult, setIsSavingResult] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          symptoms: [],
        };
      }

      const parsedProfile = JSON.parse(savedProfile);

      return {
        name: parsedProfile.name || "",
        skinType: parsedProfile.skinType || "",
        sensitivity: parsedProfile.sensitivity || "",
        allergies: parsedProfile.allergies || [],
        avoidIngredients: parsedProfile.avoidIngredients || [],
        symptoms: parsedProfile.symptoms || [],
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
    imageUri?: string,
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
        JSON.stringify(updatedHistory),
      );

      console.log("분석 기록 저장 완료:", newHistoryItem);
    } catch (error) {
      console.log("분석 기록 저장 실패:", error);
      throw error; // 에러를 던져서 저장 실패 피드백을 보여줄 수 있도록 수정
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
    const timeoutId = setTimeout(() => {
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
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [mode, handlePickImage]);

  useFocusEffect(
    useCallback(() => {
      loadUserProfile().then(setUserProfile);
    }, []),
  );

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
            <Ionicons
              name="camera-outline"
              size={34}
              color={AppColors.primary}
            />
          </View>

          <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>

          <Text style={styles.permissionDescription}>
            화장품 성분표를 촬영해 OCR 분석을 진행하려면 카메라 접근 권한이
            필요합니다.
          </Text>

          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>
              카메라 권한 허용하기
            </Text>
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
    } catch {
      Alert.alert("오류", "사진 촬영 중 문제가 발생했습니다.");
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setIsCameraOpen(true);
  };

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000); // 3초 후 숨김
  };

  const handleSaveResult = async () => {
    if (!analysisResult || isSavingResult) return;
    setIsSavingResult(true);
    try {
      await saveAnalysisHistory(analysisResult, capturedImage ?? undefined);
      showToast("분석 결과가 저장되었습니다.", "success");
    } catch (error) {
      showToast("분석 결과 저장에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!capturedImage) {
      Alert.alert(
        "이미지 필요",
        "성분표 이미지를 먼저 촬영하거나 선택해주세요.",
      );
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
      formData.append("symptoms", JSON.stringify(profile.symptoms || []));
      formData.append(
        "avoidIngredients",
        JSON.stringify(profile.avoidIngredients),
      );

      console.log("서버로 이미지 전송 시작:", capturedImage);
      console.log("분석에 반영되는 사용자 프로필:", JSON.stringify(profile));

      const response = await fetch(API_ENDPOINTS.analyzeOcr, {
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
        aiProvider: data.aiProvider === "openai" ? "openai" : "fallback",
        aiModel: data.aiModel || null,
      };

      setAnalysisResult(analysisData);

      try {
        await saveAnalysisHistory(analysisData, capturedImage);
      } catch (err) {
        console.log("자동 저장 실패:", err);
      }

      console.log("OCR 원문:", data.ocrText);
      console.log("OCR 매칭 결과:", data.matchedIngredients);
      console.log("위험도 판단 근거:", data.riskReasons);
    } catch (error) {
      console.error(error);

      Alert.alert(
        "분석 실패",
        "성분표 분석 중 문제가 발생했습니다. 서버 실행 여부와 이미지 업로드 방식을 확인해주세요.",
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
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={AppColors.card}
                  />
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
                      current === "back" ? "front" : "back",
                    )
                  }
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={24}
                    color={AppColors.card}
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
            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>성분 분석</Text>
              <Text style={styles.headerDescription}>
                OCR로 읽은 성분을 사용자 피부 정보 기준으로 분석해 개인 맞춤
                위험도를 제공합니다.
              </Text>
            </View>
          </View>

          {capturedImage && (
            <View style={styles.previewCard}>
              <Image
                source={{ uri: capturedImage }}
                style={styles.previewImage}
              />

              <View style={styles.previewActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleRetake}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={AppColors.primary}
                  />
                  <Text style={styles.secondaryButtonText}>다시 촬영</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={handlePickImage}
                >
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={AppColors.primary}
                  />
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
              <ActivityIndicator color={AppColors.card} />
            ) : (
              <>
                <Ionicons
                  name="sparkles-outline"
                  size={20}
                  color={AppColors.card}
                />
                <Text style={styles.analyzeButtonText}>OCR 성분 분석하기</Text>
              </>
            )}
          </Pressable>

          {isAnalyzing && (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingTitle}>성분표를 분석 중이에요</Text>
              <Text style={styles.loadingText}>
                OCR로 텍스트를 추출하고, 사용자 피부 정보를 기준으로 분석하고
                있습니다.
              </Text>
            </View>
          )}

          {analysisResult && (
            <AnalysisResultCard
              result={analysisResult}
              userProfile={userProfile}
              onSave={handleSaveResult}
              isSaving={isSavingResult}
            />
          )}
        </ScrollView>
      )}

      {toast && (
        <View
          style={[
            styles.toastContainer,
            toast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Ionicons
            name={toast.type === "error" ? "alert-circle" : "checkmark-circle"}
            size={22}
            color={toast.type === "error" ? AppColors.risk : AppColors.safe}
          />
          <Text
            style={[
              styles.toastText,
              toast.type === "error"
                ? styles.toastTextError
                : styles.toastTextSuccess,
            ]}
          >
            {toast.message}
          </Text>
        </View>
      )}
    </View>
  );
}

function AnalysisResultCard({
  result,
  userProfile,
  onSave,
  isSaving,
}: {
  result: AnalysisResult;
  userProfile: UserProfile | null;
  onSave: () => void;
  isSaving?: boolean;
}) {
  const riskColor = getRiskColor(result.riskLevel);

  // 프로필(알레르기, 회피성분)에 해당하는 성분들을 추출하여 맞춤 주의 성분으로 분리
  const customCautionIngredients = result.matchedIngredients
    .filter((item) => {
      if (!userProfile) return false;
      const normalizedNames = [
        item.standardName,
        item.originalName,
        item.englishName,
      ]
        .filter(Boolean)
        .map(normalizeForMatch);
      const isAllergy = userProfile.allergies.some((a) => {
        const normA = normalizeForMatch(a);
        return (
          normA &&
          normalizedNames.some((n) => n.includes(normA) || normA.includes(n))
        );
      });
      const isAvoid = userProfile.avoidIngredients.some((a) => {
        const normA = normalizeForMatch(a);
        return (
          normA &&
          normalizedNames.some((n) => n.includes(normA) || normA.includes(n))
        );
      });
      return isAllergy || isAvoid;
    })
    .map((item) => item.standardName || item.originalName);

  // 기본 서버 주의 성분과 사용자 맞춤 주의 성분 병합
  const combinedCaution = Array.from(
    new Set([...result.cautionIngredients, ...customCautionIngredients]),
  );

  const verdict = getOverallVerdict(result, combinedCaution.length);
  const confidence = getAnalysisConfidence(result.matchedIngredients);
  const recommendationLines = getSkinAdvice(result, userProfile);
  const restrictionLines = summarizePublicDataRestrictions(result);
  const matchedCount = result.matchedIngredients.length;

  return (
    <View style={styles.analysisCard}>
      <View style={styles.overallCard}>
        <View style={styles.overallHeader}>
          <View>
            <Text style={styles.overallLabel}>종합 판단</Text>
            <Text style={styles.overallTitle}>{verdict.label}</Text>
          </View>
          <View style={[styles.overallBadge, { backgroundColor: verdict.bg }]}>
            <Text style={[styles.overallBadgeText, { color: verdict.text }]}>
              {verdict.stage}
            </Text>
          </View>
        </View>
        <Text style={styles.overallText}>{verdict.message}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: riskColor.border }]}>
          <Text style={styles.summaryTitle}>위험도 점수</Text>
          <Text style={[styles.summaryValue, { color: riskColor.text }]}>
            {result.riskScore}점
          </Text>
          <Text style={styles.summarySubtitle}>
            {getRiskLabel(result.riskLevel)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>성분 인식 수</Text>
          <Text style={styles.summaryValue}>{matchedCount}개</Text>
          <Text style={styles.summarySubtitle}>인식된 성분 수</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>내 피부 기준 맞춤 안내</Text>
        {recommendationLines.map((line, index) => (
          <Text key={index} style={styles.infoText}>
            • {line}
          </Text>
        ))}
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoTitleRow}>
          <Text style={styles.infoTitle}>주의 성분 요약</Text>
          <Text style={styles.sourceLabel}>{combinedCaution.length}개</Text>
        </View>
        {combinedCaution.length > 0 ? (
          <Text style={styles.infoText}>{combinedCaution.join(" · ")}</Text>
        ) : (
          <Text style={styles.infoText}>주의 성분이 감지되지 않았습니다.</Text>
        )}
        <Text style={[styles.infoText, styles.noteText]}>
          {combinedCaution.length > 0
            ? "이 성분들은 공공데이터 제한 규정 또는 내 피부 프로필 기준에서 주의가 필요한 성분입니다."
            : "현재 프로필 기준으로 주의 성분이 적습니다."}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoTitleRow}>
          <Text style={styles.infoTitle}>성분 분석 정보</Text>
          <Text style={styles.sourceLabel}>{matchedCount}개 확인</Text>
        </View>
        {restrictionLines.length > 0 ? (
          restrictionLines.map((line, index) => (
            <Text key={index} style={styles.infoText}>
              • {line}
            </Text>
          ))
        ) : (
          <Text style={styles.infoText}>
            현재 프로필과 인식된 성분 기준에서는 제한 정보가 없습니다.
          </Text>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>전체 성분 리스트</Text>
        {result.matchedIngredients.map((item, index) => {
          const itemStatus = getIngredientStatus(item, userProfile);
          const restrictionInfo = formatRestrictionInfo([
            item.publicData?.restrictedInfo,
            item.publicData?.restrictedNationInfo,
            item.publicData?.regulationInfo,
          ]);

          return (
            <View
              key={`${item.standardName || item.originalName}-${index}`}
              style={styles.ingredientRow}
            >
              <View style={styles.ingredientRowText}>
                <Text style={styles.ingredientName}>
                  {item.standardName || item.originalName}
                </Text>
                <Text
                  style={[
                    styles.ingredientSubText,
                    itemStatus.message
                      ? { color: itemStatus.text.color }
                      : null,
                  ]}
                  numberOfLines={2}
                >
                  {itemStatus.message
                    ? itemStatus.message
                    : `${item.isMatched ? "성분 인식 완료" : "정보 없음"}${restrictionInfo.length > 0 ? ` · ${restrictionInfo[0]}` : ""}`}
                </Text>
              </View>
              <View style={[styles.statusBadge, itemStatus.bg]}>
                <Text style={[styles.statusBadgeText, itemStatus.text]}>
                  {itemStatus.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.actionButton, isSaving && styles.disabledButton]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving && (
            <ActivityIndicator color={AppColors.card} size="small" />
          )}
          <Text style={styles.actionButtonText}>
            {isSaving ? "저장 중..." : "분석 결과 저장"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.secondaryActionButton]}
          onPress={() => router.push("/history")}
        >
          <Text style={[styles.actionButtonText, styles.secondaryActionText]}>
            기록 보기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function getOverallVerdict(
  result: AnalysisResult,
  customCautionCount?: number,
) {
  const cautionCount =
    customCautionCount !== undefined
      ? customCautionCount
      : result.cautionIngredients.length;
  const hasHighRisk = result.riskLevel === "high";
  const hasWarning = result.riskLevel === "medium" || cautionCount > 0;

  if (hasHighRisk) {
    return {
      label: "위험",
      stage: "주의 필요",
      message:
        "이 제품에는 위험도와 주의 성분이 함께 감지되었습니다. 사용 전 다시 확인하고 전문가 상담을 권장합니다.",
      bg: AppColors.riskSoft,
      text: AppColors.risk,
    };
  }

  if (hasWarning) {
    return {
      label: "주의",
      stage: "신중히 사용",
      message:
        "제품에 주의 성분이 포함되어 있습니다. 피부 타입과 피하고 싶은 성분을 고려해 사용 여부를 결정하세요.",
      bg: AppColors.cautionSoft,
      text: AppColors.caution,
    };
  }

  return {
    label: "안전",
    stage: "사용 가능",
    message:
      "현재 프로필과 인식된 성분 기준에서는 큰 문제가 감지되지 않았습니다. 단, 개인 피부 상태에 따라 다를 수 있습니다.",
    bg: AppColors.mintSoft,
    text: AppColors.safe,
  };
}

function getSkinAdvice(result: AnalysisResult, profile: UserProfile | null) {
  if (!profile) {
    return ["프로필을 설정하면 개인 맞춤 안내를 받을 수 있습니다."];
  }

  const lines: string[] = [];
  const normalizedAvoid = profile.avoidIngredients.map((value) =>
    String(value || "").toLowerCase(),
  );
  const normalizedCaution = result.cautionIngredients.map((text) =>
    String(text || "").toLowerCase(),
  );
  const matchedAvoided = normalizedAvoid.filter(
    (avoid) =>
      avoid && normalizedCaution.some((caution) => caution.includes(avoid)),
  );

  if (matchedAvoided.length > 0) {
    lines.push(
      `프로필에서 피하고 싶은 성분이 포함되었습니다: ${Array.from(new Set(matchedAvoided)).join(", ")}`,
    );
  }

  if (profile.sensitivity === "민감" || profile.sensitivity === "매우 민감") {
    lines.push(
      "민감 피부이므로 향료, 에탄올, 색소 등 자극 가능 성분에 더 주의하세요.",
    );
  }

  if (lines.length === 0) {
    lines.push(
      "현재 프로필 기준으로 이 제품은 특별히 주의할 요소가 많지 않습니다.",
    );
  }

  return lines;
}

function summarizePublicDataRestrictions(result: AnalysisResult) {
  const lines = result.matchedIngredients.flatMap((item) =>
    formatRestrictionInfo([
      item.publicData?.restrictedInfo,
      item.publicData?.restrictedNationInfo,
      item.publicData?.regulationInfo,
      item.publicData?.userSummary?.restrictionSummary,
      item.publicData?.userSummary?.countrySummary,
    ]),
  );

  return Array.from(new Set(lines));
}

function normalizeForMatch(str: string) {
  return String(str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[\s\(\)\[\]\{\}\.\,\-\:\;\"\'\/\\]/g, "")
    .toLowerCase();
}

function getIngredientStatus(
  item: MatchedIngredient,
  profile: UserProfile | null,
) {
  const restrictionLines = formatRestrictionInfo([
    item.publicData?.restrictedInfo,
    item.publicData?.restrictedNationInfo,
    item.publicData?.regulationInfo,
  ]);
  const isRestricted =
    item.isRestricted ||
    restrictionLines.some((line) => line.includes("사용 제한"));

  let isAllergyMatch = false;
  let isAvoidMatch = false;

  if (profile) {
    const normalizedNames = [
      item.standardName,
      item.originalName,
      item.englishName,
    ]
      .filter(Boolean)
      .map(normalizeForMatch);

    // include public data synonyms if present
    if (item.publicData && Array.isArray(item.publicData.ingredientInfo)) {
      item.publicData.ingredientInfo.forEach((pd) => {
        if (pd?.INGR_SYNONYM) {
          const syns = String(pd.INGR_SYNONYM)
            .split(/,|;|\//)
            .map((s) => s.trim())
            .filter(Boolean)
            .map(normalizeForMatch);

          normalizedNames.push(...syns);
        }
      });
    }

    isAllergyMatch = profile.allergies.some((a) => {
      const normA = normalizeForMatch(a);
      return (
        normA &&
        normalizedNames.some((n) => n.includes(normA) || normA.includes(n))
      );
    });

    isAvoidMatch = profile.avoidIngredients.some((a) => {
      const normA = normalizeForMatch(a);
      return (
        normA &&
        normalizedNames.some((n) => n.includes(normA) || normA.includes(n))
      );
    });
  }

  if (isAllergyMatch) {
    return {
      label: "알레르기 (위험)",
      bg: { backgroundColor: AppColors.riskSoft },
      text: { color: AppColors.risk },
      message: "프로필에 저장한 알레르기 유발 성분입니다.",
    };
  }

  if (isAvoidMatch) {
    return {
      label: "회피 성분 (위험)",
      bg: { backgroundColor: AppColors.riskSoft },
      text: { color: AppColors.risk },
      message: "프로필에 저장한 회피 성분입니다.",
    };
  }

  if (isRestricted) {
    return {
      label: "주의",
      bg: styles.statusBadgeWarning,
      text: styles.statusBadgeWarningText,
      message:
        restrictionLines.length > 0
          ? restrictionLines[0]
          : "공공데이터 사용 제한 주의 성분입니다.",
    };
  }

  if (item.isMatched) {
    return {
      label: "안전",
      bg: styles.statusBadgeSafe,
      text: styles.statusBadgeSafeText,
      message: "",
    };
  }

  return {
    label: "정보 없음",
    bg: styles.statusBadgeNeutral,
    text: styles.statusBadgeNeutralText,
    message: "",
  };
}

function getAnalysisConfidence(matchedIngredients: MatchedIngredient[]) {
  const matchedCount = matchedIngredients.filter(
    (item) => item.isMatched,
  ).length;

  if (matchedCount >= 5) {
    return {
      label: "높음",
      message: "OCR로 인식된 성분이 충분해 분석 신뢰도가 높습니다.",
      matchedCount,
      bg: AppColors.mintSoft,
      border: "#BDEFE4",
      text: AppColors.safe,
    };
  }

  if (matchedCount >= 2) {
    return {
      label: "보통",
      message:
        "일부 성분이 인식되었습니다. 성분명이 이상하면 다시 촬영해 주세요.",
      matchedCount,
      bg: AppColors.cautionSoft,
      border: "#F8DCA0",
      text: AppColors.caution,
    };
  }

  return {
    label: "낮음",
    message:
      "인식된 성분이 적습니다. OCR 결과를 확인하거나 다시 촬영해 주세요.",
    matchedCount,
    bg: AppColors.riskSoft,
    border: "#FFC6CE",
    text: AppColors.risk,
  };
}

function hasPublicDataMatch(item: MatchedIngredient) {
  const publicData = item.publicData;

  return (
    publicData?.hasPublicData === true ||
    (publicData?.ingredientInfo || []).length > 0 ||
    (publicData?.restrictedInfo || []).length > 0 ||
    (publicData?.restrictedNationInfo || []).length > 0 ||
    (publicData?.regulationInfo || []).length > 0
  );
}

function IngredientPublicDataCard({ item }: { item: MatchedIngredient }) {
  const publicData = item.publicData;

  const ingredientInfo = publicData?.ingredientInfo || [];
  const restrictedInfo = publicData?.restrictedInfo || [];
  const restrictedNationInfo = publicData?.restrictedNationInfo || [];
  const regulationInfo = publicData?.regulationInfo || [];

  const restrictionLines = formatRestrictionInfo([
    restrictedInfo,
    restrictedNationInfo,
    regulationInfo,
    publicData?.userSummary?.restrictionSummary,
    publicData?.userSummary?.countrySummary,
  ]);

  let firstIngredientInfo = getBestIngredientInfo(item, ingredientInfo);
  const userSummary = publicData?.userSummary;
  if (userSummary) {
    firstIngredientInfo = {
      ...(firstIngredientInfo || {}),
      INGR_ENG_NAME:
        userSummary.englishName || firstIngredientInfo?.INGR_ENG_NAME,
      CAS_NO: userSummary.casNo || firstIngredientInfo?.CAS_NO,
      ORIGIN_MAJOR_KOR_NAME:
        userSummary.definition || firstIngredientInfo?.ORIGIN_MAJOR_KOR_NAME,
      INGR_SYNONYM: "",
    };
  }
  const hasIngredientInfo = ingredientInfo.length > 0;
  const hasRestrictedInfo = restrictedInfo.length > 0;
  const hasRestrictedNationInfo = restrictedNationInfo.length > 0;
  const hasRegulationInfo = regulationInfo.length > 0;

  const hasAnyPublicData =
    publicData?.hasPublicData === true ||
    hasIngredientInfo ||
    hasRestrictedInfo ||
    hasRestrictedNationInfo ||
    hasRegulationInfo;
  const hasPublicDataRestriction = userSummary?.hasRestriction === true;

  return (
    <View style={styles.ingredientAnalysisItem}>
      <View style={styles.ingredientTopRow}>
        <Text style={styles.ingredientAnalysisName}>
          {item.standardName || item.originalName}
        </Text>

        <View
          style={[
            styles.matchBadge,
            hasAnyPublicData || item.isMatched
              ? styles.matchedBadge
              : styles.unmatchedBadge,
          ]}
        >
          <Text
            style={[
              styles.matchBadgeText,
              hasAnyPublicData || item.isMatched
                ? styles.matchedBadgeText
                : styles.unmatchedBadgeText,
            ]}
          >
            {hasAnyPublicData
              ? "공공데이터"
              : item.isMatched
                ? "로컬 매칭"
                : "미매칭"}
          </Text>
        </View>
      </View>

      {item.originalName && item.originalName !== item.standardName ? (
        <Text style={styles.ingredientAnalysisSub}>
          OCR 인식명: {item.originalName}
        </Text>
      ) : null}

      {item.englishName || firstIngredientInfo?.INGR_ENG_NAME ? (
        <Text style={styles.ingredientAnalysisSub}>
          영문명: {item.englishName || firstIngredientInfo?.INGR_ENG_NAME}
        </Text>
      ) : null}

      {firstIngredientInfo?.CAS_NO ? (
        <Text style={styles.publicDataText}>
          CAS No: {firstIngredientInfo.CAS_NO}
        </Text>
      ) : null}

      {item.description || firstIngredientInfo?.ORIGIN_MAJOR_KOR_NAME ? (
        <Text style={styles.ingredientAnalysisText}>
          {item.description || firstIngredientInfo?.ORIGIN_MAJOR_KOR_NAME}
        </Text>
      ) : null}

      {firstIngredientInfo?.INGR_SYNONYM ? (
        <View style={styles.publicDataBox}>
          <Text style={styles.publicDataLabel}>이명</Text>
          <Text style={styles.publicDataText}>
            {firstIngredientInfo.INGR_SYNONYM}
          </Text>
        </View>
      ) : null}

      {restrictionLines.length > 0 ? (
        <View style={styles.publicDataBox}>
          <Text style={styles.publicDataLabel}>사용 가능 부위</Text>
          {restrictionLines.map((line, index) => (
            <Text key={index} style={styles.publicDataText}>
              • {line}
            </Text>
          ))}
          <Text style={styles.publicDataText}>
            {restrictionLines.some((line) => line.includes("사용 제한"))
              ? "공공데이터 기준으로 일부 사용 조건에 제한 정보가 확인되었습니다."
              : "이 성분은 공공데이터 기준으로 주요 화장품 사용 조건에서 사용할 수 있는 성분입니다."}
          </Text>
        </View>
      ) : null}

      {(item.isRestricted || item.isAllergen) && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color={AppColors.risk} />
          <Text style={styles.warningText}>
            {item.restrictedReason ||
              item.allergenReason ||
              "주의가 필요한 성분입니다."}
          </Text>
        </View>
      )}

      {hasAnyPublicData && (
        <View
          style={[
            styles.publicWarningBox,
            hasPublicDataRestriction
              ? styles.publicRestrictionBox
              : styles.publicVerifiedBox,
          ]}
        >
          <Text style={styles.publicWarningTitle}>
            {hasPublicDataRestriction
              ? "공공데이터 주의 정보"
              : "공공데이터 확인"}
          </Text>
          <Text style={styles.publicWarningText}>
            {hasPublicDataRestriction
              ? userSummary?.simpleSummary ||
                "공공데이터에서 사용 제한 또는 국가별 규제 정보가 확인된 성분입니다."
              : "식약처 공공데이터에서 표준 성분 정보가 확인되었습니다."}
          </Text>
          {hasPublicDataRestriction && userSummary?.restrictionSummary ? (
            <>
              <Text style={styles.publicDataLabel}>제한 정보</Text>
              <Text style={styles.publicWarningText}>
                {userSummary.restrictionSummary}
              </Text>
            </>
          ) : null}
          {hasPublicDataRestriction && userSummary?.countrySummary ? (
            <>
              <Text style={styles.publicDataLabel}>국가 정보</Text>
              <Text style={styles.publicWarningText}>
                {userSummary.countrySummary}
              </Text>
            </>
          ) : null}
          {hasPublicDataRestriction ? (
            <>
              <Text style={styles.publicDataLabel}>사용자 안내</Text>
              <Text style={styles.publicWarningText}>
                {userSummary?.userAdvice ||
                  "공공데이터는 참고 정보이며, 개인 피부 상태에 따라 반응이 다를 수 있습니다."}
              </Text>
            </>
          ) : null}
        </View>
      )}

      {!hasAnyPublicData && !item.isMatched ? (
        <Text style={styles.noPublicDataText}>
          공공데이터에서 직접 확인된 정보가 없습니다.
        </Text>
      ) : null}
    </View>
  );
}

function getBestIngredientInfo(
  item: MatchedIngredient,
  ingredientInfo: PublicIngredientInfo[],
) {
  if (ingredientInfo.length === 0) return null;

  const targetName = normalizeName(item.standardName || item.originalName);

  const exactMatch = ingredientInfo.find(
    (info) => normalizeName(info.INGR_KOR_NAME || "") === targetName,
  );

  if (exactMatch) return exactMatch;

  const containsMatch = ingredientInfo.find((info) => {
    const publicName = normalizeName(info.INGR_KOR_NAME || "");

    return publicName.includes(targetName) || targetName.includes(publicName);
  });

  return containsMatch || ingredientInfo[0];
}

function normalizeName(value: string) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "")
    .toLowerCase()
    .trim();
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
        bg: AppColors.mintSoft,
        text: AppColors.safe,
        border: "#BDEFE4",
      };
    case "medium":
      return {
        bg: AppColors.cautionSoft,
        text: AppColors.caution,
        border: "#F8DCA0",
      };
    case "high":
      return {
        bg: AppColors.riskSoft,
        text: AppColors.risk,
        border: "#FFC6CE",
      };
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
  },

  permissionScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 10,
  },
  permissionDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: AppColors.textSub,
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: AppColors.card,
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
    color: AppColors.card,
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
    color: AppColors.card,
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
    borderColor: AppColors.card,
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
    borderColor: AppColors.card,
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
    borderColor: AppColors.card,
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
    borderColor: AppColors.card,
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
    color: AppColors.card,
    marginTop: 6,
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: AppColors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: AppColors.card,
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
    backgroundColor: AppColors.primarySoft,
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
    color: AppColors.text,
    marginBottom: 6,
  },
  headerDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textSub,
  },

  previewCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 16,
    ...SoftShadow,
  },
  previewImage: {
    width: "100%",
    height: 320,
    borderRadius: 18,
    backgroundColor: AppColors.subCard,
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
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
  },

  analyzeButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
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
    color: AppColors.card,
  },

  loadingCard: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  analysisCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
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
    color: AppColors.primary,
    marginBottom: 6,
  },
  resultProductName: {
    fontSize: 22,
    fontWeight: "900",
    color: AppColors.text,
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
    backgroundColor: AppColors.background,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  riskScoreTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  riskScoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: AppColors.textMuted,
    marginBottom: 8,
  },
  riskSummaryLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  riskScore: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 12,
  },
  riskBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: AppColors.border,
    overflow: "hidden",
  },
  riskBarFill: {
    height: "100%",
    borderRadius: 999,
  },

  conclusionBox: {
    backgroundColor: AppColors.subCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 18,
    marginBottom: 14,
  },
  conclusionLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 8,
  },
  conclusionText: {
    fontSize: 15,
    color: AppColors.text,
    lineHeight: 22,
    marginBottom: 12,
  },

  confidenceBox: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  confidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  confidenceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confidenceTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  confidenceLevel: {
    fontSize: 15,
    fontWeight: "900",
  },
  confidenceText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
  },
  confidenceCount: {
    fontSize: 12,
    fontWeight: "800",
    color: AppColors.textMuted,
    marginTop: 8,
  },

  infoBox: {
    backgroundColor: AppColors.background,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 8,
  },
  infoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: AppColors.textMuted,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  ingredientAnalysisItem: {
    backgroundColor: AppColors.card,
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
    color: AppColors.text,
    marginBottom: 4,
  },
  ingredientAnalysisSub: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textMuted,
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
    backgroundColor: AppColors.subCard,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  matchedBadgeText: {
    color: AppColors.safe,
  },
  unmatchedBadgeText: {
    color: AppColors.textMuted,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    backgroundColor: AppColors.riskSoft,
    borderRadius: 12,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: AppColors.risk,
  },

  reasonItem: {
    backgroundColor: AppColors.card,
    borderRadius: 14,
    padding: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  reasonIngredient: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
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
    color: AppColors.safe,
    marginBottom: 7,
  },
  recommendTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 7,
  },
  recommendSourceLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6A8F7B",
  },
  recommendText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
  },

  overallCard: {
    backgroundColor: AppColors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  overallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  overallLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: AppColors.textMuted,
    marginBottom: 4,
  },
  overallTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: AppColors.text,
  },
  overallText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
    marginTop: 12,
  },
  overallBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  overallBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: "#EEF1F6",
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: AppColors.textMuted,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textMuted,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.textMuted,
    marginTop: 8,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  ingredientRowText: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
  },
  ingredientSubText: {
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  statusBadgeSafe: {
    backgroundColor: AppColors.mintSoft,
  },
  statusBadgeSafeText: {
    color: AppColors.safe,
  },
  statusBadgeWarning: {
    backgroundColor: AppColors.cautionSoft,
  },
  statusBadgeWarningText: {
    color: AppColors.caution,
  },
  statusBadgeNeutral: {
    backgroundColor: AppColors.subCard,
  },
  statusBadgeNeutralText: {
    color: AppColors.textMuted,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionButton: {
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.card,
  },
  secondaryActionText: {
    color: AppColors.primary,
  },

  publicDataBox: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  publicDataLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: AppColors.primary,
    marginBottom: 5,
  },
  publicDataText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },
  publicWarningBox: {
    borderRadius: 12,
    padding: 11,
    marginTop: 8,
    borderWidth: 1,
  },
  publicVerifiedBox: {
    backgroundColor: AppColors.mintSoft,
    borderColor: "#BDEFE4",
  },
  publicRestrictionBox: {
    backgroundColor: AppColors.cautionSoft,
    borderColor: "#F3D58A",
  },
  publicWarningTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#C58A00",
    marginBottom: 6,
  },
  publicWarningLevel: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#8A5A00",
    marginBottom: 6,
  },
  publicWarningText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#6B5A2A",
  },
  noPublicDataText: {
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.textMuted,
    marginTop: 8,
  },
  toastContainer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    ...SoftShadow,
    zIndex: 1000,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: AppColors.mintSoft,
    borderWidth: 1,
    borderColor: "#BDEFE4",
  },
  toastError: {
    backgroundColor: AppColors.riskSoft,
    borderWidth: 1,
    borderColor: "#FFC6CE",
  },
  toastText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "800",
  },
  toastTextSuccess: {
    color: AppColors.safe,
  },
  toastTextError: {
    color: AppColors.risk,
  },
});
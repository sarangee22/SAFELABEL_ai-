import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PROFILE_STORAGE_KEY = "safelabel_user_profile";

const skinTypes = ["건성", "지성", "복합성", "중성", "수부지"];

const sensitivityTypes = ["민감하지 않음", "약간 민감", "민감", "매우 민감"];

const allergyOptions = [
  "없음",
  "향료",
  "알코올",
  "에탄올",
  "변성알코올",
  "페녹시에탄올",
  "파라벤",
  "메틸파라벤",
  "프로필파라벤",
  "색소",
  "에센셜오일",
  "리모넨",
  "리날룰",
  "벤질알코올",
  "시트랄",
  "제라니올",
  "라우릴황산나트륨",
];

const avoidOptions = [
  "향료",
  "알코올",
  "파라벤",
  "색소",
  "에센셜오일",
  "리모넨",
  "페녹시에탄올",
  "잘 모르겠어요",
];

const symptomOptions = [
  "붉어짐(홍조)",
  "가려움",
  "건조",
  "트러블/여드름",
  "눈주위 민감",
];

const avoidCategoryMap: Record<string, string[]> = {
  향료: ["fragrance", "향료"],
  알코올: ["alcohol", "ethanol", "에탄올", "변성알코올"],
  파라벤: ["paraben", "파라벤", "메틸파라벤", "프로필파라벤"],
  색소: ["colorant", "색소"],
  에센셜오일: ["essential oil", "에센셜오일", "리모넨", "리날룰"],
  리모넨: ["limonene", "리모넨"],
  페녹시에탄올: ["phenoxyethanol", "페녹시에탄올"],
  "잘 모르겠어요": [],
};

type UserProfile = {
  name: string;
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
  symptoms?: string[];
};

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [skinType, setSkinType] = useState("건성");
  const [sensitivity, setSensitivity] = useState("약간 민감");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedAvoidItems, setSelectedAvoidItems] = useState<string[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

      if (!savedProfile) {
        setIsLoaded(true);
        return;
      }

      const parsedProfile: UserProfile = JSON.parse(savedProfile);

      setName(parsedProfile.name || "");
      setSkinType(parsedProfile.skinType || "건성");
      setSensitivity(parsedProfile.sensitivity || "약간 민감");
      setSelectedAllergies(parsedProfile.allergies || []);

      setSelectedAvoidItems(parsedProfile.avoidIngredients || []);
      setSelectedSymptoms(parsedProfile.symptoms || []);

      setIsLoaded(true);
    } catch (error) {
      console.error("프로필 불러오기 실패:", error);
      setIsLoaded(true);

      Alert.alert(
        "불러오기 실패",
        "저장된 프로필 정보를 불러오는 중 문제가 발생했습니다.",
      );
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProfile();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadProfile]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000); // 3초 후 토스트 메시지 숨김
  };

  const toggleAllergy = (item: string) => {
    if (item === "없음") {
      setSelectedAllergies(["없음"]);
      return;
    }

    setSelectedAllergies((prev) => {
      const filtered = prev.filter((value) => value !== "없음");

      if (filtered.includes(item)) {
        return filtered.filter((value) => value !== item);
      }

      return [...filtered, item];
    });
  };

  const toggleAvoidOption = (item: string) => {
    if (item === "잘 모르겠어요") {
      setSelectedAvoidItems(["잘 모르겠어요"]);
      return;
    }

    setSelectedAvoidItems((prev) => {
      const withoutUnknown = prev.filter((value) => value !== "잘 모르겠어요");

      if (withoutUnknown.includes(item)) {
        return withoutUnknown.filter((value) => value !== item);
      }

      return [...withoutUnknown, item];
    });
  };

  const toggleSymptom = (item: string) => {
    setSelectedSymptoms((prev) => {
      if (prev.includes(item)) return prev.filter((v) => v !== item);
      return [...prev, item];
    });
  };

  const handleSave = async () => {
    if (isSaving) return; // 중복 클릭 방지
    setIsSaving(true);

    try {
      const normalizedAllergies = selectedAllergies.includes("없음")
        ? []
        : selectedAllergies;
      const normalizedAvoids = selectedAvoidItems.includes("잘 모르겠어요")
        ? ["잘 모르겠어요"]
        : // expand categories to representative ingredient keywords
          Array.from(
            new Set(
              selectedAvoidItems.flatMap(
                (cat) => avoidCategoryMap[cat] || [cat],
              ),
            ),
          );

      const normalizedSymptoms = selectedSymptoms;

      const profile: UserProfile = {
        name: name.trim(),
        skinType,
        sensitivity,
        allergies: normalizedAllergies,
        avoidIngredients: normalizedAvoids,
        symptoms: normalizedSymptoms,
      };

      // Write and verify to increase reliability across platforms
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

      const verify = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

      if (!verify) {
        throw new Error("저장 확인 실패: 저장된 데이터가 없습니다.");
      }

      // Optionally update local UI state immediately
      setSelectedAllergies(normalizedAllergies);
      setSelectedAvoidItems(selectedAvoidItems);
      setSelectedSymptoms(selectedSymptoms);

      showToast("맞춤 설정이 저장되었습니다.", "success");
    } catch (error) {
      console.error("프로필 저장 실패:", error);
      showToast("설정 저장에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (isResetting) return; // 중복 클릭 방지
    setIsResetting(true);

    try {
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);

      setName("");
      setSkinType("건성");
      setSensitivity("약간 민감");
      setSelectedAllergies([]);
      setSelectedAvoidItems([]);
      setSelectedSymptoms([]);

      showToast("설정이 초기화되었습니다.", "success");
    } catch (error) {
      console.error("프로필 초기화 실패:", error);
      showToast("설정 초기화에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  const selectedAllergyText =
    selectedAllergies.length > 0 ? selectedAllergies.join(", ") : "미선택";
  const selectedAvoidText =
    selectedAvoidItems.length > 0 ? selectedAvoidItems.join(", ") : "미선택";

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>프로필 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.profileIconBox}>
            <Ionicons
              name="person-outline"
              size={30}
              color={AppColors.primary}
            />
          </View>

          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>맞춤 분석 설정</Text>
            <Text style={styles.headerDescription}>
              피부 타입과 피하고 싶은 성분을 바탕으로 분석 기준을 조정합니다.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>기본 정보</Text>

          <Text style={styles.label}>이름 또는 닉네임</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 선우"
            placeholderTextColor={AppColors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>피부 타입</Text>
          <Text style={styles.sectionDescription}>
            현재 피부 상태에 가장 가까운 타입을 선택하세요.
          </Text>

          <View style={styles.optionGrid}>
            {skinTypes.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.optionChip,
                  skinType === item && styles.selectedChip,
                ]}
                onPress={() => setSkinType(item)}
              >
                <Text
                  style={[
                    styles.optionText,
                    skinType === item && styles.selectedChipText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>민감 피부 정도</Text>
          <Text style={styles.sectionDescription}>
            성분 분석 시 자극 가능성 판단에 반영됩니다.
          </Text>

          <View style={styles.verticalOptions}>
            {sensitivityTypes.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.rowOption,
                  sensitivity === item && styles.selectedRowOption,
                ]}
                onPress={() => setSensitivity(item)}
              >
                <View style={styles.rowOptionTextBox}>
                  <Text
                    style={[
                      styles.rowOptionTitle,
                      sensitivity === item && styles.selectedRowText,
                    ]}
                  >
                    {item}
                  </Text>

                  <Text style={styles.rowOptionDescription}>
                    {getSensitivityDescription(item)}
                  </Text>
                </View>

                {sensitivity === item && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={AppColors.primary}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>피부 증상 (선택)</Text>
          <Text style={styles.sectionDescription}>
            평소 자주 경험하는 피부 반응을 선택하세요. (선택사항)
          </Text>

          <View style={styles.optionGrid}>
            {symptomOptions.map((item) => {
              const isSelected = selectedSymptoms.includes(item);

              return (
                <Pressable
                  key={item}
                  style={[styles.optionChip, isSelected && styles.selectedChip]}
                  onPress={() => toggleSymptom(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedChipText,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>알레르기 / 주의 성분</Text>
          <Text style={styles.sectionDescription}>
            선택한 성분은 분석 결과에서 더 강하게 표시됩니다.
          </Text>

          <View style={styles.optionGrid}>
            {allergyOptions.map((item) => {
              const isSelected = selectedAllergies.includes(item);

              return (
                <Pressable
                  key={item}
                  style={[styles.optionChip, isSelected && styles.selectedChip]}
                  onPress={() => toggleAllergy(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedChipText,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, styles.extraLabel]}>
            지금 피하고 싶은 성분 유형
          </Text>

          <Text style={styles.sectionDescription}>
            모르는 경우에도 가장 가까운 항목을 선택하거나 “잘 모르겠어요”를
            선택하세요.
          </Text>

          <View style={styles.optionGrid}>
            {avoidOptions.map((item) => {
              const isSelected = selectedAvoidItems.includes(item);

              return (
                <Pressable
                  key={item}
                  style={[styles.optionChip, isSelected && styles.selectedChip]}
                  onPress={() => toggleAvoidOption(item)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedChipText,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>맞춤 분석 기준</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>피부 타입</Text>
            <Text style={styles.summaryValue}>{skinType}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>민감도</Text>
            <Text style={styles.summaryValue}>{sensitivity}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>증상(선택)</Text>
            <Text style={styles.summaryValue}>
              {selectedSymptoms.length > 0
                ? selectedSymptoms.join(", ")
                : "미선택"}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>알레르기</Text>
            <Text style={styles.summaryValue}>{selectedAllergyText}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>회피 성분</Text>
            <Text style={styles.summaryValue}>{selectedAvoidText}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, isSaving && styles.disabledButton]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={AppColors.card} size="small" />
          ) : (
            <Ionicons name="save-outline" size={20} color={AppColors.card} />
          )}
          <Text style={styles.saveButtonText}>
            {isSaving ? "저장 중..." : "맞춤 설정 저장하기"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.resetButton, isResetting && styles.disabledButton]}
          onPress={handleReset}
          disabled={isResetting}
        >
          {isResetting && (
            <ActivityIndicator
              color={AppColors.textSub}
              size="small"
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={styles.resetButtonText}>
            {isResetting ? "초기화 중..." : "설정 초기화"}
          </Text>
        </Pressable>
      </ScrollView>

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

function getSensitivityDescription(type: string) {
  switch (type) {
    case "민감하지 않음":
      return "일반적인 성분 기준으로 분석합니다.";
    case "약간 민감":
      return "자극 가능성이 있는 성분을 함께 확인합니다.";
    case "민감":
      return "주의 성분을 더 보수적으로 판단합니다.";
    case "매우 민감":
      return "향료, 알코올 등 자극 성분을 강하게 표시합니다.";
    default:
      return "";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "800",
    color: AppColors.textSub,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  profileIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
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
    color: AppColors.textSub,
  },

  card: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.textSub,
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#3A3D46",
    marginBottom: 8,
  },
  extraLabel: {
    marginTop: 18,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: "#E4E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: AppColors.text,
  },
  multilineInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 8,
  },

  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "#F1F4F9",
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  selectedChip: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#69707D",
  },
  selectedChipText: {
    color: AppColors.card,
  },

  verticalOptions: {
    gap: 10,
  },
  rowOption: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedRowOption: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  rowOptionTextBox: {
    flex: 1,
    marginRight: 12,
  },
  rowOptionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 4,
  },
  selectedRowText: {
    color: "#4F6EF7",
  },
  rowOptionDescription: {
    fontSize: 13,
    color: AppColors.textSub,
  },

  summaryCard: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: Radius.card,
    padding: 20,
    marginTop: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#DDE5FF",
    ...SoftShadow,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.text,
    marginLeft: 16,
  },

  saveButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: AppColors.card,
  },
  resetButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: AppColors.subCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    flexDirection: "row",
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: AppColors.textSub,
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
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
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
  "파라벤",
  "색소",
  "에센셜오일",
  "리모넨",
  "리날룰",
  "벤질알코올",
];

type UserProfile = {
  name: string;
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
};

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [skinType, setSkinType] = useState("건성");
  const [sensitivity, setSensitivity] = useState("약간 민감");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [cautionIngredient, setCautionIngredient] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
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

      const avoidText = (parsedProfile.avoidIngredients || []).join(", ");
      setCautionIngredient(avoidText);

      setIsLoaded(true);
    } catch (error) {
      console.error("프로필 불러오기 실패:", error);
      setIsLoaded(true);

      Alert.alert(
        "불러오기 실패",
        "저장된 프로필 정보를 불러오는 중 문제가 발생했습니다."
      );
    }
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

  const parseAvoidIngredients = (text: string) => {
    return text
      .split(/[,，ㆍ·\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const handleSave = async () => {
    try {
      const normalizedAllergies = selectedAllergies.includes("없음")
        ? []
        : selectedAllergies;

      const avoidIngredients = parseAvoidIngredients(cautionIngredient);

      const profile: UserProfile = {
        name: name.trim(),
        skinType,
        sensitivity,
        allergies: normalizedAllergies,
        avoidIngredients,
      };

      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

      Alert.alert("프로필 저장", "맞춤 분석 정보가 저장되었습니다.");
    } catch (error) {
      console.error("프로필 저장 실패:", error);

      Alert.alert(
        "저장 실패",
        "맞춤 분석 정보를 저장하는 중 문제가 발생했습니다."
      );
    }
  };

  const handleReset = async () => {
    try {
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);

      setName("");
      setSkinType("건성");
      setSensitivity("약간 민감");
      setSelectedAllergies([]);
      setCautionIngredient("");

      Alert.alert("초기화 완료", "저장된 맞춤 설정이 초기화되었습니다.");
    } catch (error) {
      console.error("프로필 초기화 실패:", error);

      Alert.alert(
        "초기화 실패",
        "맞춤 설정을 초기화하는 중 문제가 발생했습니다."
      );
    }
  };

  const selectedAllergyText =
    selectedAllergies.length > 0 ? selectedAllergies.join(", ") : "미선택";

  const avoidIngredientList = parseAvoidIngredients(cautionIngredient);

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>프로필 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileIconBox}>
          <Ionicons name="person-outline" size={30} color="#5B7CFA" />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>내 프로필</Text>
          <Text style={styles.headerDescription}>
            피부 정보에 맞춰 화장품 성분을 분석합니다.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>기본 정보</Text>

        <Text style={styles.label}>이름 또는 닉네임</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 선우"
          placeholderTextColor="#A0A7B5"
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
                <Ionicons name="checkmark-circle" size={24} color="#5B7CFA" />
              )}
            </Pressable>
          ))}
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
          직접 입력한 회피 성분
        </Text>

        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="예: 페녹시에탄올, 특정 향료 등"
          placeholderTextColor="#A0A7B5"
          value={cautionIngredient}
          onChangeText={setCautionIngredient}
          multiline
        />

        <Text style={styles.helperText}>
          여러 개 입력할 때는 쉼표로 구분하세요.
        </Text>
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
          <Text style={styles.summaryLabel}>알레르기</Text>
          <Text style={styles.summaryValue}>{selectedAllergyText}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>회피 성분</Text>
          <Text style={styles.summaryValue}>
            {avoidIngredientList.length > 0
              ? avoidIngredientList.join(", ")
              : "미입력"}
          </Text>
        </View>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="save-outline" size={20} color="#FFFFFF" />
        <Text style={styles.saveButtonText}>맞춤 설정 저장하기</Text>
      </Pressable>

      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>설정 초기화</Text>
      </Pressable>
    </ScrollView>
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
    backgroundColor: "#F8FAFC",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7A808C",
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
    color: "#7A808C",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A808C",
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E4E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#20222A",
  },
  multilineInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: "#8A8F98",
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
    borderColor: "#E5EAF2",
  },
  selectedChip: {
    backgroundColor: "#5B7CFA",
    borderColor: "#5B7CFA",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#69707D",
  },
  selectedChipText: {
    color: "#FFFFFF",
  },

  verticalOptions: {
    gap: 10,
  },
  rowOption: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EAF2",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedRowOption: {
    borderColor: "#5B7CFA",
    backgroundColor: "#EEF3FF",
  },
  rowOptionTextBox: {
    flex: 1,
    marginRight: 12,
  },
  rowOptionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 4,
  },
  selectedRowText: {
    color: "#4F6EF7",
  },
  rowOptionDescription: {
    fontSize: 13,
    color: "#7A808C",
  },

  summaryCard: {
    backgroundColor: "#E8EEFF",
    borderRadius: 22,
    padding: 20,
    marginTop: 4,
    marginBottom: 18,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#20222A",
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
    color: "#20222A",
    marginLeft: 16,
  },

  saveButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#5B7CFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  resetButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#7A808C",
  },
});
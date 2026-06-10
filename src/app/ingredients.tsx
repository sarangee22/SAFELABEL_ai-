import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { API_ENDPOINTS } from "../constants/api";

type IngredientSearchResult = {
  ingredientName: string;
  englishName: string;
  casNo: string;
  synonyms?: string;
  hasPublicData: boolean;
  summary: string;
  isRestricted?: boolean;
  isAllergen?: boolean;
  allergenReason?: string;
  restrictedInfo?: {
    restrictedReason?: string;
  } | null;
  fitAdvice?: string;
};

type UserProfile = {
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
};

const RECOMMENDED_SEARCHES = [
  "정제수",
  "글리세린",
  "나이아신아마이드",
  "향료",
  "에탄올",
];

export default function IngredientsScreen() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<IngredientSearchResult[]>([]);
  const [selectedIngredient, setSelectedIngredient] =
    useState<IngredientSearchResult | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      const reloadProfile = async () => {
        try {
          const saved = await AsyncStorage.getItem("safelabel_user_profile");

          if (!saved) {
            setUserProfile(null);
            return;
          }

          const parsed = JSON.parse(saved);

          const profile = {
            skinType: parsed.skinType || "",
            sensitivity: parsed.sensitivity || "",
            allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
            avoidIngredients: Array.isArray(parsed.avoidIngredients)
              ? parsed.avoidIngredients
              : [],
          };

          setUserProfile(profile);
          setSearchResults((current) =>
            current.map((item) => ({
              ...item,
              fitAdvice: buildFitAdvice(item, profile),
            })),
          );
          setSelectedIngredient((current) =>
            current
              ? {
                  ...current,
                  fitAdvice: buildFitAdvice(current, profile),
                }
              : null,
          );
        } catch (e) {
          console.log("포커스 시 프로필 로드 실패:", e);
          setUserProfile(null);
        }
      };

      reloadProfile();
    }, []),
  );

  const handleSearch = async (searchTerm?: string) => {
    const keyword = (searchTerm ?? query).trim();

    if (!keyword) {
      setSearchResults([]);
      setSelectedIngredient(null);
      setErrorMessage("검색할 성분명을 입력해 주세요.");
      return;
    }

    try {
      setQuery(keyword);
      setIsSearching(true);
      setErrorMessage("");
      setSearchResults([]);
      setSelectedIngredient(null);

      const response = await fetch(
        `${API_ENDPOINTS.searchIngredients}?name=${encodeURIComponent(keyword)}`
      );

      if (!response.ok) {
        throw new Error("성분 검색 요청에 실패했습니다.");
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.data) || data.data.length === 0) {
        setErrorMessage(
          "공공데이터에서 해당 성분을 찾지 못했습니다. 한글명, 영문명, 또는 성분의 일부 이름으로 다시 검색해 주세요."
        );
        return;
      }

      const resultItems: IngredientSearchResult[] = data.data.map(
        (resultItem: any) => ({
          ingredientName:
            resultItem.koreanName || resultItem.ingredientName || keyword,
          englishName: resultItem.englishName || "",
          synonyms: resultItem.synonyms || "",
          casNo: resultItem.casNo || "",
          hasPublicData: resultItem.hasPublicData === true,
          summary:
            resultItem.summary ||
            resultItem.originDefinition ||
            resultItem.synonyms ||
            "공공데이터에서 사용자용 요약을 구성할 정보가 아직 없습니다.",
          isRestricted: Boolean(resultItem.isRestricted),
          isAllergen: Boolean(resultItem.isAllergen),
          allergenReason: resultItem.allergenReason || "",
          restrictedInfo: resultItem.restrictedInfo || null,
          fitAdvice: "",
        })
      );

      const updatedResults = resultItems.map((item) => ({
        ...item,
        fitAdvice: buildFitAdvice(item, userProfile),
      }));

      setSearchResults(updatedResults);
      setSelectedIngredient(updatedResults[0] || null);
    } catch (error) {
      console.log("성분 검색 실패:", error);
      setErrorMessage(
        "공공데이터 검색 결과를 불러오지 못했습니다. 네트워크나 서버 설정을 확인해 주세요."
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="book-outline" size={30} color={AppColors.primary} />
        </View>
        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>성분사전</Text>
          <Text style={styles.headerDescription}>
            성분명을 검색해 기본 정보, 공공데이터 확인 여부, 개인 맞춤 적합도를 살펴보세요.
          </Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="예: 정제수, 글리세린"
            placeholderTextColor={AppColors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
          />
          <Pressable
            style={styles.searchButton}
            onPress={() => handleSearch()}
          >
            {isSearching ? (
              <ActivityIndicator color={AppColors.card} />
            ) : (
              <Ionicons name="search" size={21} color={AppColors.card} />
            )}
          </Pressable>
        </View>
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>검색 팁</Text>
          <Text style={styles.hintText}>한글명, 영문명, 동의어, CAS No.로 검색하세요</Text>
          <Text style={styles.hintText}>공백 없이 검색하면 더 빨라집니다</Text>
        </View>
        {userProfile ? (
          <Text style={styles.profileHintText}>
            프로필에 따라 개인화된 적합도 안내를 확인할 수 있습니다.
          </Text>
        ) : (
          <Pressable
            style={styles.profileHintButton}
            onPress={() => router.push("/profile")}
          >
            <Text style={styles.profileHintButtonText}>프로필 설정하기</Text>
          </Pressable>
        )}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>검색 결과</Text>
        <Text style={styles.sectionDescription}>
          입력한 성분명과 공공데이터 매칭 결과를 확인하세요.
        </Text>

        {isSearching ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={AppColors.primary} />
            <Text style={styles.loadingMessage}>검색 중입니다...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{errorMessage}</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <View style={styles.resultList}>
            {searchResults.map((item) => (
              <Pressable
                key={`${item.ingredientName}-${item.casNo}-${item.englishName}`}
                style={[
                  styles.resultCard,
                  selectedIngredient?.ingredientName === item.ingredientName &&
                  selectedIngredient?.casNo === item.casNo
                    ? styles.resultCardSelected
                    : null,
                ]}
                onPress={() => setSelectedIngredient(item)}
              >
                <View style={styles.resultTopRow}>
                  <View style={styles.resultNameBox}>
                    <Text style={styles.ingredientName}>{item.ingredientName}</Text>
                    <Text style={styles.englishName}>{item.englishName || "영문명 정보 없음"}</Text>
                  </View>
                  <View
                    style={[
                      styles.publicBadge,
                      item.hasPublicData ? styles.publicBadgeOn : styles.publicBadgeOff,
                    ]}
                  >
                    <Text
                      style={[
                        styles.publicBadgeText,
                        item.hasPublicData
                          ? styles.publicBadgeTextOn
                          : styles.publicBadgeTextOff,
                      ]}
                    >
                      {item.hasPublicData ? "공공데이터 확인" : "로컬/미확인"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.summaryText} numberOfLines={2}>
                  {item.summary}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              공공데이터에서 해당 성분을 찾지 못했습니다. 한글명, 영문명, 또는 성분의 일부 이름으로 다시 검색해 주세요.
            </Text>
            <View style={styles.suggestionRow}>
              {RECOMMENDED_SEARCHES.map((term) => (
                <Pressable
                  key={term}
                  style={styles.suggestionButton}
                  onPress={() => {
                    setErrorMessage("");
                    setSearchResults([]);
                    setSelectedIngredient(null);
                    handleSearch(term);
                  }}
                >
                  <Text style={styles.suggestionButtonText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      {selectedIngredient ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>상세 정보</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{selectedIngredient.ingredientName}</Text>
              <Text style={styles.detailHint}>{selectedIngredient.englishName || "영문명 없음"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CAS No</Text>
              <Text style={styles.detailValue}>{selectedIngredient.casNo || "정보 없음"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>설명</Text>
              <Text style={styles.detailValue}>{selectedIngredient.summary}</Text>
            </View>
            {selectedIngredient.restrictedInfo?.restrictedReason ? (
              <View style={styles.warningBox}> 
                <Text style={styles.warningLabel}>제한/주의 정보</Text>
                <Text style={styles.warningText}>{selectedIngredient.restrictedInfo.restrictedReason}</Text>
              </View>
            ) : null}
            {selectedIngredient.fitAdvice ? (
              <View style={styles.fitCardDetail}>
                <Text style={styles.fitLabel}>사용자 맞춤 조언</Text>
                <Text style={styles.fitText}>{selectedIngredient.fitAdvice}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>도움말</Text>
        <Text style={styles.sectionDescription}>
          성분명 검색 시 한글/영문/동의어 모두 사용해 보세요. 예: 글리세린,
          Glycerin, 향료.
        </Text>
      </View>
    </ScrollView>
  );
}

function normalizeKeyword(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function matchLabel(value: string | undefined, list: string[] = []) {
  const normalizedValue = normalizeKeyword(value);

  return list.some((item) => {
    const normalizedItem = normalizeKeyword(item);
    return (
      normalizedItem &&
      (normalizedValue.includes(normalizedItem) || normalizedItem.includes(normalizedValue))
    );
  });
}

function buildFitAdvice(
  item: Partial<IngredientSearchResult>,
  userProfile: UserProfile | null
) {
  const reasons: string[] = [];

  if (item.isRestricted) {
    reasons.push(
      "공공데이터에서 사용 제한 또는 주의 정보가 확인된 성분입니다. 피부 자극 가능성을 주의하세요."
    );
  }

  if (item.isAllergen) {
    reasons.push(
      item.allergenReason ||
        "알레르기 유발 가능 성분으로 분류되어 민감한 사용자는 주의가 필요합니다.",
    );
  }

  if (userProfile) {
    if (
      matchLabel(item.ingredientName, userProfile.avoidIngredients) ||
      matchLabel(item.englishName, userProfile.avoidIngredients) ||
      matchLabel(item.synonyms, userProfile.avoidIngredients)
    ) {
      reasons.push("사용자 설정에서 피하고 싶은 성분 목록에 포함되어 있습니다.");
    }

    if (
      matchLabel(item.ingredientName, userProfile.allergies) ||
      matchLabel(item.englishName, userProfile.allergies) ||
      matchLabel(item.synonyms, userProfile.allergies)
    ) {
      reasons.push(
        "프로필 알레르기 목록과 일치합니다. 이 성분은 주의해서 사용하세요."
      );
    }

    if (userProfile.sensitivity === "민감") {
      reasons.push("민감 피부로 설정되어 있으므로 자극 가능성에 더 주의하세요.");
    } else if (userProfile.sensitivity === "매우 민감") {
      reasons.push(
        "매우 민감 피부 설정입니다. 민감한 성분은 가능한 한 피하는 것이 좋습니다."
      );
    }
  }

  if (reasons.length === 0) {
    if (userProfile) {
      return "현재 프로필 기준으로는 이 성분이 즉시 위험한 성분으로 보이지 않습니다. 사용 전 테스트 후 피부 반응을 확인하세요.";
    }

    return undefined;
  }

  return reasons.join(" ");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background,
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
  iconBox: {
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
    lineHeight: 20,
    color: AppColors.textSub,
  },
  searchCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 15,
    fontSize: 15,
    color: AppColors.text,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: AppColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  hintRow: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hintText: {
    fontSize: 12,
    color: AppColors.textSub,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.risk,
    marginTop: 10,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: AppColors.textSub,
    marginBottom: 14,
    lineHeight: 20,
  },
  resultList: {
    gap: 12,
  },
  resultCard: {
    backgroundColor: AppColors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 12,
    ...SoftShadow,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  resultNameBox: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 5,
  },
  englishName: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textSub,
  },
  publicBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  publicBadgeOn: {
    backgroundColor: AppColors.mintSoft,
  },
  publicBadgeOff: {
    backgroundColor: AppColors.subCard,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  publicBadgeTextOn: {
    color: AppColors.safe,
  },
  publicBadgeTextOff: {
    color: AppColors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  metaBox: {
    flex: 1,
    backgroundColor: AppColors.subCard,
    borderRadius: 16,
    padding: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textSub,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: AppColors.text,
    lineHeight: 20,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textSub,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.text,
  },
  profileHintText: {
    fontSize: 13,
    color: AppColors.textSub,
    marginTop: 12,
    lineHeight: 18,
  },
  profileHintButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
  },
  profileHintButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.primary,
  },
  fitCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: AppColors.subCard,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  fitHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  fitLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textSub,
  },
  fitBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fitBadgeSafe: {
    backgroundColor: AppColors.mintSoft,
  },
  fitBadgeWarning: {
    backgroundColor: AppColors.riskSoft,
  },
  fitBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  fitBadgeTextSafe: {
    color: AppColors.safe,
  },
  fitBadgeTextWarning: {
    color: AppColors.risk,
  },
  fitText: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.text,
  },
  resultCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  loadingBox: {
    backgroundColor: AppColors.card,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    ...SoftShadow,
  },
  loadingMessage: {
    marginTop: 10,
    fontSize: 14,
    color: AppColors.textSub,
  },
  detailCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  detailHeader: {
    marginBottom: 16,
  },
  detailName: {
    fontSize: 20,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 6,
  },
  detailHint: {
    fontSize: 13,
    color: AppColors.textSub,
  },
  detailRow: {
    marginBottom: 14,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textSub,
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    color: AppColors.text,
    lineHeight: 22,
  },
  warningBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: AppColors.riskSoft,
  },
  warningLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: AppColors.risk,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 14,
    color: AppColors.text,
    lineHeight: 20,
  },
  fitCardDetail: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: AppColors.subCard,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  emptyBox: {
    backgroundColor: AppColors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  emptyText: {
    fontSize: 14,
    color: AppColors.textSub,
    textAlign: "center",
    marginBottom: 14,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  suggestionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: AppColors.primarySoft,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  suggestionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.primary,
  },
});

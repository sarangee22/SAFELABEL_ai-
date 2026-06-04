import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type RiskLevel = "low" | "medium" | "high";

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

type SingleAnalysis = {
  id: number;
  type: "single";
  productName: string;
  brand?: string;
  date: string;
  riskScore: number;
  riskLevel: RiskLevel;
  cautionIngredients: string[];
  mainIngredients: string[];
  matchedIngredients?: MatchedIngredient[];
  riskReasons?: RiskReason[];
  summary: string;
  recommendation?: string;
  imageUri?: string;
};

type CompareAnalysis = {
  id: number;
  type: "compare";
  firstProductName: string;
  secondProductName: string;
  recommendedProduct: string;
  date: string;
  firstRiskScore: number;
  secondRiskScore: number;
  summary: string;
};

type HistoryItem = SingleAnalysis | CompareAnalysis;

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [historyItem, setHistoryItem] = useState<HistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistoryDetail();
  }, [id]);

  const loadHistoryDetail = async () => {
    try {
      setIsLoading(true);

      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const history: HistoryItem[] = savedHistory ? JSON.parse(savedHistory) : [];

      const targetItem = history.find((item) => String(item.id) === String(id));

      if (!targetItem) {
        Alert.alert("기록 없음", "해당 분석 기록을 찾을 수 없습니다.");
        setHistoryItem(null);
        return;
      }

      setHistoryItem(targetItem);
    } catch (error) {
      console.log("분석 상세 불러오기 실패:", error);
      Alert.alert("불러오기 실패", "분석 상세 정보를 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePdf = () => {
    Alert.alert("PDF 저장", "PDF 저장 기능은 추후 연결 예정입니다.");
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#5B7CFA" size="large" />
        <Text style={styles.loadingText}>분석 상세를 불러오는 중...</Text>
      </View>
    );
  }

  if (!historyItem) {
    return (
      <View style={styles.emptyScreen}>
        <Ionicons name="document-text-outline" size={42} color="#A0A7B5" />
        <Text style={styles.emptyTitle}>기록을 찾을 수 없어요</Text>
        <Text style={styles.emptyText}>
          분석 기록이 삭제되었거나 잘못된 접근일 수 있습니다.
        </Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#20222A" />
        </Pressable>

        <Text style={styles.topTitle}>분석 상세</Text>

        <Pressable style={styles.iconButton} onPress={handleSavePdf}>
          <Ionicons name="document-text-outline" size={22} color="#5B7CFA" />
        </Pressable>
      </View>

      {historyItem.type === "single" ? (
        <SingleDetail item={historyItem} />
      ) : (
        <CompareDetail item={historyItem} />
      )}
    </ScrollView>
  );
}

function SingleDetail({ item }: { item: SingleAnalysis }) {
  const riskColor = getRiskColor(item.riskLevel);
  const riskLabel = getRiskLabel(item.riskLevel);

  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.typeBadge}>
          <Ionicons name="scan-outline" size={14} color="#5B7CFA" />
          <Text style={styles.typeBadgeText}>단일 분석</Text>
        </View>

        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.brandText}>{item.brand || "OCR 분석 제품"}</Text>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>

        <View style={styles.scoreBox}>
          <View>
            <Text style={styles.scoreLabel}>사용자 맞춤 위험도</Text>
            <Text style={[styles.scoreValue, { color: riskColor.text }]}>
              {item.riskScore}점
            </Text>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: riskColor.bg }]}>
            <Text style={[styles.riskBadgeText, { color: riskColor.text }]}>
              {riskLabel}
            </Text>
          </View>
        </View>

        <View style={styles.riskBarBackground}>
          <View
            style={[
              styles.riskBarFill,
              {
                width: `${item.riskScore}%`,
                backgroundColor: riskColor.text,
              },
            ]}
          />
        </View>
      </View>

      <Section title="AI 요약" icon="sparkles-outline">
        <Text style={styles.bodyText}>{item.summary}</Text>
      </Section>

      <Section title="AI 추천" icon="bulb-outline">
        <Text style={styles.bodyText}>
          {item.recommendation || "추천 정보가 없습니다."}
        </Text>
      </Section>

      <Section title="주의 성분" icon="warning-outline">
        <Text style={styles.bodyText}>
          {item.cautionIngredients.length > 0
            ? item.cautionIngredients.join(", ")
            : "특별한 주의 성분 없음"}
        </Text>
      </Section>

      <Section title="주요 성분" icon="flask-outline">
        <Text style={styles.bodyText}>
          {item.mainIngredients.length > 0
            ? item.mainIngredients.join(", ")
            : "추출된 성분이 없습니다."}
        </Text>
      </Section>

      <Section title="공공데이터 매칭 성분" icon="library-outline">
        {item.matchedIngredients && item.matchedIngredients.length > 0 ? (
          item.matchedIngredients.map((ingredient, index) => (
            <View
              key={`${ingredient.standardName}-${index}`}
              style={styles.ingredientCard}
            >
              <View style={styles.ingredientTop}>
                <Text style={styles.ingredientName}>
                  {ingredient.standardName}
                </Text>

                <View
                  style={[
                    styles.matchBadge,
                    ingredient.isMatched
                      ? styles.matchedBadge
                      : styles.unmatchedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.matchBadgeText,
                      ingredient.isMatched
                        ? styles.matchedBadgeText
                        : styles.unmatchedBadgeText,
                    ]}
                  >
                    {ingredient.isMatched ? "매칭됨" : "미매칭"}
                  </Text>
                </View>
              </View>

              {ingredient.englishName ? (
                <Text style={styles.ingredientSub}>
                  {ingredient.englishName}
                </Text>
              ) : null}

              {ingredient.description ? (
                <Text style={styles.ingredientDescription}>
                  {ingredient.description}
                </Text>
              ) : null}

              {(ingredient.isRestricted || ingredient.isAllergen) && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={16} color="#D94C5F" />
                  <Text style={styles.warningText}>
                    {ingredient.restrictedReason || ingredient.allergenReason}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.bodyText}>매칭된 성분 정보가 없습니다.</Text>
        )}
      </Section>

      <Section title="위험도 판단 근거" icon="analytics-outline">
        {item.riskReasons && item.riskReasons.length > 0 ? (
          item.riskReasons.map((reason, index) => (
            <View key={`${reason.ingredient}-${index}`} style={styles.reasonCard}>
              <Text style={styles.reasonIngredient}>{reason.ingredient}</Text>
              <Text style={styles.reasonText}>{reason.reason}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.bodyText}>
            현재 기준에서는 특별한 위험도 상승 근거가 적게 감지되었습니다.
          </Text>
        )}
      </Section>
    </>
  );
}

function CompareDetail({ item }: { item: CompareAnalysis }) {
  const firstRisk = getRiskLevelByScore(item.firstRiskScore);
  const secondRisk = getRiskLevelByScore(item.secondRiskScore);

  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.compareTypeBadge}>
          <Ionicons name="git-compare-outline" size={14} color="#22A06B" />
          <Text style={styles.compareTypeBadgeText}>비교 분석</Text>
        </View>

        <Text style={styles.productName}>제품 비교 결과</Text>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>

        <View style={styles.compareProducts}>
          <View style={styles.compareBox}>
            <Text style={styles.compareLabel}>제품 A</Text>
            <Text style={styles.compareName}>{item.firstProductName}</Text>
          </View>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.compareBox}>
            <Text style={styles.compareLabel}>제품 B</Text>
            <Text style={styles.compareName}>{item.secondProductName}</Text>
          </View>
        </View>
      </View>

      <Section title="AI 비교 요약" icon="sparkles-outline">
        <Text style={styles.bodyText}>{item.summary}</Text>
      </Section>

      <Section title="AI 추천" icon="thumbs-up-outline">
        <View style={styles.recommendBox}>
          <Text style={styles.recommendLabel}>추천 제품</Text>
          <Text style={styles.recommendProduct}>{item.recommendedProduct}</Text>
        </View>
      </Section>

      <Section title="위험도 비교" icon="analytics-outline">
        <RiskMiniBar
          label={item.firstProductName}
          score={item.firstRiskScore}
          riskLevel={firstRisk}
        />

        <RiskMiniBar
          label={item.secondProductName}
          score={item.secondRiskScore}
          riskLevel={secondRisk}
        />
      </Section>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#5B7CFA" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {children}
    </View>
  );
}

function RiskMiniBar({
  label,
  score,
  riskLevel,
}: {
  label: string;
  score: number;
  riskLevel: RiskLevel;
}) {
  const riskColor = getRiskColor(riskLevel);

  return (
    <View style={styles.miniRiskItem}>
      <View style={styles.miniRiskTop}>
        <Text style={styles.miniRiskLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.miniRiskScore, { color: riskColor.text }]}>
          {score}점
        </Text>
      </View>

      <View style={styles.miniRiskBarBackground}>
        <View
          style={[
            styles.miniRiskBarFill,
            {
              width: `${score}%`,
              backgroundColor: riskColor.text,
            },
          ]}
        />
      </View>
    </View>
  );
}

function getRiskLevelByScore(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  return "high";
}

function getRiskLabel(level: RiskLevel) {
  switch (level) {
    case "low":
      return "낮음";
    case "medium":
      return "보통";
    case "high":
      return "높음";
  }
}

function getRiskColor(level: RiskLevel) {
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

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}.${month}.${day}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 110,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "800",
    color: "#7A808C",
  },

  emptyScreen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#20222A",
    marginTop: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A808C",
    textAlign: "center",
    marginBottom: 20,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF3",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#20222A",
  },
  backButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#5B7CFA",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  typeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF3FF",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 14,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
  },
  compareTypeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E8F7EF",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 14,
  },
  compareTypeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#22A06B",
  },

  productName: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A8F98",
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A0A7B5",
    marginBottom: 18,
  },

  scoreBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A8F98",
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: "900",
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: "900",
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

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#20222A",
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#5F6673",
    fontWeight: "600",
  },

  ingredientCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  ingredientTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ingredientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
    marginRight: 8,
  },
  ingredientSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A8F98",
    marginTop: 4,
    marginBottom: 7,
  },
  ingredientDescription: {
    fontSize: 13,
    lineHeight: 20,
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
    backgroundColor: "#FBE3E7",
    borderRadius: 12,
    padding: 10,
    marginTop: 9,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: "#D94C5F",
  },

  reasonCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  reasonIngredient: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 5,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
  },

  compareProducts: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 4,
  },
  compareBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 6,
  },
  compareName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#20222A",
  },
  vsCircle: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#A0A7B5",
  },

  recommendBox: {
    backgroundColor: "#E8F7EF",
    borderRadius: 16,
    padding: 15,
  },
  recommendLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#22A06B",
    marginBottom: 6,
  },
  recommendProduct: {
    fontSize: 19,
    fontWeight: "900",
    color: "#20222A",
  },

  miniRiskItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  miniRiskTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  miniRiskLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#4B5563",
    marginRight: 8,
  },
  miniRiskScore: {
    fontSize: 13,
    fontWeight: "900",
  },
  miniRiskBarBackground: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5EAF2",
    overflow: "hidden",
  },
  miniRiskBarFill: {
    height: "100%",
    borderRadius: 999,
  },
});
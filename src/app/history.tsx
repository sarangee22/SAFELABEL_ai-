import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type RiskLevel = "low" | "medium" | "high";
type FilterType = "all" | "single" | "compare";

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

const filters: { label: string; value: FilterType }[] = [
  { label: "전체", value: "all" },
  { label: "단일 분석", value: "single" },
  { label: "비교 분석", value: "compare" },
];

export default function HistoryScreen() {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const loadHistory = async () => {
    try {
      setIsLoading(true);

      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const parsedHistory: HistoryItem[] = savedHistory
        ? JSON.parse(savedHistory)
        : [];

      setHistoryItems(parsedHistory);
    } catch (error) {
      console.log("분석 기록 불러오기 실패:", error);

      showMessage(
        "불러오기 실패",
        "분석 기록을 불러오는 중 문제가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const filteredItems = useMemo(() => {
    if (selectedFilter === "all") {
      return historyItems;
    }

    return historyItems.filter((item) => item.type === selectedFilter);
  }, [historyItems, selectedFilter]);

  const singleCount = historyItems.filter((item) => item.type === "single")
    .length;

  const compareCount = historyItems.filter((item) => item.type === "compare")
    .length;

  const highRiskCount = historyItems.filter(
    (item) => item.type === "single" && item.riskLevel === "high"
  ).length;

  const handleOpenDetail = (item: HistoryItem) => {
  router.push({
    pathname: "/history-detail",
    params: {
      id: String(item.id),
    },
  });
};

  const handleSavePdf = () => {
    showMessage("PDF 저장", "PDF 저장 기능은 추후 연결 예정입니다.");
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(ANALYSIS_HISTORY_KEY);
      setHistoryItems([]);
      showMessage("삭제 완료", "분석 기록이 초기화되었습니다.");
    } catch (error) {
      console.log("분석 기록 삭제 실패:", error);
      showMessage("삭제 실패", "분석 기록을 삭제하는 중 문제가 발생했습니다.");
    }
  };

  const handleClearHistory = () => {
    console.log("전체 삭제 버튼 클릭됨");

    if (historyItems.length === 0) {
      showMessage("삭제할 기록 없음", "현재 저장된 분석 기록이 없습니다.");
      return;
    }

    if (Platform.OS === "web") {
      const confirmed = window.confirm("모든 분석 기록을 삭제할까요?");

      if (!confirmed) return;

      clearHistory();
      return;
    }

    Alert.alert("기록 초기화", "모든 분석 기록을 삭제할까요?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "삭제",
        style: "destructive",
        onPress: clearHistory,
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="clipboard-outline" size={28} color="#5B7CFA" />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>분석 기록</Text>
          <Text style={styles.headerDescription}>
            OCR 단일 분석과 제품 비교 분석 결과를 한눈에 확인합니다.
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{singleCount}</Text>
          <Text style={styles.summaryLabel}>단일 분석</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{compareCount}</Text>
          <Text style={styles.summaryLabel}>비교 분석</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{highRiskCount}</Text>
          <Text style={styles.summaryLabel}>고위험 제품</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const isSelected = selectedFilter === filter.value;

          return (
            <Pressable
              key={filter.value}
              style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
              onPress={() => setSelectedFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  isSelected && styles.selectedFilterText,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {getSectionTitle(selectedFilter)}
          </Text>
          <Text style={styles.sectionCount}>{filteredItems.length}개</Text>
        </View>

        <Pressable style={styles.clearButton} onPress={handleClearHistory}>
          <Ionicons name="trash-outline" size={15} color="#D94C5F" />
          <Text style={styles.clearButtonText}>전체 삭제</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {isLoading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="hourglass-outline" size={34} color="#A0A7B5" />
            <Text style={styles.emptyTitle}>기록을 불러오는 중이에요</Text>
            <Text style={styles.emptyText}>
              저장된 분석 결과를 확인하고 있습니다.
            </Text>
          </View>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) =>
            item.type === "single" ? (
              <SingleHistoryCard
                key={`single-${item.id}`}
                item={item}
                onOpenDetail={() => handleOpenDetail(item)}
                onSavePdf={handleSavePdf}
              />
            ) : (
              <CompareHistoryCard
                key={`compare-${item.id}`}
                item={item}
                onOpenDetail={() => handleOpenDetail(item)}
                onSavePdf={handleSavePdf}
              />
            )
          )
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={34} color="#A0A7B5" />
            <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
            <Text style={styles.emptyText}>
              성분 분석이나 제품 비교를 완료하면 이곳에 기록이 표시됩니다.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SingleHistoryCard({
  item,
  onOpenDetail,
  onSavePdf,
}: {
  item: SingleAnalysis;
  onOpenDetail: () => void;
  onSavePdf: () => void;
}) {
  const riskColor = getRiskColor(item.riskLevel);
  const riskLabel = getRiskLabel(item.riskLevel);
  const cautionCount = item.cautionIngredients.length;
  const ingredients = item.mainIngredients || [];

  return (
    <View style={styles.historyCard}>
      <View style={styles.cardTop}>
        <View style={styles.productImageBox}>
          <Text style={styles.productEmoji}>🧴</Text>
        </View>

        <View style={styles.cardMainInfo}>
          <View style={styles.typeRow}>
            <View style={styles.singleTypeBadge}>
              <Ionicons name="scan-outline" size={13} color="#5B7CFA" />
              <Text style={styles.singleTypeText}>단일 분석</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>

          <Text style={styles.productName}>{item.productName}</Text>
          <Text style={styles.brandText}>{item.brand || "OCR 분석 제품"}</Text>
        </View>
      </View>

      <Text style={styles.summaryText}>{item.summary}</Text>

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>위험도</Text>
          <Text style={[styles.infoValue, { color: riskColor.text }]}>
            {item.riskScore}점
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>위험 수준</Text>
          <View style={[styles.riskBadge, { backgroundColor: riskColor.bg }]}>
            <Text style={[styles.riskBadgeText, { color: riskColor.text }]}>
              {riskLabel}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>주의 성분</Text>
          <Text style={styles.infoValue}>{cautionCount}개</Text>
        </View>
      </View>

      <View style={styles.ingredientBox}>
        <Text style={styles.ingredientTitle}>주요 성분</Text>
        <Text style={styles.ingredientText} numberOfLines={2}>
          {ingredients.length > 0
            ? ingredients.join(", ")
            : "추출된 성분이 없습니다."}
        </Text>
      </View>

      {item.riskReasons && item.riskReasons.length > 0 && (
        <View style={styles.reasonPreviewBox}>
          <Text style={styles.ingredientTitle}>위험도 판단 근거</Text>
          <Text style={styles.ingredientText} numberOfLines={2}>
            {item.riskReasons
              .map((reason) => `${reason.ingredient}: ${reason.reason}`)
              .join(" / ")}
          </Text>
        </View>
      )}

      <CardActions onOpenDetail={onOpenDetail} onSavePdf={onSavePdf} />
    </View>
  );
}

function CompareHistoryCard({
  item,
  onOpenDetail,
  onSavePdf,
}: {
  item: CompareAnalysis;
  onOpenDetail: () => void;
  onSavePdf: () => void;
}) {
  const firstRisk = getRiskLevelByScore(item.firstRiskScore);
  const secondRisk = getRiskLevelByScore(item.secondRiskScore);

  return (
    <View style={styles.historyCard}>
      <View style={styles.typeRow}>
        <View style={styles.compareTypeBadge}>
          <Ionicons name="git-compare-outline" size={13} color="#22A06B" />
          <Text style={styles.compareTypeText}>비교 분석</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
      </View>

      <View style={styles.compareTitleRow}>
        <View style={styles.compareProductBox}>
          <Text style={styles.compareLabel}>제품 A</Text>
          <Text style={styles.compareProductName} numberOfLines={2}>
            {item.firstProductName}
          </Text>
        </View>

        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <View style={styles.compareProductBox}>
          <Text style={styles.compareLabel}>제품 B</Text>
          <Text style={styles.compareProductName} numberOfLines={2}>
            {item.secondProductName}
          </Text>
        </View>
      </View>

      <Text style={styles.summaryText}>{item.summary}</Text>

      <View style={styles.compareRiskBox}>
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
      </View>

      <View style={styles.recommendBox}>
        <Ionicons name="thumbs-up-outline" size={18} color="#22A06B" />
        <View style={styles.recommendTextBox}>
          <Text style={styles.recommendLabel}>추천 결과</Text>
          <Text style={styles.recommendProduct}>{item.recommendedProduct}</Text>
        </View>
      </View>

      <CardActions onOpenDetail={onOpenDetail} onSavePdf={onSavePdf} />
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

function CardActions({
  onOpenDetail,
  onSavePdf,
}: {
  onOpenDetail: () => void;
  onSavePdf: () => void;
}) {
  return (
    <View style={styles.actionRow}>
      <Pressable style={styles.detailButton} onPress={onOpenDetail}>
        <Ionicons name="search-outline" size={17} color="#5B7CFA" />
        <Text style={styles.detailButtonText}>상세보기</Text>
      </Pressable>

      <Pressable style={styles.pdfButton} onPress={onSavePdf}>
        <Ionicons name="document-text-outline" size={17} color="#5B7CFA" />
        <Text style={styles.pdfButtonText}>PDF 저장</Text>
      </Pressable>
    </View>
  );
}

function getSectionTitle(filter: FilterType) {
  switch (filter) {
    case "single":
      return "단일 분석 기록";
    case "compare":
      return "비교 분석 기록";
    default:
      return "전체 분석 기록";
  }
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

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7A808C",
  },

  filterRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2F7",
    borderRadius: 18,
    padding: 5,
    marginBottom: 24,
  },
  filterChip: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedFilterChip: {
    backgroundColor: "#FFFFFF",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8A8F98",
  },
  selectedFilterText: {
    color: "#5B7CFA",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#20222A",
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#8A8F98",
    marginTop: 3,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FBE3E7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#D94C5F",
  },

  list: {
    gap: 14,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },

  cardTop: {
    flexDirection: "row",
    marginBottom: 14,
  },
  productImageBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FAFAFC",
    borderWidth: 1,
    borderColor: "#EEF1F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  productEmoji: {
    fontSize: 26,
  },
  cardMainInfo: {
    flex: 1,
  },

  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  singleTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF3FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  singleTypeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
  },
  compareTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F7EF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  compareTypeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#22A06B",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#A0A7B5",
  },

  productName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 5,
  },
  brandText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8A8F98",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: "#5F6673",
    marginBottom: 14,
  },

  infoGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    minHeight: 72,
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A8F98",
    marginBottom: 7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#20222A",
  },

  riskBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },

  ingredientBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  reasonPreviewBox: {
    backgroundColor: "#FFF8E6",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  ingredientTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 7,
  },
  ingredientText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7A808C",
  },

  compareTitleRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 14,
  },
  compareProductBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    justifyContent: "center",
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 6,
  },
  compareProductName: {
    fontSize: 15,
    lineHeight: 20,
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

  compareRiskBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  miniRiskItem: {
    marginBottom: 12,
  },
  miniRiskTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
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

  recommendBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F7EF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  recommendTextBox: {
    marginLeft: 10,
    flex: 1,
  },
  recommendLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#22A06B",
    marginBottom: 4,
  },
  recommendProduct: {
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#EEF3FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
  },
  pdfButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE4FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pdfButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
  },

  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#20222A",
    marginTop: 12,
    marginBottom: 7,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#8A8F98",
    textAlign: "center",
  },
});
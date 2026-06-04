import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
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
  publicData?: {
    hasPublicData?: boolean;
    ingredientInfo?: unknown[];
    restrictedInfo?: unknown[];
    restrictedNationInfo?: unknown[];
    regulationInfo?: unknown[];
  } | null;
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
  aiProvider?: "openai" | "fallback";
  aiModel?: string | null;
  imageUri?: string;
};

export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<SingleAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);

      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const parsedHistory: unknown[] = savedHistory ? JSON.parse(savedHistory) : [];
      const singleHistory = parsedHistory.filter(isSingleAnalysis);

      setHistoryItems(singleHistory);
    } catch (error) {
      console.log("분석 기록 불러오기 실패:", error);
      showMessage(
        "불러오기 실패",
        "분석 기록을 불러오는 중 문제가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const highRiskCount = useMemo(
    () => historyItems.filter((item) => item.riskLevel === "high").length,
    [historyItems]
  );

  const handleOpenDetail = (item: SingleAnalysis) => {
    router.push({
      pathname: "/history-detail",
      params: {
        id: String(item.id),
      },
    });
  };

  const handleSavePdf = async (item: SingleAnalysis) => {
    try {
      const html = generateSimpleHtmlForAnalysis(item);

      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${item.productName || "analysis"}-${item.id}.html`;
        a.click();
        URL.revokeObjectURL(url);
        showMessage("내보내기 완료", "분석 결과 HTML 파일을 다운로드했습니다.");
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });

      // On Android/iOS share or save
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "분석 결과 PDF 공유",
          UTI: "com.adobe.pdf",
        });
      } else {
        const dest = `${(FileSystem as any).documentDirectory}safelabel-analysis-${item.id}.pdf`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        showMessage("저장 완료", `파일을 저장했습니다: ${dest}`);
      }
    } catch (error) {
      console.log("PDF 저장 실패:", error);
      showMessage("PDF 저장 실패", "PDF 생성 또는 공유 중 오류가 발생했습니다.");
    }
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
          <Ionicons name="clipboard-outline" size={28} color={AppColors.primary} />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>분석 기록</Text>
          <Text style={styles.headerDescription}>
            OCR 단일 분석 결과와 공공데이터 매칭 요약을 확인합니다.
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{historyItems.length}</Text>
          <Text style={styles.summaryLabel}>단일 분석</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{highRiskCount}</Text>
          <Text style={styles.summaryLabel}>고위험 제품</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>단일 분석 기록</Text>
          <Text style={styles.sectionCount}>{historyItems.length}개</Text>
        </View>

        <Pressable style={styles.clearButton} onPress={handleClearHistory}>
          <Ionicons name="trash-outline" size={15} color={AppColors.risk} />
          <Text style={styles.clearButtonText}>전체 삭제</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {isLoading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="hourglass-outline" size={34} color={AppColors.textMuted} />
            <Text style={styles.emptyTitle}>기록을 불러오는 중입니다</Text>
            <Text style={styles.emptyText}>
              저장된 분석 결과를 확인하고 있습니다.
            </Text>
          </View>
        ) : historyItems.length > 0 ? (
          historyItems.map((item) => (
            <SingleHistoryCard
              key={`single-${item.id}`}
              item={item}
              onOpenDetail={() => handleOpenDetail(item)}
              onSavePdf={() => handleSavePdf(item)}
            />
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={34} color={AppColors.textMuted} />
            <Text style={styles.emptyTitle}>아직 기록이 없습니다</Text>
            <Text style={styles.emptyText}>
              성분표를 촬영하거나 갤러리에서 불러오면 분석 기록이 저장됩니다.
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
  const publicMatchedCount = countPublicDataMatched(item.matchedIngredients || []);

  return (
    <View style={styles.historyCard}>
      <View style={styles.cardTop}>
        <View style={styles.productImageBox}>
          <Ionicons name="scan-outline" size={28} color={AppColors.primary} />
        </View>

        <View style={styles.cardMainInfo}>
          <View style={styles.typeRow}>
            <View style={styles.singleTypeBadge}>
              <Ionicons name="scan-outline" size={13} color={AppColors.primary} />
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
          <Text style={styles.infoLabel}>공공데이터</Text>
          <Text style={styles.infoValue}>{publicMatchedCount}개</Text>
        </View>
      </View>

      {cautionCount > 0 ? (
        <View style={styles.cautionPreviewBox}>
          <Ionicons name="warning-outline" size={16} color={AppColors.risk} />
          <Text style={styles.cautionPreviewText} numberOfLines={1}>
            주의 성분 {cautionCount}개: {item.cautionIngredients.join(", ")}
          </Text>
        </View>
      ) : null}

      <View style={styles.ingredientBox}>
        <Text style={styles.ingredientTitle}>주요 성분</Text>
        <Text style={styles.ingredientText} numberOfLines={2}>
          {ingredients.length > 0
            ? ingredients.join(", ")
            : "추출된 성분이 없습니다."}
        </Text>
      </View>

      {item.riskReasons && item.riskReasons.length > 0 ? (
        <View style={styles.reasonPreviewBox}>
          <Text style={styles.ingredientTitle}>위험도 판단 근거</Text>
          <Text style={styles.ingredientText} numberOfLines={2}>
            {item.riskReasons
              .map((reason) => `${reason.ingredient}: ${reason.reason}`)
              .join(" / ")}
          </Text>
        </View>
      ) : null}

      <CardActions onOpenDetail={onOpenDetail} onSavePdf={onSavePdf} />
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
        <Ionicons name="search-outline" size={17} color={AppColors.primary} />
        <Text style={styles.detailButtonText}>상세보기</Text>
      </Pressable>

      <Pressable style={styles.pdfButton} onPress={onSavePdf}>
        <Ionicons name="document-text-outline" size={17} color={AppColors.primary} />
        <Text style={styles.pdfButtonText}>PDF 저장</Text>
      </Pressable>
    </View>
  );
}

function isSingleAnalysis(item: unknown): item is SingleAnalysis {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: unknown }).type === "single"
  );
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
        bg: AppColors.mintSoft,
        text: AppColors.safe,
      };
    case "medium":
      return {
        bg: AppColors.cautionSoft,
        text: AppColors.caution,
      };
    case "high":
      return {
        bg: AppColors.riskSoft,
        text: AppColors.risk,
      };
  }
}

function countPublicDataMatched(ingredients: MatchedIngredient[]) {
  return ingredients.filter((ingredient) => {
    const publicData = ingredient.publicData;

    return (
      publicData?.hasPublicData === true ||
      (publicData?.ingredientInfo || []).length > 0 ||
      (publicData?.restrictedInfo || []).length > 0 ||
      (publicData?.restrictedNationInfo || []).length > 0 ||
      (publicData?.regulationInfo || []).length > 0
    );
  }).length;
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
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: Radius.subCard,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "900",
    color: AppColors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: AppColors.textSub,
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
    color: AppColors.text,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "800",
    color: AppColors.textMuted,
    marginTop: 3,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: AppColors.riskSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: AppColors.risk,
  },
  list: {
    gap: 14,
  },
  historyCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  cardTop: {
    flexDirection: "row",
    marginBottom: 14,
  },
  productImageBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: AppColors.subCard,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
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
    backgroundColor: AppColors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  singleTypeText: {
    fontSize: 12,
    fontWeight: "900",
    color: AppColors.primary,
  },
  dateText: {
    fontSize: 12,
    fontWeight: "800",
    color: AppColors.textMuted,
  },
  productName: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 5,
  },
  brandText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.textSub,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: AppColors.textSub,
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  infoBox: {
    flex: 1,
    backgroundColor: AppColors.subCard,
    borderRadius: 16,
    padding: 12,
    minHeight: 72,
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: AppColors.textSub,
    marginBottom: 7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "900",
    color: AppColors.text,
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
    backgroundColor: AppColors.subCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  reasonPreviewBox: {
    backgroundColor: AppColors.cautionSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  ingredientTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 7,
  },
  ingredientText: {
    fontSize: 13,
    lineHeight: 20,
    color: AppColors.textSub,
  },
  cautionPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: AppColors.riskSoft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  cautionPreviewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: AppColors.risk,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
  },
  pdfButton: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: "#DDE5FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pdfButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
  },
  emptyBox: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: AppColors.text,
    marginTop: 12,
    marginBottom: 7,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.textSub,
    textAlign: "center",
  },
});

function generateSimpleHtmlForAnalysis(item: SingleAnalysis) {
  const safe = (v?: string) => (v ? v : "-");
  const ingredientsHtml = (item.mainIngredients || [])
    .map((ing: string) => `<li>${ing}</li>`)
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 18px; }
        h1 { font-size: 20px; margin-bottom: 6px; }
        h2 { font-size: 16px; margin-top: 14px; }
        p { font-size: 14px; line-height: 1.4; }
        .meta { color: #666; font-size: 12px; }
        ul { padding-left: 18px; }
      </style>
    </head>
    <body>
      <h1>Safelabel 분석 결과</h1>
      <p class="meta">ID: ${item.id} · 날짜: ${new Date(item.date || Date.now()).toLocaleString()}</p>
      <h2>제품</h2>
      <p>${safe(item.productName)}</p>

      <h2>요약</h2>
      <p>${safe(item.summary)}</p>

      <h2>주요 성분</h2>
      <ul>${ingredientsHtml}</ul>

      <h2>권장/주의</h2>
      <p>${safe(item.recommendation)}</p>

      <h2>위험 점수</h2>
      <p>${typeof item.riskScore !== 'undefined' ? item.riskScore : '-'}</p>
    </body>
  </html>
  `;
}



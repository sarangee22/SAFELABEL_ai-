import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { formatRestrictionInfo } from "@/utils/restriction-utils";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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

const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type RiskLevel = "low" | "medium" | "high";

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

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [historyItem, setHistoryItem] = useState<SingleAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistoryDetail = useCallback(async () => {
    try {
      setIsLoading(true);

      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const history: unknown[] = savedHistory ? JSON.parse(savedHistory) : [];
      const singleHistory = history.filter(isSingleAnalysis);
      const targetItem = singleHistory.find(
        (item) => String(item.id) === String(id)
      );

      if (!targetItem) {
        Alert.alert(
          "기록 없음",
          "해당 분석 기록을 찾을 수 없거나 지원하지 않는 기록입니다."
        );
        setHistoryItem(null);
        return;
      }

      setHistoryItem(targetItem);
    } catch (error) {
      console.log("분석 상세 불러오기 실패:", error);
      Alert.alert(
        "불러오기 실패",
        "분석 상세 정보를 불러오는 중 문제가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadHistoryDetail();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadHistoryDetail]);

  const handleSavePdf = () => {
    (async () => {
      if (!historyItem) return;

      try {
        const html = generateSimpleHtmlForAnalysis(historyItem);

        if (Platform.OS === "web") {
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${historyItem.productName || "analysis"}-${historyItem.id}.html`;
          a.click();
          URL.revokeObjectURL(url);
          Alert.alert("내보내기 완료", "분석 결과 HTML 파일을 다운로드했습니다.");
          return;
        }

        const { uri } = await Print.printToFileAsync({ html });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "분석 결과 PDF 공유",
            UTI: "com.adobe.pdf",
          });
        } else {
            const dest = `${(FileSystem as any).documentDirectory}safelabel-analysis-${historyItem.id}.pdf`;
            await FileSystem.copyAsync({ from: uri, to: dest });
          Alert.alert("저장 완료", `파일을 저장했습니다: ${dest}`);
        }
      } catch (e) {
        console.log("PDF 저장 실패:", e);
        Alert.alert("PDF 저장 실패", "PDF 생성 또는 공유 중 오류가 발생했습니다.");
      }
    })();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={AppColors.primary} size="large" />
        <Text style={styles.loadingText}>분석 상세를 불러오는 중입니다</Text>
      </View>
    );
  }

  if (!historyItem) {
    return (
      <View style={styles.emptyScreen}>
        <Ionicons name="document-text-outline" size={42} color={AppColors.textMuted} />
        <Text style={styles.emptyTitle}>기록을 찾을 수 없습니다</Text>
        <Text style={styles.emptyText}>
          해당 분석 기록을 찾을 수 없거나 지원하지 않는 기록입니다.
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
          <Ionicons name="chevron-back" size={24} color={AppColors.text} />
        </Pressable>

        <Text style={styles.topTitle}>분석 상세</Text>

        <Pressable style={styles.iconButton} onPress={handleSavePdf}>
          <Ionicons name="document-text-outline" size={22} color={AppColors.primary} />
        </Pressable>
      </View>

      <SingleDetail item={historyItem} />
    </ScrollView>
  );
}

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

function SingleDetail({ item }: { item: SingleAnalysis }) {
  const riskColor = getRiskColor(item.riskLevel);
  const riskLabel = getRiskLabel(item.riskLevel);
  const publicDataMatchedCount = countPublicDataMatched(item.matchedIngredients || []);
  const isOpenAiSummary = item.aiProvider === "openai";
  const summaryTitle = isOpenAiSummary ? "AI 요약" : "분석 요약";
  const recommendationTitle = isOpenAiSummary ? "AI 추천" : "추천 안내";
  const sourceLabel = isOpenAiSummary
    ? "OpenAI 기반 요약"
    : "로컬 분석 기준 요약";

  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.typeBadge}>
          <Ionicons name="scan-outline" size={14} color={AppColors.primary} />
          <Text style={styles.typeBadgeText}>단일 분석</Text>
        </View>

        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.productImage} />
        ) : null}

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
                width: `${Math.min(100, Math.max(0, item.riskScore))}%`,
                backgroundColor: riskColor.text,
              },
            ]}
          />
        </View>
      </View>

      <Section title={summaryTitle} icon="sparkles-outline" meta={sourceLabel}>
        <Text style={styles.bodyText}>{item.summary}</Text>
      </Section>

      <Section title={recommendationTitle} icon="bulb-outline" meta={sourceLabel}>
        <Text style={styles.bodyText}>
          {item.recommendation || "추천 정보가 없습니다."}
        </Text>
      </Section>

      <Section title="공공데이터 적용 현황" icon="server-outline">
        <View style={styles.publicSummaryBox}>
          <Text style={styles.publicSummaryTitle}>
            공공데이터 매칭 성분 {publicDataMatchedCount}개
          </Text>
          <Text style={styles.publicSummaryText}>
            OCR로 추출한 성분을 식약처 공공데이터의 원료 성분 정보,
            사용 제한 정보, 규제 정보와 대조한 결과입니다.
          </Text>
        </View>
      </Section>

      <Section title="주의 성분" icon="warning-outline">
        <Text style={styles.bodyText}>
          {item.cautionIngredients.length > 0
            ? item.cautionIngredients.join(", ")
            : "발견된 주의 성분 없음"}
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
            <IngredientPublicDataCard
              key={`${ingredient.standardName || ingredient.originalName}-${index}`}
              ingredient={ingredient}
            />
          ))
        ) : (
          <Text style={styles.bodyText}>매칭된 성분 정보가 없습니다.</Text>
        )}
      </Section>

      <Section title="위험도 판단 근거" icon="analytics-outline">
        {item.riskReasons && item.riskReasons.length > 0 ? (
          item.riskReasons.map((reason, index) => {
            const reasonLines = formatRestrictionInfo(reason.reason);
            return (
              <View key={`${reason.ingredient}-${index}`} style={styles.reasonCard}>
                <Text style={styles.reasonIngredient}>{reason.ingredient}</Text>
                {reasonLines.length > 0 ? (
                  reasonLines.map((line, lineIndex) => (
                    <Text key={lineIndex} style={styles.reasonText}>
                      • {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reasonText}>{reason.reason}</Text>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.bodyText}>
            현재 기준에서는 별도의 위험도 상승 근거가 감지되지 않았습니다.
          </Text>
        )}
      </Section>
    </>
  );
}

function IngredientPublicDataCard({
  ingredient,
}: {
  ingredient: MatchedIngredient;
}) {
  const publicData = ingredient.publicData;
  const ingredientInfo = publicData?.ingredientInfo || [];
  const restrictedInfo = publicData?.restrictedInfo || [];
  const restrictedNationInfo = publicData?.restrictedNationInfo || [];
  const regulationInfo = publicData?.regulationInfo || [];
  const firstIngredientInfo = getBestIngredientInfo(ingredient, ingredientInfo);
  const userSummary = publicData?.userSummary;
  const restrictionLines = formatRestrictionInfo([
    restrictedInfo,
    restrictedNationInfo,
    regulationInfo,
    publicData?.userSummary?.restrictionSummary,
    publicData?.userSummary?.countrySummary,
  ]);
  const hasAnyPublicData =
    publicData?.hasPublicData === true ||
    ingredientInfo.length > 0 ||
    restrictedInfo.length > 0 ||
    restrictedNationInfo.length > 0 ||
    regulationInfo.length > 0;
  const hasPublicDataRestriction = userSummary?.hasRestriction === true;
  const englishName =
    userSummary?.englishName ||
    ingredient.englishName ||
    firstIngredientInfo?.INGR_ENG_NAME;
  const casNo = userSummary?.casNo || firstIngredientInfo?.CAS_NO;
  const description =
    userSummary?.definition ||
    ingredient.description ||
    firstIngredientInfo?.ORIGIN_MAJOR_KOR_NAME;

  return (
    <View style={styles.ingredientCard}>
      <View style={styles.ingredientTop}>
        <Text style={styles.ingredientName}>
          {ingredient.standardName || ingredient.originalName}
        </Text>

        <View
          style={[
            styles.matchBadge,
            hasAnyPublicData || ingredient.isMatched
              ? styles.matchedBadge
              : styles.unmatchedBadge,
          ]}
        >
          <Text
            style={[
              styles.matchBadgeText,
              hasAnyPublicData || ingredient.isMatched
                ? styles.matchedBadgeText
                : styles.unmatchedBadgeText,
            ]}
          >
            {hasAnyPublicData
              ? "공공데이터"
              : ingredient.isMatched
              ? "로컬 매칭"
              : "미매칭"}
          </Text>
        </View>
      </View>

      {ingredient.originalName &&
      ingredient.originalName !== ingredient.standardName ? (
        <Text style={styles.ingredientSub}>
          OCR 인식명: {ingredient.originalName}
        </Text>
      ) : null}

      {englishName ? (
        <Text style={styles.ingredientSub}>영문명: {englishName}</Text>
      ) : null}

      {casNo ? <Text style={styles.publicDataText}>CAS No: {casNo}</Text> : null}

      {description ? (
        <Text style={styles.ingredientDescription}>{description}</Text>
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

      {(ingredient.isRestricted || ingredient.isAllergen) && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color={AppColors.risk} />
          <Text style={styles.warningText}>
            {ingredient.restrictedReason ||
              ingredient.allergenReason ||
              "주의가 필요한 성분입니다."}
          </Text>
        </View>
      )}

      {hasAnyPublicData ? (
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
              : "식약처 공공데이터에서 성분 정보가 확인되었습니다."}
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
              <Text style={styles.publicDataLabel}>사용 안내</Text>
              <Text style={styles.publicWarningText}>
                {userSummary?.userAdvice ||
                  "공공데이터는 참고 정보이며, 개인 피부 상태에 따라 반응이 다를 수 있습니다."}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {!hasAnyPublicData && !ingredient.isMatched ? (
        <Text style={styles.noPublicDataText}>
          공공데이터에서 직접 확인된 정보가 없습니다.
        </Text>
      ) : null}
    </View>
  );
}

function Section({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={AppColors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>

      {children}
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

function getBestIngredientInfo(
  ingredient: MatchedIngredient,
  ingredientInfo: PublicIngredientInfo[]
) {
  if (ingredientInfo.length === 0) return null;

  const targetName = normalizeName(
    ingredient.standardName || ingredient.originalName || ""
  );

  const exactMatch = ingredientInfo.find(
    (info) => normalizeName(info.INGR_KOR_NAME || "") === targetName
  );

  if (exactMatch) return exactMatch;

  const containsMatch = ingredientInfo.find((info) => {
    const publicName = normalizeName(info.INGR_KOR_NAME || "");

    return publicName.includes(targetName) || targetName.includes(publicName);
  });

  return containsMatch || ingredientInfo[0];
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

function normalizeName(value: string) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "")
    .toLowerCase()
    .trim();
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
  loadingScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "800",
    color: AppColors.textSub,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: AppColors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.textSub,
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
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: AppColors.text,
  },
  backButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: AppColors.card,
  },
  heroCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  typeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: AppColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 14,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: AppColors.primary,
  },
  productImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: AppColors.subCard,
  },
  productName: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.textMuted,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "800",
    color: AppColors.textMuted,
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
    color: AppColors.textMuted,
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
    backgroundColor: AppColors.border,
    overflow: "hidden",
  },
  riskBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  sectionCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
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
    color: AppColors.text,
  },
  sectionMeta: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "800",
    color: AppColors.textMuted,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#5F6673",
    fontWeight: "600",
  },
  publicSummaryBox: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DCE4FF",
  },
  publicSummaryTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: AppColors.primary,
    marginBottom: 6,
  },
  publicSummaryText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: "#6B7280",
  },
  ingredientCard: {
    backgroundColor: AppColors.background,
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
    color: AppColors.text,
    marginRight: 8,
  },
  ingredientSub: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textMuted,
    marginTop: 4,
    marginBottom: 7,
  },
  ingredientDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginTop: 6,
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
    marginTop: 8,
    marginBottom: 5,
  },
  publicDataText: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textSub,
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
    color: AppColors.caution,
    marginBottom: 6,
  },
  publicWarningText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: AppColors.textSub,
  },
  noPublicDataText: {
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.textMuted,
    marginTop: 8,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: AppColors.riskSoft,
    borderRadius: 12,
    padding: 10,
    marginTop: 9,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    color: AppColors.risk,
  },
  reasonCard: {
    backgroundColor: AppColors.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  reasonIngredient: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.primary,
    marginBottom: 5,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
  },
});



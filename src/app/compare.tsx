import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";

type RiskLevel = "low" | "medium" | "high";

type Product = {
  id: number;
  name: string;
  brand: string;
  riskScore: number;
  riskLevel: RiskLevel;
  ingredients: string[];
  cautionIngredients: string[];
  summary: string;
};

type CompareHistoryItem = {
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

const sampleProducts: Product[] = [
  {
    id: 1,
    name: "오가닉 레어 세럼",
    brand: "Derma One",
    riskScore: 78,
    riskLevel: "high",
    ingredients: ["정제수", "향료", "에탄올", "페녹시에탄올", "시트릭애씨드"],
    cautionIngredients: ["향료", "에탄올", "페녹시에탄올"],
    summary: "민감 피부 사용자는 향료와 에탄올 성분에 주의가 필요합니다.",
  },
  {
    id: 2,
    name: "퓨어 선스크린 SPF50",
    brand: "Pure Lab",
    riskScore: 24,
    riskLevel: "low",
    ingredients: ["정제수", "징크옥사이드", "글리세린", "판테놀", "알란토인"],
    cautionIngredients: [],
    summary: "자극 가능성이 낮고 민감 피부에도 비교적 적합한 제품입니다.",
  },
  {
    id: 3,
    name: "시카 리페어 크림",
    brand: "Skin Calm",
    riskScore: 42,
    riskLevel: "medium",
    ingredients: ["정제수", "병풀추출물", "나이아신아마이드", "향료", "세라마이드"],
    cautionIngredients: ["향료"],
    summary: "진정 성분이 포함되어 있으나 향료에 민감한 사용자는 주의가 필요합니다.",
  },
];

export default function CompareScreen() {
  const [firstProduct, setFirstProduct] = useState<Product | null>(
    sampleProducts[0]
  );
  const [secondProduct, setSecondProduct] = useState<Product | null>(
    sampleProducts[1]
  );

  const [firstProductName, setFirstProductName] = useState("");
  const [secondProductName, setSecondProductName] = useState("");

  const [showResult, setShowResult] = useState(false);
  const [hasSavedCurrentCompare, setHasSavedCurrentCompare] = useState(false);

  const comparedFirstProduct = getComparableProduct(
    firstProduct,
    firstProductName,
    101
  );

  const comparedSecondProduct = getComparableProduct(
    secondProduct,
    secondProductName,
    102
  );

  const saferProduct =
    comparedFirstProduct && comparedSecondProduct
      ? comparedFirstProduct.riskScore <= comparedSecondProduct.riskScore
        ? comparedFirstProduct
        : comparedSecondProduct
      : null;

  const makeCompareSummary = (
    first: Product,
    second: Product,
    recommended: Product
  ) => {
    const scoreDiff = Math.abs(first.riskScore - second.riskScore);

    return `두 제품을 비교한 결과, 현재 사용자 맞춤 기준에서는 ${recommended.name}이 더 적합해 보입니다. 위험도 점수 차이는 ${scoreDiff}점이며, 주의 성분 수와 민감 피부 자극 가능성을 함께 고려했습니다.`;
  };

  const saveCompareHistory = async (
    first: Product,
    second: Product,
    recommended: Product
  ) => {
    try {
      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);
      const history = savedHistory ? JSON.parse(savedHistory) : [];

      const newHistoryItem: CompareHistoryItem = {
        id: Date.now(),
        type: "compare",
        firstProductName: first.name,
        secondProductName: second.name,
        recommendedProduct: recommended.name,
        date: new Date().toISOString(),
        firstRiskScore: first.riskScore,
        secondRiskScore: second.riskScore,
        summary: makeCompareSummary(first, second, recommended),
      };

      const updatedHistory = [newHistoryItem, ...history];

      await AsyncStorage.setItem(
        ANALYSIS_HISTORY_KEY,
        JSON.stringify(updatedHistory)
      );

      console.log("비교 분석 기록 저장 완료:", newHistoryItem);
    } catch (error) {
      console.log("비교 분석 기록 저장 실패:", error);
    }
  };

  const resetCompareResult = () => {
    setShowResult(false);
    setHasSavedCurrentCompare(false);
  };

  const handleCompare = async () => {
    if (!comparedFirstProduct || !comparedSecondProduct) {
      Alert.alert("제품 선택 필요", "비교할 제품 2개를 선택해주세요.");
      return;
    }

    if (comparedFirstProduct.name.trim() === comparedSecondProduct.name.trim()) {
      Alert.alert("제품 선택 오류", "서로 다른 제품 2개를 선택해주세요.");
      return;
    }

    const recommendedProduct =
      comparedFirstProduct.riskScore <= comparedSecondProduct.riskScore
        ? comparedFirstProduct
        : comparedSecondProduct;

    setShowResult(true);

    if (!hasSavedCurrentCompare) {
      await saveCompareHistory(
        comparedFirstProduct,
        comparedSecondProduct,
        recommendedProduct
      );
      setHasSavedCurrentCompare(true);
    }
  };

  const handleSavePdf = () => {
    Alert.alert("PDF 저장", "PDF 저장 기능은 추후 연결 예정입니다.");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="git-compare-outline" size={28} color="#5B7CFA" />
        </View>

        <View style={styles.headerTextBox}>
          <Text style={styles.headerTitle}>제품 비교</Text>
          <Text style={styles.headerDescription}>
            두 제품의 성분과 위험도를 사용자 맞춤 기준으로 비교합니다.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>비교할 제품 선택</Text>
        <Text style={styles.sectionDescription}>
          제품명 입력, 성분표 촬영, 갤러리 불러오기, 기록 선택 중 원하는
          방식으로 두 제품을 비교하세요.
        </Text>

        <View style={styles.compareSelectRow}>
          <ProductSelectBox
            title="제품 A"
            inputValue={firstProductName}
            onChangeInput={(value) => {
              setFirstProductName(value);
              setFirstProduct(null);
              resetCompareResult();
            }}
            selectedProduct={firstProduct}
            onSelect={(product) => {
              setFirstProduct(product);
              setFirstProductName("");
              resetCompareResult();
            }}
          />

          <View style={styles.vsBox}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <ProductSelectBox
            title="제품 B"
            inputValue={secondProductName}
            onChangeInput={(value) => {
              setSecondProductName(value);
              setSecondProduct(null);
              resetCompareResult();
            }}
            selectedProduct={secondProduct}
            onSelect={(product) => {
              setSecondProduct(product);
              setSecondProductName("");
              resetCompareResult();
            }}
          />
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            style={styles.subActionButton}
            onPress={() => router.push("/analyze?mode=camera")}
          >
            <Ionicons name="camera-outline" size={20} color="#5B7CFA" />
            <Text style={styles.subActionText}>성분표 촬영</Text>
          </Pressable>

          <Pressable
            style={styles.subActionButton}
            onPress={() => router.push("/analyze?mode=gallery")}
          >
            <Ionicons name="image-outline" size={20} color="#5B7CFA" />
            <Text style={styles.subActionText}>갤러리</Text>
          </Pressable>

          <Pressable
            style={styles.subActionButton}
            onPress={() => router.push("/history")}
          >
            <Ionicons name="time-outline" size={20} color="#5B7CFA" />
            <Text style={styles.subActionText}>기록 선택</Text>
          </Pressable>
        </View>

        <Pressable style={styles.compareButton} onPress={handleCompare}>
          <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
          <Text style={styles.compareButtonText}>AI 비교 분석하기</Text>
        </Pressable>
      </View>

      {showResult &&
        comparedFirstProduct &&
        comparedSecondProduct &&
        saferProduct && (
          <>
            <View style={styles.aiSummaryCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="sparkles" size={22} color="#5B7CFA" />
                <Text style={styles.resultTitle}>AI 요약</Text>
              </View>

              <Text style={styles.aiSummaryText}>
                두 제품을 비교한 결과, 현재 사용자 맞춤 기준에서는{" "}
                <Text style={styles.strongText}>{saferProduct.name}</Text>이 더
                적합해 보입니다. 위험도 점수, 주의 성분 수, 민감 피부 자극
                가능성을 함께 고려한 결과입니다.
              </Text>
            </View>

            <View style={styles.recommendCard}>
              <View style={styles.resultHeader}>
                <Ionicons name="thumbs-up-outline" size={22} color="#22A06B" />
                <Text style={styles.resultTitle}>AI 추천</Text>
              </View>

              <View style={styles.recommendBox}>
                <Text style={styles.recommendLabel}>추천 제품</Text>
                <Text style={styles.recommendProduct}>{saferProduct.name}</Text>
                <Text style={styles.recommendReason}>{saferProduct.summary}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>위험도 비교</Text>
              <Text style={styles.sectionDescription}>
                점수가 높을수록 사용자 피부 설정 기준에서 주의가 필요한
                제품입니다.
              </Text>

              <RiskCompareItem product={comparedFirstProduct} label="제품 A" />
              <RiskCompareItem product={comparedSecondProduct} label="제품 B" />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>주요 분석</Text>

              <AnalysisRow
                icon="warning-outline"
                title="주의 성분"
                firstText={`${comparedFirstProduct.cautionIngredients.length}개`}
                secondText={`${comparedSecondProduct.cautionIngredients.length}개`}
              />

              <AnalysisRow
                icon="flask-outline"
                title="전체 성분 수"
                firstText={`${comparedFirstProduct.ingredients.length}개`}
                secondText={`${comparedSecondProduct.ingredients.length}개`}
              />

              <AnalysisRow
                icon="shield-checkmark-outline"
                title="맞춤 적합도"
                firstText={getFitLabel(comparedFirstProduct.riskScore)}
                secondText={getFitLabel(comparedSecondProduct.riskScore)}
              />

              <AnalysisRow
                icon="person-outline"
                title="민감 피부 기준"
                firstText={getSensitiveSkinLabel(comparedFirstProduct)}
                secondText={getSensitiveSkinLabel(comparedSecondProduct)}
              />

              <View style={styles.detailBox}>
                <Text style={styles.detailTitle}>제품 A 주요 성분</Text>
                <Text style={styles.detailText}>
                  {comparedFirstProduct.ingredients.join(", ")}
                </Text>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailTitle}>제품 A 주의 성분</Text>
                <Text style={styles.detailText}>
                  {comparedFirstProduct.cautionIngredients.length > 0
                    ? comparedFirstProduct.cautionIngredients.join(", ")
                    : "특별한 주의 성분 없음"}
                </Text>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailTitle}>제품 B 주요 성분</Text>
                <Text style={styles.detailText}>
                  {comparedSecondProduct.ingredients.join(", ")}
                </Text>
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detailTitle}>제품 B 주의 성분</Text>
                <Text style={styles.detailText}>
                  {comparedSecondProduct.cautionIngredients.length > 0
                    ? comparedSecondProduct.cautionIngredients.join(", ")
                    : "특별한 주의 성분 없음"}
                </Text>
              </View>
            </View>

            <Pressable style={styles.pdfButton} onPress={handleSavePdf}>
              <Ionicons name="document-text-outline" size={21} color="#5B7CFA" />
              <Text style={styles.pdfButtonText}>PDF로 저장하기</Text>
            </Pressable>
          </>
        )}
    </ScrollView>
  );
}

function ProductSelectBox({
  title,
  inputValue,
  onChangeInput,
  selectedProduct,
  onSelect,
}: {
  title: string;
  inputValue: string;
  onChangeInput: (value: string) => void;
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
}) {
  return (
    <View style={styles.productSelectBox}>
      <Text style={styles.selectTitle}>{title}</Text>
      <Text style={styles.selectHint}>직접 입력하거나 샘플 제품을 선택하세요.</Text>

      <TextInput
        style={styles.productInput}
        placeholder="제품명 입력"
        placeholderTextColor="#A0A7B5"
        value={inputValue}
        onChangeText={onChangeInput}
      />

      <Text style={styles.sampleTitle}>샘플 제품</Text>

      {sampleProducts.map((product) => {
        const isSelected = selectedProduct?.id === product.id;

        return (
          <Pressable
            key={product.id}
            style={[
              styles.productOption,
              isSelected && styles.selectedProductOption,
            ]}
            onPress={() => onSelect(product)}
          >
            <Text
              style={[
                styles.productOptionName,
                isSelected && styles.selectedProductText,
              ]}
              numberOfLines={1}
            >
              {product.name}
            </Text>

            <Text style={styles.productOptionBrand} numberOfLines={1}>
              {product.brand}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RiskCompareItem({
  product,
  label,
}: {
  product: Product;
  label: string;
}) {
  const riskColor = getRiskColor(product.riskLevel);
  const riskLabel = getRiskLabel(product.riskLevel);

  return (
    <View style={styles.riskItem}>
      <View style={styles.riskTop}>
        <View style={styles.riskTitleBox}>
          <Text style={styles.riskLabelText}>{label}</Text>
          <Text style={styles.riskProductName}>{product.name}</Text>
          <Text style={styles.riskProductBrand}>{product.brand}</Text>
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
              width: `${product.riskScore}%`,
              backgroundColor: riskColor.text,
            },
          ]}
        />
      </View>

      <Text style={styles.riskScoreText}>위험도 {product.riskScore}점</Text>
    </View>
  );
}

function AnalysisRow({
  icon,
  title,
  firstText,
  secondText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  firstText: string;
  secondText: string;
}) {
  return (
    <View style={styles.analysisRow}>
      <View style={styles.analysisTitleBox}>
        <Ionicons name={icon} size={19} color="#5B7CFA" />
        <Text style={styles.analysisTitle}>{title}</Text>
      </View>

      <View style={styles.analysisValues}>
        <Text style={styles.analysisValue}>{firstText}</Text>
        <Text style={styles.analysisDivider}>/</Text>
        <Text style={styles.analysisValue}>{secondText}</Text>
      </View>
    </View>
  );
}

function getComparableProduct(
  selectedProduct: Product | null,
  inputName: string,
  fallbackId: number
): Product | null {
  if (selectedProduct) {
    return selectedProduct;
  }

  if (!inputName.trim()) {
    return null;
  }

  return {
    id: fallbackId,
    name: inputName.trim(),
    brand: "직접 입력",
    riskScore: 50,
    riskLevel: "medium",
    ingredients: ["성분 분석 전"],
    cautionIngredients: ["AI 분석 필요"],
    summary:
      "직접 입력한 제품은 성분표 촬영 또는 갤러리 분석을 연결하면 더 정확한 비교가 가능합니다.",
  };
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

function getFitLabel(score: number) {
  if (score <= 30) return "적합";
  if (score <= 60) return "주의";
  return "비추천";
}

function getSensitiveSkinLabel(product: Product) {
  if (product.riskScore <= 30) return "사용 가능";
  if (product.riskScore <= 60) return "주의 필요";
  return "권장하지 않음";
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

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A808C",
    marginBottom: 18,
  },

  compareSelectRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 18,
  },
  productSelectBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5EAF2",
  },
  selectTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 4,
  },
  selectHint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    color: "#8A8F98",
    marginBottom: 10,
  },
  productInput: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF2",
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#20222A",
    marginBottom: 12,
  },
  sampleTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#8A8F98",
    marginBottom: 8,
  },
  productOption: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  selectedProductOption: {
    borderColor: "#5B7CFA",
    backgroundColor: "#EEF3FF",
  },
  productOptionName: {
    fontSize: 13,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 4,
  },
  selectedProductText: {
    color: "#4F6EF7",
  },
  productOptionBrand: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A8F98",
  },

  vsBox: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#A0A7B5",
  },

  actionGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  subActionButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#F4F7FF",
    borderWidth: 1,
    borderColor: "#DCE4FF",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  subActionText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
  },

  compareButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#5B7CFA",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  compareButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  aiSummaryCard: {
    backgroundColor: "#E8EEFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  recommendCard: {
    backgroundColor: "#E8F7EF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#20222A",
  },
  aiSummaryText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
    color: "#4B5563",
  },
  strongText: {
    fontWeight: "900",
    color: "#4F6EF7",
  },

  recommendBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
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
    marginBottom: 8,
  },
  recommendReason: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  riskItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  riskTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  riskTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  riskLabelText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5B7CFA",
    marginBottom: 5,
  },
  riskProductName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 4,
  },
  riskProductBrand: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8A8F98",
  },
  riskBadge: {
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    paddingHorizontal: 13,
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
    marginBottom: 8,
  },
  riskBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  riskScoreText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B7280",
  },

  analysisRow: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analysisTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analysisTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#20222A",
  },
  analysisValues: {
    flexDirection: "row",
    alignItems: "center",
  },
  analysisValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4F6EF7",
  },
  analysisDivider: {
    marginHorizontal: 8,
    color: "#A0A7B5",
    fontWeight: "900",
  },

  detailBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1F6",
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#20222A",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },

  pdfButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE4FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  pdfButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#5B7CFA",
  },
});
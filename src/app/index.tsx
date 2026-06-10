import { AppColors, Radius, SoftShadow } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const ANALYSIS_HISTORY_KEY = "safelabel_analysis_history";
const PROFILE_STORAGE_KEY = "safelabel_user_profile";

type RiskLevel = "low" | "medium" | "high";

type RecentAnalysisItem = {
  id: number;
  productName: string;
  date: string;
  riskLevel: RiskLevel;
  riskScore: number;
  summary?: string;
};

type UserProfile = {
  skinType: string;
  sensitivity: string;
  allergies: string[];
  avoidIngredients: string[];
};

export default function HomeScreen() {
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysisItem[]>(
    [],
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const loadRecentAnalyses = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(ANALYSIS_HISTORY_KEY);

      if (!savedHistory) {
        setRecentAnalyses([]);
        return;
      }

      const parsedHistory = JSON.parse(savedHistory);

      if (!Array.isArray(parsedHistory)) {
        setRecentAnalyses([]);
        return;
      }

      const recentItems: RecentAnalysisItem[] = parsedHistory
        .filter((item) => item?.type === "single")
        .slice(0, 2)
        .map((item) => ({
          id: item.id,
          productName: item.productName || "이름 없는 제품",
          date: item.date || new Date().toISOString(),
          riskLevel: item.riskLevel || "low",
          riskScore: Number(item.riskScore || 0),
          summary: item.summary || "",
        }));

      setRecentAnalyses(recentItems);
    } catch (error) {
      console.log("최근 분석 내역 불러오기 실패:", error);
      setRecentAnalyses([]);
    }
  };

  const loadUserProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

      if (!savedProfile) {
        setUserProfile(null);
        return;
      }

      const parsedProfile = JSON.parse(savedProfile);

      setUserProfile({
        skinType: parsedProfile.skinType || "",
        sensitivity: parsedProfile.sensitivity || "",
        allergies: Array.isArray(parsedProfile.allergies)
          ? parsedProfile.allergies
          : [],
        avoidIngredients: Array.isArray(parsedProfile.avoidIngredients)
          ? parsedProfile.avoidIngredients
          : [],
      });
    } catch (error) {
      console.log("맞춤 기준 불러오기 실패:", error);
      setUserProfile(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRecentAnalyses();
      loadUserProfile();
    }, []),
  );

  const goToCamera = () => {
    router.push({
      pathname: "/analyze",
      params: { mode: "camera" },
    });
  };

  const goToGallery = () => {
    router.push({
      pathname: "/analyze",
      params: { mode: "gallery" },
    });
  };

  const goToHistoryDetail = (id: number) => {
    router.push({
      pathname: "/history-detail",
      params: { id: String(id) },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <View>
          <Text style={styles.appName}>SafeLabel AI</Text>
          <Text style={styles.appTagline}>화장품 성분 맞춤 분석</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>
          내 피부에 맞는 화장품인지, 성분부터 확인하세요
        </Text>

        <Text style={styles.subtitle}>
          OCR로 성분표를 읽고, 공공데이터와 AI로 맞춤 위험도를 분석합니다.
        </Text>
      </View>

      <View style={styles.scanCard}>
        <View style={styles.scanHeader}>
          <View style={styles.cameraIconBox}>
            <Ionicons name="camera-outline" size={30} color="#5B7CFA" />
          </View>

          <View style={styles.scanTextBox}>
            <Text style={styles.scanTitle}>성분표 촬영하기</Text>
            <Text style={styles.scanDescription}>
              제품 뒷면의 전성분 영역을 촬영해 분석을 시작하세요.
            </Text>
          </View>
        </View>

        <Pressable style={styles.cameraButton} onPress={goToCamera}>
          <Ionicons name="camera" size={18} color="#FFFFFF" />
          <Text style={styles.cameraButtonText}>카메라로 분석하기</Text>
        </Pressable>
      </View>

      <Pressable style={styles.galleryButton} onPress={goToGallery}>
        <Ionicons name="image-outline" size={22} color={AppColors.primary} />
        <Text style={styles.galleryButtonText}>갤러리에서 불러오기</Text>
      </Pressable>

      <View style={styles.featureGrid}>
        <Pressable
          style={styles.featureCard}
          onPress={() => router.push("/analyze")}
        >
          <View style={styles.featureIconBox}>
            <Ionicons
              name="sparkles-outline"
              size={22}
              color={AppColors.primary}
            />
          </View>
          <Text style={styles.featureTitle}>성분 분석하기</Text>
          <Text style={styles.featureSubtitle}>
            OCR로 전성분을 읽고 결과를 확인합니다.
          </Text>
        </Pressable>

        <Pressable
          style={styles.featureCard}
          onPress={() => router.push("/ingredients")}
        >
          <View style={styles.featureIconBox}>
            <Ionicons name="book-outline" size={22} color={AppColors.primary} />
          </View>
          <Text style={styles.featureTitle}>성분사전 검색</Text>
          <Text style={styles.featureSubtitle}>
            공공데이터 기반 성분 정보를 찾아보세요.
          </Text>
        </Pressable>

        <Pressable
          style={styles.featureCard}
          onPress={() => router.push("/history")}
        >
          <View style={styles.featureIconBox}>
            <Ionicons
              name="clipboard-outline"
              size={22}
              color={AppColors.primary}
            />
          </View>
          <Text style={styles.featureTitle}>최근 분석 기록</Text>
          <Text style={styles.featureSubtitle}>
            저장된 분석 결과를 빠르게 확인합니다.
          </Text>
        </Pressable>

        <Pressable
          style={styles.featureCard}
          onPress={() => router.push("/profile")}
        >
          <View style={styles.featureIconBox}>
            <Ionicons
              name="person-outline"
              size={22}
              color={AppColors.primary}
            />
          </View>
          <Text style={styles.featureTitle}>맞춤 기준 설정</Text>
          <Text style={styles.featureSubtitle}>
            피부 타입과 알레르기 정보를 설정합니다.
          </Text>
        </Pressable>
      </View>

      <View style={styles.profileCriteriaCard}>
        <View style={styles.profileCriteriaHeader}>
          <View style={styles.profileCriteriaIconBox}>
            <Ionicons
              name="options-outline"
              size={22}
              color={AppColors.primary}
            />
          </View>
          <Text style={styles.profileCriteriaTitle}>내 맞춤 분석 기준</Text>
        </View>

        {userProfile ? (
          <View style={styles.profileCriteriaRows}>
            <ProfileCriteriaRow
              label="피부 타입"
              value={userProfile.skinType || "미설정"}
            />
            <ProfileCriteriaRow
              label="민감도"
              value={userProfile.sensitivity || "미설정"}
            />
            <ProfileCriteriaRow
              label="알레르기"
              value={
                userProfile.allergies.length > 0
                  ? userProfile.allergies.join(", ")
                  : "미설정"
              }
            />
            <ProfileCriteriaRow
              label="피하고 싶은 성분"
              value={
                userProfile.avoidIngredients.length > 0
                  ? userProfile.avoidIngredients.join(", ")
                  : "미설정"
              }
            />
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/profile")}
            >
              <Text style={styles.profileButtonText}>기준 수정하기</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={AppColors.card}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.profileEmptyBox}>
            <Text style={styles.profileEmptyText}>
              피부 타입과 알레르기를 설정하면 분석 점수와 주의 안내에 반영됩니다.
            </Text>
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/profile")}
            >
              <Text style={styles.profileButtonText}>맞춤 기준 설정하기</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={AppColors.card}
              />
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>최근 분석 내역</Text>

        <Pressable onPress={() => router.push("/history")}>
          <View style={styles.viewAllRow}>
            <Text style={styles.viewAllText}>전체보기</Text>
            <Ionicons name="chevron-forward" size={16} color="#8A8F98" />
          </View>
        </Pressable>
      </View>

      <View style={styles.historyList}>
        {recentAnalyses.length > 0 ? (
          recentAnalyses.map((item) => {
            const statusInfo = getRiskStatusInfo(item.riskLevel);

            return (
              <Pressable
                key={item.id}
                style={styles.historyCard}
                onPress={() => goToHistoryDetail(item.id)}
              >
                <View style={styles.productImageBox}>
                  <Text style={styles.productEmoji}>🧴</Text>
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.productDate}>
                    {formatDate(item.date)} · {item.riskScore}점
                  </Text>
                  {item.summary ? (
                    <Text style={styles.productSummary} numberOfLines={1}>
                      {item.summary}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusInfo.bg },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusInfo.text },
                    ]}
                  />
                  <Text style={[styles.statusText, { color: statusInfo.text }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyHistoryBox}>
            <Ionicons name="document-text-outline" size={28} color="#A0A7B5" />

            <Text style={styles.emptyHistoryTitle}>
              아직 분석 내역이 없어요
            </Text>

            <Text style={styles.emptyHistoryText}>
              성분표를 촬영하거나 갤러리에서 불러오면 분석 기록이 저장됩니다.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ProfileCriteriaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.profileCriteriaRow}>
      <Text style={styles.profileCriteriaLabel}>{label}</Text>
      <Text style={styles.profileCriteriaValue}>{value}</Text>
    </View>
  );
}

function getRiskStatusInfo(level: RiskLevel) {
  switch (level) {
    case "low":
      return {
        label: "낮음",
        bg: AppColors.mintSoft,
        text: AppColors.safe,
      };
    case "medium":
      return {
        label: "보통",
        bg: AppColors.cautionSoft,
        text: AppColors.caution,
      };
    case "high":
      return {
        label: "높음",
        bg: AppColors.riskSoft,
        text: AppColors.risk,
      };
    default:
      return {
        label: "낮음",
        bg: AppColors.mintSoft,
        text: AppColors.safe,
      };
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

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
    marginBottom: 28,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#DDE5FF",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: AppColors.primary,
  },
  appName: {
    fontSize: 22,
    fontWeight: "900",
    color: AppColors.text,
  },
  appTagline: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textSub,
    marginTop: 2,
  },

  hero: {
    marginBottom: 24,
  },
  title: {
    fontSize: 31,
    lineHeight: 40,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: AppColors.textSub,
  },

  scanCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  cameraIconBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
  },
  scanTextBox: {
    flex: 1,
    paddingTop: 4,
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 10,
  },
  scanDescription: {
    fontSize: 16,
    lineHeight: 25,
    color: AppColors.textSub,
  },

  cameraButton: {
    height: 60,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: "900",
    color: AppColors.card,
  },

  galleryButton: {
    height: 68,
    borderRadius: 22,
    backgroundColor: AppColors.primarySoft,
    borderWidth: 1,
    borderColor: "#DDE5FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 34,
  },
  galleryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.primary,
  },

  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 26,
  },
  featureCard: {
    width: "48%",
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 18,
    ...SoftShadow,
  },
  featureIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 6,
  },
  featureSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textSub,
  },

  profileCriteriaCard: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...SoftShadow,
  },
  profileCriteriaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  profileCriteriaIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AppColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  profileCriteriaTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.text,
  },
  profileCriteriaRows: {
    gap: 10,
  },
  profileCriteriaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  profileCriteriaLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: AppColors.textSub,
  },
  profileCriteriaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: AppColors.text,
  },
  profileEmptyBox: {
    gap: 14,
  },
  profileEmptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: AppColors.textSub,
  },
  profileButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 4,
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: AppColors.card,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: AppColors.text,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.textSub,
  },

  historyList: {
    gap: 12,
  },
  historyCard: {
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    ...SoftShadow,
  },
  productImageBox: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: AppColors.subCard,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  productEmoji: {
    fontSize: 26,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "900",
    color: AppColors.text,
    marginBottom: 9,
  },
  productDate: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.textSub,
  },
  productSummary: {
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.textMuted,
    marginTop: 4,
  },

  statusBadge: {
    minWidth: 72,
    height: 34,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "900",
  },

  emptyHistoryBox: {
    backgroundColor: AppColors.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: 22,
    alignItems: "center",
    ...SoftShadow,
  },
  emptyHistoryTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: AppColors.text,
    marginTop: 10,
    marginBottom: 6,
  },
  emptyHistoryText: {
    fontSize: 14,
    lineHeight: 21,
    color: AppColors.textSub,
    textAlign: "center",
  },
});

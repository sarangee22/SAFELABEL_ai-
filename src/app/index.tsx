import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const recentAnalyses = [
  {
    id: 1,
    name: "오가닉 레어 세럼",
    date: "2026.05.13",
    status: "위험",
    statusType: "danger",
  },
  {
    id: 2,
    name: "퓨어 선스크린 SPF50",
    date: "2026.05.10",
    status: "안전",
    statusType: "safe",
  },
];

export default function HomeScreen() {
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <Text style={styles.appName}>SafeLabel AI</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>성분표를 찍으면 안전이 보입니다.</Text>

        <Text style={styles.subtitle}>
          AI가 화장품 성분을 분석해 나에게 맞는 안전 선택을 돕습니다.
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
              제품 뒷면의 성분표를 촬영해 분석을 시작하세요.
            </Text>
          </View>
        </View>

        <Pressable style={styles.cameraButton} onPress={goToCamera}>
          <Ionicons name="camera" size={16} color="#5B7CFA" />
          <Text style={styles.cameraButtonText}>탭하여 카메라 열기</Text>
        </Pressable>
      </View>

      <Pressable style={styles.galleryButton} onPress={goToGallery}>
        <Ionicons name="image-outline" size={22} color="#5B7CFA" />
        <Text style={styles.galleryButtonText}>갤러리에서 불러오기</Text>
      </Pressable>

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
        {recentAnalyses.map((item) => (
          <Pressable
            key={item.id}
            style={styles.historyCard}
            onPress={() => router.push("/history")}
          >
            <View style={styles.productImageBox}>
              <Text style={styles.productEmoji}>🧴</Text>
            </View>

            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productDate}>{item.date}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                item.statusType === "danger"
                  ? styles.dangerBadge
                  : styles.safeBadge,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  item.statusType === "danger"
                    ? styles.dangerDot
                    : styles.safeDot,
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  item.statusType === "danger"
                    ? styles.dangerText
                    : styles.safeText,
                ]}
              >
                {item.status}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
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
    marginBottom: 28,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#5B7CFA",
  },
  appName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#20222A",
  },

  hero: {
    marginBottom: 24,
  },
  title: {
    fontSize: 31,
    lineHeight: 40,
    fontWeight: "900",
    color: "#20222A",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#7A808C",
  },

  scanCard: {
    backgroundColor: "#E7EEFF",
    borderRadius: 24,
    padding: 28,
    marginBottom: 16,
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
    backgroundColor: "#FFFFFF",
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
    color: "#20222A",
    marginBottom: 10,
  },
  scanDescription: {
    fontSize: 16,
    lineHeight: 25,
    color: "#7A808C",
  },

  cameraButton: {
    height: 72,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#D6DEF2",
    borderStyle: "dashed",
    backgroundColor: "#F7FAFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#5B7CFA",
  },

  galleryButton: {
    height: 68,
    borderRadius: 18,
    backgroundColor: "#E7EEFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 34,
  },
  galleryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#5B7CFA",
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
    color: "#20222A",
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A8F98",
  },

  historyList: {
    gap: 12,
  },
  historyCard: {
    minHeight: 92,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF3",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  productImageBox: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: "#FAFAFC",
    borderWidth: 1,
    borderColor: "#EEF1F6",
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
    color: "#20222A",
    marginBottom: 9,
  },
  productDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7A808C",
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
  dangerBadge: {
    backgroundColor: "#FBE3E7",
  },
  safeBadge: {
    backgroundColor: "#DFF4E8",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dangerDot: {
    backgroundColor: "#E15B6B",
  },
  safeDot: {
    backgroundColor: "#4DB978",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "900",
  },
  dangerText: {
    color: "#D94C5F",
  },
  safeText: {
    color: "#3CA66B",
  },
});
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#5B7CFA",
        tabBarInactiveTintColor: "#8A8F98",
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="analyze"
        options={{
          title: "분석",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "scan" : "scan-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="compare"
        options={{
          title: "비교",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "git-compare" : "git-compare-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "기록",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "clipboard" : "clipboard-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
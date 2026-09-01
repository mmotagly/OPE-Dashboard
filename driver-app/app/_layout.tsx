import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SessionProvider, useSession } from "../lib/session";
import { colors } from "../lib/theme";
// Registers the background location task (TaskManager.defineTask) as a
// side effect — must happen before the app needs it, including on a cold
// start the OS triggers just to deliver a queued background location
// event, so it's imported here at the root rather than lazily from the
// shift screen.
import "../lib/location-task";

/**
 * `Stack.Protected` is the SDK 53+ Expo Router auth-gating API — confirmed
 * against the versioned docs for this SDK rather than assumed, since the
 * router's auth pattern changed from the plain-redirect approach older
 * guidance describes. `(app)` only renders once `session` is truthy;
 * `login` only once it isn't. Navigating to a route the current guard
 * excludes bounces back to the anchor route automatically.
 */
function RootNavigator() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
});

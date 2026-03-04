import { createContext, useContext } from 'react';
import {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

const TabBarContext = createContext(null);

// Pixels of upward scroll needed to fully hide the elements
const SCROLL_DISTANCE = 120;

const SNAP_CONFIG = { duration: 450, easing: Easing.out(Easing.cubic) };

export function TabBarScrollProvider({ children }) {
  const tabVisible = useSharedValue(1);
  return (
    <TabBarContext.Provider value={{ tabVisible }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext) ?? {};
}

export function useTabBarScroll() {
  const { tabVisible } = useTabBar();
  const lastY = useSharedValue(0);

  return useAnimatedScrollHandler({
    // Cancel any snap animation the moment the finger touches
    onBeginDrag: () => {
      cancelAnimation(tabVisible);
    },
    // Cancel snap if momentum starts (fast swipe — let onScroll keep tracking)
    onMomentumBegin: () => {
      cancelAnimation(tabVisible);
    },
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const diff = y - lastY.value;
      lastY.value = y;

      // At or above top: always fully visible
      if (y <= 0) {
        tabVisible.value = 1;
        return;
      }

      // Proportional: each pixel of scroll maps directly to visibility
      const delta = diff / SCROLL_DISTANCE;
      tabVisible.value = Math.min(1, Math.max(0, tabVisible.value - delta));
    },
    // Snap to fully hidden or fully visible when finger lifts
    onEndDrag: (event) => {
      if (event.contentOffset.y <= 0) {
        tabVisible.value = withTiming(1, SNAP_CONFIG);
        return;
      }
      tabVisible.value = withTiming(
        tabVisible.value < 0.5 ? 0 : 1,
        SNAP_CONFIG,
      );
    },
    // Same snap at end of momentum scroll
    onMomentumEnd: (event) => {
      if (event.contentOffset.y <= 0) {
        tabVisible.value = withTiming(1, SNAP_CONFIG);
        return;
      }
      if (tabVisible.value > 0 && tabVisible.value < 1) {
        tabVisible.value = withTiming(
          tabVisible.value < 0.5 ? 0 : 1,
          SNAP_CONFIG,
        );
      }
    },
  });
}

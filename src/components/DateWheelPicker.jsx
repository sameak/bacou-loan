/**
 * DateWheelPicker — iOS UIPickerView-style 3-column date picker
 *
 * Ported from KOLi project. Theme imports replaced with inline constants.
 *
 *  - Animated.FlatList + getItemLayout — performant, no layout thrash
 *  - WheelItem as separate component — fixes hooks-in-renderItem violation
 *  - rotateX 3D cylinder + opacity + scale + fontSize animation
 *  - Two thin selection lines — authentic iOS look
 *  - Spring slide-in modal — bouncy native feel
 *  - Khmer text support
 *  - YYYY-MM-DD string I/O
 *  - Circular/looping scroll for Month + Day
 *
 * Column order: Month | Day | Year  (matches iOS native picker)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// ── Inline theme constants (matches KOLi theme values) ────
const borderRadius = { xl: 20 };
const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24 };

// ── Layout ────────────────────────────────────────────────
const VISIBLE   = 3;
const CENTER    = Math.floor(VISIBLE / 2);   // 1  — selected row
const ITEM_H    = 44;
const ITEM_H_KM = 52;                        // Khmer tall vowels need more room
const getItemH  = (isKhmer) => (isKhmer ? ITEM_H_KM : ITEM_H);

// Repetitions for looping columns (Month + Day).
// 100× means 50 full repetitions in each direction — impossible to reach the end.
const REPEAT = 100;

// ── Data helpers ──────────────────────────────────────────
const CUR_YEAR = new Date().getFullYear();

export const YEAR_DATA  = Array.from({ length: CUR_YEAR - 1949 }, (_, i) => CUR_YEAR - i);
export const MONTH_DATA = Array.from({ length: 12 }, (_, i) => i + 1);

export function getDayData(year, month) {
  return Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
}

export const MONTH_NAMES = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  km: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'],
};

const pad = (n) => String(n).padStart(2, '0');

// ── WheelItem ─────────────────────────────────────────────
// Must be its own component — calling useAnimatedStyle inside renderItem
// (a plain function) violates Rules of Hooks.  One component = safe.
const WheelItem = React.memo(function WheelItem({
  label, index, scrollY, itemH, accentColor, mutedColor, isKhmer,
}) {
  // View: opacity + 3-D rotateX cylinder + scale
  const viewAnim = useAnimatedStyle(() => {
    const delta = scrollY.value - index * itemH;
    const angle = interpolate(delta, [-itemH*2,-itemH,0,itemH,itemH*2], [25,5,0,-5,-25], Extrapolation.CLAMP);
    const opa   = interpolate(Math.abs(delta), [0,itemH,itemH*2], [1,1.0,0.20], Extrapolation.CLAMP);
    const sc    = interpolate(Math.abs(delta), [0,itemH], [1,0.97], Extrapolation.CLAMP);
    return {
      opacity: opa,
      transform: [{ perspective: 500 }, { rotateX: `${angle}deg` }, { scale: sc }],
    };
  });

  // Text: color + weight + font-size (grows at center — reference pattern)
  const textAnim = useAnimatedStyle(() => {
    const delta    = scrollY.value - index * itemH;
    const isCenter = Math.abs(delta) < itemH * 0.55;
    const fSize    = interpolate(
      Math.abs(delta),
      [0, itemH],
      [isKhmer ? 17 : 21, isKhmer ? 16 : 21],
      Extrapolation.CLAMP,
    );
    return {
      fontSize: fSize,
      color:    isCenter ? accentColor : mutedColor,
      ...(isKhmer
        ? { fontFamily: isCenter ? 'KohSantepheap_700Bold' : 'KohSantepheap_400Regular' }
        : { fontWeight: isCenter ? '700' : '400' }),
    };
  });

  return (
    <Animated.View style={[styles.item, { height: itemH }, viewAnim]}>
      <Animated.Text style={[styles.itemText, textAnim]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
});

// ── WheelColumn ───────────────────────────────────────────
const WheelColumn = React.memo(function WheelColumn({
  data, selectedIndex, onIndexChange, renderLabel,
  accentColor, mutedColor, surfaceColor, isKhmer, flex = 1,
  loop = false,
}) {
  const itemH = getItemH(isKhmer);
  const N     = data.length;

  // For loop columns: repeat data × REPEAT; centred at repetition 50.
  const loopedData = useMemo(() => {
    if (!loop || N === 0) return data;
    return Array.from({ length: REPEAT * N }, (_, i) => data[i % N]);
  }, [loop, data, N]);

  const canonIdx = useCallback((realIdx) => (
    loop ? Math.floor(REPEAT / 2) * N + realIdx : realIdx
  ), [loop, N]);

  const startIdx = canonIdx(selectedIndex);

  const listRef        = useRef(null);
  const scrollY        = useSharedValue(startIdx * itemH);
  const lastIdx        = useRef(startIdx);
  const lastRealIdx    = useRef(selectedIndex);
  const lastHapticIdx  = useSharedValue(startIdx);
  const momentumActive = useRef(false);
  const prevDataLen    = useRef(N);
  const isMounted      = useRef(false);

  // Velocity-matched haptics: slow drag = Light, normal = Medium, fast flick = Heavy
  const haptic = useCallback((speed = 0) => {
    const style = speed > 1500
      ? Haptics.ImpactFeedbackStyle.Heavy
      : speed > 500
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style).catch(() => {});
  }, []);

  const scrollToIdx = useCallback((idx, animated = true) => {
    listRef.current?.scrollToOffset({ offset: idx * itemH, animated });
  }, [itemH]);

  const commitIdx = useCallback((flatIdx) => {
    const realIdx = loop ? ((flatIdx % N) + N) % N : flatIdx;
    if (realIdx !== lastRealIdx.current) {
      lastRealIdx.current = realIdx;
      onIndexChange(realIdx);
    }
  }, [loop, N, onIndexChange]);

  const handler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
      const idx = Math.round(e.contentOffset.y / itemH);
      if (idx !== lastHapticIdx.value) {
        lastHapticIdx.value = idx;
        runOnJS(haptic)(Math.abs(e.velocity?.y ?? 500));
      }
    },
  });

  const onScrollEndDrag = useCallback((e) => {
    const offset = e.nativeEvent.contentOffset.y;
    setTimeout(() => {
      if (!momentumActive.current) {
        const maxOff  = (loopedData.length - 1) * itemH;
        const flatIdx = Math.round(Math.max(0, Math.min(maxOff, offset)) / itemH);
        const snapIdx = loop ? canonIdx(((flatIdx % N) + N) % N) : flatIdx;
        scrollToIdx(snapIdx, true);
        commitIdx(flatIdx);
      }
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopedData.length, N, loop, itemH, canonIdx, scrollToIdx, commitIdx]);

  const onMomentumScrollBegin = useCallback(() => {
    momentumActive.current = true;
  }, []);

  const onMomentumScrollEnd = useCallback((e) => {
    momentumActive.current = false;
    const offset  = e.nativeEvent.contentOffset.y;
    const maxOff  = (loopedData.length - 1) * itemH;
    const flatIdx = Math.round(Math.max(0, Math.min(maxOff, offset)) / itemH);

    if (loop) {
      const realIdx  = ((flatIdx % N) + N) % N;
      const snapIdx  = canonIdx(realIdx);
      lastHapticIdx.value = snapIdx;
      scrollToIdx(snapIdx, false);
      scrollY.value   = snapIdx * itemH;
      lastIdx.current = snapIdx;
      commitIdx(flatIdx);
    } else {
      scrollToIdx(flatIdx, false);
      commitIdx(flatIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopedData.length, N, loop, itemH, canonIdx, scrollToIdx, commitIdx]);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollToIdx(startIdx, false);
      scrollY.value     = startIdx * itemH;
      lastIdx.current   = startIdx;
      isMounted.current = true;
    }, 10);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;
    const dataLenChanged = prevDataLen.current !== N;
    prevDataLen.current  = N;
    const targetIdx      = canonIdx(selectedIndex);
    scrollY.value        = targetIdx * itemH;
    scrollToIdx(targetIdx, !dataLenChanged);
    lastIdx.current      = targetIdx;
    lastRealIdx.current  = selectedIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, N]);

  const renderItem = useCallback(({ item, index }) => (
    <WheelItem
      label={renderLabel ? renderLabel(item, index) : String(item)}
      index={index}
      scrollY={scrollY}
      itemH={itemH}
      accentColor={accentColor}
      mutedColor={mutedColor}
      isKhmer={isKhmer}
    />
  ), [scrollY, itemH, accentColor, mutedColor, isKhmer, renderLabel]);

  const getItemLayout = useCallback((_, index) => ({
    length: itemH, offset: itemH * index, index,
  }), [itemH]);

  return (
    <View style={{ flex, height: itemH * VISIBLE, overflow: 'hidden' }}>
      {/* Two thin iOS-style selection lines */}
      <View
        pointerEvents="none"
        style={[styles.selLines, { top: CENTER * itemH, height: itemH }]}
      >
        <View style={[styles.selLine, { backgroundColor: accentColor + '60' }]} />
        <View style={[styles.selLine, { backgroundColor: accentColor + '60' }]} />
      </View>

      {/* Top gradient fade */}
      <View pointerEvents="none" style={{ position: 'absolute', zIndex: 2, top: 0, left: 0, right: 0, height: CENTER * itemH, flexDirection: 'column' }}>
        {[0.95, 0.75, 0.50, 0.28, 0.12, 0.03].map((op, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: surfaceColor, opacity: op }} />
        ))}
      </View>

      {/* Bottom gradient fade */}
      <View pointerEvents="none" style={{ position: 'absolute', zIndex: 2, bottom: 0, left: 0, right: 0, height: CENTER * itemH, flexDirection: 'column' }}>
        {[0.03, 0.12, 0.28, 0.50, 0.75, 0.95].map((op, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: surfaceColor, opacity: op }} />
        ))}
      </View>

      <Animated.FlatList
        ref={listRef}
        data={loopedData}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={startIdx}
        onScroll={handler}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        decelerationRate={Platform.OS === 'ios' ? 0.996 : 0.985}
        contentContainerStyle={{ paddingVertical: CENTER * itemH }}
      />
    </View>
  );
});

// ── DateWheelPicker ───────────────────────────────────────
// Column order: Month | Day | Year  (matches iOS native picker)
export const DateWheelPicker = function DateWheelPicker({
  value, onChange, accentColor, colors, language,
}) {
  const parse = (str) => {
    const [y, m, d] = (str || '').split('-').map(Number);
    return { year: y || (CUR_YEAR - 25), month: m || 1, day: d || 1 };
  };

  const init = parse(value);
  const [year,  setYear]  = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [day,   setDay]   = useState(init.day);

  const dayData    = useMemo(() => getDayData(year, month), [year, month]);
  const safeDay    = Math.min(day, dayData.length);
  const isKhmer    = language === 'km';
  const monthNames = MONTH_NAMES[language] || MONTH_NAMES.en;

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    onChange(`${year}-${pad(month)}-${pad(safeDay)}`);
  }, [year, month, safeDay]);

  const monthIdx = month - 1;
  const dayIdx   = safeDay - 1;
  const yearIdx  = Math.max(0, YEAR_DATA.indexOf(year));

  const onMonth = useCallback((i) => setMonth(i + 1),        []);
  const onDay   = useCallback((i) => setDay(dayData[i]),     [dayData]);
  const onYear  = useCallback((i) => setYear(YEAR_DATA[i]),  []);

  return (
    <View style={styles.pickerRow}>
      {/* Month — widest (long names) — loops Jan→Dec→Jan */}
      <WheelColumn
        data={MONTH_DATA}
        selectedIndex={monthIdx}
        onIndexChange={onMonth}
        renderLabel={(item) => monthNames[item - 1]}
        accentColor={accentColor}
        mutedColor={colors.textMuted}
        surfaceColor={colors.surface}
        isKhmer={isKhmer}
        flex={1.5}
        loop={true}
      />
      <View style={[styles.colSep, { backgroundColor: colors.border }]} />
      {/* Day — loops 1→maxDay→1, handles variable day count per month */}
      <WheelColumn
        data={dayData}
        selectedIndex={dayIdx}
        onIndexChange={onDay}
        accentColor={accentColor}
        mutedColor={colors.textMuted}
        surfaceColor={colors.surface}
        isKhmer={isKhmer}
        flex={0.75}
        loop={true}
      />
      <View style={[styles.colSep, { backgroundColor: colors.border }]} />
      {/* Year — bounded (1950 → current year), no loop */}
      <WheelColumn
        data={YEAR_DATA}
        selectedIndex={yearIdx}
        onIndexChange={onYear}
        accentColor={accentColor}
        mutedColor={colors.textMuted}
        surfaceColor={colors.surface}
        isKhmer={isKhmer}
        flex={1}
        loop={false}
      />
    </View>
  );
};

// ── DatePickerModal ───────────────────────────────────────
export const DatePickerModal = function DatePickerModal({
  visible, onClose, value, onChange, title,
  accentColor, colors, isDark, language,
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [rendered,   setRendered]   = useState(visible);
  const slideAnim   = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setLocalValue(value || '');
      slideAnim.value = withSpring(1, { damping: 50, stiffness: 300 });
    } else {
      slideAnim.value = withTiming(0, { duration: 200 }, (done) => {
        if (done) runOnJS(setRendered)(false);
      });
    }
  }, [visible]);

  const sheetAnim = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(slideAnim.value, [0, 1], [500, 0], Extrapolation.CLAMP),
    }],
  }));

  const backdropAnim = useAnimatedStyle(() => ({
    opacity: interpolate(slideAnim.value, [0, 1], [0, 0.5], Extrapolation.CLAMP),
  }));

  const isKhmer = language === 'km';
  const HEAVY = ['600', '700', '800', '900'];
  const kf = (w) => isKhmer ? { fontFamily: HEAVY.includes(String(w)) ? 'KohSantepheap_700Bold' : 'KohSantepheap_400Regular' } : { fontWeight: w };

  const L = {
    done:   language === 'ko' ? '확인'  : language === 'km' ? 'បញ្ជាក់' : 'Done',
    cancel: language === 'ko' ? '취소'  : language === 'km' ? 'បោះបង់'  : 'Cancel',
  };

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>

        {/* Animated backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnim]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Animated sheet */}
        <Animated.View style={[styles.sheetWrap, sheetAnim]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>

            {/* Handle */}
            <View style={[styles.handle, {
              backgroundColor: isDark ? colors.border : 'rgba(0,0,0,0.15)',
            }]} />

            {/* Cancel · Title · Done */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.70}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.cancelText, kf('600'), { color: colors.textMuted }]}>{L.cancel}</Text>
              </TouchableOpacity>

              {!!title && (
                <Text style={[styles.titleText, kf('700'), { color: colors.text }]}>{title}</Text>
              )}

              <TouchableOpacity
                onPress={() => { onChange(localValue); onClose(); }}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.doneText, kf('700'), { color: accentColor }]}>{L.done}</Text>
              </TouchableOpacity>
            </View>

            {/* Hairline divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Picker */}
            <DateWheelPicker
              value={localValue}
              onChange={setLocalValue}
              accentColor={accentColor}
              colors={colors}
              language={language}
            />

            {/* Date preview */}
            <Text style={[styles.preview, kf('600'), { color: colors.textMuted }]}>{localValue}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  // WheelItem
  item:     { alignItems: 'center', justifyContent: 'center' },
  itemText: { textAlign: 'center' },

  // Two selection lines (iOS native style)
  selLines: {
    position: 'absolute', zIndex: 2, left: 0, right: 0,
    justifyContent: 'space-between',
  },
  selLine: { height: StyleSheet.hairlineWidth },

  // DateWheelPicker
  pickerRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  colSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },

  // DatePickerModal
  backdrop:  { backgroundColor: '#000' },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    borderTopLeftRadius:  borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    paddingBottom:     Platform.OS === 'ios' ? spacing.xl : spacing.md,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cancelText: { fontSize: 15 },
  titleText:  { fontSize: 16 },
  doneText:   { fontSize: 15 },
  divider:    { height: StyleSheet.hairlineWidth, marginBottom: spacing.xs },
  preview:    { textAlign: 'center', fontSize: 12, marginTop: spacing.xs },
});

export default DatePickerModal;

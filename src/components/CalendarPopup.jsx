/**
 * CalendarPopup — Full month-grid date picker popup
 *
 * Props:
 *   visible       boolean
 *   onClose       () => void
 *   value         'YYYY-MM-DD'        ← currently selected date
 *   onChange      (str: string) => void  ← called with 'YYYY-MM-DD' on Done
 *   accentColor   string  (default '#2D6AE0')
 *   colors        theme colors object
 *   isDark        boolean
 *   language      'en' | 'ko' | 'km'
 *   title         string (optional)
 *   minDate       'YYYY-MM-DD' (optional)
 *   maxDate       'YYYY-MM-DD' (optional)
 *
 * Usage:
 *   <CalendarPopup
 *     visible={show}
 *     onClose={() => setShow(false)}
 *     value={date}
 *     onChange={(d) => { setDate(d); setShow(false); }}
 *     accentColor="#2D6AE0"
 *     colors={colors}
 *     isDark={isDark}
 *     language={language}
 *   />
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// ── Helpers ───────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const toStr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parseStr = (str) => {
  const [y, m, d] = (str || '').split('-').map(Number);
  const today = new Date();
  return {
    year:  y || today.getFullYear(),
    month: m || (today.getMonth() + 1),
    day:   d || today.getDate(),
  };
};

const TODAY = new Date();
const TODAY_STR = toStr(TODAY.getFullYear(), TODAY.getMonth() + 1, TODAY.getDate());

/**
 * Returns a 42-cell (6 × 7) array for the calendar grid.
 * Cells from adjacent months have `other: true`.
 */
const buildGrid = (year, month) => {
  const firstWeekday  = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth   = new Date(year, month, 0).getDate();
  const daysInPrev    = new Date(year, month - 1, 0).getDate();

  // Only render as many rows as the month actually needs (4, 5, or 6)
  const numRows    = Math.ceil((firstWeekday + daysInMonth) / 7);
  const totalCells = numRows * 7;

  const cells = [];

  // Trailing days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({
      day:   daysInPrev - i,
      month: month === 1 ? 12 : month - 1,
      year:  month === 1 ? year - 1 : year,
      other: true,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, other: false });
  }

  // Leading days from next month (only to fill the last row)
  let fill = 1;
  while (cells.length < totalCells) {
    cells.push({
      day:   fill++,
      month: month === 12 ? 1 : month + 1,
      year:  month === 12 ? year + 1 : year,
      other: true,
    });
  }

  return cells;
};

// ── i18n ─────────────────────────────────────────────────

const MONTHS = {
  en: ['January','February','March','April','May','June',
       'July','August','September','October','November','December'],
  ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  km: ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា',
       'កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'],
};

const WEEKDAYS = {
  en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  ko: ['일','월','화','수','목','금','토'],
  km: ['អា','ច','អ','ព','ព្រ','សុ','ស'],
};

const LABELS = {
  en: { cancel: 'Cancel', done: 'Done', today: 'Today' },
  ko: { cancel: '취소',    done: '확인',  today: '오늘' },
  km: { cancel: 'បោះបង់',  done: 'យល់ព្រម', today: 'ថ្ងៃនេះ' },
};

// ── CalendarPopup ─────────────────────────────────────────

const CalendarPopup = ({
  visible,
  onClose,
  value,
  onChange,
  accentColor = '#2D6AE0',
  colors,
  isDark,
  language = 'en',
  title,
  minDate,
  maxDate,
}) => {
  const init = parseStr(value);
  const [viewYear,  setViewYear]  = useState(init.year);
  const [viewMonth, setViewMonth] = useState(init.month);
  const [selected,  setSelected]  = useState(value || TODAY_STR);

  // Sync displayed month when value prop changes
  useEffect(() => {
    if (value) {
      const p = parseStr(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelected(value);
    }
  }, [value]);

  // ── Animation ─────────────────────────────────────────
  const [rendered, setRendered] = useState(visible);
  const anim     = useSharedValue(0);
  const bgAnim   = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      bgAnim.value = withTiming(1, { duration: 220 });
      anim.value   = withTiming(1, { duration: 220 });
    } else {
      bgAnim.value = withTiming(0, { duration: 180 });
      anim.value   = withTiming(0, { duration: 180 }, (done) => {
        if (done) runOnJS(setRendered)(false);
      });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(anim.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(anim.value, [0, 1], [0.88, 1], Extrapolation.CLAMP) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgAnim.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Month navigation ──────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth() + 1);
    setSelected(TODAY_STR);
  };

  // ── Grid ─────────────────────────────────────────────
  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const wds  = WEEKDAYS[language] || WEEKDAYS.en;
  const mnms = MONTHS[language]   || MONTHS.en;
  const L    = LABELS[language]   || LABELS.en;

  const isDisabled = (cell) => {
    if (cell.other) return true;
    const s = toStr(cell.year, cell.month, cell.day);
    if (minDate && s < minDate) return true;
    if (maxDate && s > maxDate) return true;
    return false;
  };

  // ── Styles ────────────────────────────────────────────
  // computed inline so they respond to isDark/accentColor
  const surf    = colors?.surface  || (isDark ? '#1C1C1E' : '#FFFFFF');
  const txtMain = colors?.text     || (isDark ? '#FFFFFF' : '#000000');
  const txtMute = colors?.textMuted|| (isDark ? '#666'    : '#AAA');
  const isKhmer = language === 'km';

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>

        {/* Dimmed backdrop */}
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Calendar card */}
        <Animated.View style={[s.card, { backgroundColor: surf }, cardStyle]}>

          {/* Title */}
          {!!title && (
            <Text style={[s.title, { color: txtMain }]}>{title}</Text>
          )}

          {/* Month / Year navigation */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={20} color={txtMain} />
            </TouchableOpacity>

            <TouchableOpacity onPress={goToToday} activeOpacity={0.7}>
              <Text style={[s.navTitle, { color: txtMain }]}>
                {mnms[viewMonth - 1]}{'  '}{viewYear}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.navBtn} onPress={nextMonth} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={20} color={txtMain} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={s.wdRow}>
            {wds.map((wd, i) => (
              <Text
                key={i}
                style={[
                  s.wdLabel,
                  { color: i === 0 ? '#EF4444' : txtMute },
                  isKhmer && { fontSize: 10 },
                ]}
              >
                {wd}
              </Text>
            ))}
          </View>

          {/* Hairline divider */}
          <View style={[s.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />

          {/* Date grid — explicit rows so flex:1 cells never wrap */}
          <View style={s.grid}>
            {Array.from({ length: grid.length / 7 }, (_, row) => (
              <View key={row} style={s.gridRow}>
                {grid.slice(row * 7, row * 7 + 7).map((cell, col) => {
                  const dateStr  = toStr(cell.year, cell.month, cell.day);
                  const isSel    = !cell.other && dateStr === selected;
                  const isToday  = !cell.other && dateStr === TODAY_STR;
                  const disabled = isDisabled(cell);
                  const isSun    = col === 0;

                  return (
                    <TouchableOpacity
                      key={col}
                      style={s.cell}
                      onPress={() => !disabled && setSelected(dateStr)}
                      activeOpacity={disabled ? 1 : 0.65}
                      disabled={disabled}
                    >
                      {isSel && (
                        <View style={[s.selCircle, { backgroundColor: accentColor }]} />
                      )}
                      {isToday && !isSel && (
                        <View style={[s.todayRing, { borderColor: accentColor }]} />
                      )}
                      <Text style={[
                        s.dayText,
                        { color: isSel ? '#fff' : cell.other ? txtMute : isSun ? '#EF4444' : txtMain },
                        cell.other && { opacity: 0.35 },
                        disabled && !cell.other && { opacity: 0.25 },
                        isKhmer && { fontSize: 12 },
                      ]}>
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Today shortcut */}
          <TouchableOpacity
            style={[s.todayPill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}
            onPress={goToToday}
            activeOpacity={0.7}
          >
            <Ionicons name="today-outline" size={14} color={accentColor} />
            <Text style={[s.todayText, { color: accentColor }]}>{L.today}</Text>
          </TouchableOpacity>

          {/* Hairline */}
          <View style={[s.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginTop: 0 }]} />

          {/* Cancel / Done */}
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.cancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[s.btnText, { color: txtMute }]}>{L.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.doneBtn, { backgroundColor: accentColor }]}
              onPress={() => { onChange(selected); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: '#fff' }]}>{L.done}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────

const CELL_SIZE = 40;

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },

  // Title
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 14 },

  // Month nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700' },

  // Weekday headers
  wdRow: { flexDirection: 'row', marginBottom: 8 },
  wdLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },

  // Grid — rows handle layout; flex:1 cells avoid % rounding bugs
  grid: { marginBottom: 4 },
  gridRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCircle: {
    position: 'absolute',
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
  },
  todayRing: {
    position: 'absolute',
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Today shortcut
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 8,
  },
  todayText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1.5 },
  doneBtn:   {},
  btnText:   { fontSize: 15, fontWeight: '700' },
});

export default CalendarPopup;

/**
 * LogoMark — Bacou brand mark for use inside the app.
 *
 * The icon PNG has a deep-indigo (#312e81) background with a white circle and
 * accent-coloured geometric B + triangle, so it blends seamlessly when placed
 * on the app's hero background (same colour).
 *
 * Props:
 *   size       number   icon width / height in px  (default 88)
 *   showText   boolean  show "BACOU / Loan" beside the icon  (default false)
 *   textColor  string   app-name colour  (default '#fff')
 *   subColor   string   "Loan" label colour  (default 'rgba(255,255,255,0.55)')
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const ICON = require('../../assets/images/icon.png');

export default function LogoMark({
  size      = 88,
  showText  = false,
  textColor = '#fff',
  subColor  = 'rgba(255,255,255,0.55)',
}) {
  const radius = Math.round(size * 0.225);   // matches iOS icon rounding (~22.5 %)

  return (
    <View style={showText ? s.row : s.center}>
      <Image
        source={ICON}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
      {showText && (
        <View style={s.textWrap}>
          <Text style={[s.name, { color: textColor }]}>BACOU</Text>
          <Text style={[s.sub,  { color: subColor  }]}>Loan</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center:   { alignItems: 'center' },
  row:      { flexDirection: 'row', alignItems: 'center' },
  textWrap: { marginLeft: 14 },
  name: {
    fontFamily: 'KohSantepheap_700Bold',
    fontSize: 22,
    letterSpacing: 1.8,
  },
  sub: {
    fontFamily: 'KohSantepheap_400Regular',
    fontSize: 13,
    letterSpacing: 0.6,
    marginTop: 2,
  },
});

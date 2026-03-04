/**
 * LogoMark — Bacou brand mark for use inside the app.
 *
 * Props:
 *   size      number   icon width / height in px  (default 88)
 *   showLogo  boolean  show the navbar text logo beside the icon  (default false)
 *   logoBg    string   background color behind the text logo  (default '#fff')
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const ICON      = require('../../assets/images/icon.png');
const LOGO_TEXT = require('../../assets/images/navbar-logo.png');

// navbar-logo.png native size: 384×216 (3x of 128×72)
const LOGO_RATIO = 256 / 144;

export default function LogoMark({
  size     = 88,
  showLogo = false,
  logoBg   = '#fff',
}) {
  const radius    = Math.round(size * 0.225);
  const logoH     = Math.round(size * 0.45);
  const logoW     = Math.round(logoH * LOGO_RATIO);

  return (
    <View style={showLogo ? s.row : s.center}>
      <Image
        source={ICON}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
      {showLogo && (
        <View style={[s.logoPill, { backgroundColor: logoBg }]}>
          <Image source={LOGO_TEXT} style={{ width: logoW, height: logoH }} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center:  { alignItems: 'center' },
  row:     { flexDirection: 'row', alignItems: 'center' },
  logoPill: { marginLeft: 12, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
});

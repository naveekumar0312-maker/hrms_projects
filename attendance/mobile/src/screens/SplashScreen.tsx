import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  Dimensions,
} from 'react-native';

const LOGO_WITH_TAGLINE = require('../../assets/branding/yaazh360-logo-tagline.png');
const { width } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(width * 0.75, 300);
const LOGO_HEIGHT = (LOGO_WIDTH * 156) / 436; // Keep natural aspect ratio of transparent logo

interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (typeof onAnimationComplete === 'function') {
        onAnimationComplete();
      }
    });
  }, [fadeAnim, scaleAnim, onAnimationComplete]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />

      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={LOGO_WITH_TAGLINE}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={styles.footerWrap}>
        <Text style={styles.brandSubtitle}>Human Resource Management System</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    width: LOGO_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  footerWrap: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  brandSubtitle: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#8E9BAE',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default SplashScreen;

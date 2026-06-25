import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
} from 'react-native';

let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  Haptics = null;
}

const triggerHaptic = async () => {
  try {
    if (Haptics?.notificationAsync) {
      await triggerHaptic();;
    }
  } catch (e) {
    // Haptics not available, skip silently
  }
};

export default function UnlockCelebration({ visible, onClose, data }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;
  const badgeSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible && data) {
      // Trigger haptic feedback
      triggerHaptic();;

      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      xpAnim.setValue(0);
      badgeSlide.setValue(50);

      // Play entrance sequence
      Animated.sequence([
        // Fade in backdrop
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Pop in the card with bounce
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        // Slide in XP counter
        Animated.timing(xpAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Slide in achievements if any
        Animated.timing(badgeSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Extra haptic for level up
      if (data.xp?.leveled_up) {
        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 500);
      }
    }
  }, [visible, data]);

  const handleClose = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  if (!data) return null;

  const { location, xp, achievements } = data;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Location unlocked header */}
          <Text style={styles.emoji}>🔓</Text>
          <Text style={styles.title}>Location Unlocked!</Text>
          <Text style={styles.locationName}>{location?.name}</Text>
          <Text style={styles.locationType}>
            {location?.location_type?.replace(/_/g, ' ').toUpperCase()}
          </Text>

          {/* XP gained */}
          <Animated.View
            style={[
              styles.xpContainer,
              {
                opacity: xpAnim,
                transform: [
                  {
                    translateY: xpAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.xpAmount}>+{xp?.xp_gained} XP</Text>
            {xp?.achievement_bonus_xp > 0 && (
              <Text style={styles.bonusXp}>
                +{xp.achievement_bonus_xp} bonus XP from achievements!
              </Text>
            )}
            <Text style={styles.xpTotal}>Total: {xp?.total_xp} XP</Text>
          </Animated.View>

          {/* Level up */}
          {xp?.leveled_up && (
            <View style={styles.levelUpContainer}>
              <Text style={styles.levelUpEmoji}>🎉</Text>
              <Text style={styles.levelUpText}>LEVEL UP!</Text>
              <Text style={styles.levelUpLevel}>Level {xp.level}</Text>
              {xp.new_titles?.length > 0 && (
                <Text style={styles.newTitle}>
                  New title: ✨ {xp.new_titles.join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Achievements */}
          {achievements?.length > 0 && (
            <Animated.View
              style={[
                styles.achievementsContainer,
                {
                  transform: [{ translateY: badgeSlide }],
                  opacity: badgeSlide.interpolate({
                    inputRange: [0, 50],
                    outputRange: [1, 0],
                  }),
                },
              ]}
            >
              <Text style={styles.achievementsTitle}>
                🏆 Achievement{achievements.length > 1 ? 's' : ''} Earned!
              </Text>
              {achievements.map((achievement) => (
                <View key={achievement.key} style={styles.achievementRow}>
                  <Text style={styles.achievementEmoji}>
                    {achievement.emoji}
                  </Text>
                  <View style={styles.achievementInfo}>
                    <Text style={styles.achievementName}>
                      {achievement.name}
                    </Text>
                    <Text style={styles.achievementDesc}>
                      {achievement.description}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeText}>Continue Exploring</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    maxHeight: '85%',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  locationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  locationType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 20,
  },
  xpContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  xpAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#F9A825',
  },
  bonusXp: {
    fontSize: 14,
    color: '#F9A825',
    marginTop: 4,
  },
  xpTotal: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  levelUpContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  levelUpEmoji: {
    fontSize: 40,
  },
  levelUpText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F57F17',
    letterSpacing: 2,
  },
  levelUpLevel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9A825',
    marginTop: 4,
  },
  newTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  achievementsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  achievementEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  achievementDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
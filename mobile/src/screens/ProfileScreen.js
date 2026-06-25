import React, { useState, useEffect } from 'react';import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

import { useUnits } from '../context/UnitsContext';


const AVATAR_DISPLAY = {
  explorer: '🧭',
  hiker: '🥾',
  camper: '⛺',
};



const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500,
];

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [updatingTitle, setUpdatingTitle] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);

  const [achievements, setAchievements] = useState([]);
  const [achievementStats, setAchievementStats] = useState({ total: 0, earned: 0 });
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  const { units, toggleUnits } = useUnits();

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const response = await userAPI.getAchievements();
      setAchievements(response.data.achievements);
      setAchievementStats({
        total: response.data.total,
        earned: response.data.earned,
      });
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  const currentLevelIndex = user.level - 1;
  const currentThreshold = LEVEL_THRESHOLDS[currentLevelIndex] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[currentLevelIndex + 1];
  const xpIntoLevel = user.xp - currentThreshold;
  const xpNeeded = nextThreshold ? nextThreshold - currentThreshold : 0;
  const progress = nextThreshold ? xpIntoLevel / xpNeeded : 1;

  const handleAvatarChange = async (avatar) => {
    setUpdatingAvatar(true);
    try {
      await userAPI.updateProfile({ avatar });
      await refreshUser();
      setShowAvatarPicker(false);
    } catch (error) {
      const message = error.response?.data?.errors?.[0] || 'Failed to update avatar.';
      Alert.alert('Error', message);
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleTitleChange = async (title) => {
    setUpdatingTitle(true);
    try {
      await userAPI.updateProfile({ title });
      await refreshUser();
      setShowTitlePicker(false);
    } catch (error) {
      const message = error.response?.data?.errors?.[0] || 'Failed to update title.';
      Alert.alert('Error', message);
    } finally {
      setUpdatingTitle(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => setShowAvatarPicker(!showAvatarPicker)}
        >
          <Text style={styles.avatar}>
            {AVATAR_DISPLAY[user.avatar] || '🧭'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.username}>{user.username}</Text>

        <TouchableOpacity onPress={() => setShowTitlePicker(!showTitlePicker)}>
          <Text style={styles.title}>✨ {user.title}</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Choose Avatar</Text>
          <View style={styles.pickerRow}>
            {(user.unlocked_avatars || []).map((avatar) => (
              <TouchableOpacity
                key={avatar}
                style={[
                  styles.pickerOption,
                  user.avatar === avatar && styles.pickerOptionActive,
                ]}
                onPress={() => handleAvatarChange(avatar)}
                disabled={updatingAvatar}
              >
                <Text style={styles.pickerEmoji}>
                  {AVATAR_DISPLAY[avatar] || '❓'}
                </Text>
                <Text style={styles.pickerLabel}>{avatar}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Title picker */}
      {showTitlePicker && (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Choose Title</Text>
          {(user.unlocked_titles || []).map((title) => (
            <TouchableOpacity
              key={title}
              style={[
                styles.titleOption,
                user.title === title && styles.titleOptionActive,
              ]}
              onPress={() => handleTitleChange(title)}
              disabled={updatingTitle}
            >
              <Text
                style={[
                  styles.titleOptionText,
                  user.title === title && styles.titleOptionTextActive,
                ]}
              >
                {title}
              </Text>
              {user.title === title && (
                <Text style={styles.titleCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* XP & Level */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelText}>Level {user.level}</Text>
          <Text style={styles.xpText}>{user.xp} XP</Text>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>

        {nextThreshold ? (
          <Text style={styles.xpToNext}>
            {xpNeeded - xpIntoLevel} XP to Level {user.level + 1}
          </Text>
        ) : (
          <Text style={styles.xpToNext}>🎉 Max Level Reached!</Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Explorer Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user.stats?.parks_unlocked || 0}
            </Text>
            <Text style={styles.statLabel}>Parks</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user.stats?.forests_unlocked || 0}
            </Text>
            <Text style={styles.statLabel}>Forests</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user.stats?.poi_unlocked || 0}
            </Text>
            <Text style={styles.statLabel}>POI</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user.stats?.total_trips || 0}
            </Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
        </View>
      </View>

      {/* Unlocked locations count */}
      <TouchableOpacity
        style={styles.infoCard}
        onPress={() => navigation.navigate('UnlockedLocations')}
      >
        <Text style={styles.infoLabel}>📍 Locations Unlocked</Text>
        <View style={styles.infoRight}>
          <Text style={styles.infoValue}>
            {user.unlocked_locations?.length || 0}
          </Text>
          <Text style={styles.infoArrow}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Member since */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>📅 Member Since</Text>
        <Text style={styles.infoValue}>
          {new Date(user.created_at).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      </View>
{/* Achievements */}
      <View style={styles.achievementsCard}>
        <TouchableOpacity
          style={styles.achievementsHeader}
          onPress={() => setShowAllAchievements(!showAllAchievements)}
        >
          <Text style={styles.achievementsTitle}>
            🏆 Achievements ({achievementStats.earned}/{achievementStats.total})
          </Text>
          <Text style={styles.achievementsToggle}>
            {showAllAchievements ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.achievementProgressBg}>
          <View
            style={[
              styles.achievementProgressFill,
              {
                width: achievementStats.total > 0
                  ? `${(achievementStats.earned / achievementStats.total) * 100}%`
                  : '0%',
              },
            ]}
          />
        </View>

        {/* Earned achievements */}
        {achievements.filter((a) => a.earned).length > 0 && (
          <View style={styles.earnedSection}>
            <Text style={styles.sectionLabel}>Earned</Text>
            <View style={styles.badgeGrid}>
              {achievements
                .filter((a) => a.earned)
                .map((achievement) => (
                  <View key={achievement.key} style={styles.badge}>
                    <Text style={styles.badgeEmoji}>{achievement.emoji}</Text>
                    <Text style={styles.badgeName} numberOfLines={1}>
                      {achievement.name}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Locked achievements (expandable) */}
        {showAllAchievements && (
          <View style={styles.lockedSection}>
            <Text style={styles.sectionLabel}>Locked</Text>
            {achievements
              .filter((a) => !a.earned)
              .map((achievement) => (
                <View key={achievement.key} style={styles.lockedRow}>
                  <Text style={styles.lockedEmoji}>🔒</Text>
                  <View style={styles.lockedInfo}>
                    <Text style={styles.lockedName}>{achievement.name}</Text>
                    <Text style={styles.lockedDesc}>
                      {achievement.description}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      {/* Settings */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>⚙️ Settings</Text>
        <TouchableOpacity style={styles.settingRow} onPress={toggleUnits}>
          <Text style={styles.settingLabel}>Distance Units</Text>
          <View style={styles.toggleContainer}>
            <Text style={[
              styles.toggleOption,
              units === 'imperial' && styles.toggleActive,
            ]}>MI</Text>
            <Text style={styles.toggleDivider}>|</Text>
            <Text style={[
              styles.toggleOption,
              units === 'metric' && styles.toggleActive,
            ]}>KM</Text>
          </View>
        </TouchableOpacity>
      </View>
      </View>
      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  avatar: {
    fontSize: 48,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  pickerOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    minWidth: 80,
  },
  pickerOptionActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  pickerEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  titleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  titleOptionActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  titleOptionText: {
    fontSize: 15,
    color: '#333',
  },
  titleOptionTextActive: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  titleCheck: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  levelCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  xpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9A825',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  xpToNext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoArrow: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },

  achievementsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  achievementsToggle: {
    fontSize: 14,
    color: '#999',
  },
  achievementProgressBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#FFB300',
    borderRadius: 4,
  },
  earnedSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: 80,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  lockedSection: {
    marginTop: 8,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  lockedEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  lockedInfo: {
    flex: 1,
  },
  lockedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  lockedDesc: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 2,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOption: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 8,
  },
  toggleActive: {
    color: '#2E7D32',
  },
  toggleDivider: {
    color: '#ddd',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF5350',
  },
});
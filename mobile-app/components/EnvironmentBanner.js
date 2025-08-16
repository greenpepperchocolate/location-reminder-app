import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const EnvironmentBanner = () => {
  const isExpoGo = __DEV__ && !Constants.appOwnership;
  
  if (!isExpoGo) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        🧪 開発環境 - バックグラウンド機能は制限されます
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default EnvironmentBanner;
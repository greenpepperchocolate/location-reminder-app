import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { AuthContext } from '../App';

const ReminderFormScreen = ({ navigation }) => {
  const { location } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    store_type: '',
    title: '',
    memo: '',
    trigger_distance: 30,
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  const storeTypeOptions = [
    { value: '', label: '店舗タイプを選択してください' },
    { value: 'convenience', label: 'コンビニ' },
    { value: 'pharmacy', label: '薬局' }
  ];

  const distanceOptions = [
    { value: 10, label: '10m - 目の前' },
    { value: 30, label: '30m - 近づいたとき' },
    { value: 50, label: '50m - 少し手前' },
    { value: 100, label: '100m - 早めに通知' }
  ];

  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = async () => {
    if (!formData.store_type || !formData.title) {
      Alert.alert('エラー', '店舗タイプとタイトルは必須です。');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${axios.defaults.baseURL}/reminders/`, formData);
      Alert.alert(
        '成功',
        'リマインダーが作成されました！',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('リマインダー作成エラー:', error);
      Alert.alert(
        'エラー',
        error.response?.data?.detail || 'リマインダーの作成に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* Store Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>🏪 店舗タイプ *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.store_type}
              onValueChange={(value) => handleChange('store_type', value)}
              style={styles.picker}
            >
              {storeTypeOptions.map(option => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Title */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📝 タイトル *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(value) => handleChange('title', value)}
            placeholder="例: 胃薬を買う"
            maxLength={200}
          />
        </View>

        {/* Memo */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📄 メモ (任意)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.memo}
            onChangeText={(value) => handleChange('memo', value)}
            placeholder="詳細なメモ（例: 処方箋持参、第一三共胃腸薬など）"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Trigger Distance */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📏 トリガー距離</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.trigger_distance}
              onValueChange={(value) => handleChange('trigger_distance', value)}
              style={styles.picker}
            >
              {distanceOptions.map(option => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Active Switch */}
        <View style={styles.formGroup}>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>
              {formData.is_active ? '🟢' : '⚫'} リマインダーを有効にする
            </Text>
            <Switch
              value={formData.is_active}
              onValueChange={(value) => handleChange('is_active', value)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={formData.is_active ? '#007AFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Current Location Info */}
        {location && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📍 現在の位置情報</Text>
            <Text style={styles.infoText}>
              緯度: {location.latitude.toFixed(6)}
            </Text>
            <Text style={styles.infoText}>
              経度: {location.longitude.toFixed(6)}
            </Text>
            <Text style={styles.infoText}>
              この位置を基準にリマインダーが作動します
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.buttonDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? '作成中...' : '✨ 作成'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default ReminderFormScreen;
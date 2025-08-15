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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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

  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSubmit = async () => {
    console.log('=== リマインダー作成開始 ===');
    console.log('フォームデータ:', formData);
    console.log('位置情報:', location);
    
    if (!formData.store_type || !formData.title.trim()) {
      Alert.alert('エラー', '店舗タイプとタイトルは必須です。');
      return;
    }

    if (!location) {
      Alert.alert('エラー', '位置情報が取得できません。位置情報を有効にしてください。');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        title: formData.title.trim(),
        memo: formData.memo.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      };
      
      console.log('送信データ:', submitData);
      console.log('リクエストURL:', `${axios.defaults.baseURL}/reminders/`);
      
      const response = await axios.post(`${axios.defaults.baseURL}/reminders/`, submitData);
      console.log('レスポンス:', response.data);
      
      Alert.alert(
        '成功 ✨',
        'リマインダーが作成されました！\n選択した店舗タイプの近くで通知されます。',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error) {
      console.error('リマインダー作成エラー:', error);
      console.error('エラーレスポンス:', error.response?.data);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          error.message ||
                          'リマインダーの作成に失敗しました';
      
      Alert.alert('エラー', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <View style={styles.form}>
        {/* Store Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>🏪 店舗タイプ *</Text>
          <View style={styles.optionGroup}>
            {storeTypeOptions.slice(1).map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  formData.store_type === option.value && styles.optionButtonSelected
                ]}
                onPress={() => handleChange('store_type', option.value)}
              >
                <View style={styles.radioButton}>
                  {formData.store_type === option.value && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
                <Text style={[
                  styles.optionText,
                  formData.store_type === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!formData.store_type && (
            <Text style={styles.helperText}>店舗タイプを選択してください</Text>
          )}
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

        {/* Additional Info Section */}
        <View style={styles.additionalInfo}>
          <Text style={styles.sectionTitle}>📋 登録について</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>🎯 動作条件:</Text>
            <Text style={styles.infoDescription}>
              選択した店舗タイプ（コンビニ・薬局）の30m以内に近づくと通知されます
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>📱 通知方式:</Text>
            <Text style={styles.infoDescription}>
              プッシュ通知でリマインダーの内容が表示されます
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>🔄 リマインダー管理:</Text>
            <Text style={styles.infoDescription}>
              作成後もリマインダー一覧から編集・削除が可能です
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>🏪 対応店舗:</Text>
            <Text style={styles.infoDescription}>
              • コンビニ: セブン-イレブン、ファミマ、ローソンなど{'\n'}
              • 薬局: ココカラファイン、マツキヨ、ツルハなど
            </Text>
          </View>
        </View>

    
        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20, // ScrollViewのデフォルト余白
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
  optionGroup: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  previewBox: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 10,
  },
  previewText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
    lineHeight: 20,
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
  additionalInfo: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 30,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summarySection: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  infoItem: {
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 5,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    paddingLeft: 10,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 100, // 下部に大きな余白
    backgroundColor: 'transparent',
  },
});

export default ReminderFormScreen;
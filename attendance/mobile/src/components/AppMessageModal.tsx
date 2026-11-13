import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from 'lucide-react-native';
import { COLORS } from '../constants/theme';

export type AppMessageType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AppMessageButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppMessageOptions {
  title?: string;
  message: string;
  type?: AppMessageType;
  buttons?: AppMessageButton[];
  cancelable?: boolean;
}

interface AppMessageModalProps {
  visible: boolean;
  options: AppMessageOptions | null;
  onClose: () => void;
  loading?: boolean;
}

export const AppMessageModal: React.FC<AppMessageModalProps> = ({
  visible,
  options,
  onClose,
  loading = false,
}) => {
  if (!options) return null;

  const {
    title,
    message,
    type = 'info',
    buttons = [{ text: 'OK', style: 'default' }],
    cancelable = true,
  } = options;

  const getHeaderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={36} color="#000000" strokeWidth={2.2} />;
      case 'error':
        return <AlertCircle size={36} color="#000000" strokeWidth={2.2} />;
      case 'warning':
        return <AlertTriangle size={36} color="#222222" strokeWidth={2.2} />;
      case 'confirm':
        return <HelpCircle size={36} color={COLORS.primary || '#EA580C'} strokeWidth={2.2} />;
      case 'info':
      default:
        return <Info size={36} color="#000000" strokeWidth={2.2} />;
    }
  };

  const getIconBackground = () => {
    switch (type) {
      case 'success':
        return '#F5F5F5';
      case 'error':
        return '#F5F5F5';
      case 'warning':
        return '#F5F5F5';
      case 'confirm':
        return 'rgba(234, 88, 12, 0.10)';
      case 'info':
      default:
        return '#F5F5F5';
    }
  };

  const handleBackdropPress = () => {
    if (cancelable && !loading) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <StatusBar style="dark" hidden={false} />
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrapper, { backgroundColor: getIconBackground() }]}>
            {getHeaderIcon()}
          </View>

          {Boolean(title) && <Text style={styles.title}>{title}</Text>}

          <Text style={[styles.message, !title && styles.messageWithoutTitle]}>
            {message}
          </Text>

          <View style={styles.buttonsContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary || '#EA580C'} />
              </View>
            ) : (
              buttons.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';

                return (
                  <TouchableOpacity
                    key={`${btn.text}-${index}`}
                    style={[
                      styles.button,
                      buttons.length > 1 && styles.multiButton,
                      isCancel && styles.cancelButton,
                      isDestructive && styles.destructiveButton,
                    ]}
                    onPress={() => {
                      onClose();
                      if (btn.onPress) {
                        btn.onPress();
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.cancelButtonText,
                        isDestructive && styles.destructiveButtonText,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#444444',
    textAlign: 'center',
    marginBottom: 22,
  },
  messageWithoutTitle: {
    marginTop: 4,
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.primary || '#EA580C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  multiButton: {
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  destructiveButton: {
    backgroundColor: '#000000',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
  cancelButtonText: {
    color: '#444444',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },
  loadingContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


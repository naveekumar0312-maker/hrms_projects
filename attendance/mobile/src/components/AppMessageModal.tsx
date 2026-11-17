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
  Trash2,
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

  const hasDestructive = buttons.some((b) => b.style === 'destructive');

  const getHeaderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={38} color="#16A34A" strokeWidth={2.5} />;
      case 'error':
        return <AlertCircle size={38} color="#DC2626" strokeWidth={2.4} />;
      case 'warning':
        return <AlertTriangle size={38} color="#D97706" strokeWidth={2.4} />;
      case 'confirm':
        if (hasDestructive) {
          return <Trash2 size={32} color="#DC2626" strokeWidth={2.4} />;
        }
        return <HelpCircle size={36} color="#2563EB" strokeWidth={2.4} />;
      case 'info':
      default:
        return <Info size={36} color="#22C55E" strokeWidth={2.4} />;
    }
  };

  const getIconBackground = () => {
    switch (type) {
      case 'success':
        return '#DCFCE7';
      case 'error':
        return '#FEE2E2';
      case 'warning':
        return '#FEF3C7';
      case 'confirm':
        if (hasDestructive) {
          return '#FEE2E2';
        }
        return '#DBEAFE';
      case 'info':
      default:
        return 'rgba(34, 197, 94, 0.14)';
    }
  };

  const getIconBorder = () => {
    switch (type) {
      case 'success':
        return '#BBF7D0';
      case 'error':
        return '#FECACA';
      case 'warning':
        return '#FDE68A';
      case 'confirm':
        if (hasDestructive) {
          return '#FECACA';
        }
        return '#BFDBFE';
      case 'info':
      default:
        return 'rgba(34, 197, 94, 0.28)';
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
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: getIconBackground(),
                borderColor: getIconBorder(),
              },
            ]}
          >
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
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
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
    backgroundColor: '#22C55E',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  multiButton: {
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
  cancelButtonText: {
    color: '#475569',
    fontFamily: 'Comfortaa_700Bold',
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


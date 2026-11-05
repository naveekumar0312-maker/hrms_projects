import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  AppMessageModal,
  AppMessageOptions,
  AppMessageType,
  AppMessageButton,
} from '../components/AppMessageModal';

interface MessageContextType {
  showMessage: (options: AppMessageOptions) => void;
  showSuccess: (titleOrMessage: string, message?: string, onOk?: () => void) => void;
  showError: (titleOrMessage: string, message?: string, onOk?: () => void) => void;
  showWarning: (titleOrMessage: string, message?: string, onOk?: () => void) => void;
  showInfo: (titleOrMessage: string, message?: string, onOk?: () => void) => void;
  showConfirm: (
    titleOrOptions:
      | string
      | {
          title: string;
          message: string;
          onConfirm: () => void;
          confirmText?: string;
          cancelText?: string;
          isDestructive?: boolean;
        },
    message?: string,
    onConfirm?: () => void,
    confirmText?: string,
    cancelText?: string,
    destructive?: boolean
  ) => void;
  hideMessage: () => void;
}

const MessageContext = createContext<MessageContextType | null>(null);

export const MessageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalOptions, setModalOptions] = useState<AppMessageOptions | null>(null);

  const hideMessage = useCallback(() => {
    setModalVisible(false);
    setModalOptions(null);
  }, []);

  const showMessage = useCallback((options: AppMessageOptions) => {
    setModalOptions(options);
    setModalVisible(true);
  }, []);

  const showSuccess = useCallback(
    (titleOrMessage: string, message?: string, onOk?: () => void) => {
      const finalTitle = message ? titleOrMessage : 'Success';
      const finalMessage = message ? message : titleOrMessage;
      showMessage({
        title: finalTitle,
        message: finalMessage,
        type: 'success',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showMessage]
  );

  const showError = useCallback(
    (titleOrMessage: string, message?: string, onOk?: () => void) => {
      const finalTitle = message ? titleOrMessage : 'Error';
      const finalMessage = message ? message : titleOrMessage;
      showMessage({
        title: finalTitle,
        message: finalMessage,
        type: 'error',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showMessage]
  );

  const showWarning = useCallback(
    (titleOrMessage: string, message?: string, onOk?: () => void) => {
      const finalTitle = message ? titleOrMessage : 'Warning';
      const finalMessage = message ? message : titleOrMessage;
      showMessage({
        title: finalTitle,
        message: finalMessage,
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showMessage]
  );

  const showInfo = useCallback(
    (titleOrMessage: string, message?: string, onOk?: () => void) => {
      const finalTitle = message ? titleOrMessage : 'Information';
      const finalMessage = message ? message : titleOrMessage;
      showMessage({
        title: finalTitle,
        message: finalMessage,
        type: 'info',
        buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
      });
    },
    [showMessage]
  );

  const showConfirm = useCallback(
    (
      titleOrOptions:
        | string
        | {
            title: string;
            message: string;
            onConfirm: () => void;
            confirmText?: string;
            cancelText?: string;
            isDestructive?: boolean;
          },
      message?: string,
      onConfirm?: () => void,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      destructive = false
    ) => {
      let finalTitle = 'Confirm';
      let finalMessage = '';
      let finalOnConfirm = () => {};
      let finalConfirmText = 'Confirm';
      let finalCancelText = 'Cancel';
      let finalDestructive = false;

      if (typeof titleOrOptions === 'object') {
        finalTitle = titleOrOptions.title;
        finalMessage = titleOrOptions.message;
        finalOnConfirm = titleOrOptions.onConfirm;
        finalConfirmText = titleOrOptions.confirmText || 'Confirm';
        finalCancelText = titleOrOptions.cancelText || 'Cancel';
        finalDestructive = !!titleOrOptions.isDestructive;
      } else {
        finalTitle = titleOrOptions;
        finalMessage = message || '';
        finalOnConfirm = onConfirm || (() => {});
        finalConfirmText = confirmText;
        finalCancelText = cancelText;
        finalDestructive = destructive;
      }

      showMessage({
        title: finalTitle,
        message: finalMessage,
        type: 'confirm',
        buttons: [
          { text: finalCancelText, style: 'cancel' },
          {
            text: finalConfirmText,
            style: finalDestructive ? 'destructive' : 'default',
            onPress: finalOnConfirm,
          },
        ],
      });
    },
    [showMessage]
  );

  return (
    <MessageContext.Provider
      value={{
        showMessage,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        hideMessage,
      }}
    >
      {children}
      <AppMessageModal
        visible={modalVisible}
        options={modalOptions}
        onClose={hideMessage}
      />
    </MessageContext.Provider>
  );
};

export const useAppMessage = (): MessageContextType => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useAppMessage must be used within a MessageProvider');
  }
  return context;
};

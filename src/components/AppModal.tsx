import { Modal, type ModalProps } from 'react-native';

export type AppModalProps = Omit<ModalProps, 'onRequestClose'> & {
  onRequestClose?: () => void;
};

export function AppModal(props: AppModalProps) {
  return <Modal {...props} />;
}

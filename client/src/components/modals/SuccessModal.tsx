import NotificationModal, { type NotificationModalProps } from "./NotificationModal";

export type SuccessModalProps = Omit<NotificationModalProps, "type">;

/** @deprecated Prefer `NotificationModal` directly or the `useNotification()` hook. */
const SuccessModal = ({ title = "Success!", ...props }: SuccessModalProps) => (
  <NotificationModal type="success" title={title} okButtonText="Great!" {...props} />
);

export default SuccessModal;

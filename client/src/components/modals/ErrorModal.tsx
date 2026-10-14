import NotificationModal, { type NotificationModalProps } from "./NotificationModal";

export type ErrorModalProps = Omit<NotificationModalProps, "type">;

/** @deprecated Prefer `NotificationModal` directly or the `useNotification()` hook. */
const ErrorModal = ({ title = "Error", ...props }: ErrorModalProps) => (
  <NotificationModal type="error" title={title} okButtonText="Close" {...props} />
);

export default ErrorModal;

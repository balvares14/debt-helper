import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import NotificationModal, {
  type NotificationDetails,
  type NotificationModalProps,
  type NotificationType,
} from "@/components/modals/NotificationModal";
import FloatingNotice, { type FloatingNoticeProps } from "@/components/notices/FloatingNotice";
import type { NoticeTone } from "@/components/notices/tones";

/**
 * Global notification system.
 *
 *   const { showSuccess, showError, toast, notice } = useNotification();
 *
 *   showSuccess("Item saved successfully!");           // centered modal
 *   showError("Connection failed", { title: "Network Error", details: error.message });
 *   toast.success("Saved!");                           // corner notice, timed
 *   notice({ title: "Queued", subtext: "Working…", duration: 0, icon: "spinner" });
 */

export interface NotificationOptions extends Omit<NotificationModalProps, "isOpen" | "onClose"> {
  onClose?: (() => void) | null;
}

export type ShorthandOptions = Omit<NotificationOptions, "type" | "message">;

export interface NoticeOptions extends Omit<FloatingNoticeProps, "open" | "onClose" | "tone"> {
  type?: NotificationType | NoticeTone;
  message?: string;
  onClose?: (() => void) | null;
}

interface ModalState extends NotificationOptions {
  isOpen: boolean;
}

interface CornerState extends NoticeOptions {
  open: boolean;
}

export interface NotificationContextValue {
  showNotification: (options: NotificationOptions) => void;
  showSuccess: (message: string, options?: ShorthandOptions) => void;
  showError: (message: string, options?: ShorthandOptions) => void;
  showWarning: (message: string, options?: ShorthandOptions) => void;
  showInfo: (message: string, options?: ShorthandOptions) => void;
  notice: (options: NoticeOptions) => void;
  toast: Record<Exclude<NotificationType, "neutral">, (message: string, duration?: number) => void>;
  hideNotification: () => void;
  hideNotice: () => void;
}

const MODAL_CLOSED: ModalState = {
  isOpen: false,
  type: "info",
  title: null,
  message: "",
  details: null,
  overlay: true,
  overlayClose: true,
  autoClose: null,
  showOkButton: true,
  okButtonText: null,
  showCloseButton: true,
  icon: null,
};

const CORNER_CLOSED: CornerState = {
  open: false,
  title: "",
  subtext: "",
  duration: 5000,
  type: "info",
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const useNotification = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within a NotificationProvider");
  return context;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const [corner, setCorner] = useState<CornerState>(CORNER_CLOSED);
  const modalOnCloseRef = useRef<(() => void) | null>(null);
  const cornerOnCloseRef = useRef<(() => void) | null>(null);

  const hideNotification = useCallback(() => {
    modalOnCloseRef.current?.();
    modalOnCloseRef.current = null;
    setModal((previous) => ({ ...previous, isOpen: false }));
  }, []);

  const hideNotice = useCallback(() => {
    cornerOnCloseRef.current?.();
    cornerOnCloseRef.current = null;
    setCorner((previous) => ({ ...previous, open: false }));
  }, []);

  const showNotification = useCallback((options: NotificationOptions) => {
    modalOnCloseRef.current = options.onClose ?? null;
    setModal({ ...MODAL_CLOSED, ...options, isOpen: true });
  }, []);

  const notice = useCallback((options: NoticeOptions) => {
    cornerOnCloseRef.current = options.onClose ?? null;
    setCorner({
      ...CORNER_CLOSED,
      ...options,
      open: true,
      title: options.title ?? "",
      subtext: options.subtext ?? options.message ?? "",
    });
  }, []);

  const showSuccess = useCallback(
    (message: string, options: ShorthandOptions = {}) =>
      showNotification({ type: "success", message, ...options }),
    [showNotification],
  );

  const showError = useCallback(
    (message: string, options: ShorthandOptions = {}) =>
      showNotification({ type: "error", message, ...options }),
    [showNotification],
  );

  const showWarning = useCallback(
    (message: string, options: ShorthandOptions = {}) =>
      showNotification({ type: "warning", message, ...options }),
    [showNotification],
  );

  const showInfo = useCallback(
    (message: string, options: ShorthandOptions = {}) =>
      showNotification({ type: "info", message, ...options }),
    [showNotification],
  );

  const toast = useMemo<NotificationContextValue["toast"]>(() => {
    const build =
      (type: NotificationType, defaultDuration: number) =>
      (message: string, duration = defaultDuration) =>
        notice({ type, title: message, duration, dismissible: true });

    return {
      success: build("success", 2500),
      error: build("error", 4000),
      warning: build("warning", 3500),
      info: build("info", 3000),
    };
  }, [notice]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      notice,
      toast,
      hideNotification,
      hideNotice,
    }),
    [
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      notice,
      toast,
      hideNotification,
      hideNotice,
    ],
  );

  const cornerTone = (corner.type ?? "info") as NoticeTone;

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationModal
        isOpen={modal.isOpen}
        onClose={hideNotification}
        onOkClick={modal.onOkClick ?? undefined}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        details={modal.details}
        overlay={modal.overlay}
        overlayColor={modal.overlayColor}
        overlayClose={modal.overlayClose}
        escapeClose={modal.escapeClose}
        autoClose={modal.autoClose}
        showOkButton={modal.showOkButton}
        okButtonText={modal.okButtonText}
        okButtonVariant={modal.okButtonVariant}
        showCloseButton={modal.showCloseButton}
        icon={modal.icon}
        colorBackground={modal.colorBackground}
        colorIcon={modal.colorIcon}
        colorTitle={modal.colorTitle}
        colorDetails={modal.colorDetails}
        color={modal.color}
        borderColor={modal.borderColor}
        accentColor={modal.accentColor}
        textColor={modal.textColor}
        style={modal.style}
        zIndex={modal.zIndex}
        align={modal.align}
        alignIcon={modal.alignIcon}
        alignTitle={modal.alignTitle}
        alignMessage={modal.alignMessage}
        alignButton={modal.alignButton}
        iconSize={modal.iconSize}
        titleSize={modal.titleSize}
        messageSize={modal.messageSize}
      >
        {modal.children}
      </NotificationModal>
      <FloatingNotice
        open={corner.open}
        title={corner.title}
        subtext={corner.subtext ?? corner.message}
        details={corner.details}
        tone={cornerTone}
        color={corner.color}
        borderColor={corner.borderColor}
        accentColor={corner.accentColor}
        textColor={corner.textColor}
        colorBackground={corner.colorBackground}
        colorIcon={corner.colorIcon}
        colorTitle={corner.colorTitle}
        colorDetails={corner.colorDetails}
        duration={corner.duration}
        dismissible={corner.dismissible}
        blockInteraction={corner.blockInteraction}
        overlayClose={corner.overlayClose}
        showCloseButton={corner.showCloseButton}
        position={corner.position}
        compact={corner.compact}
        icon={corner.icon}
        gifSrc={corner.gifSrc}
        zIndex={corner.zIndex}
        style={corner.style}
        onClose={hideNotice}
      />
    </NotificationContext.Provider>
  );
}

export default NotificationContext;

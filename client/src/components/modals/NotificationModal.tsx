import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Button, { type ButtonVariant } from "@/components/common/Button";
import { afterPaint } from "@/components/notices/afterPaint";
import { defaultToneIcon, NOTICE_TONES, type NoticeTone } from "@/components/notices/tones";
import "./NotificationModal.css";

export type NotificationAlign = "start" | "center" | "end";
export type NotificationType = NoticeTone;

export type NotificationDetails = string | Record<string, unknown> | unknown[];

export interface NotificationModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onOkClick?: () => void;
  type?: NotificationType;
  title?: string | null;
  message?: string | null;
  details?: NotificationDetails | null;
  /** Dim the rest of the page. */
  overlay?: boolean;
  overlayColor?: string;
  /** Close when the overlay is clicked. */
  overlayClose?: boolean;
  /** Close when Escape is pressed. */
  escapeClose?: boolean;
  /** Milliseconds before the modal dismisses itself; `null` / `0` keeps it open. */
  autoClose?: number | null;
  showOkButton?: boolean;
  okButtonText?: string | null;
  okButtonVariant?: ButtonVariant;
  showCloseButton?: boolean;
  /**
   * Type glyph by default. Pass a node (e.g. a Lucide icon), `"none"` to hide,
   * or `"spinner"` while waiting. Type is only a color preset — it does not lock the icon.
   */
  icon?: ReactNode;
  /** Tint the panel with the type palette. Off by default — modal stays on `--surface-1`. */
  colorBackground?: boolean;
  /**
   * Color the icon with the type accent (or `accentColor`). Defaults on for status types
   * and off for `neutral`.
   */
  colorIcon?: boolean;
  /**
   * Color the heading with the type accent (or `accentColor`). Defaults on for status types
   * and off for `neutral`.
   */
  colorTitle?: boolean;
  /** Tint the optional details block. Off by default — `details` itself is omitted unless passed. */
  colorDetails?: boolean;
  /** Override the type preset. */
  color?: string;
  borderColor?: string;
  accentColor?: string;
  textColor?: string;
  style?: CSSProperties;
  zIndex?: number;
  /** Extra body (forms, choice cards). Renders under the message. */
  children?: ReactNode;
  /**
   * Shorthand for all four slots. Per-slot props win.
   * Icon / title / message default to start; button defaults to end.
   */
  align?: NotificationAlign;
  alignIcon?: NotificationAlign;
  alignTitle?: NotificationAlign;
  alignMessage?: NotificationAlign;
  alignButton?: NotificationAlign;
  /** Diameter of the type icon (number = px). */
  iconSize?: number | string;
  /** Heading font size (number = px). */
  titleSize?: number | string;
  /** Message font size (number = px). */
  messageSize?: number | string;
}

const DEFAULT_TITLES: Record<NotificationType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
  neutral: "Notice",
};

const DEFAULT_BUTTONS: Record<NotificationType, string> = {
  success: "OK",
  error: "Close",
  warning: "OK",
  info: "OK",
  neutral: "OK",
};

const EXIT_MS = 280;

function cssSize(value: number | string | undefined, fallback: string): string {
  if (value == null || value === "") return fallback;
  return typeof value === "number" ? `${value}px` : value;
}

function resolveAlign(
  specific: NotificationAlign | undefined,
  shorthand: NotificationAlign | undefined,
  fallback: NotificationAlign,
): NotificationAlign {
  return specific ?? shorthand ?? fallback;
}

/** Centered, parameterized dialog. Pair with FloatingNotice for corner toasts. */
function NotificationModal({
  isOpen,
  onClose,
  onOkClick,
  type = "info",
  title,
  message,
  details,
  overlay = true,
  overlayColor,
  overlayClose = true,
  escapeClose = true,
  autoClose = null,
  showOkButton = true,
  okButtonText,
  okButtonVariant = "primary",
  showCloseButton = true,
  icon = null,
  colorBackground = false,
  colorIcon,
  colorTitle,
  colorDetails = false,
  color,
  borderColor,
  accentColor,
  textColor,
  style = {},
  zIndex = 1100,
  children,
  align,
  alignIcon,
  alignTitle,
  alignMessage,
  alignButton,
  iconSize,
  titleSize,
  messageSize,
}: NotificationModalProps) {
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);
  const closeTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const preset = NOTICE_TONES[type] ?? NOTICE_TONES.neutral;
  const statusTone = type !== "neutral";
  const paintIcon = colorIcon ?? statusTone;
  const paintTitle = colorTitle ?? statusTone;
  const tinted = colorBackground || Boolean(color);
  const vars = {
    "--nm-bg": color || (tinted ? preset.bg : "var(--surface-1)"),
    "--nm-border": borderColor || (tinted ? preset.border : "var(--line)"),
    "--nm-accent": accentColor || preset.accent,
    "--nm-text": textColor || (tinted ? preset.text : "var(--ink)"),
    "--nm-icon": paintIcon ? accentColor || preset.accent : "var(--ink-muted)",
    "--nm-title": paintTitle ? accentColor || preset.accent : "var(--ink)",
    "--nm-icon-size": cssSize(iconSize, "1.65rem"),
    "--nm-title-size": cssSize(titleSize, "0.875rem"),
    "--nm-message-size": cssSize(messageSize, "0.8125rem"),
    ...(overlayColor ? { "--nm-overlay": overlayColor } : {}),
  } as CSSProperties;

  const finishClose = (notify: boolean) => {
    setVisible(false);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setMounted(false);
      if (notify) onClose?.();
    }, EXIT_MS);
  };

  const requestClose = () => finishClose(true);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setVisible(false);
      return afterPaint(() => setVisible(true));
    }
    if (mounted) finishClose(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !visible || !autoClose) return undefined;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => requestClose(), autoClose);
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visible, autoClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && escapeClose) requestClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, escapeClose]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  if (!mounted) return null;

  const resolvedIcon =
    icon === "none" ? null : icon === "spinner" ? "spinner" : icon == null ? defaultToneIcon(type) : icon;
  const duration = autoClose && autoClose > 0 ? autoClose : 0;
  const iconAlign = resolveAlign(alignIcon, align, "start");
  const titleAlign = resolveAlign(alignTitle, align, "start");
  const messageAlign = resolveAlign(alignMessage, align, "start");
  const buttonAlign = resolveAlign(alignButton, align, "end");

  return (
    <div
      className={`nm-root${overlay ? " nm-root--overlay" : ""}`}
      style={{ ...vars, zIndex }}
      role="dialog"
      aria-modal={overlay}
      aria-labelledby="nm-title"
    >
      {overlay && (
        <div
          className={`nm-scrim${visible ? " nm-scrim--visible" : ""}`}
          onClick={overlayClose ? requestClose : undefined}
          aria-hidden="true"
        />
      )}

      <div
        className={`nm-panel${visible ? " nm-panel--visible" : ""}${tinted ? " nm-panel--tinted" : ""}${
          paintIcon ? " nm-panel--icon-accent" : ""
        }${colorDetails ? " nm-panel--details-accent" : ""}`}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {showCloseButton && (
          <button type="button" className="nm-close" onClick={requestClose} aria-label="Close">
            ×
          </button>
        )}

        <div className="nm-header">
          {resolvedIcon !== null && (
            <div className={`nm-icon nm-icon--${iconAlign}`} aria-hidden="true">
              {resolvedIcon === "spinner" ? <span className="nm-spinner" /> : resolvedIcon}
            </div>
          )}

          <h2 id="nm-title" className={`nm-title nm-title--${titleAlign}`}>
            {title || DEFAULT_TITLES[type]}
          </h2>

          {message && <p className={`nm-message nm-message--${messageAlign}`}>{message}</p>}
        </div>

        {details != null && details !== "" && (
          <div className="nm-details">
            {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
          </div>
        )}

        {children ? <div className="nm-body">{children}</div> : null}

        {showOkButton && (
          <div className={`nm-actions nm-actions--${buttonAlign}`}>
            <Button
              onClick={() => (onOkClick ? onOkClick() : requestClose())}
              variant={okButtonVariant}
              size="small"
            >
              {okButtonText || DEFAULT_BUTTONS[type]}
            </Button>
          </div>
        )}

        {duration > 0 && (
          <div className="nm-timer" aria-hidden="true">
            <div
              className="nm-timer-bar"
              style={{ animationDuration: `${duration}ms` }}
              key={`${isOpen}-${duration}-${title}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

type PresetProps = Omit<NotificationModalProps, "type">;

NotificationModal.success = (props: PresetProps) => <NotificationModal type="success" {...props} />;
NotificationModal.error = (props: PresetProps) => <NotificationModal type="error" {...props} />;
NotificationModal.warning = (props: PresetProps) => <NotificationModal type="warning" {...props} />;
NotificationModal.info = (props: PresetProps) => <NotificationModal type="info" {...props} />;
NotificationModal.neutral = (props: PresetProps) => <NotificationModal type="neutral" {...props} />;

export default NotificationModal;

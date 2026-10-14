import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { afterPaint } from "./afterPaint";
import { defaultToneIcon, NOTICE_TONES, type NoticeTone } from "./tones";
import "./FloatingNotice.css";

export type FloatingNoticePosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface FloatingNoticeProps {
  open?: boolean;
  title?: string;
  subtext?: string;
  details?: string | Record<string, unknown> | unknown[] | null;
  tone?: NoticeTone;
  color?: string;
  borderColor?: string;
  accentColor?: string;
  textColor?: string;
  /** Tint the card with the type palette. On by default for floating notices. */
  colorBackground?: boolean;
  /** Color the type icon with the type accent. On by default. */
  colorIcon?: boolean;
  /** Color the heading with the type accent. On by default. */
  colorTitle?: boolean;
  /** Tint the optional details block. Off by default — `details` itself is omitted unless passed. */
  colorDetails?: boolean;
  /** Milliseconds visible. `0` stays until dismissed. */
  duration?: number;
  dismissible?: boolean;
  /** Full-page overlay that blocks the rest of the UI. */
  blockInteraction?: boolean;
  overlayClose?: boolean;
  showCloseButton?: boolean;
  position?: FloatingNoticePosition;
  /** `'auto'` follows `tone`. `'none'` hides it. */
  icon?: "auto" | "none" | "error" | "success" | "info" | "warning" | "spinner" | ReactNode;
  gifSrc?: string | null;
  zIndex?: number;
  style?: CSSProperties;
  onClose?: () => void;
}

const EXIT_MS = 280;

/**
 * Corner floating notice with a slide-in animation.
 *
 * Same parameter surface as NotificationModal where it applies: overlay
 * (`blockInteraction` / `overlayClose`), dismiss, copy, colors, icon, and a
 * `duration` timer.
 */
export default function FloatingNotice({
  open = false,
  title = "",
  subtext = "",
  details = null,
  tone = "info",
  color,
  borderColor,
  accentColor,
  textColor,
  colorBackground = true,
  colorIcon = true,
  colorTitle = true,
  colorDetails = false,
  duration = 5000,
  dismissible = true,
  blockInteraction = false,
  overlayClose = true,
  showCloseButton = true,
  position = "bottom-right",
  icon = "auto",
  gifSrc = null,
  zIndex = 1200,
  style = {},
  onClose,
}: FloatingNoticeProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const closeTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const preset = NOTICE_TONES[tone] ?? NOTICE_TONES.neutral;
  const resolvedIcon = icon === "auto" ? tone : icon;
  const tinted = colorBackground || Boolean(color);

  const vars = {
    "--fn-bg": color || (tinted ? preset.bg : "var(--surface-1)"),
    "--fn-border": borderColor || (tinted ? preset.border : "var(--line)"),
    "--fn-accent": accentColor || preset.accent,
    "--fn-text": textColor || (tinted ? preset.text : "var(--ink)"),
    "--fn-icon": colorIcon ? accentColor || preset.accent : "var(--ink-muted)",
    "--fn-title": colorTitle ? accentColor || preset.accent : "var(--ink)",
    zIndex,
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
    if (open) {
      setMounted(true);
      setVisible(false);
      return afterPaint(() => setVisible(true));
    }
    if (mounted) finishClose(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !visible || !duration) return undefined;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => requestClose(), duration);
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visible, duration]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  if (!mounted) return null;

  const handleNoticeClick = () => {
    if (dismissible) requestClose();
  };

  const detailText =
    details == null || details === ""
      ? ""
      : typeof details === "string"
        ? details
        : JSON.stringify(details, null, 2);

  return (
    <div
      className={`fn-root fn-root--${position}${blockInteraction ? " fn-root--blocking" : ""}`}
      style={vars}
      aria-live="polite"
    >
      {blockInteraction ? (
        <div
          className={`fn-scrim${visible ? " fn-scrim--visible" : ""}`}
          onClick={dismissible && overlayClose ? requestClose : undefined}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`fn-card${visible ? " fn-card--visible" : ""}${
          dismissible ? " fn-card--dismissible" : ""
        }${tinted ? " fn-card--tinted" : ""}${colorIcon ? " fn-card--icon-accent" : ""}${
          colorDetails ? " fn-card--details-accent" : ""
        }`}
        role="status"
        style={style}
        onClick={handleNoticeClick}
      >
        {(resolvedIcon && resolvedIcon !== "none") || gifSrc ? (
          <div className="fn-media" aria-hidden="true">
            {gifSrc ? (
              <img src={gifSrc} alt="" className="fn-gif" />
            ) : resolvedIcon === "spinner" ? (
              <span className="fn-spinner" />
            ) : (
              <span className="fn-icon">
                {typeof resolvedIcon === "string" ? defaultToneIcon(resolvedIcon) : resolvedIcon}
              </span>
            )}
          </div>
        ) : null}

        <div className="fn-copy">
          {title ? <p className="fn-title">{title}</p> : null}
          {subtext ? <p className="fn-subtext">{subtext}</p> : null}
          {detailText ? <p className="fn-details">{detailText}</p> : null}
        </div>

        {dismissible && showCloseButton ? (
          <button
            type="button"
            className="fn-close"
            aria-label="Dismiss"
            onClick={(event) => {
              event.stopPropagation();
              requestClose();
            }}
          >
            ×
          </button>
        ) : (
          <span />
        )}

        {duration > 0 ? (
          <div className="fn-timer" aria-hidden="true">
            <div
              className="fn-timer-bar"
              style={{ animationDuration: `${duration}ms` }}
              key={`${open}-${duration}-${title}`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

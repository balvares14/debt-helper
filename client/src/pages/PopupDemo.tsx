import { useState, type CSSProperties, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingOverlay from "@/components/overlays/LoadingOverlay";
import { useNotification } from "@/contexts/NotificationContext";
import type { NotificationAlign, NotificationType } from "@/components/modals/NotificationModal";
import type { FloatingNoticePosition } from "@/components/notices/FloatingNotice";
import type { NoticeTone } from "@/components/notices/tones";

const MODAL_TYPES: NotificationType[] = ["success", "error", "warning", "info", "neutral"];
const ALIGNMENTS: NotificationAlign[] = ["start", "center", "end"];
const CUSTOM_ACCENT = "#7c3aed";
const NOTICE_TONES: NoticeTone[] = ["success", "error", "warning", "info", "neutral"];
const POSITIONS: FloatingNoticePosition[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
];

const PopupDemo = () => {
  const { showNotification, notice } = useNotification();

  const [spinnerOpen, setSpinnerOpen] = useState(false);
  const [spinnerMs, setSpinnerMs] = useState(1500);

  const [modalType, setModalType] = useState<NotificationType>("success");
  const [modalOverlay, setModalOverlay] = useState(true);
  const [modalOverlayClose, setModalOverlayClose] = useState(true);
  const [modalCloseBtn, setModalCloseBtn] = useState(true);
  const [modalOkBtn, setModalOkBtn] = useState(true);
  const [modalDetails, setModalDetails] = useState(false);
  const [modalTimer, setModalTimer] = useState(false);
  const [modalIcon, setModalIcon] = useState(true);
  const [modalColorBg, setModalColorBg] = useState(false);
  const [modalColorIcon, setModalColorIcon] = useState(true);
  const [modalColorTitle, setModalColorTitle] = useState(true);
  const [modalColorDetails, setModalColorDetails] = useState(false);
  const [modalAlignIcon, setModalAlignIcon] = useState<NotificationAlign>("start");
  const [modalAlignTitle, setModalAlignTitle] = useState<NotificationAlign>("start");
  const [modalAlignMessage, setModalAlignMessage] = useState<NotificationAlign>("start");
  const [modalAlignButton, setModalAlignButton] = useState<NotificationAlign>("end");
  const [modalIconSize, setModalIconSize] = useState("1.65rem");
  const [modalTitleSize, setModalTitleSize] = useState("0.875rem");
  const [modalCustomIcon, setModalCustomIcon] = useState(false);
  const [modalCustomColor, setModalCustomColor] = useState(false);

  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [noticePosition, setNoticePosition] = useState<FloatingNoticePosition>("bottom-right");
  const [noticeDuration, setNoticeDuration] = useState(3500);
  const [noticeSticky, setNoticeSticky] = useState(false);
  const [noticeOverlay, setNoticeOverlay] = useState(false);
  const [noticeSpinner, setNoticeSpinner] = useState(false);
  const [noticeIcon, setNoticeIcon] = useState(true);
  const [noticeColorBg, setNoticeColorBg] = useState(true);
  const [noticeColorIcon, setNoticeColorIcon] = useState(true);
  const [noticeColorTitle, setNoticeColorTitle] = useState(true);
  const [noticeDetails, setNoticeDetails] = useState(false);
  const [noticeColorDetails, setNoticeColorDetails] = useState(false);

  const runSpinner = () => {
    setSpinnerOpen(true);
    window.setTimeout(() => setSpinnerOpen(false), spinnerMs);
  };

  const runModal = () => {
    showNotification({
      type: modalType,
      title: `${modalType[0].toUpperCase()}${modalType.slice(1)}`,
      message: "Centered dialog. Overlay, dismiss, copy, colors, and the footer button are all props.",
      details: modalDetails
        ? { overlay: modalOverlay, overlayClose: modalOverlayClose, autoClose: modalTimer ? 2500 : null }
        : null,
      overlay: modalOverlay,
      overlayClose: modalOverlayClose,
      showCloseButton: modalCloseBtn,
      showOkButton: modalOkBtn,
      okButtonText: "OK",
      autoClose: modalTimer ? 2500 : null,
      icon: modalCustomIcon ? <Sparkles /> : modalIcon ? undefined : "none",
      colorBackground: modalColorBg,
      colorIcon: modalColorIcon,
      colorTitle: modalColorTitle,
      colorDetails: modalColorDetails,
      accentColor: modalCustomColor ? CUSTOM_ACCENT : undefined,
      alignIcon: modalAlignIcon,
      alignTitle: modalAlignTitle,
      alignMessage: modalAlignMessage,
      alignButton: modalAlignButton,
      iconSize: modalIconSize,
      titleSize: modalTitleSize,
    });
  };

  const runNotice = () => {
    notice({
      type: noticeTone,
      title: noticeSpinner ? "Working…" : "Floating notice",
      subtext: noticeSticky
        ? "Stays until dismissed. Click the card or ×."
        : `Slides in at ${noticePosition}, then the timer bar runs out.`,
      duration: noticeSticky ? 0 : noticeDuration,
      position: noticePosition,
      dismissible: true,
      blockInteraction: noticeOverlay,
      overlayClose: true,
      icon: noticeSpinner ? "spinner" : noticeIcon ? "auto" : "none",
      colorBackground: noticeColorBg,
      colorIcon: noticeColorIcon,
      colorTitle: noticeColorTitle,
      colorDetails: noticeColorDetails,
      details: noticeDetails ? { position: noticePosition, duration: noticeSticky ? 0 : noticeDuration } : null,
    });
  };

  return (
    <div style={styles.page}>
      <LoadingOverlay isVisible={spinnerOpen} message="Loading…" />

      <div style={styles.grid}>
        <Card title="Loading overlay" subtitle="Full-page spinner. Used while a request is in flight.">
          <Row label="Duration">
            <select
              value={spinnerMs}
              onChange={(event) => setSpinnerMs(Number(event.target.value))}
              style={styles.select}
            >
              <option value={800}>800 ms</option>
              <option value={1500}>1.5 s</option>
              <option value={3000}>3 s</option>
            </select>
          </Row>
          <Button onClick={runSpinner}>Show spinner</Button>
        </Card>

        <Card
          title="Centered popup"
          subtitle="Neutral panel by default. Type color on icon and heading; background tint is optional."
        >
          <Row label="Type">
            <select
              value={modalType}
              onChange={(event) => setModalType(event.target.value as NotificationType)}
              style={styles.select}
            >
              {MODAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Row>
          <label style={styles.check}>
            <input type="checkbox" checked={modalOverlay} onChange={(e) => setModalOverlay(e.target.checked)} />
            Overlay
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalOverlayClose}
              onChange={(e) => setModalOverlayClose(e.target.checked)}
            />
            Click overlay to close
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalCloseBtn}
              onChange={(e) => setModalCloseBtn(e.target.checked)}
            />
            Show ×
          </label>
          <label style={styles.check}>
            <input type="checkbox" checked={modalOkBtn} onChange={(e) => setModalOkBtn(e.target.checked)} />
            Show OK button
          </label>
          <label style={styles.check}>
            <input type="checkbox" checked={modalDetails} onChange={(e) => setModalDetails(e.target.checked)} />
            Show details block
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalColorDetails}
              onChange={(e) => setModalColorDetails(e.target.checked)}
              disabled={!modalDetails}
            />
            Color details
          </label>
          <label style={styles.check}>
            <input type="checkbox" checked={modalTimer} onChange={(e) => setModalTimer(e.target.checked)} />
            Auto-close (2.5 s)
          </label>
          <label style={styles.check}>
            <input type="checkbox" checked={modalIcon} onChange={(e) => setModalIcon(e.target.checked)} />
            Type icon
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalColorIcon}
              onChange={(e) => setModalColorIcon(e.target.checked)}
              disabled={!modalIcon}
            />
            Color icon
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalColorTitle}
              onChange={(e) => setModalColorTitle(e.target.checked)}
            />
            Color heading
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalColorBg}
              onChange={(e) => setModalColorBg(e.target.checked)}
            />
            Color background
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalCustomIcon}
              onChange={(e) => setModalCustomIcon(e.target.checked)}
              disabled={!modalIcon}
            />
            Custom icon (Sparkles)
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={modalCustomColor}
              onChange={(e) => setModalCustomColor(e.target.checked)}
            />
            Custom accent (violet)
          </label>
          <Row label="Icon align">
            <select
              value={modalAlignIcon}
              onChange={(event) => setModalAlignIcon(event.target.value as NotificationAlign)}
              style={styles.select}
            >
              {ALIGNMENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Title align">
            <select
              value={modalAlignTitle}
              onChange={(event) => setModalAlignTitle(event.target.value as NotificationAlign)}
              style={styles.select}
            >
              {ALIGNMENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Message align">
            <select
              value={modalAlignMessage}
              onChange={(event) => setModalAlignMessage(event.target.value as NotificationAlign)}
              style={styles.select}
            >
              {ALIGNMENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Button align">
            <select
              value={modalAlignButton}
              onChange={(event) => setModalAlignButton(event.target.value as NotificationAlign)}
              style={styles.select}
            >
              {ALIGNMENTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Icon size">
            <select
              value={modalIconSize}
              onChange={(event) => setModalIconSize(event.target.value)}
              style={styles.select}
            >
              <option value="1.65rem">default</option>
              <option value="2.25rem">2.25rem</option>
              <option value="2.75rem">2.75rem</option>
            </select>
          </Row>
          <Row label="Title size">
            <select
              value={modalTitleSize}
              onChange={(event) => setModalTitleSize(event.target.value)}
              style={styles.select}
            >
              <option value="0.875rem">default</option>
              <option value="1.05rem">1.05rem</option>
              <option value="1.25rem">1.25rem</option>
            </select>
          </Row>
          <Button onClick={runModal}>Show popup</Button>
        </Card>

        <Card
          title="Floating notice"
          subtitle="Corner toast. Tinted background by default; icon and heading follow the tone."
        >
          <Row label="Tone">
            <select
              value={noticeTone}
              onChange={(event) => setNoticeTone(event.target.value as NoticeTone)}
              style={styles.select}
            >
              {NOTICE_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Position">
            <select
              value={noticePosition}
              onChange={(event) => setNoticePosition(event.target.value as FloatingNoticePosition)}
              style={styles.select}
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Timer">
            <select
              value={noticeDuration}
              onChange={(event) => setNoticeDuration(Number(event.target.value))}
              style={styles.select}
              disabled={noticeSticky}
            >
              <option value={2000}>2 s</option>
              <option value={3500}>3.5 s</option>
              <option value={6000}>6 s</option>
            </select>
          </Row>
          <label style={styles.check}>
            <input type="checkbox" checked={noticeSticky} onChange={(e) => setNoticeSticky(e.target.checked)} />
            Stay until dismissed (duration 0)
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeOverlay}
              onChange={(e) => setNoticeOverlay(e.target.checked)}
            />
            Block page (overlay)
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeIcon}
              onChange={(e) => setNoticeIcon(e.target.checked)}
              disabled={noticeSpinner}
            />
            Type icon
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeSpinner}
              onChange={(e) => setNoticeSpinner(e.target.checked)}
            />
            Spinner icon
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeColorIcon}
              onChange={(e) => setNoticeColorIcon(e.target.checked)}
              disabled={!noticeIcon && !noticeSpinner}
            />
            Color icon
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeColorTitle}
              onChange={(e) => setNoticeColorTitle(e.target.checked)}
            />
            Color heading
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeColorBg}
              onChange={(e) => setNoticeColorBg(e.target.checked)}
            />
            Color background
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeDetails}
              onChange={(e) => setNoticeDetails(e.target.checked)}
            />
            Show details block
          </label>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={noticeColorDetails}
              onChange={(e) => setNoticeColorDetails(e.target.checked)}
              disabled={!noticeDetails}
            />
            Color details
          </label>
          <Button onClick={runNotice}>Show notice</Button>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={styles.row}>
    <span style={styles.rowLabel}>{label}</span>
    {children}
  </label>
);

const styles = {
  page: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  grid: {
    maxWidth: "880px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "8px",
    alignItems: "start",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
  },
  rowLabel: { flexShrink: 0 },
  select: {
    fontSize: "0.75rem",
    padding: "4px 6px",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    background: "var(--surface-1)",
    color: "var(--ink)",
    maxWidth: "140px",
  },
  check: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
    marginBottom: "8px",
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

export default PopupDemo;

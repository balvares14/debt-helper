import { useState, type ChangeEvent, type CSSProperties } from "react";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Card from "@/components/common/Card";
import LoadingOverlay from "@/components/overlays/LoadingOverlay";
import ErrorModal from "@/components/modals/ErrorModal";
import SuccessModal from "@/components/modals/SuccessModal";
import { formatFileSize } from "@/utils/helpers";
import { errorMessage, post, type ApiEnvelope } from "@/lib/api";
import type { NotificationDetails } from "@/components/modals/NotificationModal";

interface PresignedUrlData {
  presignedUrl: string;
  s3Key: string;
  bucket: string;
  region: string;
}

interface UploadedFile {
  url: string;
  key: string;
  bucket: string;
  region: string;
  size: number;
  type: string;
}

type UploadOutcome =
  | { file: string; success: true; data: UploadedFile }
  | { file: string; success: false; error: string };

interface ModalData {
  title: string;
  message: string;
  details?: NotificationDetails;
}

const FILE_LOCATION = "temp";

const S3Upload = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [useCustomFilename, setUseCustomFilename] = useState(false);
  const [customFilename, setCustomFilename] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadOutcome[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []));
  };

  const handleUseCustomFilenameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUseCustomFilename(event.target.checked);
    if (!event.target.checked) setCustomFilename("");
  };

  const uploadFilePresigned = async (file: File): Promise<UploadedFile> => {
    const presigned = await post<ApiEnvelope<PresignedUrlData>>("/api/s3/presigned-url", {
      fileName: file.name,
      fileType: file.type,
      fileLocation: FILE_LOCATION,
      useCustomFilename,
      customFilename,
    });

    if (!presigned.success || !presigned.data) {
      throw new Error(presigned.message ?? "Failed to generate a presigned URL.");
    }

    const { presignedUrl, bucket, region, s3Key } = presigned.data;

    // A bare fetch on purpose: adding our Authorization header would invalidate
    // the S3 signature.
    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`,
      key: s3Key,
      bucket,
      region,
      size: file.size,
      type: file.type,
    };
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setModalData({
        title: "No Files Selected",
        message: "Please select at least one file to upload.",
        details: "Click the 'Choose Files' button to select files from your computer.",
      });
      setShowErrorModal(true);
      return;
    }

    setIsUploading(true);
    setUploadResults([]);
    setShowErrorModal(false);
    setShowSuccessModal(false);

    const results: UploadOutcome[] = [];

    for (const file of selectedFiles) {
      try {
        results.push({ file: file.name, success: true, data: await uploadFilePresigned(file) });
      } catch (error) {
        results.push({ file: file.name, success: false, error: errorMessage(error) });
      }
    }

    setUploadResults(results);
    setIsUploading(false);

    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;
    const plural = succeeded === 1 ? "" : "s";

    if (failed === 0) {
      setModalData({
        title: "Upload Successful!",
        message: `All ${succeeded} file${plural} uploaded successfully to S3.`,
        details: results.map((result) => ({
          File: result.file,
          Status: "✅ Success",
          URL: result.success ? result.data.url : "N/A",
        })),
      });
      setShowSuccessModal(true);
    } else if (succeeded > 0) {
      setModalData({
        title: "Partial Upload Success",
        message: `${succeeded} file${plural} uploaded successfully, ${failed} failed.`,
        details: results.map((result) => ({
          File: result.file,
          Status: result.success ? "✅ Success" : "❌ Failed",
          Error: result.success ? "N/A" : result.error,
        })),
      });
      setShowSuccessModal(true);
    } else {
      setModalData({
        title: "Upload Failed",
        message: "All file uploads failed. Please check your configuration and try again.",
        details: results.map((result) => ({
          File: result.file,
          Error: result.success ? "N/A" : result.error,
        })),
      });
      setShowErrorModal(true);
    }
  };

  const destinationHint = `Files will be uploaded to: ${FILE_LOCATION}/${
    useCustomFilename && customFilename ? `${customFilename}.ext` : "timestamp_filename"
  }`;

  return (
    <div style={styles.container}>
      <LoadingOverlay isVisible={isUploading} message="Uploading files to S3..." />

      <Card
        title="S3 File Upload"
        subtitle="Upload files directly to AWS S3 with custom file location paths."
        style={styles.content}
      >
        <div style={styles.form}>
          <div style={styles.formGroup}>
            <Input
              label="File Location Path"
              value={FILE_LOCATION}
              readOnly
              disabled
              helpText={destinationHint}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={useCustomFilename}
                onChange={handleUseCustomFilenameChange}
                style={styles.checkbox}
              />
              Use Custom Filename
            </label>
            <small style={styles.helpText}>
              When enabled, you can specify a custom filename (without extension)
            </small>
          </div>

          {useCustomFilename && (
            <div style={styles.formGroup}>
              <Input
                label="Custom Filename (No Extension)"
                value={customFilename}
                onChange={(event) => setCustomFilename(event.target.value)}
                placeholder="e.g., my-document, report-2024, profile-photo"
                helpText="Enter filename without extension. Original file extension will be preserved automatically."
              />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="fileInput">
              Choose Files
            </label>
            <input
              type="file"
              id="fileInput"
              multiple
              onChange={handleFileSelect}
              style={styles.fileInput}
            />
            {selectedFiles.length > 0 && (
              <div style={styles.fileList}>
                <h4>Selected Files ({selectedFiles.length}):</h4>
                {selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`} style={styles.fileItem}>
                    <span style={styles.fileName}>{file.name}</span>
                    <span style={styles.fileSize}>({formatFileSize(file.size)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0}
            style={{ width: "100%", marginTop: "20px" }}
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${selectedFiles.length} File${selectedFiles.length === 1 ? "" : "s"}`}
          </Button>
        </div>

        {uploadResults.length > 0 && (
          <div style={styles.resultsSection}>
            <h3>Upload Results</h3>
            {uploadResults.map((result) => (
              <div
                key={result.file}
                style={{
                  ...styles.resultCard,
                  ...(result.success ? styles.successCard : styles.errorCard),
                }}
              >
                <div style={styles.resultHeader}>
                  <strong>{result.file}</strong>
                  <span style={styles.resultStatus}>
                    {result.success ? "✅ Success" : "❌ Failed"}
                  </span>
                </div>

                {result.success ? (
                  <div style={styles.resultDetails}>
                    <p>
                      <strong>URL:</strong>{" "}
                      <a href={result.data.url} target="_blank" rel="noopener noreferrer">
                        {result.data.url}
                      </a>
                    </p>
                    <p>
                      <strong>S3 Key:</strong> {result.data.key}
                    </p>
                    <p>
                      <strong>Bucket:</strong> {result.data.bucket}
                    </p>
                    <p>
                      <strong>Size:</strong> {formatFileSize(result.data.size)}
                    </p>
                    <p>
                      <strong>Type:</strong> {result.data.type}
                    </p>
                  </div>
                ) : (
                  <div style={styles.resultDetails}>
                    <p>
                      <strong>Error:</strong> {result.error}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={styles.infoSection}>
          <h3>Configuration Info</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <strong>Upload Method:</strong> Presigned URL (Direct to S3)
            </div>
            <div style={styles.infoItem}>
              <strong>File Location:</strong> {FILE_LOCATION}
            </div>
            <div style={styles.infoItem}>
              <strong>Max File Size:</strong> 5GB (S3 presigned URL limit)
            </div>
            <div style={styles.infoItem}>
              <strong>Supported:</strong> All file types
            </div>
          </div>
        </div>
      </Card>

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={modalData?.title}
        message={modalData?.message}
        details={modalData?.details}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={modalData?.title}
        message={modalData?.message}
        details={modalData?.details}
      />
    </div>
  );
};

const styles = {
  container: { minHeight: "calc(100vh - 40px)", background: "var(--bg)", padding: "16px" },
  content: { maxWidth: "640px", margin: "0 auto" },
  form: { marginBottom: "16px" },
  formGroup: { marginBottom: "12px" },
  label: {
    display: "block",
    marginBottom: "4px",
    fontWeight: 500,
    color: "var(--ink-muted)",
    fontSize: "0.75rem",
  },
  fileInput: {
    width: "100%",
    padding: "8px 10px",
    border: "1px dashed var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.8125rem",
    cursor: "pointer",
    backgroundColor: "var(--surface-2)",
    boxSizing: "border-box",
    color: "var(--ink-muted)",
  },
  helpText: {
    display: "block",
    marginTop: "4px",
    color: "var(--ink-faint)",
    fontSize: "0.75rem",
    lineHeight: 1.4,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    marginBottom: "4px",
    fontWeight: 500,
    color: "var(--ink-muted)",
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  checkbox: { marginRight: "8px", cursor: "pointer" },
  fileList: {
    marginTop: "8px",
    padding: "8px 10px",
    background: "var(--surface-2)",
    borderRadius: "var(--r-xs)",
    border: "1px solid var(--line)",
    fontSize: "0.75rem",
  },
  fileItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
    borderBottom: "1px solid var(--line)",
  },
  fileName: { fontWeight: 500, color: "var(--ink)" },
  fileSize: { color: "var(--ink-faint)", fontSize: "0.75rem" },
  resultsSection: { marginBottom: "16px", fontSize: "0.8125rem" },
  resultCard: {
    padding: "10px 12px",
    borderRadius: "var(--r-card)",
    marginBottom: "8px",
    border: "1px solid var(--line)",
    background: "var(--surface-2)",
    color: "var(--ink)",
  },
  successCard: {},
  errorCard: {},
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    fontSize: "0.8125rem",
  },
  resultStatus: { fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-muted)" },
  resultDetails: { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--ink-muted)" },
  infoSection: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    padding: "10px 12px",
    borderRadius: "var(--r-card)",
    marginTop: "16px",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px",
    marginTop: "8px",
  },
  infoItem: {
    padding: "8px 10px",
    background: "var(--surface-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-xs)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, CSSProperties>;

export default S3Upload;

"use client";

import { useEffect, useState } from "react";
import {
  downloadAttachment,
  fileKindLabel,
  isImageMime,
  isPdfMime,
} from "@/lib/message-attachments";

export type AttachmentPreview = {
  url: string;
  name?: string | null;
  mime?: string | null;
};

type Props = {
  attachment: AttachmentPreview | null;
  onClose: () => void;
};

export function AttachmentLightbox({ attachment, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [attachment, onClose]);

  if (!attachment) return null;

  const name = attachment.name?.trim() || "Attachment";
  const mime = attachment.mime ?? "";
  const kind = fileKindLabel(mime, name);
  const image = isImageMime(mime) || (!mime && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(attachment.url));
  const pdf = isPdfMime(mime) || /\.pdf(\?|$)/i.test(attachment.url);

  async function onDownload() {
    setError(null);
    setDownloading(true);
    try {
      await downloadAttachment(attachment!.url, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="attach-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div
        className="attach-lightbox-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="attach-lightbox-head">
          <div>
            <div className="attach-lightbox-kind">{kind}</div>
            <div className="attach-lightbox-name">{name}</div>
          </div>
          <div className="attach-lightbox-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void onDownload()}
              disabled={downloading}
            >
              {downloading ? "Downloading…" : "Download"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="attach-lightbox-body">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.url} alt={name} className="attach-lightbox-img" />
          ) : pdf ? (
            <iframe
              title={name}
              src={attachment.url}
              className="attach-lightbox-frame"
            />
          ) : (
            <div className="attach-lightbox-file">
              <div className="attach-lightbox-file-icon">{kind}</div>
              <p>Preview isn’t available for this file type. Download to open it.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onDownload()}
                disabled={downloading}
              >
                {downloading ? "Downloading…" : "Download file"}
              </button>
            </div>
          )}
        </div>

        {error ? <div className="upload-error attach-lightbox-error">{error}</div> : null}
      </div>
    </div>
  );
}

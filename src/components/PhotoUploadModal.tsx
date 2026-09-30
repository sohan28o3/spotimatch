"use client";
import { useState, useRef } from "react";
import { X, Upload, Link2, Camera, Check, RefreshCw, UserCheck } from "lucide-react";
import type { UserProfile } from "@/types";

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  googlePhotoURL?: string | null;
  onSavePhoto: (photoURL: string, avatarType: "custom" | "google" | "initials") => Promise<void>;
}

export function resizeImageToDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Please select an image file (JPEG, PNG, WebP)."));
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const w = img.width;
        const h = img.height;
        const minDim = Math.min(w, h);
        // Square crop from center
        const sx = (w - minDim) / 2;
        const sy = (h - minDim) / 2;
        canvas.width = Math.min(minDim, maxDim);
        canvas.height = Math.min(minDim, maxDim);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Unable to process image."));
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load selected image."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export function PhotoUploadModal({
  isOpen,
  onClose,
  profile,
  googlePhotoURL,
  onSavePhoto,
}: PhotoUploadModalProps) {
  const [mode, setMode] = useState<"upload" | "url" | "initials">("upload");
  const [previewUrl, setPreviewUrl] = useState<string>(profile?.photoURL || "");
  const [urlInput, setUrlInput] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Image must be smaller than 10MB.");
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setPreviewUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    setError("");
    setBusy(true);
    try {
      if (mode === "initials") {
        await onSavePhoto("", "initials");
      } else if (mode === "url") {
        if (!urlInput.trim()) throw new Error("Please enter an image URL.");
        await onSavePhoto(urlInput.trim(), "custom");
      } else {
        if (!previewUrl) throw new Error("Please choose an image to upload.");
        await onSavePhoto(previewUrl, "custom");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUseGooglePhoto() {
    if (!googlePhotoURL) return;
    setError("");
    setBusy(true);
    try {
      await onSavePhoto(googlePhotoURL, "google");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set Google photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#181818] border border-[#282828] rounded-2xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282828]">
          <h2 className="text-lg font-bold tracking-tight">Profile Photo</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-800/80 text-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Photo Preview Circle */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-[#282828] border-2 border-[#383838] shadow-lg flex items-center justify-center">
              {mode === "initials" ? (
                <span className="text-3xl font-bold text-[#1db954]">
                  {(profile?.displayName || "You").slice(0, 2).toUpperCase()}
                </span>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera size={36} className="text-[#727272]" />
              )}

              {mode === "upload" && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-xs font-semibold text-white transition-opacity cursor-pointer"
                >
                  <Camera size={24} className="mb-1" />
                  Choose photo
                </button>
              )}
            </div>
            <span className="text-xs text-[#b3b3b3]">
              {mode === "initials"
                ? "Showing profile initials"
                : "Photo preview (256 × 256)"}
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#121212] rounded-lg border border-[#282828]">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                mode === "upload"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-[#b3b3b3] hover:text-white"
              }`}
            >
              <Upload size={14} />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                mode === "url"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-[#b3b3b3] hover:text-white"
              }`}
            >
              <Link2 size={14} />
              Image URL
            </button>
            <button
              type="button"
              onClick={() => setMode("initials")}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                mode === "initials"
                  ? "bg-[#282828] text-white shadow-sm"
                  : "text-[#b3b3b3] hover:text-white"
              }`}
            >
              <UserCheck size={14} />
              Initials
            </button>
          </div>

          {/* Tab Content */}
          {mode === "upload" && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="w-full py-3 px-4 border border-dashed border-[#404040] hover:border-[#1db954] rounded-xl bg-[#121212] hover:bg-[#1a1a1a] text-sm text-[#b3b3b3] hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload size={16} className="text-[#1db954]" />
                Browse photo from device
              </button>
              <p className="text-[11px] text-center text-[#727272]">
                Supports JPEG, PNG, or WebP. Automatically centered and optimized.
              </p>
            </div>
          )}

          {mode === "url" && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#b3b3b3]">
                Direct image link
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={e => {
                  setUrlInput(e.target.value);
                  if (e.target.value.startsWith("http")) setPreviewUrl(e.target.value);
                }}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-2 text-sm bg-[#121212] border border-[#282828] focus:border-[#1db954] rounded-lg text-white placeholder-[#727272] outline-none"
              />
              <p className="text-[11px] text-[#727272]">
                Paste any publicly accessible image link.
              </p>
            </div>
          )}

          {mode === "initials" && (
            <p className="text-xs text-center text-[#b3b3b3] py-2">
              Your profile will display your initials over a styled Spotify icon backdrop.
            </p>
          )}

          {/* Google Photo shortcut if available */}
          {googlePhotoURL && (
            <button
              type="button"
              onClick={handleUseGooglePhoto}
              disabled={busy}
              className="w-full py-2.5 px-3 text-xs bg-[#242424] hover:bg-[#2e2e2e] text-[#b3b3b3] hover:text-white rounded-lg flex items-center justify-center gap-2 transition-colors border border-[#333]"
            >
              <RefreshCw size={13} />
              Reset to Google Account photo
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#121212] border-t border-[#282828]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-[#b3b3b3] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="px-6 py-2 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] hover:scale-[1.02] active:scale-[0.98] rounded-full transition-all flex items-center gap-1.5 shadow-md"
          >
            {busy ? (
              <RefreshCw size={14} className="spin" />
            ) : (
              <Check size={14} />
            )}
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}

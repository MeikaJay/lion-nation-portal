
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const BUCKET = "aep-raffle-images";
const MAX_SIZE = 5 * 1024 * 1024;

export default function AdminRaffleImageUpload({
  raffleId,
  imagePath,
  onUploaded,
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!imagePath) {
        setPreviewUrl("");
        return;
      }

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(imagePath, 60 * 60);

      if (!cancelled) {
        setPreviewUrl(error ? "" : data?.signedUrl || "");
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  async function uploadImage(event) {
    const file = event.target.files?.[0];

    if (!file || !raffleId) return;

    setMessage("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setMessage("Image must be 5 MB or smaller.");
      return;
    }

    setUploading(true);

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const path = `${raffleId}/${crypto.randomUUID()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: saveError } = await supabase.rpc(
        "admin_set_raffle_image",
        {
          p_raffle_id: raffleId,
          p_image_path: path,
        }
      );

      if (saveError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw saveError;
      }

      setMessage("Raffle graphic uploaded successfully.");

      if (onUploaded) await onUploaded(path);
    } catch (error) {
      setMessage(error.message || "Unable to upload image.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div
      style={{
        padding: 22,
        border: "1px solid #e6dcc6",
        borderRadius: 14,
        background: "#fffdf8",
        marginTop: 20,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Raffle Promotional Graphic</h3>

      <p style={{ color: "#777", fontSize: 13 }}>
        Upload a JPG, PNG, or WebP graphic (maximum 5 MB).
      </p>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Current raffle promotion"
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: 320,
            objectFit: "contain",
            borderRadius: 12,
            display: "block",
            marginBottom: 16,
          }}
        />
      )}

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading || !raffleId}
        onChange={uploadImage}
      />

      {!raffleId && (
        <p style={{ fontSize: 12 }}>
          Save the raffle first to enable image uploads.
        </p>
      )}

      {uploading && <p>Uploading graphic...</p>}

      {message && (
        <p role="status" style={{ color: "#8b691f" }}>
          {message}
        </p>
      )}
    </div>
  );
}

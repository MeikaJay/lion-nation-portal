
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function RaffleGraphic({ imagePath, alt = "Raffle promotion" }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    setUrl("");

    if (!imagePath) return;

    async function loadImage() {
      const { data, error } = await supabase.storage
        .from("aep-raffle-images")
        .createSignedUrl(imagePath, 3600);

      if (!cancelled && !error) {
        setUrl(data?.signedUrl || "");
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      style={{
        width: "100%",
        maxHeight: 380,
        objectFit: "contain",
        borderRadius: 16,
        background: "#191919",
      }}
    />
  );
}

"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";
import { FormError, primaryButtonClass } from "@/components/member/form";
import { requestContentFileUrl } from "./actions";

// ContentItem has no stored file type, so an audio file is recognised by
// its extension: enough to decide whether to show a player inline or
// just open the file, without needing a schema change.
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".aac"];

function looksLikeAudio(path: string): boolean {
  return AUDIO_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

export function FileButton({ contentId, filePath }: { contentId: string; filePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const isAudio = looksLikeAudio(filePath);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const result = await requestContentFileUrl(contentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.url) return;
      if (isAudio) {
        setUrl(result.url);
      } else {
        // Not window.open: after an await, mobile browsers treat a new
        // window as a pop-up and block it. Navigating this tab always
        // works, and the browser's own back button returns here.
        window.location.assign(result.url);
      }
    } catch {
      setError("That could not be opened. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  const Icon = isAudio ? Play : Download;

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={handleClick} disabled={isPending} className={`${primaryButtonClass} self-start`}>
        <Icon className="size-5" aria-hidden="true" />
        {isPending ? "Loading..." : isAudio ? "Play" : "Download"}
      </button>
      <FormError>{error}</FormError>
      {url ? (
        // Streams directly from the signed URL, range requests included,
        // so seeking does not require downloading the whole file first.
        <audio controls autoPlay src={url} className="w-full" />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    const result = await requestContentFileUrl(contentId);
    setIsPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.url) return;
    if (isAudio) {
      setUrl(result.url);
    } else {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleClick} disabled={isPending} className="h-11 self-start px-5 text-base">
        {isPending ? "Loading..." : isAudio ? "Play" : "Download"}
      </Button>
      {error ? <p className="text-base text-destructive">{error}</p> : null}
      {url ? (
        // Streams directly from the signed URL, range requests included,
        // so seeking does not require downloading the whole file first.
        <audio controls src={url} className="w-full" />
      ) : null}
    </div>
  );
}

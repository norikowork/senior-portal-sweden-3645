import { useEffect, useState } from "react";
import { toast } from "sonner";
import content, { contentImage } from "@/lib/shared/kliv-content.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MAX_PICK_BYTES, optimizeImage } from "@/lib/imageUpload";

/** A saved image path, or a newly picked file that is uploaded on save. */
export type ImageValue = { path: string | null; file: File | null };

export function imageValue(path: string | null | undefined): ImageValue {
  return { path: path ?? null, file: null };
}

function ImageField({ id, label, hint, value, round, onChange }: {
  id: string; label: string; hint: string; value: ImageValue; round?: boolean; onChange: (v: ImageValue) => void;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!value.file) { setPreview(""); return; }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Välj en bildfil."); return; }
    if (file.size > MAX_PICK_BYTES) { toast.error("Bilden är för stor (max 30 MB)."); return; }
    onChange({ path: value.path, file });
  }

  const src = preview || (value.path ? `${value.path}?w=320` : "");
  const box = round ? "h-24 w-24 rounded-full" : "h-24 w-40 rounded-xl";
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold">{label}</Label>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className={`${box} flex shrink-0 items-center justify-center overflow-hidden border-2 border-dashed bg-muted`}>
          {src ? <img src={src} alt={label} className="h-full w-full object-cover" />
            : <span className="text-3xl">{round ? "🙂" : "🖼️"}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <input id={id} type="file" accept="image/*" className="text-sm" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {src && (
            <Button type="button" variant="link" className="h-auto justify-start p-0 text-sm text-destructive"
              onClick={() => onChange({ path: null, file: null })}>Ta bort bilden</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The face field is only for listings without an account (test data); a provider's face comes from their profile. */
export function ListingImageFields({ idPrefix, category, avatar, cover, onAvatar, onCover }: {
  idPrefix: string; category: string; avatar?: ImageValue; cover: ImageValue;
  onAvatar?: (v: ImageValue) => void; onCover: (v: ImageValue) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {avatar && onAvatar && (
        <ImageField id={`${idPrefix}-avatar`} label="Profilbild" round value={avatar} onChange={onAvatar}
          hint="Ett foto på ansiktet. Visas för alla på startsidan." />
      )}
      <ImageField id={`${idPrefix}-cover`} label={`Bild på verksamheten – ${category}`} value={cover} onChange={onCover}
        hint={`En bild som passar just ${category.toLowerCase()}, t.ex. du i arbete eller ett utfört jobb. Varje annons har sin egen bild.`} />
    </div>
  );
}

/**
 * Uploads a newly picked file and returns the path to save. Providers upload into their private
 * folder (`provider-photos/<uuid>`) so an admin can review it first; admins upload straight into
 * `provider-public/<uuid>`.
 */
export async function resolveImage(v: ImageValue, folder: string): Promise<string | null> {
  if (!v.file) return v.path;
  const uploaded = await content.uploadFile(await optimizeImage(v.file), folder);
  return uploaded.path;
}

export type ImageReview = {
  _row_id: number; _created_at: number; user_uuid: string; kind: "avatar" | "cover"; provider_id: number | null;
  path: string; status: "pending" | "approved" | "rejected"; review_note: string | null;
};

/** What the provider sees about their latest upload for one photo slot. */
export function ReviewNotice({ review }: { review: ImageReview | undefined }) {
  if (!review || review.status === "approved") return null;
  if (review.status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        <img src={`${review.path}?w=160`} alt="Bild som väntar på granskning" className="h-12 w-12 rounded-md object-cover" />
        Den nya bilden granskas av Seniorportalen och visas när den godkänts. Tills dess visas den gamla.
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      Din senaste bild godkändes inte och har tagits bort.{review.review_note ? ` Kommentar: ${review.review_note}` : ""} Ladda gärna upp en annan.
    </div>
  );
}

/** Cover image with the face photo overlapping its lower edge, as shown on the home page. */
export function ListingPhotos({ name, avatar, cover }: { name: string; avatar: string | null; cover: string | null }) {
  if (!avatar && !cover) return null;
  return (
    <div className={`relative ${avatar ? "mb-12" : "mb-4"}`}>
      {cover ? (
        <img {...contentImage(cover, { widths: [640, 960, 1280], sizes: "(min-width: 768px) 560px, 100vw" })}
          alt={`Bild från ${name}`} loading="lazy" decoding="async"
          className="aspect-[16/9] w-full rounded-xl object-cover" />
      ) : (
        <div className="aspect-[16/5] w-full rounded-xl bg-primary/10" />
      )}
      {avatar && (
        <img {...contentImage(avatar, { widths: [160, 320], sizes: "96px" })}
          alt={`Foto på ${name}`} loading="lazy" decoding="async"
          className="absolute -bottom-10 left-6 h-24 w-24 rounded-full border-4 border-white bg-white object-cover shadow-md" />
      )}
    </div>
  );
}

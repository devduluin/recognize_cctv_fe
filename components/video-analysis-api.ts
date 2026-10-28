export type VideoOptions = {
  line_position: number;
  line_orientation: "horizontal" | "vertical";
  reverse_direction: boolean;
  gender_enabled: boolean;
  counting_mode: "line" | "zone";
  occupancy_zone: [number, number, number, number];
};

export function videoUploadUrl(base: string, file: { name: string }, options: VideoOptions, eventId?: string, recordingStartedAt?: string) {
  const query = new URLSearchParams({ filename: file.name });
  if (eventId) query.set("event_id", eventId);
  if (recordingStartedAt) query.set("recording_started_at", recordingStartedAt);
  // A crowd zone has no direction or gender; the zone travels as "left,top,right,bottom".
  for (const [key, value] of Object.entries({ ...options, gender_enabled: options.counting_mode === "line" && options.gender_enabled })) query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  return `${base}/video-analyses?${query}`;
}

export function validateVideo(file: { name: string; size: number }, maxBytes: number) {
  if (!/\.(mp4|mov|mkv|avi|webm)$/i.test(file.name)) return "Pilih video MP4, MOV, MKV, AVI, atau WebM.";
  if (!file.size) return "File video kosong.";
  if (file.size > maxBytes) return `Ukuran video maksimal ${Math.floor(maxBytes / 1024 / 1024)} MB.`;
  return "";
}

export function videoTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

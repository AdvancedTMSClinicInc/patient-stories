"use client";

import { useRouter } from "next/navigation";
import Recorder from "./Recorder";

export default function TestimonialRecorder({ prompts, minSeconds, maxSeconds }: { prompts: string[]; minSeconds: number; maxSeconds: number }) {
  const router = useRouter();
  return (
    <Recorder
      prompts={prompts}
      minSeconds={minSeconds}
      maxSeconds={maxSeconds}
      uploadUrl="/api/patient/testimonial"
      submitLabel="Submit privately"
      onUploaded={() => router.push("/p/thanks")}
    />
  );
}

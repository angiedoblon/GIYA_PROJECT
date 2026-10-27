
import React from "react";

interface CameraFeedProps {
  streamUrl?: string;
}

export default function CameraFeed({ streamUrl }: CameraFeedProps) {
  const apiUrl = "http://127.0.0.1:8000";
  const videoUrl = streamUrl || `${apiUrl}/video-feed`;

  return (
    <div className="w-full overflow-hidden rounded-lg bg-black">
      <img
        src={videoUrl}
        alt="GIYA live camera with license plate detection"
        className="block h-auto w-full object-contain"
      />
    </div>
  );
}

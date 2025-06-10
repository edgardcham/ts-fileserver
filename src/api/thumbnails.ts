import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError("Invalid video ID");
//   }

//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }

//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError("Thumbnail not found");
//   }

//   return new Response(thumbnail.data, {
//     headers: {
//       "Content-Type": thumbnail.mediaType,
//       "Cache-Control": "no-store",
//     },
//   });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid thumbnail file");
  }
  const MAX_UPLOAD_SIZE = 1024 * 1024 * 10; // 10MB
  const fileType = file.type; // get type
  const fileBuffer = await file.arrayBuffer();
  const fileb64 = Buffer.from(fileBuffer).toString("base64");

  let video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (userID !== video.userID) {
    throw new UserForbiddenError(
      "You are not allowed to upload a thumbnail for this video"
    );
  }

  const thumbnail: Thumbnail = {
    data: fileBuffer,
    mediaType: fileType,
  };

  const thumbnailURL = `data:${fileType};base64,${fileb64}`;
  video.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, video);
  return respondWithJSON(200, video);
}

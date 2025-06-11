import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";
import crypto from "crypto";

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

  const fileType = file.type;
  console.log("fileType", fileType);
  if (fileType !== "image/jpeg" && fileType !== "image/png") {
    throw new BadRequestError(
      "Invalid file type - only JPEG and PNG are allowed"
    );
  }
  const MAX_UPLOAD_SIZE = 1024 * 1024 * 10; // 10MB
  const fileBuffer = await file.arrayBuffer();

  let video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (userID !== video.userID) {
    throw new UserForbiddenError(
      "You are not allowed to upload a thumbnail for this video"
    );
  }

  const randomBytes = crypto.randomBytes(32).toString("base64url");

  const fileExtension = fileType.split("/")[1];
  const filePath = path.join(cfg.assetsRoot, `${randomBytes}.${fileExtension}`);
  await Bun.write(filePath, fileBuffer);
  const thumbnailURL = `http://localhost:${cfg.port}/assets/${randomBytes}.${fileExtension}`;
  video.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, video);
  return respondWithJSON(200, video);
}

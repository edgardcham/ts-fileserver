import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import path from "path";
import crypto from "crypto";
import fs from "fs";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30; // 1GB
  //  extract videoId as uuid type
  console.log(req.params);
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (userID !== video.userID) {
    throw new UserForbiddenError(
      "You are not allowed to upload a video for this user"
    );
  }

  const formData = await req.formData();
  const file = formData.get("video"); // get video file on disk
  // check if it exceeds 10 GB
  if (!(file instanceof File)) {
    throw new BadRequestError("No video file provided");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video file exceeds 10 GB");
  }
  // ensure it's MP4
  if (file.type !== "video/mp4") {
    throw new BadRequestError("Invalid video file type");
  }
  // create processed video file
  const tmpPath = path.join(cfg.assetsRoot, `${videoId}.mp4`);
  await Bun.write(tmpPath, file);

  // fast-start -> *.processed.mp4
  const processedPath = await processVideoForFastStart(tmpPath);
  fs.unlink(tmpPath, () => {}); // ignore if already gone

  // generate random key
  const aspect = await getVideoAspectRatio(processedPath);
  const randomKey = `${crypto.randomBytes(32).toString("hex")}.mp4`;
  const s3Key = `videos/${aspect}/${randomKey}`;
  
  // upload to s3
  const s3File = cfg.s3Client.file(s3Key);
  await s3File.write(Bun.file(processedPath), { type: file.type });

  fs.unlink(processedPath, () => {}); // ignore if already gone

  const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${s3Key}`;
  video.videoURL = videoURL;
  updateVideo(cfg.db, video);
  return respondWithJSON(200, { videoURL });
}

export async function getVideoAspectRatio(
  filePath: string
): Promise<"landscape" | "portrait" | "other"> {
  // ffprobe -v error -print_format json -show_streams samples/boots-video-horizontal.mp4
  const proc = Bun.spawn({
    cmd: [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  // read stdout and stderr check exited if it's not 0 -> error
  const [stdoutText, exitCode] = await Promise.all([
    new Response(proc.stdout!).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr!).text();
    throw new Error(`Failed to get video aspect ratio: ${errText}`);
  }
  const { streams } = JSON.parse(stdoutText) as {
    streams: { width: number; height: number }[];
  };

  const { width, height } = streams[0] ?? {};
  if (!width || !height) {
    throw new Error("ffprobe JSON missing width/height");
  }

  const ratio = width / height;

  // tolerance
  const close = (a: number, b: number) => Math.abs(a - b) < 0.05;

  if (close(ratio, 16 / 9)) {
    return "landscape";
  } else if (close(ratio, 9 / 16)) {
    return "portrait";
  } else {
    return "other";
  }
}

export async function processVideoForFastStart(input: string): Promise<string> {
  const output = input.replace(/\.mp4$/i, ".processed.mp4");

  const proc = Bun.spawn({
    cmd: [
      "ffmpeg",
      "-i",
      input,
      "-movflags",
      "+faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      output,
    ],
    stdout: "ignore",
    stderr: "pipe",
  });

  if ((await proc.exited) !== 0) {
    const err = await new Response(proc.stderr!).text();
    throw new Error(`ffmpeg failed: ${err.trim()}`);
  }
  return output; // e.g. …/1234.tmp.processed.mp4
}

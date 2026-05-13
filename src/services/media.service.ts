import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { HTTP_STATUS } from "constants/http-status.contants";
import { db } from "db/index";
import { companies } from "db/schema";
import { uploadMediaToMeta } from "services/meta.service";
import { AuthContext } from "types/common.types";
import { ApiError } from "utils/api-error.utils";
import { assertOwnS3Key, getS3PresignedPutUrl } from "utils/s3.utils";

const ALLOWED_MEDIA_TYPES = ["template_header", "image", "video", "document"] as const;
type MediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const ALLOWED_CONTENT_TYPES: Record<MediaType, string[]> = {
  template_header: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/3gpp",
    "application/pdf"
  ],
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/3gpp"],
  document: ["application/pdf"]
};

const sanitizeFilename = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");

export type PresignResponse = {
  url: string;
  key: string;
};

export const getPresignedUploadUrl = async (
  payload: { filename: string; contentType: string; mediaType: string },
  auth: AuthContext
): Promise<PresignResponse> => {
  const { filename, contentType, mediaType } = payload;

  if (!filename || !contentType || !mediaType) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "filename, contentType and mediaType are required");
  }

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType as MediaType)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `mediaType must be one of: ${ALLOWED_MEDIA_TYPES.join(", ")}`
    );
  }

  const allowed = ALLOWED_CONTENT_TYPES[mediaType as MediaType];
  if (!allowed.includes(contentType)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `contentType ${contentType} is not allowed for mediaType ${mediaType}`
    );
  }

  const safe = sanitizeFilename(filename) || "file";
  const key = `${mediaType}/${auth.companyId}/${uuidv4()}-${safe}`;

  const url = await getS3PresignedPutUrl(key, contentType);

  return { url, key };
};

export const getMetaMediaHandle = async (
  payload: { s3Key: string; contentType: string },
  auth: AuthContext
): Promise<{ handle: string }> => {
  const { s3Key, contentType } = payload;

  if (!s3Key || !contentType) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "s3Key and contentType are required");
  }

  assertOwnS3Key(s3Key, "s3Key");

  const [company] = await db
    .select({ accessToken: companies.whatsappAccessToken })
    .from(companies)
    .where(eq(companies.id, auth.companyId))
    .limit(1);

  if (!company?.accessToken) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Company has no WhatsApp access token configured");
  }

  const handle = await uploadMediaToMeta(s3Key, contentType, company.accessToken);

  return { handle };
};

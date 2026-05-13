import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "config/env";
import { HTTP_STATUS } from "constants/http-status.contants";
import { ApiError } from "utils/api-error.utils";

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
});

export const assertOwnS3Key = (key: string, field: string): void => {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} is required`);
  }
  if (key.startsWith("http://") || key.startsWith("https://")) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${field} must be an S3 key, not a full URL`);
  }
};

export const getS3SignedUrl = async (key: string, expiresIn = 3600): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });
  return awsGetSignedUrl(s3, command, { expiresIn });
};

export const getS3PresignedPutUrl = async (
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });
  return awsGetSignedUrl(s3, command, { expiresIn });
};

export const deleteS3Object = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });
  await s3.send(command);
};

export const getS3ObjectBuffer = async (key: string): Promise<Buffer> => {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });
  const res = await s3.send(command);
  if (!res.Body) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, `S3 object not found: ${key}`);
  }
  return Buffer.from(await res.Body.transformToByteArray());
};

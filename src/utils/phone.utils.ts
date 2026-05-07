import { parsePhoneNumberFromString } from "libphonenumber-js";

import { HTTP_MESSAGES } from "constants/http-message.constants";
import { HTTP_STATUS } from "constants/http-status.contants";
import { ApiError } from "utils/api-error.utils";

/**
 * Validates and normalizes a phone number to E.164.
 * Input must include `+` and a valid country calling code (no default region).
 */
export function parseE164Phone(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `${fieldName}: ${HTTP_MESSAGES.ERROR.VALIDATION_FAILED}`
    );
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `${fieldName} must be in E.164 format with country code (e.g. +14155552671)`
    );
  }

  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed || !parsed.isValid()) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `${fieldName} is not a valid international phone number`
    );
  }

  return parsed.format("E.164");
}

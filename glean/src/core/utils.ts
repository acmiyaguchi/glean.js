/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { MetricType } from "./metrics/index.js";
import { v4 as UUIDv4 } from "uuid";
import { Context } from "./context.js";
import { ErrorType } from "./error/error_type.js";

// We will intentionaly leave `null` out even though it is a valid JSON primitive.
export type JSONPrimitive = string | number | boolean;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [member: string]: JSONValue | undefined };
export type JSONArray = JSONValue[];

/**
 * Verifies if a given value is a valid JSONValue.
 *
 * @param v The value to verify
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a valid JSONValue.
 */
export function isJSONValue(v: unknown): v is JSONValue {
  if (isString(v) || isBoolean(v) || isNumber(v)) {
    return true;
  }

  if (isObject(v)) {
    if (Object.keys(v).length === 0) {
      return true;
    }
    for (const key in v) {
      return isJSONValue(v[key]);
    }
  }

  if (Array.isArray(v)) {
    return v.every((e) => isJSONValue(e));
  }

  return false;
}

/**
 * Checks whether or not `v` is a simple data object.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a valid data object.
 */
export function isObject(v: unknown): v is Record<string | number | symbol, unknown> {
  return (typeof v === "object" && v !== null && v.constructor === Object);
}

/**
 * Checks whether or not `v` is undefined.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is undefined.
 */
export function isUndefined(v: unknown): v is undefined {
  return typeof v === "undefined";
}

/**
 * Checks whether or not `v` is a string.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a string.
 */
export function isString(v: unknown): v is string {
  return typeof v === "string";
}

/**
 * Checks whether or not `v` is a boolean.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a boolean.
 */
export function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * Checks whether or not `v` is a number.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a number.
 */
export function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

/**
 * Checks whether or not `v` is an integer.
 *
 * @param v The value to verify.
 * @returns A special Typescript value (which compiles down to a boolean)
 *          stating whether `v` is a number.
 */
export function isInteger(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v);
}

/**
 * Generates a pipeline-friendly string
 * that replaces non alphanumeric characters with dashes.
 *
 * @param applicationId The application if to sanitize.
 * @returns The sanitized applicaiton id.
 */
export function sanitizeApplicationId(applicationId: string): string {
  return applicationId.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

/**
 * Check that a given string is a valid URL.
 *
 * @param v The string to validate.
 * @returns Whether or not the given string is a valid url.
 */
export function validateURL(v: string): boolean {
  const urlPattern = /^(http|https):\/\/[a-zA-Z0-9._-]+(:\d+){0,1}(\/{0,1})$/i;
  return urlPattern.test(v);
}

/**
 * Validates whether or not a given value is an acceptable HTTP header for outgoing pings.
 *
 * @param v The value to validate.
 * @returns Whether or not the given value is a valid HTTP header value.
 */
export function validateHeader(v: string): boolean {
  return /^[a-z0-9-]{1,20}$/i.test(v);
}

/**
 * Generates a UUIDv4.
 *
 * Will provide a fallback in case `crypto` is not available,
 * which makes the "uuid" package generator not work.
 *
 * # Important
 *
 * This workaround is here for usage in Qt/QML environments, where `crypto` is not available.
 * Bug 1688015 was opened to figure out a less hacky way to do this.
 *
 * @returns A randomly generated UUIDv4.
 */
export function generateUUIDv4(): string {
  if (typeof crypto !== "undefined") {
    return UUIDv4();
  } else {
    // Copied from https://stackoverflow.com/a/2117523/261698
    // and https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * A helper function to aid mocking the time in tests.
 *
 * This is only meant to be overridden in tests.
 *
 * @returns The number of milliseconds since the time origin.
 */
export function getMonotonicNow(): number {
  // Sadly, `performance.now` is not available on Qt, which
  // means we should get creative to find a proper clock for that platform.
  // Fall back to `Date.now` for now, until bug 1690528 is fixed.
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/**
 * Truncates a string to a given max length.
 *
 * If the string required truncation, records an error through the error
 * reporting mechanism.
 *
 * @param metric The metric to record an error to, if necessary,
 * @param value The string to truncate.
 * @param length The lenght to truncate to.
 * @returns A string with at most `length` bytes.
 */
export async function truncateStringAtBoundaryWithError(metric: MetricType, value: string, length: number): Promise<string> {
  const truncated = value.substr(0, length);
  if (truncated !== value) {
    await Context.errorManager.record(
      metric,
      ErrorType.InvalidOverflow,
      `Value length ${value.length} exceeds maximum of ${length}.`
    );
  }
  return truncated;
}

/**
 * Takes a string as input, and returns a Uint8Array containing UTF-8 encoded text.
 *
 * @param text The text to encoded.
 * @returns The encoded text.
 */
export function UTF8EncodeText(text: string): Uint8Array {
  if (typeof TextEncoder === "undefined") {
    // The following code is copied, with minor modifications, from the polyfill in
    // https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder#polyfill
    // This is necessary specially for QML environments.
    let resPos = -1;
    // The Uint8Array's length must be at least 3x the length of the string because an invalid UTF-16
    // takes up the equivelent space of 3 UTF-8 characters to encode it properly. However, Array's
    // have an auto expanding length and 1.5x should be just the right balance for most uses.
    const resArr = new Uint8Array(text.length * 3);
    for (let point = 0, nextcode = 0, i = 0; i !== text.length;) {
      point = text.charCodeAt(i), i += 1;
      if (point >= 0xD800 && point <= 0xDBFF) {
        if (i === text.length) {
          resArr[resPos += 1] = 0xef/*0b11101111*/; resArr[resPos += 1] = 0xbf/*0b10111111*/;
          resArr[resPos += 1] = 0xbd/*0b10111101*/; break;
        }
        // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        nextcode = text.charCodeAt(i);
        if (nextcode >= 0xDC00 && nextcode <= 0xDFFF) {
          point = (point - 0xD800) * 0x400 + nextcode - 0xDC00 + 0x10000;
          i += 1;
          if (point > 0xffff) {
            resArr[resPos += 1] = (0x1e/*0b11110*/<<3) | (point>>>18);
            resArr[resPos += 1] = (0x2/*0b10*/<<6) | ((point>>>12)&0x3f/*0b00111111*/);
            resArr[resPos += 1] = (0x2/*0b10*/<<6) | ((point>>>6)&0x3f/*0b00111111*/);
            resArr[resPos += 1] = (0x2/*0b10*/<<6) | (point&0x3f/*0b00111111*/);
            continue;
          }
        } else {
          resArr[resPos += 1] = 0xef/*0b11101111*/; resArr[resPos += 1] = 0xbf/*0b10111111*/;
          resArr[resPos += 1] = 0xbd/*0b10111101*/; continue;
        }
      }
      if (point <= 0x007f) {
        resArr[resPos += 1] = (0x0/*0b0*/<<7) | point;
      } else if (point <= 0x07ff) {
        resArr[resPos += 1] = (0x6/*0b110*/<<5) | (point>>>6);
        resArr[resPos += 1] = (0x2/*0b10*/<<6) | (point&0x3f/*0b00111111*/);
      } else {
        resArr[resPos += 1] = (0xe/*0b1110*/<<4) | (point>>>12);
        resArr[resPos += 1] = (0x2/*0b10*/<<6) | ((point>>>6)&0x3f/*0b00111111*/);
        resArr[resPos += 1] = (0x2/*0b10*/<<6) | (point&0x3f/*0b00111111*/);
      }
    }
    return resArr.subarray(0, resPos + 1); // trim off extra weight
  } else {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }
}

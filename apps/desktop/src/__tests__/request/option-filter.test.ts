import { describe, expect, it } from "vitest";
import { filterOptions } from "@/lib/option-filter";
import { COMMON_REQUEST_HEADERS } from "@/lib/http-headers";

describe("filterOptions", () => {
  it("returns every option for an empty query", () => {
    expect(filterOptions(COMMON_REQUEST_HEADERS, "")).toHaveLength(COMMON_REQUEST_HEADERS.length);
    expect(filterOptions(COMMON_REQUEST_HEADERS, "   ")).toHaveLength(COMMON_REQUEST_HEADERS.length);
  });

  it("matches case-insensitively and ranks prefix matches first", () => {
    const options = ["X-Content-Type-Options", "Content-Type", "Content-Length"];
    expect(filterOptions(options, "content")).toEqual([
      "Content-Type",
      "Content-Length",
      "X-Content-Type-Options",
    ]);
    expect(filterOptions(options, "CONTENT")).toEqual([
      "Content-Type",
      "Content-Length",
      "X-Content-Type-Options",
    ]);
  });

  it("supports substring matches", () => {
    expect(filterOptions(COMMON_REQUEST_HEADERS, "length")).toEqual(["Content-Length"]);
    expect(filterOptions(COMMON_REQUEST_HEADERS, "auth")).toEqual(["Authorization"]);
  });

  it("returns nothing when the query matches no preset, leaving free text alone", () => {
    expect(filterOptions(COMMON_REQUEST_HEADERS, "X-Custom-Vendor")).toEqual([]);
  });
});

describe("COMMON_REQUEST_HEADERS", () => {
  it("offers the documented presets", () => {
    for (const key of [
      "Authorization",
      "Cookie",
      "Content-Type",
      "Content-Range",
      "Content-Encoding",
      "Content-Length",
    ]) {
      expect(COMMON_REQUEST_HEADERS).toContain(key);
    }
  });

  it("has no duplicates, so list keys stay unique", () => {
    expect(new Set(COMMON_REQUEST_HEADERS).size).toBe(COMMON_REQUEST_HEADERS.length);
  });
});

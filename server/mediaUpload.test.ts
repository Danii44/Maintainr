import { describe, expect, it } from "vitest";
import { failedUploadNames } from "../shared/mediaUpload";

describe("failedUploadNames", () => {
  it("returns only rejected attachment names in original order", () => {
    const results: PromiseSettledResult<void>[] = [
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("upload failed") },
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("read failed") },
    ];
    expect(failedUploadNames(["a.jpg", "b.jpg", "c.jpg", "d.jpg"], results)).toEqual(["b.jpg", "d.jpg"]);
  });
});

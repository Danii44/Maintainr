import { describe, expect, it } from "vitest";
import { nextMediaState, retainedFailedFileNames } from "../shared/mediaUpload";
import { mediaAndCompletionTarget, selectedJobTarget, ticketIdFromUiId } from "../shared/workflowTargets";

describe("workflow verification contracts", () => {
  it("keeps the selected technician job aligned with proof and completion targets", () => {
    expect(ticketIdFromUiId("MT-42")).toBe(42);
    expect(selectedJobTarget(42, "MT-42")).toBe(42);
    expect(selectedJobTarget(41, "MT-42")).toBeUndefined();
    expect(mediaAndCompletionTarget(42)).toEqual({ proofUploadTicketId: 42, completionTicketId: 42 });
  });

  it("retains only failed tenant attachments after a partial multi-file upload", () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: { url: "a" } },
      { status: "rejected", reason: new Error("network") },
      { status: "fulfilled", value: { url: "c" } },
    ];
    expect(retainedFailedFileNames(["a.jpg", "b.jpg", "c.jpg"], results)).toEqual(["b.jpg"]);
  });

  it("updates each tenant file independently through uploading, success, and failed states", () => {
    const uploading = nextMediaState({}, "a.jpg", "uploading");
    const mixed = nextMediaState(nextMediaState(uploading, "a.jpg", "success"), "b.jpg", "failed");
    expect(mixed).toEqual({ "a.jpg": "success", "b.jpg": "failed" });
  });
});

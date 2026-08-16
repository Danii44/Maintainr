export type MediaState = "uploading" | "success" | "failed";

export function failedUploadNames(fileNames: string[], results: PromiseSettledResult<unknown>[]) {
  return results
    .map((result, index) => (result.status === "rejected" ? fileNames[index] : undefined))
    .filter((name): name is string => Boolean(name));
}

export function retainedFailedFileNames(fileNames: string[], results: PromiseSettledResult<unknown>[]) {
  const failed = new Set(failedUploadNames(fileNames, results));
  return fileNames.filter(fileName => failed.has(fileName));
}

export function nextMediaState(previous: Record<string, MediaState>, fileName: string, state: MediaState) {
  return { ...previous, [fileName]: state };
}

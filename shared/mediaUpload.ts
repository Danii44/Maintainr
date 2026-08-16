export function failedUploadNames<T>(fileNames: string[], results: PromiseSettledResult<T>[]) {
  return results
    .map((result, index) => (result.status === "rejected" ? fileNames[index] : undefined))
    .filter((name): name is string => Boolean(name));
}

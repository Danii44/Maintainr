export function ticketIdFromUiId(uiId: string) {
  return uiId.startsWith("MT-") ? Number(uiId.slice(3)) : 0;
}

export function selectedJobTarget(selectedTicketId: number, uiId: string) {
  const ticketId = ticketIdFromUiId(uiId);
  return ticketId > 0 && ticketId === selectedTicketId ? ticketId : undefined;
}

export function mediaAndCompletionTarget(selectedTicketId: number) {
  return { proofUploadTicketId: selectedTicketId, completionTicketId: selectedTicketId };
}

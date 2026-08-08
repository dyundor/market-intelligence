export function shouldSyncDraftSent(previousStatus: string, nextStatus: string | undefined, sentActionExists: boolean): boolean {
  return nextStatus === "sent" && previousStatus !== "sent" && !sentActionExists;
}

export function draftSentActionId(draftId: string): string {
  return `la-${draftId}-sent`;
}

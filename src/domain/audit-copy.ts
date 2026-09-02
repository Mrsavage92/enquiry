export function auditSummary(action: string, fixtureId: string): string {
  switch (action) {
    case "approve":
      return `Sent the recommended action on ${fixtureId}`;
    case "approve_auto":
      return `Autopilot sent ${fixtureId}`;
    case "accept_quote":
      return `Quote accepted - ${fixtureId} booked`;
    case "client_question":
      return `${fixtureId}: customer asked a question`;
    case "follow_up_due":
      return `${fixtureId}: follow-up marked due`;
    case "propose_revision":
      return `${fixtureId}: new quote version proposed`;
    case "mark_lost":
      return `${fixtureId} marked lost`;
    case "decline":
      return `${fixtureId} declined, letter sent`;
    case "snooze":
      return `${fixtureId} snoozed`;
    case "note":
      return `Note added on ${fixtureId}`;
    case "correct_fact":
      return `Fact corrected on ${fixtureId}`;
    case "teach_enquiry":
      return `Learning proposed from ${fixtureId}`;
    case "reconnect":
      return `Calendar reconnected from ${fixtureId}`;
    case "reconnect_business":
      return "Calendar reconnected for the workspace";
    case "arrive":
      return "A new enquiry arrived";
    case "reschedule":
      return `Booking moved · ${fixtureId}`;
    case "cancel_booking":
      return `Taken off the diary · ${fixtureId}`;
    default:
      return `${fixtureId} · ${action.replaceAll("_", " ")}`;
  }
}

// Send approval stages (P3a S11a/S11b). Leaf module: it imports nothing,
// so the send-review screen can use the stage type without importing
// send.tsx — which would create a screens/send.tsx <->
// screens/send-review.tsx cycle (send.tsx renders SendReview). The cycle
// check (scripts/check-wallet-cycles.mjs) counts type-only imports as
// edges, so the type must live here, not in send.tsx.
export const SEND_APPROVAL_STAGES = [
  'review',
  'simulating',
  'signing',
  'signed',
  'broadcast-disabled',
] as const;

export type SendApprovalStage = (typeof SEND_APPROVAL_STAGES)[number];

export function canStartSigning(stage: SendApprovalStage): boolean {
  return stage === 'review';
}

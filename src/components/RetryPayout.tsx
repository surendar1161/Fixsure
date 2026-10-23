"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ActionButton } from "@/components/ActionButton";

export function RetryPayout({ jobId, email: initial }: { jobId: string; email: string }) {
  const [email, setEmail] = useState(initial);
  return (
    <div className="form">
      <p className="muted small">The capture worked but the payout did not. Retrying with the same email cannot pay twice.</p>
      <div className="field">
        <label htmlFor="payout-email">Technician PayPal email</label>
        <input id="payout-email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <ActionButton label="Retry payout" icon={<RefreshCw size={16} />} path={`/api/v1/jobs/${jobId}/payout/retry`} json={email ? { email } : {}} block />
    </div>
  );
}

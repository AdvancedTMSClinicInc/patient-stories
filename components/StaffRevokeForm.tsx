"use client";

import { useState } from "react";
import ActionButton from "./ActionButton";

/** For revocations that arrive by phone, email or mail. */
export default function StaffRevokeForm({ authorizationId }: { authorizationId: string }) {
  const [via, setVia] = useState("PHONE");
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <label className="visually-hidden" htmlFor={`via-${authorizationId}`}>
        Received by
      </label>
      <select id={`via-${authorizationId}`} value={via} onChange={(e) => setVia(e.target.value)} style={{ minHeight: 40, width: "auto", fontSize: 14 }}>
        <option value="PHONE">Phone</option>
        <option value="EMAIL">Email</option>
        <option value="MAIL">Mail</option>
      </select>
      <ActionButton
        url={`/api/staff/authorizations/${authorizationId}/revoke`}
        body={{ via }}
        className="btn btn-small btn-danger"
        label="Revoke"
        confirm="Log this revocation? The patient's video will be withdrawn and a takedown checklist created."
      />
    </div>
  );
}

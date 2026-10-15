"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Opt {
  value: string;
  label: string;
}
interface Props {
  facilities: { id: string; name: string }[];
  locations: { id: string; facilityId: string; name: string }[];
  services: Opt[];
  protocols: Opt[];
  today: string;
}

export default function InviteForm({ facilities, locations, services, protocols, today }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [picked, setPicked] = useState<string[]>(["TMS"]);
  const [purpose, setPurpose] = useState("BOTH");
  const [protocol, setProtocol] = useState("TMS_STANDARD");
  const [startDate, setStartDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; code: string; expiresAt: string } | null>(null);

  const locs = useMemo(() => locations.filter((l) => l.facilityId === facilityId), [locations, facilityId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/staff/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, email, facilityId, locationId: locationId || locs[0]?.id, services: picked, purpose, protocol, startDate }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; path?: string; code?: string; expiresAt?: string };
    setBusy(false);
    if (!res.ok || !data.path || !data.code) {
      setError(data.error ?? "Couldn't create the invitation.");
      return;
    }
    setResult({ link: `${window.location.origin}${data.path}`, code: data.code, expiresAt: data.expiresAt ?? "" });
    router.refresh();
  }

  if (result) {
    return (
      <section className="card" aria-live="polite">
        <h2>Invitation ready for {firstName}</h2>
        <p className="notice" style={{ margin: 0 }}>
          This is the only time the link and code are shown. Send them separately. (In this prototype nothing is sent
          automatically.)
        </p>
        <div className="field">
          <span className="label">Link</span>
          <span className="mono" style={{ fontSize: 14 }}>{result.link}</span>
        </div>
        <div className="field">
          <span className="label">Code</span>
          <span className="mono" style={{ fontSize: 24, letterSpacing: "0.2em" }}>{result.code}</span>
        </div>
        <span className="small muted">Expires {new Date(result.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <div className="row">
          <button type="button" className="btn btn-outline btn-small" onClick={() => navigator.clipboard?.writeText(result.link)}>
            Copy link
          </button>
          <button type="button" className="btn btn-outline btn-small" onClick={() => navigator.clipboard?.writeText(result.code)}>
            Copy code
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-navy btn-small"
            onClick={() => {
              setResult(null);
              setFirstName("");
              setLastName("");
              setPhone("");
              setEmail("");
            }}
          >
            New invitation
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New invitation</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Sample data only: use made-up names.
      </p>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="fn">First name</label>
          <input id="fn" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ln">Last name</label>
          <input id="ln" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ph">Mobile phone</label>
          <input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 010 0000" />
        </div>
        <div className="field">
          <label htmlFor="em">Email (optional)</label>
          <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fac">Facility</label>
          <select
            id="fac"
            value={facilityId}
            onChange={(e) => {
              setFacilityId(e.target.value);
              setLocationId("");
            }}
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="loc">Location</label>
          <select id="loc" value={locationId || locs[0]?.id || ""} onChange={(e) => setLocationId(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pur">Invite them to</label>
          <select id="pur" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="BOTH">Video story + journal</option>
            <option value="TESTIMONIAL">Video story only (link lasts 7 days)</option>
            <option value="JOURNAL">Journal only</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pro">Treatment plan</label>
          <select id="pro" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            {protocols.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sd">Treatment start date</label>
          <input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
      </div>
      <fieldset>
        <legend>Services</legend>
        <div className="row">
          {services.map((s) => (
            <label className="check" key={s.value} style={{ flex: "1 1 140px" }}>
              <input
                type="checkbox"
                checked={picked.includes(s.value)}
                onChange={() => setPicked((p) => (p.includes(s.value) ? p.filter((x) => x !== s.value) : [...p, s.value]))}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <button className="btn btn-navy" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Creating…" : "Create invitation"}
      </button>
    </form>
  );
}

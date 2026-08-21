"use client";

import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  CircleUserRound,
  Clock3,
  FileText,
  Link2,
  LogOut,
  MapPin,
  MessageCircle,
  ReceiptText,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { logoutAction } from "@/features/auth/actions";
import type { DispatcherIdentity } from "@/lib/domain/types";
import { jobStatusLabels } from "@/lib/i18n/is";
import type { JobTimelineCategory, JobTimelineEvent, JobTimelinePageData } from "./types";
import { formatTimelineDate } from "./timeline";

type TimelineFilter = "all" | JobTimelineCategory;

const filterLabels: Record<TimelineFilter, string> = {
  all: "Allt",
  job: "Verkefni",
  customer: "Viðskiptavinur",
  driver: "Þjónustuaðili",
  billing: "Uppgjör",
};

function EventIcon({ event }: { event: JobTimelineEvent }) {
  if (event.id.startsWith("photo-")) return <Camera size={17} />;
  if (event.id.startsWith("customer-link-")) return <Link2 size={17} />;
  if (event.id.startsWith("contact-")) return <MessageCircle size={17} />;
  if (event.id.startsWith("assignment-")) return <Truck size={17} />;
  if (event.category === "billing") return <ReceiptText size={17} />;
  if (event.category === "customer") return <UserRound size={17} />;
  if (event.category === "driver") return <Truck size={17} />;
  return <Route size={17} />;
}

interface TimelineWorkspaceProps {
  data: JobTimelinePageData;
  identity: DispatcherIdentity;
}

export function TimelineWorkspace({ data, identity }: TimelineWorkspaceProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const visibleEvents = useMemo(() => (
    filter === "all" ? data.events : data.events.filter((event) => event.category === filter)
  ), [data.events, filter]);

  const counts = useMemo(() => ({
    all: data.events.length,
    job: data.events.filter((event) => event.category === "job").length,
    customer: data.events.filter((event) => event.category === "customer").length,
    driver: data.events.filter((event) => event.category === "driver").length,
    billing: data.events.filter((event) => event.category === "billing").length,
  }), [data.events]);

  return (
    <main className="timeline-app">
      <header className="topbar timeline-topbar">
        <div className="brand-lockup"><span className="brand-mark"><MapPin size={22} /></span><span><strong>Vegstoð</strong><small>Ferill verkefnis</small></span></div>
        <nav className="timeline-nav" aria-label="Aðalleiðsögn">
          <Link href={`/?job=${data.job.id}`}><BriefcaseBusiness size={16} /> Aðgerðastjórn</Link>
          <Link href={`/billing?job=${data.job.id}`}><ReceiptText size={16} /> Uppgjör</Link>
        </nav>
        <div className="topbar-actions">
          <div className="identity"><CircleUserRound size={26} /><span><strong>{identity.displayName}</strong><small>{identity.email}</small></span></div>
          <form action={logoutAction}><button className="icon-button" type="submit" aria-label="Skrá út" title="Skrá út"><LogOut size={18} /></button></form>
        </div>
      </header>

      <div className="timeline-page-shell">
        <header className="timeline-hero">
          <div>
            <Link className="timeline-back-link" href={`/?job=${data.job.id}`}><ArrowLeft size={15} /> Til baka í verkefni</Link>
            <p className="eyebrow"><Activity size={13} /> Sameinaður ferill</p>
            <div className="timeline-title-row">
              <h1>{data.job.customerName}</h1>
              <span className={`status-pill job-status-${data.job.status}`}>{jobStatusLabels[data.job.status]}</span>
            </div>
            <p className="timeline-location"><MapPin size={15} /> {data.job.locationLabel}</p>
          </div>
          <div className="timeline-job-meta">
            <span><Clock3 size={15} /><small>Stofnað</small><strong>{formatTimelineDate(data.job.createdAt)}</strong></span>
            <span><FileText size={15} /><small>Verkefnisnúmer</small><code>{data.job.id.slice(0, 8)}</code></span>
          </div>
        </header>

        <section className="timeline-trust-note">
          <ShieldCheck size={19} />
          <div>
            <strong>Raunverulegur kerfisferill</strong>
            <p>Hér birtast skráðar aðgerðir úr verkefni, viðskiptavinatengli, úthlutun og uppgjöri. WhatsApp- og símaatburðir sýna að drög eða símatengill voru opnuð; ytri þjónustan staðfestir ekki sendingu eða samtal.</p>
          </div>
        </section>

        <section className="timeline-card">
          <header className="timeline-card-header">
            <div><h2>Atburðir</h2><p>{visibleEvents.length} af {data.events.length} atburðum</p></div>
            <div className="timeline-filters" role="group" aria-label="Sía feril">
              {(Object.keys(filterLabels) as TimelineFilter[]).map((value) => (
                <button
                  className={filter === value ? "timeline-filter-active" : ""}
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {filterLabels[value]} <b>{counts[value]}</b>
                </button>
              ))}
            </div>
          </header>

          {visibleEvents.length > 0 ? (
            <ol className="timeline-list">
              {visibleEvents.map((event) => (
                <li className={`timeline-event timeline-event-${event.category} timeline-event-${event.tone}`} key={event.id}>
                  <span className="timeline-event-icon"><EventIcon event={event} /></span>
                  <div className="timeline-event-copy">
                    <div><strong>{event.title}</strong><time dateTime={event.occurredAt}>{formatTimelineDate(event.occurredAt)}</time></div>
                    {event.description ? <p>{event.description}</p> : null}
                    {event.actorName ? <small><UserRound size={12} /> {event.actorName}</small> : <small>Kerfisatburður</small>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="timeline-empty"><Activity size={25} /><p>Engir atburðir passa við þessa síu.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}

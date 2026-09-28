import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoOperators } from "@/features/operators/demo-data";
import { demoJobMatches, demoJobs } from "./demo-data";
import { JobDetail } from "./job-detail";

vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({ assignJobAction: vi.fn(), updateJobStatusAction: vi.fn() }));
vi.mock("@/features/customer-intake/actions", () => ({
  createCustomerIntakeLinkAction: vi.fn(),
  revokeCustomerIntakeLinkAction: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

function renderJob(overrides: Partial<(typeof demoJobs)[number]>) {
  const job = { ...demoJobs[0], ...overrides };
  render(
    <JobDetail
      customerLink={null}
      demoMode
      job={job}
      matches={demoJobMatches}
      operators={demoOperators}
      whatsappReplies={[]}
      onChanged={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
}

describe("JobDetail layout", () => {
  it("shows the provider ranking before the assignment controls", () => {
    renderJob({ status: "new", intakePending: false, assignment: null });

    const ranking = screen.getByRole("heading", { name: "Röðun þjónustuaðila" });
    const assignment = screen.getByRole("heading", { name: "Úthlutun" });
    expect(ranking.compareDocumentPosition(assignment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("JobDetail vehicle summary", () => {
  it("shows the vehicle registration the customer submitted", () => {
    renderJob({ vehicleRegistration: "AB123" });

    expect(screen.getByText("Skráningarnúmer")).toBeInTheDocument();
    expect(screen.getByText("AB123")).toBeInTheDocument();
  });

  it("marks a missing registration as unregistered", () => {
    renderJob({ vehicleRegistration: null });

    expect(screen.getByText("Skráningarnúmer").nextElementSibling).toHaveTextContent("Óskráð");
  });
});

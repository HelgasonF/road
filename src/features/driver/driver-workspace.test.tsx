import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoJobs } from "@/features/jobs/demo-data";
import { demoOperators } from "@/features/operators/demo-data";
import { DriverWorkspace } from "./driver-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/auth/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/supabase/use-live-refresh", () => ({ useLiveRefresh: vi.fn() }));
vi.mock("./actions", () => ({ respondToDriverAssignmentAction: vi.fn(), setDriverAvailabilityAction: vi.fn(), updateDriverJobStatusAction: vi.fn() }));
vi.mock("./driver-map", () => ({ DriverMap: () => <div>Pickup map</div> }));
vi.mock("@/features/customer-intake/job-photo-gallery", () => ({ JobPhotoGallery: () => null }));
afterEach(cleanup);

describe("provider destination details", () => {
  it("shows the requested vehicle destination separately from pickup information", () => {
    render(<DriverWorkspace demoMode jobs={[{ ...demoJobs[1], destinationLabel: "Workshop in Keflavík" }]} operator={demoOperators[1]} />);
    expect(screen.getByText("Áfangastaður ökutækis")).toBeInTheDocument();
    expect(screen.getByText("Workshop in Keflavík")).toBeInTheDocument();
    expect(screen.getAllByText(demoJobs[1].locationLabel).length).toBeGreaterThan(0);
  });
  it("keeps jobs without a destination usable", () => {
    render(<DriverWorkspace demoMode jobs={[{ ...demoJobs[1], destinationLabel: null }]} operator={demoOperators[1]} />);
    expect(screen.queryByText("Áfangastaður ökutækis")).not.toBeInTheDocument();
    expect(screen.getByText("Pickup map")).toBeInTheDocument();
  });
});

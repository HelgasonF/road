import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManualWhatsAppMessage } from "./manual-message";

const props = { phone: "+442079460958", recipientName: "Customer", message: "Hello,\n\nhttps://vegstod.vercel.app/customer/secure-link\n\nHæ & + 10%" };
const writeText = vi.fn();
beforeEach(() => { writeText.mockResolvedValue(undefined); vi.stubGlobal("navigator", { userAgent: "Android", maxTouchPoints: 1, clipboard: { writeText } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function openSms() {
  const link = screen.getByRole("link", { name: "Opna SMS fyrir Customer" });
  link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(link);
  return link.getAttribute("href");
}

describe("customer SMS handoff", () => {
  it("keeps SMS opt-in so driver actions and their WhatsApp callbacks remain unchanged", () => {
    render(<ManualWhatsAppMessage {...props} onOpen={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /Opna SMS/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tilbúin WhatsApp-skilaboð")).toHaveValue(props.message);
  });

  it("opens an Android draft for the same message without reporting a WhatsApp send", async () => {
    const onOpen = vi.fn();
    render(<ManualWhatsAppMessage {...props} allowSms onOpen={onOpen} />);
    const sms = new URL(openSms()!);
    const whatsapp = new URL(screen.getByRole("link", { name: "Opna WhatsApp fyrir Customer" }).getAttribute("href")!);
    expect(sms.pathname).toBe(props.phone);
    expect(sms.searchParams.get("body")).toBe(whatsapp.searchParams.get("text"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Afrita skilaboð til Customer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("WhatsApp eða SMS");
    expect(writeText).toHaveBeenCalledWith(props.message);
  });

  it.each([
    ["iPhone", 1, "&"],
    ["iPad", 5, "&"],
    ["Macintosh", 5, "&"],
    ["Macintosh", 0, "?"],
    ["Android", 5, "?"],
  ])("handles %s with %s touch points", (userAgent, maxTouchPoints, separator) => {
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
    render(<ManualWhatsAppMessage {...props} allowSms />);
    expect(openSms()).toBe(`sms:${props.phone}${separator}body=${encodeURIComponent(props.message)}`);
  });

  it("keeps copying available for devices without a messaging app and for an invalid recipient", async () => {
    writeText.mockRejectedValueOnce(new Error("Clipboard unavailable"));
    render(<ManualWhatsAppMessage {...props} phone="invalid" allowSms />);
    expect(screen.queryByRole("link", { name: /Opna SMS/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Afrita skilaboð til Customer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("veldu textann handvirkt");
    expect(screen.getByLabelText("Tilbúin skilaboð")).toHaveValue(props.message);
  });

  it("hydrates the same markup on iPhone and adapts only when opening the SMS draft", async () => {
    const element = <ManualWhatsAppMessage {...props} allowSms />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    vi.stubGlobal("navigator", { userAgent: "iPhone", maxTouchPoints: 5 });
    const onRecoverableError = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    try {
      await act(async () => { root = hydrateRoot(container, element, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(openSms()).toBe(`sms:${props.phone}&body=${encodeURIComponent(props.message)}`);
    } finally {
      if (root) await act(() => root.unmount());
      container.remove();
    }
  });
});

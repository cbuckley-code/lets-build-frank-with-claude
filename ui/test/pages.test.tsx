/**
 * Page-level behaviour, driven through a fake Frank. These assert what ADR-003
 * actually promises: status on the Overview, and a form rendered from a tool's
 * schema on the Tools page.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App.js";
import Overview from "../src/pages/Overview.js";
import Tools from "../src/pages/Tools.js";
import { GET_STATUS_TOOL, SAMPLE_STATUS, createFakeClient } from "./fake-client.js";

describe("Overview", () => {
  it("shows Frank's version, uptime and greeting", async () => {
    render(<Overview client={createFakeClient()} />);

    expect(await screen.findByText(SAMPLE_STATUS.summary)).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
    expect(screen.getByText("1m 32s")).toBeTruthy();
    expect(screen.getByText(SAMPLE_STATUS.greeting)).toBeTruthy();
  });

  it("reports a healthy connection", async () => {
    render(<Overview client={createFakeClient()} />);
    expect(await screen.findByText("Connected")).toBeTruthy();
  });

  it("shows an error, not a blank page, when Frank is unreachable", async () => {
    render(<Overview client={createFakeClient({ failStatus: new Error("Failed to fetch") })} />);

    expect(await screen.findByText("Cannot reach Frank")).toBeTruthy();
    expect(screen.getByText("Failed to fetch")).toBeTruthy();
  });

  it("re-reads status when refreshed", async () => {
    const client = createFakeClient();
    render(<Overview client={client} />);
    await screen.findByText(SAMPLE_STATUS.summary);

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText(SAMPLE_STATUS.summary)).toBeTruthy());
  });
});

describe("Tools", () => {
  it("lists the tools Frank discovered", async () => {
    render(<Tools client={createFakeClient()} />);

    expect(await screen.findByText("get_status")).toBeTruthy();
    expect(screen.getByText("Get Frank's status")).toBeTruthy();
    expect(screen.getByText("Read-only")).toBeTruthy();
  });

  it("renders a form from the selected tool's input schema", async () => {
    render(<Tools client={createFakeClient()} />);
    await screen.findByText("get_status");

    await userEvent.click(screen.getByRole("radio"));

    // The field, its label and its description all come from the schema.
    expect(await screen.findByText("name — optional")).toBeTruthy();
    expect(
      screen.getByText("Who Frank should greet. Omit for a generic greeting."),
    ).toBeTruthy();
    expect(screen.getByText(/at most 100 characters/)).toBeTruthy();
  });

  it("calls the tool with what was typed and shows the JSON result", async () => {
    const client = createFakeClient();
    render(<Tools client={client} />);
    await screen.findByText("get_status");
    await userEvent.click(screen.getByRole("radio"));

    await userEvent.type(await screen.findByRole("textbox"), "the class");
    await userEvent.click(screen.getByRole("button", { name: /run tool/i }));

    await waitFor(() => expect(client.calls).toHaveLength(1));
    expect(client.calls[0]).toEqual({ name: "get_status", args: { name: "the class" } });

    const result = await screen.findByTestId("tool-result");
    expect(result.textContent).toContain('"version": "0.1.0"');
  });

  it("omits an untouched optional field from the call", async () => {
    const client = createFakeClient();
    render(<Tools client={client} />);
    await screen.findByText("get_status");
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(await screen.findByRole("button", { name: /run tool/i }));

    await waitFor(() => expect(client.calls).toHaveLength(1));
    expect(client.calls[0]?.args).toEqual({});
  });

  it("shows a required field's error instead of calling the tool", async () => {
    const client = createFakeClient({
      tools: [
        {
          name: "get_thing",
          title: "Get a thing",
          description: "Needs an id.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string", description: "Which thing." } },
            required: ["id"],
          },
        },
      ],
    });

    render(<Tools client={client} />);
    await screen.findByText("get_thing");
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(await screen.findByRole("button", { name: /run tool/i }));

    expect(await screen.findByText(/id is required/i)).toBeTruthy();
    expect(client.calls).toHaveLength(0);
  });

  it("surfaces a tool error as an error, not as a result", async () => {
    const client = createFakeClient({
      outcome: {
        isError: true,
        text: "Frank could not complete get_status: something went wrong.",
      },
    });

    render(<Tools client={client} />);
    await screen.findByText("get_status");
    await userEvent.click(screen.getByRole("radio"));
    await userEvent.click(await screen.findByRole("button", { name: /run tool/i }));

    expect(await screen.findByText(/something went wrong/)).toBeTruthy();
    expect(screen.queryByTestId("tool-result")).toBeNull();
  });

  it("says so when discovery fails", async () => {
    render(<Tools client={createFakeClient({ failList: new Error("Failed to fetch") })} />);
    expect(await screen.findByText("Could not list Frank's tools")).toBeTruthy();
  });

  it("handles a tool that takes no parameters", async () => {
    const client = createFakeClient({
      tools: [{ ...GET_STATUS_TOOL, inputSchema: { type: "object", properties: {} } }],
    });

    render(<Tools client={client} />);
    await screen.findByText("get_status");
    await userEvent.click(screen.getByRole("radio"));

    expect(await screen.findByText("This tool takes no parameters.")).toBeTruthy();
  });
});

describe("App shell", () => {
  it("opens on the Overview", async () => {
    render(<App client={createFakeClient()} />);
    expect(await screen.findByText(SAMPLE_STATUS.summary)).toBeTruthy();
  });

  it("switches to the Tools page from the side navigation", async () => {
    render(<App client={createFakeClient()} />);
    await screen.findByText(SAMPLE_STATUS.summary);

    const navigation = screen.getByRole("navigation");
    await userEvent.click(within(navigation).getByText("Tools"));

    expect(await screen.findByText("get_status")).toBeTruthy();
  });
});

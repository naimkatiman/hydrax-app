import { describe, expect, it, vi } from "vitest";
import {
  consoleSender,
  noopSender,
  createSmtpSender,
  type SmtpTransporterLike,
  type SmtpTransporterFactory,
} from "./email-sender.js";

describe("consoleSender", () => {
  it("logs the envelope to stdout", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    try {
      await consoleSender.send({ to: "a@a.test", subject: "S", text: "T" });
      expect(logs.find((l) => l.includes("[notify-svc:email]"))).toBeDefined();
      expect(logs[0]).toContain("To: a@a.test");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("noopSender", () => {
  it("resolves without any side effects", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    try {
      await noopSender.send({ to: "a@a.test", subject: "S", text: "T" });
      expect(logs).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("createSmtpSender", () => {
  it("forwards envelope to transporter.sendMail with FROM from config", async () => {
    const calls: Array<unknown> = [];
    const fakeTransporter: SmtpTransporterLike = {
      sendMail: async (input) => {
        calls.push(input);
        return { messageId: "<test>" };
      },
    };
    const factory: SmtpTransporterFactory = () => fakeTransporter;
    const sender = createSmtpSender(
      { host: "h", port: 587, secure: false, from: "alerts@hydrax.test" },
      factory,
    );

    await sender.send({ to: "a@a.test", subject: "S", text: "Hi" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      from: "alerts@hydrax.test",
      to: "a@a.test",
      subject: "S",
      text: "Hi",
    });
  });

  it("propagates transporter errors", async () => {
    const factory: SmtpTransporterFactory = () => ({
      sendMail: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:25");
      },
    });
    const sender = createSmtpSender(
      { host: "h", port: 25, secure: false, from: "x@x.test" },
      factory,
    );
    await expect(sender.send({ to: "a@a.test", subject: "S", text: "T" }))
      .rejects.toThrow(/ECONNREFUSED/);
  });

  it("only calls the factory once and reuses the transporter", async () => {
    let factoryCalls = 0;
    let sendCalls = 0;
    const factory: SmtpTransporterFactory = () => {
      factoryCalls += 1;
      return {
        sendMail: async () => {
          sendCalls += 1;
          return null;
        },
      };
    };
    const sender = createSmtpSender(
      { host: "h", port: 587, secure: false, from: "x@x.test" },
      factory,
    );
    await sender.send({ to: "a@a.test", subject: "S1", text: "T1" });
    await sender.send({ to: "b@b.test", subject: "S2", text: "T2" });
    expect(factoryCalls).toBe(1);
    expect(sendCalls).toBe(2);
  });
});

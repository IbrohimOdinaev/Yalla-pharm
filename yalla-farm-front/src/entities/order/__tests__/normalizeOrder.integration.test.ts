import { describe, expect, it } from "vitest";
import { normalizeOrder } from "@/entities/order/api";

describe("normalizeOrder", () => {
  it("maps orderPlacedAt to createdAtUtc", () => {
    const order = normalizeOrder({ orderId: "o1", status: 0, orderPlacedAt: "2026-03-22T10:00:00Z", cost: 100 });
    expect(order.createdAtUtc).toBe("2026-03-22T10:00:00Z");
  });

  it("maps numeric status to string", () => {
    expect(normalizeOrder({ orderId: "o1", status: 0, cost: 0 }).status).toBe("New");
    expect(normalizeOrder({ orderId: "o1", status: 1, cost: 0 }).status).toBe("UnderReview");
    expect(normalizeOrder({ orderId: "o1", status: 5, cost: 0 }).status).toBe("Delivered");
    expect(normalizeOrder({ orderId: "o1", status: 6, cost: 0 }).status).toBe("Cancelled");
  });

  it("keeps string status as-is", () => {
    expect(normalizeOrder({ orderId: "o1", status: "Ready", cost: 0 }).status).toBe("Ready");
  });

  it("maps numeric paymentState", () => {
    expect(normalizeOrder({ orderId: "o1", status: 0, cost: 0, paymentState: 0 }).paymentState).toBe("Confirmed");
    expect(normalizeOrder({ orderId: "o1", status: 0, cost: 0, paymentState: 1 }).paymentState).toBe("PendingManualConfirmation");
  });

  it("defaults currency to TJS", () => {
    expect(normalizeOrder({ orderId: "o1", status: 0, cost: 100 }).currency).toBe("TJS");
  });

  it("uses paymentCurrency if available", () => {
    expect(normalizeOrder({ orderId: "o1", status: 0, cost: 100, paymentCurrency: "USD" }).currency).toBe("USD");
  });

  it("normalizes positions with medicineTitle fallback", () => {
    const order = normalizeOrder({
      orderId: "o1", status: 0, cost: 100,
      positions: [{ positionId: "p1", medicineTitle: "Aspirin", quantity: 2, price: 50 }]
    });
    expect(order.positions?.length).toBe(1);
    expect(order.positions![0].medicine?.title).toBe("Aspirin");
  });

  it("normalizes positions with full medicine object", () => {
    const order = normalizeOrder({
      orderId: "o1", status: 0, cost: 100,
      positions: [{ positionId: "p1", medicineId: "m1", quantity: 3, price: 30, medicine: { id: "m1", title: "Para" } }]
    });
    expect(order.positions![0].medicineId).toBe("m1");
    expect(order.positions![0].medicine?.title).toBe("Para");
  });

  it("maps id to orderId if orderId missing", () => {
    expect(normalizeOrder({ id: "abc", status: 0, cost: 0 }).orderId).toBe("abc");
  });

  it("computes cost from positions when backend cost is 0", () => {
    const order = normalizeOrder({
      orderId: "o1", status: 0, cost: 0,
      positions: [
        { positionId: "p1", quantity: 2, price: 50, isRejected: false },
        { positionId: "p2", quantity: 1, price: 30, isRejected: false },
        { positionId: "p3", quantity: 1, price: 20, isRejected: true },
      ]
    });
    // 2×50 + 1×30 = 130 (rejected p3 excluded)
    expect(order.cost).toBe(130);
  });

  it("uses backend cost when it is > 0", () => {
    const order = normalizeOrder({
      orderId: "o1", status: 0, cost: 430,
      positions: [{ positionId: "p1", quantity: 10, price: 43 }]
    });
    expect(order.cost).toBe(430);
  });
});

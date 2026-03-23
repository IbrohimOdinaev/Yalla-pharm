import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/features/cart/model/cartStore";
import * as basketApi from "@/entities/basket/api";

vi.mock("@/entities/basket/api", () => ({
  getBasket: vi.fn(),
  addToBasket: vi.fn(),
  removeFromBasket: vi.fn(),
  updateBasketQuantity: vi.fn(),
  clearBasket: vi.fn()
}));

describe("cart store integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState({
      basket: {
        positions: [
          {
            id: "position-1",
            medicineId: "medicine-1",
            quantity: 1
          }
        ],
        pharmacyOptions: []
      },
      isLoading: false,
      error: null
    });
  });

  it("increases quantity for existing basket position instead of creating duplicate", async () => {
    vi.mocked(basketApi.updateBasketQuantity).mockResolvedValue({
      positions: [
        {
          id: "position-1",
          medicineId: "medicine-1",
          quantity: 2
        }
      ],
      pharmacyOptions: []
    });

    await useCartStore.getState().addItem("token", "medicine-1");

    expect(basketApi.updateBasketQuantity).toHaveBeenCalledTimes(1);
    expect(basketApi.updateBasketQuantity).toHaveBeenCalledWith("token", "position-1", 2);
    expect(basketApi.addToBasket).not.toHaveBeenCalled();
    expect(useCartStore.getState().basket.positions?.[0]?.quantity).toBe(2);
  });
});

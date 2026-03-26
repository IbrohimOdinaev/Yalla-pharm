import { describe, expect, it } from "vitest";
import {
  imageUrl,
  getMinimalImageUrl,
  getMainImageUrl,
  getGalleryImages,
  getCheapestPrice,
  getMedicineDisplayName,
  resolveMedicineImageUrl,
} from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";

const IMG_MAIN = { id: "img-main", isMain: true, isMinimal: false };
const IMG_MINIMAL = { id: "img-min", isMain: false, isMinimal: true };
const IMG_REGULAR1 = { id: "img-reg1", isMain: false, isMinimal: false };
const IMG_REGULAR2 = { id: "img-reg2", isMain: false, isMinimal: false };

const MEDICINE_FULL: ApiMedicine = {
  id: "m1",
  title: "Парацетамол",
  articul: "ART-001",
  images: [IMG_REGULAR1, IMG_MAIN, IMG_MINIMAL, IMG_REGULAR2],
  offers: [
    { pharmacyId: "p1", stockQuantity: 10, price: 25.00 },
    { pharmacyId: "p2", stockQuantity: 5, price: 15.50 },
    { pharmacyId: "p3", stockQuantity: 0, price: 30.00 },
  ],
  price: 20.00,
};

describe("imageUrl", () => {
  it("returns URL from id", () => {
    expect(imageUrl({ id: "abc" })).toContain("/api/medicines/images/abc/content");
  });
  it("prefers url over id", () => {
    expect(imageUrl({ id: "abc", url: "https://example.com/img.jpg" })).toBe("https://example.com/img.jpg");
  });
  it("returns empty for undefined", () => {
    expect(imageUrl(undefined)).toBe("");
  });
  it("returns empty for empty object", () => {
    expect(imageUrl({})).toBe("");
  });
});

describe("getMinimalImageUrl", () => {
  it("returns minimal image when available", () => {
    expect(getMinimalImageUrl(MEDICINE_FULL)).toContain("img-min");
  });
  it("falls back to main when no minimal", () => {
    const med: ApiMedicine = { id: "m", images: [IMG_MAIN, IMG_REGULAR1] };
    expect(getMinimalImageUrl(med)).toContain("img-main");
  });
  it("falls back to first when no minimal or main", () => {
    const med: ApiMedicine = { id: "m", images: [IMG_REGULAR1, IMG_REGULAR2] };
    expect(getMinimalImageUrl(med)).toContain("img-reg1");
  });
  it("returns empty when no images", () => {
    expect(getMinimalImageUrl({ id: "m", images: [] })).toBe("");
  });
  it("returns empty for undefined medicine", () => {
    expect(getMinimalImageUrl(undefined)).toBe("");
  });
});

describe("getMainImageUrl", () => {
  it("returns main image when available", () => {
    expect(getMainImageUrl(MEDICINE_FULL)).toContain("img-main");
  });
  it("falls back to first when no main", () => {
    const med: ApiMedicine = { id: "m", images: [IMG_REGULAR1] };
    expect(getMainImageUrl(med)).toContain("img-reg1");
  });
  it("returns empty when no images", () => {
    expect(getMainImageUrl({ id: "m", images: [] })).toBe("");
  });
});

describe("getGalleryImages", () => {
  it("returns main first, then regular, excludes minimal", () => {
    const gallery = getGalleryImages(MEDICINE_FULL);
    expect(gallery.length).toBe(3); // main + 2 regular, no minimal
    expect(gallery[0]).toContain("img-main");
    expect(gallery[1]).toContain("img-reg1");
    expect(gallery[2]).toContain("img-reg2");
    // minimal should NOT be in gallery
    expect(gallery.join(",")).not.toContain("img-min");
  });
  it("returns empty array for no images", () => {
    expect(getGalleryImages({ id: "m", images: [] })).toEqual([]);
  });
  it("handles medicine with only minimal image", () => {
    const med: ApiMedicine = { id: "m", images: [IMG_MINIMAL] };
    // minimal is excluded, no main or regular
    expect(getGalleryImages(med)).toEqual([]);
  });
  it("handles medicine with only main image", () => {
    const gallery = getGalleryImages({ id: "m", images: [IMG_MAIN] });
    expect(gallery.length).toBe(1);
    expect(gallery[0]).toContain("img-main");
  });
});

describe("getCheapestPrice", () => {
  it("returns cheapest offer price", () => {
    expect(getCheapestPrice(MEDICINE_FULL)).toBe(15.50);
  });
  it("falls back to medicine.price when no offers", () => {
    const med: ApiMedicine = { id: "m", price: 42, offers: [] };
    expect(getCheapestPrice(med)).toBe(42);
  });
  it("returns undefined when no price info", () => {
    expect(getCheapestPrice({ id: "m" })).toBeUndefined();
  });
  it("ignores zero-price offers", () => {
    const med: ApiMedicine = { id: "m", offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 0 }, { pharmacyId: "p2", stockQuantity: 3, price: 10 }] };
    expect(getCheapestPrice(med)).toBe(10);
  });

  it("prefers minPrice over offers", () => {
    const med: ApiMedicine = {
      id: "m1",
      minPrice: 8.50,
      offers: [{ pharmacyId: "p1", stockQuantity: 5, price: 15 }],
    };
    expect(getCheapestPrice(med)).toBe(8.50);
  });
});

describe("getMedicineDisplayName", () => {
  it("returns title first", () => {
    expect(getMedicineDisplayName({ id: "m", title: "Aspirin", name: "ASP" })).toBe("Aspirin");
  });
  it("falls back to name", () => {
    expect(getMedicineDisplayName({ id: "m", name: "ASP" })).toBe("ASP");
  });
  it("falls back to default", () => {
    expect(getMedicineDisplayName({ id: "m" })).toBe("Без названия");
  });
});

describe("resolveMedicineImageUrl (legacy)", () => {
  it("returns same as getMinimalImageUrl", () => {
    expect(resolveMedicineImageUrl(MEDICINE_FULL)).toBe(getMinimalImageUrl(MEDICINE_FULL));
  });
});

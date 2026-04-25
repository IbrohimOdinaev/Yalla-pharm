/**
 * Decode the payload of a JWT into the claims we care about. Pure
 * client-side base64url decode — does NOT validate the signature, so only
 * use the result for UI gating, never for security decisions.
 *
 * The backend issues role as a numeric enum (0=Client, 1=Admin, 2=SuperAdmin)
 * which we map to the corresponding string label.
 */

const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };

const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const NAMEID_CLAIM = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

export type JwtClaims = {
  role: string | undefined;
  userId: string | undefined;
  pharmacyId: string | undefined;
};

export function decodeJwt(token: string): JwtClaims {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as Record<string, unknown>;
    const rawRole = payload[ROLE_CLAIM];
    const role =
      typeof rawRole === "number" ? ROLE_MAP[rawRole]
      : typeof rawRole === "string" ? rawRole
      : undefined;
    const userId = (payload.sub as string | undefined) ?? (payload[NAMEID_CLAIM] as string | undefined);
    const pharmacyId = (payload.pharmacy_id as string | undefined) || undefined;
    return { role, userId, pharmacyId };
  } catch {
    return { role: undefined, userId: undefined, pharmacyId: undefined };
  }
}

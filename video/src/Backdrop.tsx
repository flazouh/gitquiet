import { AbsoluteFill } from "remotion";
import { GRADIENT, PAGE } from "@/palette";

/**
 * The page, and the one bright thing on it.
 *
 * acepe.dev's arrangement: a near-black field with a single pastel bed carrying the
 * screenshot. Copied rather than reinterpreted, because two products from the same
 * hand should be recognisable as such before either is named.
 *
 * The bed does not animate. It is a surface for two screens that are themselves
 * changing on measured timings, and a moving background would compete with the only
 * motion that carries a claim.
 */
export const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill style={{ background: PAGE, padding: 64, justifyContent: "center" }}>
      <div
        style={{
          background: GRADIENT,
          borderRadius: 28,
          padding: "48px 52px 44px",
          boxShadow: "0 40px 120px -40px rgba(183,155,255,0.45)",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

"use client";

import { useReveal } from "@/hooks/useReveal";
import { ContractLink } from "@/components/ContractLink";
import { PixelLogo } from "@/components/PixelLogo";
import { KEEPER_GUARD, VAULT_ADDRESSES } from "@/lib/chain";
import { GLYPH_GRID, KEY, PERCENT, ROBOT } from "@/lib/pixel-glyphs";
import type { PixelLogo as PixelLogoData } from "@/lib/pixel-logos";
import { ACTORS, PERMISSIONS, PERMISSION_CAPTION } from "@/lib/permissions";

/**
 * The three claims, carried over from the section this replaces.
 *
 * Deliberately compact here: they are the conclusions, and the matrix below is
 * what earns them. Given a whole card each with a 72px mark, as they had
 * before, they would outweigh the evidence.
 */
const CLAIMS: { glyph: PixelLogoData; title: string; body: string }[] = [
  {
    glyph: KEY,
    title: "Your keys",
    body: "Every position is yours. Withdrawals are permissionless and in-kind — your pro-rata slice comes back even when markets are closed.",
  },
  {
    glyph: ROBOT,
    title: "The keeper is on a leash",
    body: "It harvests and rebalances. Per-call size and slippage limits live on the guard contract, not in a promise.",
  },
  {
    glyph: PERCENT,
    title: "5% of gains only",
    body: "Charged above your high-water mark, and never on the deposit itself. Yield is real lending interest, not emissions.",
  },
];

/**
 * Who can do what to a vault, as a table.
 *
 * A table on purpose: the section above it is a flow diagram, and the five
 * sections that used to sit here were all grids of bordered text cards. The
 * shape is doing work.
 *
 * Nothing is positioned against a row count -- the matrix renders from
 * PERMISSIONS, so a row that cannot be supported by the Solidity is deleted
 * from that array and this component neither knows nor cares.
 */
export function TrustSection() {
  const { ref: root, seen } = useReveal<HTMLDivElement>();

  return (
    <section
      id="trust"
      className="px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto" ref={root}>
        <div className="text-sm font-semibold text-wire-cyan mb-3">
          Who can move your money
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-white mb-4 leading-tight">
          Read the permissions, not the promises.
        </h2>
        <p className="text-base text-wire-muted leading-relaxed max-w-2xl mb-9">
          Every way a vault&apos;s assets can move, and who is allowed to move
          them — taken from the deployed source, function by function. Where a
          cell is empty it is because no such function exists, not because one
          is guarded.
        </p>

        {/* The evidence. */}
        <div className="relative uni-card overflow-hidden">
          <div className="flex items-center gap-4 border-b border-wire-border px-5 sm:px-7 py-4 text-xs">
            <span className="font-semibold text-white">Permission map</span>
            <span className="ml-auto text-wire-muted whitespace-nowrap">
              BlurVault · KeeperGuard
            </span>
          </div>

          <div className="p-4 sm:p-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[620px]">
              <thead>
                <tr>
                  <th className="text-left" />
                  {ACTORS.map((a) => (
                    <th
                      key={a.key}
                      className="text-[13px] font-medium text-wire-muted text-center pb-4 px-2 border-b border-wire-border"
                    >
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row, i) => (
                  <tr
                    key={row.action}
                    className={seen ? "figure-in" : "opacity-0"}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <td className="text-[15px] font-medium text-white py-4 pr-5 border-b border-wire-border">
                      {row.action}
                    </td>
                    {ACTORS.map((a) => {
                      const yes = row.can.includes(a.key);
                      return (
                        <td
                          key={a.key}
                          className="text-center py-4 px-2 border-b border-wire-border"
                        >
                          <span
                            className={
                              yes
                                ? "text-wire-cyan text-xl glow-cyan"
                                : "text-white/15 text-xl"
                            }
                            title={yes ? "can" : "no such function"}
                          >
                            {yes ? "●" : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 pt-5 border-t border-wire-border">
              <div className="text-lg font-semibold text-white">
                {PERMISSION_CAPTION.lead}
              </div>
              <div className="text-[13px] text-wire-muted leading-relaxed mt-2.5 max-w-3xl">
                {PERMISSION_CAPTION.body}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-wire-border px-5 sm:px-8 py-4">
            {/* The two contracts the rows above are read off. Both are
                source-verified on Blockscout, so following either link lands
                on the code rather than on bytecode -- which is the whole
                claim this section makes. The guard verifies against 423d0b9^
                rather than HEAD, because it was deployed before that commit
                lowered the slippage ceiling; see contracts/DEPLOYMENTS.md. */}
            <span className="text-xs text-wire-muted/70">Verified source</span>
            <ContractLink
              address={VAULT_ADDRESSES.balanced}
              label="BlurVault"
              variant="bare"
            />
            <ContractLink
              address={KEEPER_GUARD}
              label="KeeperGuard"
              variant="bare"
            />
          </div>
        </div>

        {/* The conclusions, after the evidence rather than before it: the table
            is what earns them, so it reads first and these read as what it
            adds up to.

            No boxes. Three bordered cards under a bordered panel gave the
            section four frames in a row and made the summary compete with the
            thing it summarises; unboxed, it reads as the closing remark it
            is. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-12">
          {CLAIMS.map((c, i) => (
            <div
              key={c.title}
              className="flex flex-col items-start gap-5"
            >
              {/* Drawn in rather than simply present, once the section is
                  reached. Held at opacity 0 until then, or all three would have
                  finished drawing long before anyone scrolled this far. */}
              <PixelLogo
                logo={c.glyph}
                grid={GLYPH_GRID}
                size={80}
                className={
                  "text-wire-cyan shrink-0 drop-shadow-[0_0_16px_rgba(252,114,255,0.35)] " +
                  (seen ? "pixel-draw" : "opacity-0")
                }
                style={{ animationDelay: `${i * 220}ms` }}
              />
              <div>
                <div className="text-lg font-semibold text-white">{c.title}</div>
                <div className="text-sm text-wire-muted leading-relaxed mt-2.5">
                  {c.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

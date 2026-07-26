"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
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
    title: "YOUR KEYS",
    body: "Every position is yours. Withdrawals are permissionless and in-kind — your pro-rata slice comes back even when markets are closed.",
  },
  {
    glyph: ROBOT,
    title: "THE KEEPER IS ON A LEASH",
    body: "It harvests and rebalances. Per-call size and slippage limits live on the guard contract, not in a promise.",
  },
  {
    glyph: PERCENT,
    title: "5% OF GAINS ONLY",
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
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="trust"
      className="border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto" ref={root}>
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// WHO CAN MOVE YOUR MONEY"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-3 leading-snug">
          Read the permissions, not the promises.
        </h2>
        <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-2xl mb-9">
          Every way a vault&apos;s assets can move, and who is allowed to move
          them — taken from the deployed source, function by function. Where a
          cell is empty it is because no such function exists, not because one
          is guarded.
        </p>

        {/* The evidence. */}
        <div className="relative border border-wire-cyan/25 bg-black/25">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          <div className="flex items-center gap-4 border-b border-wire-cyan/20 px-5 sm:px-7 py-3.5 font-mono text-[11px] tracking-[0.26em] text-wire-muted">
            <span className="text-wire-cyan glow-cyan">▸ PERMISSION MAP</span>
            {/* Not mono, and not at this strip's tracking. Share Tech Mono at
                11px with 0.26em between the letters is legible as a label of
                four words in caps and not as two contract names in mixed case;
                the digits face carries them at a size that can be read. */}
            <span className="ml-auto font-digits text-sm tracking-normal text-wire-muted whitespace-nowrap">
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
                      className="font-mono text-[13px] font-normal text-wire-muted/80 tracking-[0.16em] text-center pb-4 px-2 border-b border-wire-cyan/25"
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
                    <td className="font-mono text-[15px] text-wire-cyan tracking-[0.1em] py-4 pr-5 border-b border-wire-cyan/10">
                      {row.action}
                    </td>
                    {ACTORS.map((a) => {
                      const yes = row.can.includes(a.key);
                      return (
                        <td
                          key={a.key}
                          className="text-center py-4 px-2 border-b border-wire-cyan/10"
                        >
                          <span
                            className={
                              yes
                                ? "text-wire-cyan text-xl [text-shadow:0_0_10px_rgba(214,254,81,0.65)]"
                                : "text-wire-cyan/15 text-xl"
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

            <div className="mt-6 pt-5 border-t border-wire-cyan/15">
              <div className="font-mono text-lg text-wire-cyan glow-cyan">
                {PERMISSION_CAPTION.lead}
              </div>
              <div className="font-mono text-[13px] text-wire-muted leading-relaxed mt-2.5 max-w-3xl">
                {PERMISSION_CAPTION.body}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-wire-cyan/20 px-5 sm:px-8 py-4">
            {/* The two contracts the rows above are read off. Both are
                source-verified on Blockscout, so following either link lands
                on the code rather than on bytecode -- which is the whole
                claim this section makes. The guard verifies against 423d0b9^
                rather than HEAD, because it was deployed before that commit
                lowered the slippage ceiling; see contracts/DEPLOYMENTS.md. */}
            <span className="font-mono text-[10px] text-wire-muted/70 tracking-[0.22em]">
              VERIFIED SOURCE
            </span>
            <ContractLink
              address={VAULT_ADDRESSES.balanced}
              label="BLURVAULT"
              variant="bare"
            />
            <ContractLink
              address={KEEPER_GUARD}
              label="KEEPERGUARD"
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
          {CLAIMS.map((c) => (
            <div
              key={c.title}
              className="flex flex-col items-start gap-5"
            >
              <PixelLogo
                logo={c.glyph}
                grid={GLYPH_GRID}
                size={80}
                className="text-wire-cyan shrink-0 drop-shadow-[0_0_16px_rgba(214,254,81,0.35)]"
              />
              <div>
                <div className="font-mono text-base text-wire-cyan glow-cyan tracking-[0.14em]">
                  {c.title}
                </div>
                <div className="font-mono text-[14px] text-wire-muted leading-relaxed mt-3">
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

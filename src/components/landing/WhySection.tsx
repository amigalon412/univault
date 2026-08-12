"use client";

import { useReveal } from "@/hooks/useReveal";
import { ContractLink } from "@/components/ContractLink";
import { KEEPER_GUARD, VAULT_ADDRESSES } from "@/lib/chain";
import { ACTORS, PERMISSIONS, PERMISSION_CAPTION } from "@/lib/permissions";
import { WHY_CARDS } from "@/lib/landing";

/**
 * The claims, and then the thing that earns them.
 *
 * Three cards reuse the corner-tick shell from How-it-works, but this grid has
 * no `id="steps"`, so <ScrollEffects /> leaves it alone and each card arrives
 * on its own `.reveal` instead of the staircase.
 *
 * Under them is the permission matrix, read off the deployed Solidity function
 * by function. It is the only table on the page and that is deliberate: every
 * other section is prose or diagram, so the shape itself says "this is the
 * evidence". Nothing is positioned against a row count — delete a row from
 * PERMISSIONS and this component neither knows nor cares.
 */
export function WhySection() {
  const { ref, seen } = useReveal<HTMLDivElement>();

  return (
    <section id="why">
      <div className="wrap">
        <div className="sec-head ctr reveal">
          <span className="eyebrow">{"// Why SAFEX"}</span>
          <h2>Read the permissions, not the promises</h2>
          <p>
            Rewards come from real lending and real market exposure, your shares stay at
            your address, and what automation may touch is bounded on-chain.
          </p>
        </div>

        <div className="steps" style={{ marginTop: 56 }}>
          {WHY_CARDS.map((card) => (
            <div className="step reveal" key={card.num}>
              <span className="tick tl" />
              <span className="tick tr" />
              <span className="tick bl" />
              <span className="tick br" />
              <div className="num">{card.num}</div>
              <h3 style={{ marginTop: 22 }}>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>

        <div className="matrix reveal" ref={ref}>
          <div className="matrix-head">
            <span className="matrix-title">Permission map</span>
            <span className="showcase-meta">Safex · KeeperGuard</span>
          </div>

          <div className="matrix-scroll">
            <table>
              <thead>
                <tr>
                  <th />
                  {ACTORS.map((a) => (
                    <th key={a.key}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row, i) => (
                  <tr
                    key={row.action}
                    className={seen ? "figure-in" : undefined}
                    style={seen ? { animationDelay: `${i * 55}ms` } : { opacity: 0 }}
                  >
                    <td>{row.action}</td>
                    {ACTORS.map((a) => {
                      const yes = row.can.includes(a.key);
                      return (
                        <td key={a.key} className="matrix-cell">
                          <span
                            className={yes ? "yes" : "no"}
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
          </div>

          <div className="matrix-caption">
            <strong>{PERMISSION_CAPTION.lead}</strong>
            <p>{PERMISSION_CAPTION.body}</p>
          </div>

          <div className="matrix-foot">
            <span className="ui-label">Verified source</span>
            <ContractLink
              address={VAULT_ADDRESSES.balanced}
              label="Safex"
              variant="chip"
            />
            <ContractLink address={KEEPER_GUARD} label="KeeperGuard" variant="chip" />
          </div>
        </div>
      </div>
    </section>
  );
}

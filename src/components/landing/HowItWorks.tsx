import { ContractLink } from "@/components/ContractLink";
import { HOW_STEPS } from "@/lib/landing";

/**
 * "How one deposit moves" — three corner-tick cards.
 *
 * Their entrance is the scroll staircase written by <ScrollEffects /> onto
 * `#steps > .step`: each card starts 70px lower than the one before and rises
 * into line as the group is scrolled toward. They deliberately carry no
 * `.reveal` class — that would fight the staircase for the same transform.
 *
 * Every step lists the contracts it actually touches. The claim this section
 * makes is that the wiring is checkable, so it has to be checkable from here.
 */
export function HowItWorks() {
  return (
    <section id="how">
      <div className="wrap">
        <div className="hiw-intro">
          <div className="reveal">
            <span className="eyebrow">{"// How it works"}</span>
            <h2>Money in, basket out</h2>
          </div>
          <div className="reveal">
            <p>
              UNIVAULT is an ERC-4626 vault and a guarded keeper working together. You
              deposit once; the vault lends, buys and rebalances on its own, and every
              box below opens the deployed contract it runs at.
            </p>
          </div>
        </div>

        <div className="steps" id="steps">
          {HOW_STEPS.map((step) => (
            <div className="step" key={step.num}>
              <span className="tick tl" />
              <span className="tick tr" />
              <span className="tick bl" />
              <span className="tick br" />

              <div className="num">{step.num}</div>

              <div className="art">
                <div className="step-plate">
                  <span className="step-caption">{step.caption}</span>
                </div>
              </div>

              <h3>{step.title}</h3>
              <p>{step.body}</p>

              <div className="step-links">
                {step.links.map((l) => (
                  <ContractLink
                    key={l.label}
                    address={l.address}
                    label={l.label}
                    variant="chip"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

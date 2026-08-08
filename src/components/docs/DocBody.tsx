import type { ReactNode } from "react";
import { getAddress } from "viem";
import { explorerAddressUrl } from "@/lib/chain";
import type { DocBlock } from "@/lib/docs";

const ADDRESS = /0x[0-9a-fA-F]{40}/g;

/**
 * Turns every contract address inside a table cell into an explorer link.
 *
 * Done here rather than by marking up each row because the contracts page is a
 * plain list of addresses and there is nothing to distinguish by hand: any
 * address in any table gets the treatment, including ones added later. It was
 * worth fixing — the one page whose whole job is listing contracts was the one
 * page with no way to reach the explorer from it.
 *
 * The address is lowercased before getAddress, so it computes a checksum rather
 * than validating one. That means a table written in either casing renders
 * identically, and a mis-cased entry cannot throw the docs page.
 *
 * The full address stays visible rather than the truncated form used elsewhere:
 * this is the page people copy from.
 */
function linkAddresses(cell: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;

  for (const match of cell.matchAll(ADDRESS)) {
    const at = match.index;
    if (at > last) out.push(cell.slice(last, at));
    const address = getAddress(match[0].toLowerCase());
    out.push(
      <a
        key={at}
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        /* nowrap so the ↗ cannot be orphaned onto a second line, which turned
           every row of the contracts table into a two-line row. The table is
           already inside overflow-x-auto, so a narrow viewport scrolls it. */
        className="doc-addr"
      >
        {address} ↗
      </a>,
    );
    last = at + match[0].length;
  }

  if (!out.length) return cell;
  if (last < cell.length) out.push(cell.slice(last));
  return out;
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="doc-p">{block.text}</p>
      );

    case "list":
      return (
        <ul className="doc-list">
          {block.items.map((item) => (
            <li key={item.text}>
              <span aria-hidden className="doc-bullet" />
              <span>
                {item.lead && <b>{item.lead} </b>}
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="doc-table card">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th
                    key={h}
                    className="ui-label"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={i === 0 ? "doc-td-key" : undefined}
                    >
                      {linkAddresses(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "code":
      return (
        /* A real monospace stack, not the site face. `font-mono` now resolves
           to Inter like everything else, and these blocks are ASCII flow
           diagrams whose columns have to line up. */
        <pre className="doc-code">
          {block.lines.join("\n")}
        </pre>
      );

    case "note":
      return (
        <div className="doc-note">
          <span aria-hidden>!</span>
          <p>{block.text}</p>
        </div>
      );
  }
}

export function DocBody({ blocks }: { blocks: DocBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

// A small, safe renderer for the assistant's answers: headings, lists, bold, links and simple tables.
// It builds React elements only. No raw HTML is ever inserted.
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function inline(text, key) {
  const parts = [];
  text.split(/(\*\*[^*]+\*\*|(?<![*\w])\*[^*\s][^*]*\*(?![*\w]))/g).forEach((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      parts.push(<strong key={`${key}b${i}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }
    if (/^\*[^*\s][^*]*\*$/.test(chunk)) {
      parts.push(<em key={`${key}i${i}`}>{chunk.slice(1, -1)}</em>);
      return;
    }
    chunk.split(URL_RE).forEach((piece, j) => {
      if (/^https?:\/\//.test(piece)) {
        parts.push(<a key={`${key}l${i}-${j}`} className="link break-all" href={piece} target="_blank" rel="noreferrer noopener">{piece}</a>);
      } else if (piece) {
        parts.push(piece);
      }
    });
  });
  return parts;
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      out.push(
        <div key={`t${i}`} className="my-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr>{head.map((h, k) => <th key={k} className="border-b border-mist-300 px-2 py-1 font-semibold dark:border-ink-700">{inline(h, `h${k}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, k) => <td key={k} className="border-b border-mist-200 px-2 py-1 dark:border-ink-800">{inline(c, `c${a}${k}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      out.push(<blockquote key={`q${i}`} className="my-2 border-l-4 border-steel-400 pl-3 italic muted">{inline(quote.join(' '), `q${i}`)}</blockquote>);
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(<p key={`h${i}`} className="mt-3 font-display text-base font-semibold">{inline(h[2], `h${i}`)}</p>);
      i += 1;
      continue;
    }

    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i += 1;
      }
      out.push(<ul key={`u${i}`} className="my-1 list-disc space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t, `li${i}${k}`)}</li>)}</ul>);
      continue;
    }

    out.push(<p key={`p${i}`} className="my-1">{inline(line, `p${i}`)}</p>);
    i += 1;
  }
  return <div className="space-y-0.5 text-sm leading-relaxed">{out}</div>;
}

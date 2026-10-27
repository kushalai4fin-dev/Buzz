// Tiny RSS / Atom reader with no dependencies.
// It only pulls out what Buzz stores: title, link, short description, date, author.
// Everything coming out of here is untrusted text and must be treated that way.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(input) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

// Turns a raw XML text node (maybe CDATA, maybe escaped HTML) into plain text.
export function cleanText(raw) {
  if (raw == null) return '';
  let text = String(raw).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = decodeEntities(text);
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' '); // drop script/style blocks including their contents
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, ' '); // strip HTML tags
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstTag(block, name) {
  const n = escapeRegExp(name);
  const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : null;
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)];
  let fallback = null;
  for (const [, attrs] of links) {
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!href) continue;
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i);
    if (!rel || rel[1].toLowerCase() === 'alternate') return decodeEntities(href[1]);
    if (!fallback) fallback = decodeEntities(href[1]);
  }
  return fallback;
}

export function parseFeed(xml) {
  if (typeof xml !== 'string' || xml.length === 0) {
    throw new Error('Empty response');
  }
  const head = xml.slice(0, 2000);
  if (/<!doctype\s+html|<html[\s>]/i.test(head)) {
    throw new Error('Got a web page instead of a feed');
  }
  const isRss = /<rss[\s>]/i.test(xml) || /<rdf:RDF[\s>]/i.test(xml);
  const isAtom = /<feed[\s>]/i.test(xml);
  if (!isRss && !isAtom) {
    throw new Error('Not an RSS or Atom feed');
  }

  const itemRe = isAtom && !isRss ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRe) || [];

  const items = blocks.map((block) => {
    let link;
    if (isAtom && !isRss) {
      link = atomLink(block);
    } else {
      const linkText = firstTag(block, 'link');
      link = linkText ? cleanText(linkText) : null;
      if (!link) {
        const guid = firstTag(block, 'guid');
        const guidText = guid ? cleanText(guid) : '';
        if (/^https?:\/\//i.test(guidText)) link = guidText;
      }
    }
    const description =
      firstTag(block, 'description') ?? firstTag(block, 'summary') ?? firstTag(block, 'content:encoded') ?? firstTag(block, 'content');
    const date =
      firstTag(block, 'pubDate') ?? firstTag(block, 'published') ?? firstTag(block, 'updated') ?? firstTag(block, 'dc:date');
    const author = firstTag(block, 'dc:creator') ?? firstTag(block, 'author');
    return {
      title: cleanText(firstTag(block, 'title')),
      link: link ? link.trim() : '',
      description: cleanText(description),
      date: date ? cleanText(date) : '',
      author: author ? cleanText(author) : '',
    };
  });

  return { format: isAtom && !isRss ? 'atom' : 'rss', items };
}

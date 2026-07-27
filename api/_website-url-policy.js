const dns = require('dns');
const net = require('net');

class WebsitePolicyError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function ipv4Number(address) {
  return address.split('.').reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inV4Range(value, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (ipv4Number(base) & mask);
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];

function expandIpv6(address) {
  let value = address.toLowerCase().split('%')[0];
  const mapped = value.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const n = ipv4Number(mapped[2]);
    value = `${mapped[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const fill = 8 - left.length - right.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const words = [...left, ...Array(fill).fill('0'), ...right].map((word) => Number.parseInt(word || '0', 16));
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff) ? words : null;
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    return !BLOCKED_V4.some(([base, bits]) => inV4Range(value, base, bits));
  }
  if (family !== 6) return false;
  const words = expandIpv6(address);
  if (!words) return false;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const mapped = `${words[6] >>> 8}.${words[6] & 255}.${words[7] >>> 8}.${words[7] & 255}`;
    return isPublicAddress(mapped);
  }
  const first = words[0];
  if (words.every((word) => word === 0) || words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return false;
  return !((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || (first & 0xffc0) === 0x2000);
}

function validateWebsiteUrl(input) {
  if (typeof input !== 'string' || !input || input.length > 2048) throw new WebsitePolicyError('invalid_url', 'Enter a valid public webpage URL.');
  let url;
  try { url = new URL(input); } catch { throw new WebsitePolicyError('invalid_url', 'Enter a valid public webpage URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new WebsitePolicyError('unsupported_scheme', 'Only HTTP and HTTPS webpages are supported.');
  if (url.username || url.password) throw new WebsitePolicyError('credentials_not_allowed', 'URLs containing credentials are not supported.');
  if (!url.hostname || url.hostname.endsWith('.') || url.hostname.includes('%')) throw new WebsitePolicyError('invalid_host', 'Enter a valid public webpage URL.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'localhost.localdomain') throw new WebsitePolicyError('unsafe_destination', 'That destination is not available.');
  const authority = input.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] || '';
  const rawHost = authority.replace(/^[^@]*@/, '').replace(/^\[([^\]]+)\](?::\d+)?$/, '$1').replace(/:\d+$/, '');
  if (net.isIP(hostname) && !net.isIP(rawHost)) throw new WebsitePolicyError('invalid_host', 'Alternative IP address formats are not supported.');
  if (net.isIP(hostname) && !isPublicAddress(hostname)) throw new WebsitePolicyError('unsafe_destination', 'That destination is not available.');
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  if ((url.protocol === 'https:' && port !== '443') || (url.protocol === 'http:' && port !== '80')) throw new WebsitePolicyError('port_not_allowed', 'That network port is not supported.');
  url.hash = '';
  return url;
}

async function resolvePublicAddresses(hostname, lookup = dns.promises.lookup) {
  if (net.isIP(hostname)) return [{ address: hostname, family: net.isIP(hostname) }];
  let answers;
  try { answers = await lookup(hostname, { all: true, verbatim: true }); } catch { throw new WebsitePolicyError('dns_failed', 'The webpage host could not be resolved.'); }
  if (!Array.isArray(answers) || !answers.length || answers.some(({ address }) => !isPublicAddress(address))) throw new WebsitePolicyError('unsafe_destination', 'That destination is not available.');
  return answers.map(({ address, family }) => ({ address, family: Number(family) || net.isIP(address) }));
}

module.exports = { WebsitePolicyError, validateWebsiteUrl, isPublicAddress, resolvePublicAddresses };

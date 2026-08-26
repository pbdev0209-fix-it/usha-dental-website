'use strict';
//
// Regenerates every derived file on the site from the articles that actually
// exist in /blog. Nothing here is hand-maintained, which is the point: add or
// remove an article file and the listings, the homepage and the sitemap all
// follow automatically.
//
// Regenerates:
//   blog.html    the full card grid, between the POSTS markers
//   index.html   the three newest cards, plus the 'Browse all N articles' label
//   sitemap.xml  every page on the site
//
// Article metadata is read back out of each article's own HTML rather than
// kept in a separate manifest, so the two can never drift apart.
//
// Run directly:  node scripts/update-indexes.js
//

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const SITE = 'https://pbdev0209-fix-it.github.io/usha-dental-website';
const IMG_Q = '?auto=format&amp;fit=crop&amp;w=800&amp;q=70';

// Categories that have a filter chip in blog.html. A post in any other
// category would still show, but could not be filtered to, so we warn.
const KNOWN_CATEGORIES = ['Symptoms', 'Prevention', 'Gum Health', 'Cosmetic', 'Treatments', 'Kids', 'Emergencies'];

// ---------------------------------------------------------------- helpers

function attr(s) {
  return String(s)
    .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function pick(re, html, fallback) {
  const m = html.match(re);
  return m ? m[1].trim() : fallback;
}

function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')) + '...';
}

function label(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Swaps the content between two marker comments. Throws loudly rather than
// silently doing nothing, because a silent no-op here would be invisible.
function replaceBetween(html, name, replacement) {
  const start = '<!-- ' + name + ':START -->';
  const end = '<!-- ' + name + ':END -->';
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i === -1 || j === -1) throw new Error('Markers ' + name + ' not found. Did someone delete the marker comments?');
  if (j < i) throw new Error('Markers ' + name + ' are in the wrong order.');
  return html.slice(0, i + start.length) + '\n' + replacement + '\n      ' + html.slice(j);
}

// ------------------------------------------------------- read the articles

function parseArticle(slug) {
  const html = fs.readFileSync(path.join(BLOG_DIR, slug + '.html'), 'utf8');
  const title = decode(stripTags(pick(/<h1>([\s\S]*?)<\/h1>/, html, slug)));
  const category = decode(stripTags(pick(/<span class="eyebrow">([\s\S]*?)<\/span>/, html, 'General')));
  const desc = decode(pick(/<meta name="description" content="([^"]*)"/, html, ''));
  const iso = pick(/"datePublished":\s*"([^"]+)"/, html, '1970-01-01');
  const lead = decode(stripTags(pick(/<p class="lead">([\s\S]*?)<\/p>/, html, desc)));
  const img = pick(/images\.unsplash\.com\/(photo-[a-z0-9-]+)/, html, 'photo-1606811971618-4486d14f3f99');
  const heroTag = pick(/(<img[^>]*images\.unsplash\.com[^>]*>)/, html, '');
  const alt = decode(pick(/alt="([^"]*)"/, heroTag, title));
  return { slug: slug, title: title, category: category, desc: desc, iso: iso, dateLabel: label(iso), lead: lead, img: img, alt: alt };
}

function readPosts() {
  const files = fs.readdirSync(BLOG_DIR).filter(function (f) { return f.endsWith('.html'); });
  const posts = files.map(function (f) { return parseArticle(f.replace('.html', '')); });
  // Newest first. Ties broken by slug so the output is deterministic and
  // the git diff stays clean between runs.
  posts.sort(function (a, b) {
    if (a.iso !== b.iso) return a.iso < b.iso ? 1 : -1;
    return a.slug < b.slug ? -1 : 1;
  });
  return posts;
}

// ------------------------------------------------------------ card markup

function blogCard(p, i) {
  const search = attr([p.title, p.category, p.lead].join(' '));
  return [
    '        <a class="card reveal" href="blog/' + p.slug + '.html" data-category="' + attr(p.category) + '" data-search="' + search + '" style="transition-delay:' + (i % 3) * 60 + 'ms">',
    '          <div class="thumb">',
    '            <img src="https://images.unsplash.com/' + p.img + IMG_Q + '" alt="' + attr(p.alt) + '" loading="lazy" width="800" height="500">',
    '            <span class="tag">' + attr(p.category) + '</span>',
    '          </div>',
    '          <div class="body">',
    '            <div class="date">' + attr(p.dateLabel) + '</div>',
    '            <h3>' + attr(p.title) + '</h3>',
    '            <p>' + attr(truncate(p.lead, 150)) + '</p>',
    '            <div class="more">Read more <i>&rarr;</i></div>',
    '          </div>',
    '        </a>'
  ].join('\n');
}

function homeCard(p) {
  return [
    '        <a class="blog-card reveal" href="blog/' + p.slug + '.html" style="text-decoration:none;color:inherit;display:block;overflow:hidden">',
    '          <div class="thumb" style="overflow:hidden;padding:0">',
    '            <img src="https://images.unsplash.com/' + p.img + IMG_Q + '" alt="' + attr(p.alt) + '" loading="lazy" width="800" height="500" style="width:100%;height:100%;object-fit:cover;display:block">',
    '          </div>',
    '          <div class="blog-card-body">',
    '            <span class="date">' + attr(p.category) + ' &middot; ' + attr(p.dateLabel) + '</span>',
    '            <h3>' + attr(p.title) + '</h3>',
    '            <p>' + attr(truncate(p.desc || p.lead, 140)) + '</p>',
    '            <span style="font-weight:700;color:#12545c">Read more &rarr;</span>',
    '          </div>',
    '        </a>'
  ].join('\n');
}

// --------------------------------------------------------------- sitemap

function sitemap(posts) {
  const staticPages = [
    { loc: '/', pri: '1.0', freq: 'weekly' },
    { loc: '/blog.html', pri: '0.9', freq: 'weekly' }
  ];
  const newest = posts.length ? posts[0].iso : new Date().toISOString().slice(0, 10);
  const rows = staticPages.map(function (s) {
    return ['  <url>', '    <loc>' + SITE + s.loc + '</loc>', '    <lastmod>' + newest + '</lastmod>',
      '    <changefreq>' + s.freq + '</changefreq>', '    <priority>' + s.pri + '</priority>', '  </url>'].join('\n');
  }).concat(posts.map(function (p) {
    return ['  <url>', '    <loc>' + SITE + '/blog/' + p.slug + '.html</loc>', '    <lastmod>' + p.iso + '</lastmod>',
      '    <changefreq>monthly</changefreq>', '    <priority>0.8</priority>', '  </url>'].join('\n');
  }));
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rows.join('\n'), '</urlset>', ''].join('\n');
}

// ------------------------------------------------------------------ main

function rebuildIndexes() {
  const posts = readPosts();
  if (!posts.length) throw new Error('No articles found in /blog. Refusing to blank the listings.');

  const unknown = posts.filter(function (p) { return KNOWN_CATEGORIES.indexOf(p.category) === -1; });
  unknown.forEach(function (p) {
    console.log('WARNING: ' + p.slug + ' is in category "' + p.category + '", which has no filter chip in blog.html. It will show in All topics but cannot be filtered to.');
  });

  // blog.html: the full grid.
  const blogPath = path.join(ROOT, 'blog.html');
  let blog = fs.readFileSync(blogPath, 'utf8');
  blog = replaceBetween(blog, 'POSTS', posts.map(blogCard).join('\n'));
  fs.writeFileSync(blogPath, blog);

  // index.html: three newest cards, and the count on the button.
  const indexPath = path.join(ROOT, 'index.html');
  let index = fs.readFileSync(indexPath, 'utf8');
  index = replaceBetween(index, 'HOME_POSTS', posts.slice(0, 3).map(homeCard).join('\n'));
  index = index.replace(/Browse all \d+ articles/g, 'Browse all ' + posts.length + ' articles');
  fs.writeFileSync(indexPath, index);

  // sitemap.xml: everything.
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(posts));

  console.log('Rebuilt indexes for ' + posts.length + ' articles.');
  console.log('  newest: ' + posts[0].slug + ' (' + posts[0].iso + ')');
  console.log('  oldest: ' + posts[posts.length - 1].slug + ' (' + posts[posts.length - 1].iso + ')');
  return posts;
}

module.exports = { rebuildIndexes: rebuildIndexes, readPosts: readPosts };

if (require.main === module) rebuildIndexes();

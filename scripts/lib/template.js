// Article template for the Dr. Usha Sribollineni dental blog.
//
// This is the single source of truth for article layout. Both the weekly
// agent and any manual post go through this function, so every article on
// the site stays visually and structurally identical.
//
// Expected shape of `d`:
//   slug       string   url slug, no extension        e.g. "why-does-my-jaw-click"
//   category   string   one of the blog.html filters  e.g. "Symptoms"
//   title      string   the h1 and <title>
//   date       string   human label                   e.g. "August 26, 2026"
//   iso        string   machine date                  e.g. "2026-08-26"
//   img        string   Unsplash photo id             e.g. "photo-1606811971618-4486d14f3f99"
//   alt        string   alt text for the hero image
//   desc       string   meta description, under 155 chars
//   keywords   string   comma separated
//   lead       string   opening paragraph, plain text
//   takeaways  string[] exactly 5 short sentences
//   related    string[] exactly 3 slugs that exist in /blog
//   faq        [q,a][]  4 or 5 pairs
//   body       string   the article HTML: h2/h3/p/ul/ol/table/.callout/.warn
//
// Returns a complete HTML document as a string.

/* eslint-disable */
function T(d) {
  const U = "https://images.unsplash.com/";
  const q = (w) => "?auto=format&amp;fit=crop&amp;w=" + w + "&amp;q=72";
  const base = "https://pbdev0209-fix-it.github.io/usha-dental-website/";
  const idx = JSON.parse(localStorage.getItem("postIndex"));

  const takeaways = d.takeaways.map(x => "        <li>" + x + "</li>").join("\n");

  const faq = d.faq.map(p => `      <div class="qa">
        <button type="button">` + p[0] + `</button>
        <div class="ans"><p>` + p[1] + `</p></div>
      </div>`).join("\n");

  const related = d.related.map(s => {
    const r = idx[s];
    return `        <a class="card reveal" href="` + s + `.html">
          <div class="thumb">
            <img src="` + U + r.i + q(700) + `" alt="` + r.a + `" loading="lazy" width="700" height="440">
            <span class="tag">` + r.c + `</span>
          </div>
          <div class="body">
            <div class="date">` + r.d + `</div>
            <h3>` + r.t + `</h3>
            <div class="more">Read more <i>&rarr;</i></div>
          </div>
        </a>`;
  }).join("\n");

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": d.title,
    "description": d.desc,
    "image": U + d.img + "?auto=format&fit=crop&w=1200&q=72",
    "datePublished": d.iso,
    "dateModified": d.iso,
    "articleSection": d.category,
    "inLanguage": "en-US",
    "mainEntityOfPage": { "@type": "WebPage", "@id": base + "blog/" + d.slug + ".html" },
    "author": {
      "@type": "Person",
      "name": "Usha Sribollineni",
      "honorificSuffix": "DDS",
      "jobTitle": "Dentist",
      "url": base,
      "worksFor": { "@type": "Dentist", "name": "Comfort Dental", "address": { "@type": "PostalAddress", "addressLocality": "Overland Park", "addressRegion": "KS", "addressCountry": "US" } }
    },
    "publisher": { "@type": "Person", "name": "Dr. Usha Sribollineni, DDS" }
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": d.faq.map(p => ({
      "@type": "Question",
      "name": p[0].replace(/<[^>]+>/g, ""),
      "acceptedAnswer": { "@type": "Answer", "text": p[1].replace(/<[^>]+>/g, "") }
    }))
  };

  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": base },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": base + "blog.html" },
      { "@type": "ListItem", "position": 3, "name": d.title }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>` + d.title + ` | Dr. Usha Sribollineni, DDS - Overland Park, KS</title>
<meta name="description" content="` + d.desc + `">
<meta name="keywords" content="` + d.keywords + `">
<meta name="author" content="Dr. Usha Sribollineni, DDS">
<meta name="robots" content="index, follow">
<meta name="article:published_time" content="` + d.iso + `">
<link rel="canonical" href="` + base + `blog/` + d.slug + `.html">

<meta property="og:type" content="article">
<meta property="og:title" content="` + d.title + `">
<meta property="og:description" content="` + d.desc + `">
<meta property="og:url" content="` + base + `blog/` + d.slug + `.html">
<meta property="og:image" content="` + U + d.img + `?auto=format&amp;fit=crop&amp;w=1200&amp;q=72">
<meta property="og:site_name" content="Dr. Usha Sribollineni, DDS">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="` + d.title + `">
<meta name="twitter:description" content="` + d.desc + `">

<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="../assets/blog.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A6%B7%3C/text%3E%3C/svg%3E">

<script type="application/ld+json">
` + JSON.stringify(ld, null, 1) + `
</script>
<script type="application/ld+json">
` + JSON.stringify(faqLd, null, 1) + `
</script>
<script type="application/ld+json">
` + JSON.stringify(crumbLd, null, 1) + `
</script>
</head>
<body>

<div id="progress" role="presentation"></div>

<header class="site-header">
  <div class="wrap hdr">
    <a class="brand" href="../index.html">
      <span class="mark" aria-hidden="true">&#129463;</span>
      <span>
        <b>Dr. Usha Sribollineni, DDS</b>
        <span>Comfort Dental &middot; Overland Park, KS</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Main navigation">
      <ul>
        <li><a href="../index.html#home">Home</a></li>
        <li><a href="../index.html#about">About</a></li>
        <li><a href="../index.html#services">Services</a></li>
        <li><a href="../blog.html" class="active">Blog</a></li>
        <li><a href="../index.html#faq">FAQ</a></li>
      </ul>
    </nav>
    <a class="btn btn-primary" href="../index.html#contact">Book a Visit</a>
  </div>
</header>

<main>

  <section class="hero">
    <div class="wrap narrow">
      <p class="crumbs"><a href="../index.html">Home</a> &nbsp;&rsaquo;&nbsp; <a href="../blog.html">Blog</a> &nbsp;&rsaquo;&nbsp; ` + d.category + `</p>
      <span class="eyebrow">` + d.category + `</span>
      <h1>` + d.title + `</h1>
    </div>
  </section>

  <article class="wrap narrow article">

    <div class="meta">
      <span class="who"><span class="av" aria-hidden="true">US</span> Dr. Usha Sribollineni, DDS</span>
      <span>MDS, Prosthodontics</span>
      <span>` + d.date + `</span>
      <span id="readTime">5 min read</span>
    </div>

    <div class="hero-img">
      <img src="` + U + d.img + q(1200) + `" alt="` + d.alt + `" width="1200" height="675">
    </div>

    <p class="lead">` + d.lead + `</p>

    <div class="takeaways">
      <h4>The short version</h4>
      <ul>
` + takeaways + `
      </ul>
    </div>

    <div class="prose">
` + d.body + `
    </div>

    <h2 style="margin-top:44px">Questions patients ask me about this</h2>
    <div class="faq">
` + faq + `
    </div>

    <div class="author-box">
      <div class="av" aria-hidden="true">US</div>
      <div>
        <h4>Dr. Usha Sribollineni, DDS</h4>
        <p class="role">Dentist &middot; MDS in Prosthodontics &middot; Licensed in Kansas</p>
        <p>Dr. Usha practises general and restorative dentistry at Comfort Dental in Overland Park, Kansas. Her specialist training in prosthodontics focuses on rebuilding and replacing teeth, and she writes here to give patients the same plain explanations she gives in the chair.</p>
      </div>
    </div>

    <div class="cta-band">
      <h3>Have a question about your own teeth?</h3>
      <p>Book a visit at Comfort Dental in Overland Park and let us take a proper look.</p>
      <a class="btn btn-white" href="../index.html#contact">Request an appointment</a>
    </div>

  </article>

  <section class="related">
    <div class="wrap">
      <h2>Keep reading</h2>
      <p class="sub">More plain-English answers from the blog.</p>
      <div class="post-grid">
` + related + `
      </div>
      <p style="text-align:center;margin-top:34px"><a class="btn btn-ghost" href="../blog.html">See all articles</a></p>
    </div>
  </section>

</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <h5>Dr. Usha Sribollineni, DDS</h5>
        <p style="margin:0;color:#c8d3dd">Dentist with an MDS in Prosthodontics, licensed in Kansas and practising at Comfort Dental in Overland Park.</p>
      </div>
      <div>
        <h5>Explore</h5>
        <ul>
          <li><a href="../index.html#home">Home</a></li>
          <li><a href="../index.html#about">About Dr. Usha</a></li>
          <li><a href="../index.html#services">Services</a></li>
          <li><a href="../blog.html">Blog</a></li>
          <li><a href="../index.html#contact">Contact</a></li>
        </ul>
      </div>
      <div>
        <h5>Popular topics</h5>
        <ul>
          <li><a href="tooth-sensitivity-cold.html">Tooth sensitivity</a></li>
          <li><a href="bleeding-gums.html">Bleeding gums</a></li>
          <li><a href="teeth-whitening-guide.html">Teeth whitening</a></li>
          <li><a href="dental-emergency-overland-park.html">Dental emergencies</a></li>
          <li><a href="kids-first-dentist-age.html">Children's teeth</a></li>
        </ul>
      </div>
      <div>
        <h5>Visit</h5>
        <ul>
          <li>Comfort Dental</li>
          <li>Overland Park, Kansas</li>
          <li><a href="../index.html#contact">Request an appointment</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <p>&copy; <span class="js-year">2026</span> Dr. Usha Sribollineni, DDS. All rights reserved.</p>
      <p>This article is general dental education, not personal medical advice. Please see a dentist about your own symptoms. In an emergency, call your dental office or seek urgent care.</p>
      <p>Dr. Sribollineni practises at a Comfort Dental location. This is her personal professional website and is not an official Comfort Dental corporate site.</p>
      <p>Photography courtesy of Unsplash contributors.</p>
    </div>
  </div>
</footer>

<button class="back-top" aria-label="Back to top">&uarr;</button>
<script src="../assets/blog.js" defer></script>
</body>
</html>
`;
}

module.exports = { article: T };

#!/usr/bin/env python3
"""Render the Switchboard markdown docs into styled site HTML pages.

Usage:  python site/render.py   (run from anywhere)
Requires: python-markdown  (pip install markdown)

Renders the four docs from ../docs plus the repo-root ROADMAP.md into <name>.html
in this folder (site/), sharing docs.css. Each page is a two-column docs layout:
a left-rail nav (the pages, with the active page's section anchors nested under
it) and a prose column. Cross-links between the docs (foo.md) are rewritten to
foo.html so navigation stays on the site; links into repo source (agents/*,
skills/*, other *.md) are rewritten to GitHub.
"""
import os
import re
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, ".."))
GH = "https://github.com/cogghaus/switchboard/blob/main/"

# out-file -> (nav label, meta description, source markdown path)
DOCS = {
    "usage.html":   ("Usage",           "The Switchboard orchestrator workflow, direct vs delegate, a worked example.", os.path.join(REPO, "docs", "usage.md")),
    "agents.html":  ("Agents",          "The Switchboard specialist roster, one entry per agent.",                      os.path.join(REPO, "docs", "agents.md")),
    "skills.html":  ("Skills",          "The four skills that drive the Switchboard roster.",                           os.path.join(REPO, "docs", "skills.md")),
    "install.html": ("Install & setup", "Install, share, theme, and wire Switchboard into a project.",                 os.path.join(REPO, "docs", "install.md")),
    "roadmap.html": ("Roadmap",         "The Switchboard roadmap: ranked skill and feature backlog, and how to vote.", os.path.join(REPO, "ROADMAP.md")),
}
INSITE = {"usage.md", "agents.md", "skills.md", "install.md"}
NAV = [("usage.html", "Usage"), ("agents.html", "Agents"), ("skills.html", "Skills"),
       ("install.html", "Install"), ("roadmap.html", "Roadmap")]

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} · Switchboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="docs.css">
</head>
<body>
<div class="layout">
<aside class="sidebar">
<a class="brand" href="index.html"><span class="dot"></span>Switchboard</a>
<nav class="docnav">
<div class="navtitle">Documentation</div>
{nav}
</nav>
<div class="sidebar-foot"><a href="index.html">Home</a> · <a href="https://github.com/cogghaus/switchboard">GitHub</a> · MIT</div>
</aside>
<main class="prose">
{body}
</main>
</div>
</body>
</html>
"""


def rewrite_link(href):
    if href.startswith(("http://", "https://", "#", "mailto:")):
        return href
    if href in INSITE:
        return href[:-3] + ".html"
    if href.endswith(".md") or href.startswith(("agents/", "skills/", "docs/")):
        return GH + href
    return href


def extract_sections(html):
    """Return [(id, text)] for each H2 in the rendered doc (toc gives them ids)."""
    out = []
    for m in re.finditer(r'<h2 id="([^"]+)">(.*?)</h2>', html, re.S):
        text = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        out.append((m.group(1), text))
    return out


def build_nav(active_html, sections):
    lines = []
    for href, label in NAV:
        active = href == active_html
        lines.append('<a href="%s"%s>%s</a>' % (href, ' class="active"' if active else "", label))
        if active:
            for sid, text in sections:
                lines.append('<a class="sub" href="#%s">%s</a>' % (sid, text))
    return "\n".join(lines)


def render(out_name):
    title, desc, src = DOCS[out_name]
    with open(src, encoding="utf-8") as fh:
        text = fh.read()
    html = markdown.markdown(text, extensions=["extra", "sane_lists", "toc"])
    html = re.sub(r'href="([^"]+)"', lambda m: 'href="%s"' % rewrite_link(m.group(1)), html)
    open_tag = '<table class="roster">' if out_name == "agents.html" else "<table>"
    html = html.replace("<table>", '<div class="table-wrap">' + open_tag).replace("</table>", "</table></div>")
    nav = build_nav(out_name, extract_sections(html))
    page = PAGE.format(title=title, desc=desc, nav=nav, body=html)
    with open(os.path.join(HERE, out_name), "w", encoding="utf-8") as fh:
        fh.write(page)
    return out_name


if __name__ == "__main__":
    for name in DOCS:
        print("rendered", render(name))

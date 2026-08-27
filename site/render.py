#!/usr/bin/env python3
"""Render the Switchboard markdown docs into styled site HTML pages.

Usage:  python site/render.py   (run from anywhere)
Requires: python-markdown  (pip install markdown)

Reads the markdown sources from ../docs and writes <name>.html into this folder
(site/), sharing docs.css. Each page is a two-column docs layout: a left-rail
nav (the four docs, with the active doc's section anchors nested under it) and a
prose column. Cross-links between the docs (foo.md) are rewritten to foo.html so
navigation stays on the site; links into repo source (agents/*, skills/*, other
*.md) are rewritten to GitHub.
"""
import os
import re
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
MD_DIR = os.path.normpath(os.path.join(HERE, "..", "docs"))
GH = "https://github.com/cogghaus/switchboard/blob/main/"
DOCS = {
    "usage.md":   ("Usage",           "The Switchboard orchestrator workflow, direct vs delegate, a worked example."),
    "agents.md":  ("Agents",          "The Switchboard specialist roster, one entry per agent."),
    "skills.md":  ("Skills",          "The four skills that drive the Switchboard roster."),
    "install.md": ("Install & setup", "Install, share, theme, and wire Switchboard into a project."),
}
INSITE = {"usage.md", "agents.md", "skills.md", "install.md"}
# Left-rail order: the docs home is Usage; Home returns to the landing page.
NAV = [("usage.html", "Usage"), ("agents.html", "Agents"),
       ("skills.html", "Skills"), ("install.html", "Install")]

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


def render(md_name):
    title, desc = DOCS[md_name]
    with open(os.path.join(MD_DIR, md_name), encoding="utf-8") as fh:
        text = fh.read()
    html = markdown.markdown(text, extensions=["extra", "sane_lists", "toc"])
    html = re.sub(r'href="([^"]+)"', lambda m: 'href="%s"' % rewrite_link(m.group(1)), html)
    html = html.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
    out_name = md_name[:-3] + ".html"
    nav = build_nav(out_name, extract_sections(html))
    page = PAGE.format(title=title, desc=desc, nav=nav, body=html)
    with open(os.path.join(HERE, out_name), "w", encoding="utf-8") as fh:
        fh.write(page)
    return out_name


if __name__ == "__main__":
    for name in DOCS:
        print("rendered", render(name))

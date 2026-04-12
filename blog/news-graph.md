---
slug: news-graph
title: News Source Network Graph
date: 2023-06-15
category: project
tags: NetworkX, Gephi, NLP
url: https://github.com/arianayekrangi/news-graph
description: Maps citation networks between 500+ European news outlets across five languages.
image: 
---

A network analysis of citation patterns between 500+ European
news outlets in English, Finnish, Swedish, French, and German.
Built to understand how information flows across the European
media ecosystem.

## The Question

When a story breaks in Helsinki, how long does it take to appear
in Paris? Which outlets function as hubs, amplifying stories
across language boundaries? Which exist in isolated clusters,
citing only themselves?

## Methodology

- RSS ingestion across 500+ outlets, running continuously for 90 days
- URL extraction and normalisation from article bodies
- Graph construction in NetworkX (nodes: outlets, edges: citations)
- Community detection using Louvain clustering
- Visualisation in Gephi

## Findings

The European media ecosystem is more fragmented than it looks.
Language boundaries are stronger predictors of citation patterns
than political alignment or geography.

English-language outlets function as a relay layer — stories
often travel: national language → English outlet → other national
language, rather than directly between languages.

## Open Data

The graph data (anonymised at outlet level) is available for download.
The collection scripts are open source.

Stack: Python · feedparser · NetworkX · Gephi · NLP (spaCy)

---
Type 'projects' to return to the list.

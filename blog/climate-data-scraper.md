---
slug: climate-data-scraper
title: How We Scraped 10 Years of Climate Policy Records
date: 2023-11-05
category: journalism
tags: data, Python, FOIA
url: climate-data-scraper
description: How we scraped ten years of climate policy records to investigate the gap between government commitments and action.
image: 
---

In 2023, Reuters commissioned an investigation into the gap between
European countries' stated climate commitments and their actual
legislative records. The dataset didn't exist. We built it.

## The Source Problem

Ten years of climate policy spans dozens of legislative sessions,
hundreds of documents, and multiple document management systems —
most of which were designed for archival, not analysis.

We filed freedom of information requests in eleven countries. We
received eight responses. Three were complete refusals.

## The Technical Approach

For the records we could access:

- PDF scraping using pdfplumber for machine-readable documents
- OCR via Tesseract for scanned parliamentary records
- Named entity recognition to tag legislation, dates, commitments
- A manual review layer for anything the NER flagged as uncertain

Total pipeline: 22,000 documents, processed over three weeks.

## What the Analysis Found

The gap between stated commitment and legislative action was
consistent across party lines. Countries that signed ambitious
international agreements often passed enabling legislation
years later, or not at all.

The data told a story of institutional inertia that was harder
to dismiss than any individual anecdote.

---
Type 'work' to return to the list.

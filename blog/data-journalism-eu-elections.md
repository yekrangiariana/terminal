---
slug: data-journalism-eu-elections
title: Mapping the EU Elections: A Data Story
date: 2024-06-10
category: journalism
tags: data journalism, elections, D3.js
url: data-journalism-eu-elections
description: How we built a data pipeline to ingest EU election results from 27 countries within six hours of polls closing.
image: 
---

The 2024 European Parliament elections produced the most geographically
fragmented result in the institution's history. To tell that story, we
built a data pipeline that ingested results from 27 national electoral
commissions within six hours of polls closing.

## The Data Problem

No single source publishes EU election results in a unified format.
Each member state uses different schemas, different field names, and
different levels of granularity. Germany reports by constituency.
France reports by department. Cyprus reports nationally.

We wrote collection scripts for each country and ran them in parallel,
normalising into a single schema:

- candidate_id, party_id, country_code
- votes_raw, votes_pct, seats_won
- region_id (where available)

## The Visualisation

We chose D3.js for the interactive maps — primarily because of its
projection support. Getting the electoral geography of 27 countries
into a coherent, comparable visual took more iteration than the
data collection.

The final piece showed:

- Seat shifts by country (bump chart)
- Regional swing maps for Germany, France, Poland
- A coalition calculator for the new Parliament

## What the Data Said

The far-right gained seats in every country where it was competitive.
The centre held, but only just. The Greens collapsed in Germany.

The story the numbers told was about geography: urban-rural divides
now structure European politics more than they did in 2019.

---
Type 'work' to return to the list.

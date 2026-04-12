oka---
slug: parliament-tracker
title: EU Parliament Vote Tracker
date: 2023-09-01
category: project
tags: Python, SQLite, D3.js
url: https://github.com/arianayekrangi/parliament-tracker
description: Scrapes and visualises every European Parliament vote since 2019.
image: 
---

A tool that scrapes, stores, and visualises every European Parliament
vote since the 2019 election. Built for journalists and researchers
who need to track how MEPs vote on specific legislation.

## Why It Exists

The European Parliament publishes voting records, but not in a form
that's easy to query across time. Searching for how a particular MEP
voted on climate legislation across five years requires either a
researcher with too much time, or a database.

## How It Works

- Python scraper runs nightly against the EP's open data API
- Results stored in SQLite (lightweight, portable, no server needed)
- D3.js visualisation layer for exploration
- Exportable as CSV for journalists who prefer spreadsheets

## What You Can Do With It

- Track any MEP's voting record over time
- Compare party cohesion on specific policy areas
- Filter by country, party group, or policy domain
- Identify outliers — MEPs who vote against their group

## Status

Active. Updated nightly. Open source.

Stack: Python · requests · SQLite · D3.js · vanilla JS

---
Type 'projects' to return to the list.

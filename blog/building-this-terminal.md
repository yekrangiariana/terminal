---
slug: building-this-terminal
title: Building This Terminal
date: 2026-01-10
category: writing
tags: web, design, philosophy
url: building-this-terminal
description: Why I built a terminal-style personal site, and what that choice says about how I think about the web.
image: 
---

I wanted a personal site that didn’t feel like a personal site.

Every template I looked at assumed the same things: a hero section,
a grid of projects, a contact form. They were fine. They were also
exactly what everyone else had.

## The Idea

Terminals are honest. They don’t have hover states or micro-animations
or gradients that shift depending on the time of day. They have a
prompt, and they wait.

I liked that. I wanted something that required the visitor to
do something — to type, to explore, to be slightly uncertain
about what was going to happen next.

## How It Works

- Plain HTML, CSS, and JavaScript. No framework.
- Commands are registered in a central object.
- Blog posts are Markdown files fetched at runtime.
- Arrow key navigation renders navigable box lists.
- Tab completes partial commands like a real shell.

## What I Learned

The hardest part was not the code. It was deciding what the
interface should feel like. Too much explanation and it becomes
a tutorial. Too little and it’s frustrating.

The prompt is the right metaphor. It implies that something is
waiting. That the system is ready. That what happens next
depends on you.

---
Type 'blog' to return to the post list.

# firecrawl

CLI for web scraping, searching, crawling and AI-powered data extraction.

## Quick Start

```bash
firecrawl https://example.com
```

## scrape

Extract content from any webpage. Supports multiple URLs and formats.

```bash
firecrawl https://example.com
firecrawl scrape https://example.com --html
firecrawl https://example.com --format markdown,links,images
firecrawl https://example.com -o output.md
firecrawl scrape https://example.com https://example.com/blog
```

### Useful options
- `--format` — markdown, html, links, images, screenshot, summary, json, etc.
- `--only-main-content`
- `--wait-for <ms>`
- `--screenshot`, `--full-page-screenshot`
- `--include-tags`, `--exclude-tags`
- `--schema`, `--actions`
- `-o, --output`

### Examples
```bash
firecrawl https://blog.example.com --only-main-content
firecrawl https://spa-app.com --wait-for 3000
firecrawl https://example.com --format links
firecrawl https://example.com --format markdown --screenshot
firecrawl https://example.com --include-tags article,main
firecrawl https://example.com --exclude-tags nav,aside,.ad
```

## search

Search the web and optionally scrape results.

```bash
firecrawl search "firecrawl"
firecrawl search "AI news" --limit 10
firecrawl search "tech startups" --sources news
firecrawl search "machine learning" --sources web,news,images
firecrawl search "web data python" --categories github
firecrawl search "transformer architecture" --categories research
firecrawl search "AI announcements" --tbs qdr:d
firecrawl search "restaurants" --location "San Francisco,California,United States"
firecrawl search "firecrawl tutorials" --scrape --scrape-formats markdown,links
```

## map

Discover all URLs on a website.

```bash
firecrawl map https://example.com
firecrawl map https://example.com --search "blog"
firecrawl map https://example.com --limit 500
firecrawl map https://example.com --sitemap only
firecrawl map https://example.com --include-subdomains --limit 1000
firecrawl map https://shop.example.com --search "product" -o urls.txt
```

## crawl

Crawl multiple pages from a website.

```bash
firecrawl crawl https://example.com
firecrawl crawl https://example.com --wait --progress
firecrawl crawl https://example.com --limit 100 --max-depth 3
firecrawl crawl https://example.com --include-paths /blog,/posts
firecrawl crawl https://example.com --exclude-paths /admin,/login
firecrawl crawl https://example.com --delay 1000 --max-concurrency 2
firecrawl crawl https://example.com --limit 1000 --max-depth 10 --wait -o results.json --pretty
```

## agent

AI-powered autonomous extraction using natural language prompts.

```bash
firecrawl agent "Find the pricing plans for Firecrawl"
firecrawl agent "Extract all product names and prices" --wait
firecrawl agent "Get the main features listed" --urls https://example.com/features
firecrawl agent "Extract company info" --schema '{"type":"object","properties":{"name":{"type":"string"}}}'
firecrawl agent "Extract product data" --schema-file ./product-schema.json --wait
firecrawl agent "Find top 5 competitors and pricing" --wait --timeout 300
firecrawl agent "Get all blog post titles and dates" --urls https://blog.example.com --max-credits 100 --wait
```

## interact

Scrape then interact with a live browser session using prompts or code.

```bash
firecrawl scrape https://example.com
firecrawl interact "Click the pricing tab"
firecrawl interact "Fill in the email field with test@example.com"
firecrawl interact "Extract the pricing table"
firecrawl interact -c "await page.title()"
firecrawl interact -c "print(await page.title())" --python
firecrawl interact stop
```

### Profiles (persist login state)

```bash
firecrawl scrape "https://app.example.com/login" --profile my-app
firecrawl interact "Fill in email and click login"
firecrawl scrape "https://app.example.com/dashboard" --profile my-app
firecrawl interact "Extract the dashboard data"
```

## Output & piping

```bash
firecrawl https://example.com | head -50
firecrawl https://example.com --format links | jq '.links[].url'
firecrawl https://example.com | pandoc -o document.pdf
firecrawl https://example.com | grep -i "keyword"
```

## Status & config

```bash
firecrawl --status
firecrawl config --api-url https://firecrawl.mycompany.com
firecrawl view-config
firecrawl credit-usage
```

Use `firecrawl` for fast web data extraction, crawling, and AI-assisted scraping.

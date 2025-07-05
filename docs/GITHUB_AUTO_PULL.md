# GitHub Auto Pull via RSS/Atom Feed Monitoring

This document describes how to automatically trigger workflows in this repository when new releases are published in external repositories using GitHub's built-in RSS/Atom feeds.

## Overview

GitHub automatically provides RSS/Atom feeds for repository releases at:
- `https://github.com/owner/repo/releases.atom`
- `https://github.com/owner/repo/tags.atom`

This approach monitors these feeds without requiring any cooperation from the external repository.

## Implementation

### Basic RSS Feed Monitor

```yaml
name: Monitor Upstream Releases
on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours
  workflow_dispatch:

jobs:
  check-releases:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Get latest release
        id: get-release
        run: |
          LATEST=$(curl -s https://github.com/dfpc-coe/CloudTAK/releases.atom | \
                   grep -o '<title>[^<]*</title>' | head -2 | tail -1 | \
                   sed 's/<[^>]*>//g')
          echo "latest_release=$LATEST" >> $GITHUB_OUTPUT
          
      - name: Check if new release
        id: check-new
        run: |
          mkdir -p .github/cache
          PREV=$(cat .github/cache/last_release.txt 2>/dev/null || echo "")
          CURRENT="${{ steps.get-release.outputs.latest_release }}"
          
          if [ "$CURRENT" != "$PREV" ] && [ -n "$CURRENT" ]; then
            echo "is_new=true" >> $GITHUB_OUTPUT
            echo "$CURRENT" > .github/cache/last_release.txt
          fi
          
      - name: Commit cache update
        if: steps.check-new.outputs.is_new == 'true'
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .github/cache/last_release.txt
          git commit -m "Update last release cache" || exit 0
          git push
          
      - name: Trigger sync workflow
        if: steps.check-new.outputs.is_new == 'true'
        run: |
          echo "New release detected: ${{ steps.get-release.outputs.latest_release }}"
          # Trigger your sync/deployment workflow here
          gh workflow run sync-upstream.yml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Advanced XML Parsing

For more robust parsing, use `xmllint`:

```yaml
      - name: Parse release feed
        id: parse-feed
        run: |
          curl -s https://github.com/dfpc-coe/CloudTAK/releases.atom > feed.xml
          
          # Extract latest release info
          TITLE=$(xmllint --xpath "//entry[1]/title/text()" feed.xml 2>/dev/null || echo "")
          LINK=$(xmllint --xpath "//entry[1]/link/@href" feed.xml 2>/dev/null | cut -d'"' -f2)
          DATE=$(xmllint --xpath "//entry[1]/published/text()" feed.xml 2>/dev/null || echo "")
          
          echo "title=$TITLE" >> $GITHUB_OUTPUT
          echo "link=$LINK" >> $GITHUB_OUTPUT
          echo "date=$DATE" >> $GITHUB_OUTPUT
```

## Benefits

- **No External Dependencies**: Uses GitHub's native RSS feeds
- **No API Rate Limits**: RSS feeds are not subject to GitHub API limits
- **Lightweight**: Simple HTTP requests, no authentication required
- **Reliable**: GitHub's RSS feeds are stable and well-maintained

## Limitations

- **Polling Delay**: Maximum frequency limited by cron schedule
- **Feed Caching**: GitHub may cache feeds, causing slight delays
- **Limited Data**: RSS feeds contain less detail than API responses

## Feed URLs for Common Repositories

| Repository | Releases Feed | Tags Feed |
|------------|---------------|-----------|
| dfpc-coe/CloudTAK | `https://github.com/dfpc-coe/CloudTAK/releases.atom` | `https://github.com/dfpc-coe/CloudTAK/tags.atom` |
| Any Repository | `https://github.com/owner/repo/releases.atom` | `https://github.com/owner/repo/tags.atom` |

## Integration with Existing Workflows

This monitoring can trigger existing workflows like:
- `sync-upstream.yml` - Sync with upstream repository
- `deploy.yml` - Deploy new version
- `test.yml` - Run integration tests

Use `gh workflow run` or repository dispatch to trigger these workflows when new releases are detected.
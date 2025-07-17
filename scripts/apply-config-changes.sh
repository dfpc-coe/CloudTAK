#!/bin/bash

set -e

echo "📄 Applying only api/lib/config.ts changes from takserver-config-env branch..."

# Get the specific file from the branch
git checkout takserver-config-env -- api/lib/config.ts

echo "✅ Changes applied but not committed!"
echo ""
echo "📋 Next steps:"
echo "   1. Review the changes: git diff api/lib/config.ts"
echo "   2. Commit when ready: git commit -m 'Apply takserver-config-env changes to config.ts'"
echo "   3. Test locally: docker-compose up"
echo "   4. Push changes: git push origin main"
#!/bin/bash

SUBCOMMAND=${1:-}

set -euo pipefail

# ── Terminal helpers ────────────────────────────────────────────────────────────
BOLD=$(tput bold 2>/dev/null || true)
GREEN=$(tput setaf 2 2>/dev/null || true)
YELLOW=$(tput setaf 3 2>/dev/null || true)
RED=$(tput setaf 1 2>/dev/null || true)
DIM=$(tput dim 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)

log_info() { printf "     %s\n" "$*"; }
log_ok()   { printf "  %b✔%b  %s\n" "$GREEN$BOLD" "$RESET" "$*"; }
log_warn() { printf "  %b⚠%b  %s\n" "$YELLOW$BOLD" "$RESET" "$*"; }
log_err()  { printf "  %b✘%b  %s\n" "$RED$BOLD" "$RESET" "$*"; }

# run_step <label> <cmd> [args…]
#   Runs <cmd> in the background, shows a spinner, prints ✔/✘ on completion.
#   On failure the captured output is printed so the user can diagnose.
run_step() {
    local label=$1; shift
    local log; log=$(mktemp)
    local spin_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0

    "$@" >"$log" 2>&1 &
    local pid=$!

    while kill -0 "$pid" 2>/dev/null; do
        printf "\r  %s  %b%s%b " \
            "${spin_chars:$i:1}" "$DIM" "$label" "$RESET"
        i=$(( (i + 1) % ${#spin_chars} ))
        sleep 0.1
    done

    local rc=0
    wait "$pid" || rc=$?

    if [[ $rc -eq 0 ]]; then
        printf "\r  %b✔%b  %s\n" "$GREEN$BOLD" "$RESET" "$label"
    else
        printf "\r  %b✘%b  %s\n" "$RED$BOLD" "$RESET" "$label"
        printf "\n  %b--- Error output ---%b\n" "$RED" "$RESET"
        cat "$log"
        printf "  %b--- End of output ---%b\n" "$RED" "$RESET"
        rm -f "$log"
        exit $rc
    fi

    rm -f "$log"
}
# ensure_env <KEY> <value>
#   Appends KEY=value to .env when KEY is absent
ensure_env() {
    if ! grep -q "^$1=" .env; then
        echo "$1=$2" >> .env
        log_ok "Added $1 to .env"
    fi
}

# Legacy MinIO data lives in .docker-store - refuse to start until it has been migrated to Garage
check_legacy_store() {
    if [[ -d .docker-store ]]; then
        log_err "Legacy MinIO data found in .docker-store - the object store is now Garage"
        log_info "Run './cloudtak.sh migrate-store' to copy your files into the new store before starting"
        exit 1
    fi
}
# ────────────────────────────────────────────────────────────────────────────────

if [[ "$SUBCOMMAND" == "install" ]]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release

        if [ "$ID" = "ubuntu" ]; then
            printf "  %b✔%b  Ubuntu detected: %s\n" "$GREEN$BOLD" "$RESET" "$PRETTY_NAME"
        else
            printf "  %b✘%b  Not Ubuntu: %s\n" "$RED$BOLD" "$RESET" "$PRETTY_NAME"
            exit 1
        fi
    else
        printf "  %b✘%b  Cannot determine OS: /etc/os-release is missing\n" "$RED$BOLD" "$RESET"
        exit 1
    fi

    # Prompt for sudo credentials upfront so background run_step calls
    # never need to show an interactive password prompt mid-spinner.
    sudo -v

    run_step "Updating package lists" sudo apt-get update -qq
    run_step "Installing base packages (git, jq, curl, caddy…)" \
        sudo apt-get install -y git jq ca-certificates curl caddy dnsutils

    run_step "Removing conflicting Docker packages" \
        sudo apt-get remove -y --ignore-missing \
            docker.io docker-doc docker-compose docker-compose-v2 \
            podman-docker containerd runc

    sudo install -m 0755 -d /etc/apt/keyrings
    run_step "Fetching Docker GPG key" \
        sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    run_step "Updating package lists (Docker repo)" sudo apt-get update -qq

    run_step "Installing Docker Engine" \
        sudo apt-get install -y \
            docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin

    run_step "Starting Docker service" sudo systemctl start docker

    # if the following command fails, check if the user is part of the docker group
    if ! docker run hello-world > /dev/null 2>&1; then
        log_warn "Docker run failed - Checking for 'docker' group"

        if getent group docker > /dev/null 2>&1; then
            log_ok "'docker' group exists"
        else
            log_info "'docker' group does not exist - creating it..."
            sudo groupadd docker
        fi

        # check if user is a member of docker group
        if id -nG "$USER" | grep -qw docker; then
            log_ok "User '$USER' is already a member of 'docker' group"
        else
            log_info "Adding user '$USER' to 'docker' group..."
            sudo usermod -aG docker $USER
        fi
    fi

    if ! docker run hello-world > /dev/null 2>&1; then
        log_err "Docker run still failed - please log out and back in, then re-run './cloudtak.sh install'"
        exit 1
    fi

    if [[ ! -f .env ]]; then
        log_info "Generating a new .env file from defaults..."
        cp .env.example .env
        log_info "Generating random SigningSecret"
        sed -i "s/^SigningSecret=.*/SigningSecret=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)/" .env
        log_info "Generating random GARAGE_RPC_SECRET"
        sed -i "s/^GARAGE_RPC_SECRET=.*/GARAGE_RPC_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')/" .env
        log_ok ".env created - please review it before starting"
    else
        log_ok ".env already exists - skipping creation"
    fi

    read -p "Enter the API_URL (e.g. map.example.com): " API_URL
    if [[ -n "$API_URL" ]]; then
        log_info "Checking DNS for $API_URL..."
        if dig +short "$API_URL" A | grep -q .; then
            log_ok "DNS check passed for $API_URL"
            sed -i "s|^API_URL=.*|API_URL=https://$API_URL|" .env
            log_ok "Updated API_URL in .env"

            PMTILES_URL="tiles.$API_URL"
            log_info "Checking DNS for $PMTILES_URL..."
            if dig +short "$PMTILES_URL" A | grep -q .; then
                log_ok "DNS check passed for $PMTILES_URL"
                sed -i "s|^PMTILES_URL=.*|PMTILES_URL=https://$PMTILES_URL|" .env
                log_ok "Updated PMTILES_URL in .env"

                CADDY_BLOCK=$(cat <<EOF

# CloudTAK app
$API_URL {
        reverse_proxy localhost:5000
}

# CloudTAK Tiles
$PMTILES_URL {
        reverse_proxy localhost:5002
}
EOF
)
                if [[ -f /etc/caddy/Caddyfile ]]; then
                    log_warn "/etc/caddy/Caddyfile already exists"
                    printf "     %b[a]%b Append CloudTAK block to existing Caddyfile\n" "$BOLD" "$RESET"
                    printf "     %b[s]%b Skip – leave Caddyfile unchanged\n" "$BOLD" "$RESET"
                    read -p "     Choice [a/s]: " CADDY_CHOICE
                    case "${CADDY_CHOICE,,}" in
                        a)
                            printf '%s\n' "$CADDY_BLOCK" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
                            log_ok "CloudTAK block appended to /etc/caddy/Caddyfile"
                            sudo systemctl reload caddy
                            ;;
                        *)
                            log_warn "Skipping Caddyfile update - configure it manually if needed"
                            ;;
                    esac
                else
                    printf '%s\n' "$CADDY_BLOCK" | sudo tee /etc/caddy/Caddyfile > /dev/null
                    log_ok "Caddyfile written to /etc/caddy/Caddyfile"
                    sudo systemctl reload caddy
                fi
            else
                log_err "DNS check failed: no A records found for $PMTILES_URL"
                log_info "Ensure DNS is configured correctly, then re-run './cloudtak.sh install'"
                exit 1
            fi
        else
            log_err "DNS check failed: no A records found for $API_URL"
            log_info "Ensure DNS is configured correctly, then re-run './cloudtak.sh install'"
            exit 1
        fi
    else
        log_warn "No API_URL provided - skipping DNS validation and .env updates"
        log_info "Set API_URL and PMTILES_URL in .env manually before starting"
    fi

    run_step "Building CloudTAK Docker images" docker compose build

elif [[ "$SUBCOMMAND" == "backup" ]]; then
    if [ ! -f .env ]; then
        log_err ".env file not found - please run './cloudtak.sh install' first"
        exit 1
    fi

    # Check if postgres container is running
    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        log_err "PostgreSQL container is not running - please start services first"
        exit 1
    fi

    mkdir -p ~/cloudtak-backups
    BACKUP_FILE=~/cloudtak-backups/cloudtak-$(date +%Y%m%d_%H%M%S).sql
    log_info "Backing up PostgreSQL database to ${BACKUP_FILE}"
    docker exec cloudtak-postgis-1 pg_dump -d $(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/') > $BACKUP_FILE
elif [[ "$SUBCOMMAND" == "restore" ]]; then
    TARGET_FILE=${2:-}
    FORCE=${3:-}

    if [ ! -f .env ]; then
        log_err ".env file not found - please run './cloudtak.sh install' first"
        exit 1
    fi

    if [[ -n "$TARGET_FILE" ]]; then
        BACKUP_FILE="$TARGET_FILE"
        if [ ! -f "$BACKUP_FILE" ]; then
            log_err "Backup file $BACKUP_FILE does not exist"
            exit 1
        fi
    else
        BACKUP_DIR=~/cloudtak-backups
        if [ ! -d "$BACKUP_DIR" ]; then
            log_err "Backup directory $BACKUP_DIR does not exist"
            exit 1
        fi

        shopt -s nullglob
        FILES=("$BACKUP_DIR"/*.sql)
        shopt -u nullglob

        if [ ${#FILES[@]} -eq 0 ]; then
            log_err "No backup files found in $BACKUP_DIR"
            exit 1
        fi

        log_info "Available backups:"
        PS3="Select a backup number to restore (or 'q' to quit): "
        select BACKUP_FILE in "${FILES[@]}"; do
            if [[ -n "$BACKUP_FILE" ]]; then
                break
            fi
            if [[ "$REPLY" == "q" || "$REPLY" == "quit" ]]; then
                log_info "Cancelled"
                exit 0
            fi
            log_warn "Invalid selection - please try again"
        done
        log_ok "Selected: $BACKUP_FILE"
    fi

    if [[ "$FORCE" != "--force" ]]; then
        read -p "WARNING: This will OVERWRITE the current database. Are you sure? (y/n): " CONFIRM
        if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi

    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        log_warn "PostgreSQL container is not running - starting it..."
        docker compose up -d postgis
        sleep 5
    fi

    DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

    log_info "Dropping existing public schema..."
    docker exec cloudtak-postgis-1 psql -d "$DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

    log_info "Restoring database from $BACKUP_FILE..."
    cat "$BACKUP_FILE" | docker exec -i cloudtak-postgis-1 psql -d "$DB_URL"

    log_ok "Restore complete"
elif [[ "$SUBCOMMAND" == "connect" ]]; then
    if [ ! -f .env ]; then
        log_err ".env file not found - please run './cloudtak.sh install' first"
        exit 1
    fi

    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        log_err "PostgreSQL container is not running - please start services first"
        exit 1
    fi

    DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

    log_info "Connection string: $DB_URL"
    log_info "Connecting to PostgreSQL database..."
    docker exec -it cloudtak-postgis-1 psql -d "$DB_URL"
elif [[ "$SUBCOMMAND" == "start" ]]; then
    if [ ! -f .env ]; then
        log_err ".env file not found - please run './cloudtak.sh install' first"
        exit 1
    fi

    check_legacy_store
    ensure_env GARAGE_RPC_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        docker compose up -d postgis
    fi

    if ! docker compose ps | grep "cloudtak-store" &> /dev/null; then
        docker compose up -d store
    fi

    docker compose up -d api events tiles media
elif [[ "$SUBCOMMAND" == "stop" ]]; then
    docker compose stop
elif [[ "$SUBCOMMAND" == "clean" ]]; then
    if ! command -v jq &> /dev/null; then
        log_err "jq not found - install it first"
        log_info "On Ubuntu: sudo apt-get install jq"
        exit 1
    fi

    PROJECT_NAME=$(docker compose config --format json | jq -r .name)
    log_info "Cleaning up unused Docker images for project: $PROJECT_NAME..."
    docker image prune --filter label=com.docker.compose.project=$PROJECT_NAME
elif [[ "$SUBCOMMAND" == "update" ]]; then
    if ! command -v git &> /dev/null; then
        log_err "git not found - install it first"
        log_info "On Ubuntu: sudo apt-get install git"
        exit 1
    fi

    if [ ! -d .git ]; then
        log_err "This directory is not a git repository - please run './cloudtak.sh install' first"
        exit 1
    fi

    log_info "Backing up database before update..."
    $0 backup
    LATEST_BACKUP=$(ls -t ~/cloudtak-backups/cloudtak-*.sql 2>/dev/null | head -n1)

    git pull

    docker compose build api --no-cache
    docker compose build events tiles media

    if [[ -d .docker-store ]]; then
        log_warn "Legacy MinIO store detected - migrating files to Garage"
        $0 migrate-store
    fi

    $0 start

    log_info "Verifying database integrity..."
    sleep 10

    if docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

        # Check table count
        if TABLE_COUNT=$(docker exec cloudtak-postgis-1 psql -d "$DB_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs); then
            log_info "Found $TABLE_COUNT tables in public schema"

            if [[ "$TABLE_COUNT" -eq 0 ]]; then
                log_warn "Database appears empty!"
                if [[ -n "$LATEST_BACKUP" && -f "$LATEST_BACKUP" ]]; then
                    log_warn "Attempting automatic restore from $LATEST_BACKUP..."
                    $0 restore "$LATEST_BACKUP" --force
                    log_ok "Automatic restore complete"
                else
                    log_err "No backup available to restore from!"
                fi
            else
                log_ok "Database integrity check passed"
            fi
        else
            log_err "Failed to check database table count"
        fi
    else
        log_warn "PostGIS container is not running - skipping database check"
    fi

    read -p "Cleanup unused docker images? (y/n): " CLEAN_CHOICE
    if [[ "$CLEAN_CHOICE" == "y" || "$CLEAN_CHOICE" == "Y" ]]; then
        $0 clean
    fi
elif [[ "$SUBCOMMAND" == "migrate-store" ]]; then
    if [ ! -f .env ]; then
        log_err ".env file not found - please run './cloudtak.sh install' first"
        exit 1
    fi

    if [[ ! -d .docker-store ]]; then
        log_ok "No legacy MinIO data in .docker-store - nothing to migrate"
        exit 0
    fi

    if ! grep -q "^MINIO_ROOT_USER=" .env || ! grep -q "^MINIO_ROOT_PASSWORD=" .env; then
        log_err "MINIO_ROOT_USER & MINIO_ROOT_PASSWORD must be set in .env to read the legacy store"
        exit 1
    fi

    BUCKET=$(grep "^ASSET_BUCKET=" .env | cut -d= -f2-)
    if [[ -z "$BUCKET" ]]; then
        log_err "ASSET_BUCKET must be set in .env"
        exit 1
    fi

    ensure_env GARAGE_RPC_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    sed -i "s|^AWS_S3_Endpoint=.*|AWS_S3_Endpoint=http://store:3900|" .env
    log_ok "AWS_S3_Endpoint now points at Garage (http://store:3900)"

    # MinIO images can no longer be pulled - reuse the one the existing store container runs from
    if [[ -z "${MINIO_LEGACY_IMAGE:-}" ]]; then
        MINIO_LEGACY_IMAGE=$(docker compose ps -a --format json store 2>/dev/null | jq -r '.Image // empty' | head -n1)
    fi
    if [[ -z "$MINIO_LEGACY_IMAGE" ]]; then
        MINIO_LEGACY_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'minio/minio:' | head -n1 || true)
    fi
    if [[ -z "$MINIO_LEGACY_IMAGE" ]]; then
        log_err "No local MinIO image found to read the legacy store with"
        log_info "Set MINIO_LEGACY_IMAGE=<image> and re-run './cloudtak.sh migrate-store'"
        exit 1
    fi
    export MINIO_LEGACY_IMAGE
    log_ok "Using legacy MinIO image $MINIO_LEGACY_IMAGE"

    log_warn "CloudTAK services will be stopped while files are copied"
    run_step "Stopping CloudTAK services" docker compose stop api events tiles retention

    run_step "Starting Garage & legacy MinIO" docker compose --profile migrate up -d --remove-orphans --pull missing store minio-legacy

    RCLONE="docker compose --profile migrate run --rm --quiet-pull migrate"

    wait_for_store() {
        for _ in $(seq 1 30); do
            if $RCLONE lsd "$1:" > /dev/null 2>&1; then return 0; fi
            sleep 2
        done
        return 1
    }
    run_step "Waiting for Garage" wait_for_store garage
    run_step "Waiting for legacy MinIO" wait_for_store minio

    run_step "Copying objects from MinIO to Garage" $RCLONE sync -v "minio:$BUCKET" "garage:$BUCKET"
    run_step "Verifying copied objects" $RCLONE check --size-only "minio:$BUCKET" "garage:$BUCKET"

    run_step "Stopping legacy MinIO" docker compose --profile migrate rm -sf minio-legacy

    ARCHIVE=".docker-store-migrated-$(date +%Y%m%d_%H%M%S)"
    mv .docker-store "$ARCHIVE"
    log_ok "Legacy MinIO data moved to $ARCHIVE"
    log_info "Once you have verified CloudTAK, reclaim the space with: sudo rm -rf $ARCHIVE"

    $0 start
else
    log_info "Usage: $0 install|start|update|stop|backup|restore|clean|connect|migrate-store"
    exit 0
fi

#!/bin/bash

SUBCOMMAND=${1:-}

set -euo pipefail

if [[ "$SUBCOMMAND" == "install" ]]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release

        if [ "$ID" = "ubuntu" ]; then
            echo "This is an Ubuntu system. ✅"
            echo "Details: $PRETTY_NAME"
        else
            echo "This is not an Ubuntu system. ❌"
            echo "OS Identified: $PRETTY_NAME"
            exit 1
        fi
    else
        echo "Cannot determine the OS, the /etc/os-release file is missing."
        exit 1
    fi

    sudo apt update
    sudo apt install -y git jq ca-certificates curl caddy dnsutils

    for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done

    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update

    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    sudo systemctl start docker

    # if the following command fails, check if the user is part of the docker group
    if ! docker run hello-world > /dev/null 2>&1; then
        echo "Docker run failed - Checking for 'docker' group"

        if getent group docker > /dev/null 2>&1; then
            echo "ok - 'docker' group exists."
        else
            echo "ok - 'docker' group does not exist. Creating 'docker' group..."
            sudo groupadd docker
        fi

        # check if user is a member of docker group
        if id -nG "$USER" | grep -qw docker; then
            echo "User '$USER' is already a member of 'docker' group."
        else
            echo "User '$USER' is not a member of 'docker' group. Adding user to 'docker' group..."
            sudo usermod -aG docker $USER
        fi
    fi

    if ! docker run hello-world > /dev/null 2>&1; then
        echo "Docker run still failed - Please log out and log back in, then re-run './cloudtak.sh install'"
        exit 1
    fi

    if [[ ! -f .env ]]; then
        echo "Generating a new .env file with default settings..."
        cp .env.example .env
        echo ".env file created. Please review and modify it as needed."

        echo "Generating Random SigningSecret"
        sed -i "s/^SigningSecret=.*/SigningSecret=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)/" .env
    else
        echo ".env file already exists. Skipping creation."
    fi

    read -p "Enter the API_URL (e.g. map.example.com): " API_URL
    if [[ -n "$API_URL" ]]; then
        echo "Checking DNS records for $API_URL..."
        if dig +short "$API_URL" A | grep -q .; then
            echo "DNS check passed: A records found for $API_URL."
            sed -i "s|^API_URL=.*|API_URL=https://$API_URL|" .env
            echo "Updated API_URL in .env"

            PMTILES_URL="tiles.$API_URL"
            echo "Checking DNS records for $PMTILES_URL..."
            if dig +short "$PMTILES_URL" A | grep -q .; then
                echo "DNS check passed: A records found for $PMTILES_URL."
                sed -i "s|^PMTILES_URL=.*|PMTILES_URL=https://$PMTILES_URL|" .env
                echo "Updated PMTILES_URL in .env"
            else
                echo "DNS check failed: No A records found for $PMTILES_URL."
                echo "Please ensure your DNS is configured correctly."
                echo "Run ./cloudtak.sh install again after fixing DNS."
                exit 1
            fi
        else
            echo "DNS check failed: No A records found for $API_URL."
            echo "Please ensure your DNS is configured correctly."
            echo "Run ./cloudtak.sh install again after fixing DNS."
            exit 1
        fi
    else
        echo "WARNING: No API_URL provided. Skipping DNS validation and .env updates for API_URL and PMTILES_URL."
        echo "You may need to manually set API_URL and PMTILES_URL in your .env file before running the application."
    fi

    docker compose build

elif [[ "$SUBCOMMAND" == "backup" ]]; then
    if [ ! -f .env ]; then
        echo ".env file not found. Please run 'install' first."
        exit 1
    fi

    # Check if postgres container is running
    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        echo "PostgreSQL container is not running. Please start the services first."
        exit 1
    fi

    mkdir -p ~/cloudtak-backups
    BACKUP_FILE=~/cloudtak-backups/cloudtak-$(date +%Y%m%d_%H%M%S).sql
    echo "Backing up PostgreSQL database to ${BACKUP_FILE}"
    docker exec cloudtak-postgis-1 pg_dump -d $(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/') > $BACKUP_FILE
elif [[ "$SUBCOMMAND" == "restore" ]]; then
    TARGET_FILE=${2:-}
    FORCE=${3:-}

    if [ ! -f .env ]; then
        echo ".env file not found. Please run 'install' first."
        exit 1
    fi

    if [[ -n "$TARGET_FILE" ]]; then
        BACKUP_FILE="$TARGET_FILE"
        if [ ! -f "$BACKUP_FILE" ]; then
            echo "Backup file $BACKUP_FILE does not exist."
            exit 1
        fi
    else
        BACKUP_DIR=~/cloudtak-backups
        if [ ! -d "$BACKUP_DIR" ]; then
            echo "Backup directory $BACKUP_DIR does not exist."
            exit 1
        fi

        shopt -s nullglob
        FILES=("$BACKUP_DIR"/*.sql)
        shopt -u nullglob

        if [ ${#FILES[@]} -eq 0 ]; then
            echo "No backup files found in $BACKUP_DIR"
            exit 1
        fi

        echo "Available backups:"
        PS3="Select a backup number to restore (or 'q' to quit): "
        select BACKUP_FILE in "${FILES[@]}"; do
            if [[ -n "$BACKUP_FILE" ]]; then
                break
            fi
            if [[ "$REPLY" == "q" || "$REPLY" == "quit" ]]; then
                echo "Cancelled."
                exit 0
            fi
            echo "Invalid selection. Please try again."
        done
        echo "You selected: $BACKUP_FILE"
    fi

    if [[ "$FORCE" != "--force" ]]; then
        read -p "WARNING: This will OVERWRITE the current database. Are you sure? (y/n): " CONFIRM
        if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
            echo "Restore cancelled."
            exit 0
        fi
    fi

    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        echo "PostgreSQL container is not running. Starting it..."
        docker compose up -d postgis
        sleep 5
    fi

    DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

    echo "Dropping existing public schema..."
    docker exec cloudtak-postgis-1 psql -d "$DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

    echo "Restoring database from $BACKUP_FILE..."
    cat "$BACKUP_FILE" | docker exec -i cloudtak-postgis-1 psql -d "$DB_URL"

    echo "Restore complete."
elif [[ "$SUBCOMMAND" == "connect" ]]; then
    if [ ! -f .env ]; then
        echo ".env file not found. Please run 'install' first."
        exit 1
    fi

    if ! docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        echo "PostgreSQL container is not running. Please start the services first."
        exit 1
    fi

    DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

    echo "Connection String: $DB_URL"
    echo "Connecting to PostgreSQL database..."
    docker exec -it cloudtak-postgis-1 psql -d "$DB_URL"
elif [[ "$SUBCOMMAND" == "start" ]]; then
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
        echo "jq could not be found, please install jq first."
        echo "On Ubuntu: sudo apt-get install jq"
        exit 1
    fi

    PROJECT_NAME=$(docker compose config --format json | jq -r .name)
    echo "Cleaning up unused Docker images for project: $PROJECT_NAME..."
    docker image prune --filter label=com.docker.compose.project=$PROJECT_NAME
elif [[ "$SUBCOMMAND" == "update" ]]; then
    if ! command -v git &> /dev/null; then
        echo "git could not be found, please install git first."
        echo "On Ubuntu: sudo apt-get install git"
        exit 1
    fi

    if [ ! -d .git ]; then
        echo "This directory is not a git repository. Please run './cloudtak.sh install' first."
        exit 1
    fi

    # Always backup database
    echo "Backing up database..."
    $0 backup
    LATEST_BACKUP=$(ls -t ~/cloudtak-backups/cloudtak-*.sql 2>/dev/null | head -n1)

    git pull

    docker compose build api --no-cache
    docker compose build events tiles media

    $0 start

    echo "Verifying database integrity..."
    sleep 10

    if docker compose ps | grep "cloudtak-postgis" &> /dev/null; then
        DB_URL=$(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis:5432/@localhost:5432/')

        # Check table count
        if TABLE_COUNT=$(docker exec cloudtak-postgis-1 psql -d "$DB_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs); then
            echo "Found $TABLE_COUNT tables in public schema."

            if [[ "$TABLE_COUNT" -eq 0 ]]; then
                echo "Database appears empty!"
                if [[ -n "$LATEST_BACKUP" && -f "$LATEST_BACKUP" ]]; then
                    echo "Attempting automatic restore from $LATEST_BACKUP..."
                    $0 restore "$LATEST_BACKUP" --force
                    echo "Automatic restore complete."
                else
                    echo "No backup available to restore from!"
                fi
            else
                echo "Database seems intact."
            fi
        else
            echo "Failed to check database table count."
        fi
    else
        echo "PostGIS container is not running. Skipping database check."
    fi

    read -p "Cleanup unused docker images? (y/n): " CLEAN_CHOICE
    if [[ "$CLEAN_CHOICE" == "y" || "$CLEAN_CHOICE" == "Y" ]]; then
        $0 clean
    fi
else
    echo "Usage: $0 install|start|update|stop|backup|restore|clean|connect"
    exit 0
fi

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
    sudo apt install -y git jq ca-certificates curl

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

    docker run hello-world

    git clone https://github.com/dfpc-coe/CloudTAK.git

    cd CloudTAK

    docker compose build

    if [[ ! -f .env ]]; then
        echo "Generating a new .env file with default settings..."
        cp .env.example .env
        echo ".env file created. Please review and modify it as needed."
    else
        echo ".env file already exists. Skipping creation."
    fi
elif [[ "$SUBCOMMAND" == "backup" ]]; then
    if [ ! -f .env ]; then
        echo ".env file not found. Please run 'install' first."
        exit 1
    fi

    # Check if postgres container is running
    if ! docker ps | grep "cloudtak-postgis" &> /dev/null; then
        echo "PostgreSQL container is not running. Please start the services first."
        exit 1
    fi

    mkdir -p ~/cloudtak-backups
    BACKUP_FILE=~/cloudtak-backups/cloudtak-$(date +%Y%m%d_%H%M%S).sql
    echo "Backing up PostgreSQL database to ${BACKUP_FILE}"
    pg_dump -d $(grep "^POSTGRES=postgres:" .env | sed 's/^POSTGRES=//' | sed 's/@postgis/@localhost/') > $BACKUP_FILE
elif [[ "$SUBCOMMAND" == "start" ]]; then
    docker compose up -d
elif [[ "$SUBCOMMAND" == "stop" ]]; then
    docker compose down
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

    # Promp if they want a backup
    read -p "Backup Database? (y/n): " BACKUP_CHOICE
    if [[ "$BACKUP_CHOICE" == "y" || "$BACKUP_CHOICE" == "Y" ]]; then
        $0 backup
    fi

    git pull

    docker compose build api --no-cache
    docker compose build events
    docker compose build tiles

    docker compose up -d
else
    echo "Usage: $0 install|start|update|stop|backup"
    exit 0
fi

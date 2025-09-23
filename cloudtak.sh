SUBCOMMAND=${1:-}

set -euo pipefail

if [ -f /etc/os-release ]; then
    . /etc/os-release

    if [ "$ID" = "ubuntu" ]; then
        echo "This is an Ubuntu system. ✅"
        echo "Details: $PRETTY_NAME"
    else
        echo "This is not an Ubuntu system. ❌"
        echo "OS Identified: $PRETTY_NAME"
    fi
else
    echo "Cannot determine the OS, the /etc/os-release file is missing."
    exit 1
fi


if [[ "$SUBCOMMAND" == "install" ]]; then
    sudo apt update
    sudo apt install -y git jq yq ca-certificates curl

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

    docker compose build
elif [[ "$SUBCOMMAND" == "update" ]]; then
    if ! command -v git &> /dev/null; then
        echo "git could not be found, please install git first."
        echo "On Ubuntu: sudo apt-get install git"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo "git could not be found, please install git first."
        echo "On Ubuntu: sudo apt-get install jq"
        exit 1
    fi

    if ! command -v yq &> /dev/null; then
        echo "git could not be found, please install yq first."
        echo "On Ubuntu: sudo apt-get install yq"
        exit 1
    fi
else
    echo "Usage: $0 install|update"
    exit 0
fi

DOCKER_UID := 1001
DOCKER_GID := 1001

.PHONY: start

start:
	DOCKER_UID=$(DOCKER_UID) DOCKER_GID=$(DOCKER_GID) docker compose down && \
	DOCKER_UID=$(DOCKER_UID) DOCKER_GID=$(DOCKER_GID) docker compose up -d

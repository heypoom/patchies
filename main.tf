terraform {
  required_version = ">= 1.5.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "4.5.0"
    }
  }
}

provider "docker" {}

resource "docker_image" "patchies" {
  name         = "patchies:latest"
  keep_locally = true

  build {
    context = path.module
    tag     = ["patchies:latest"]
  }
}

resource "docker_volume" "patchies_data" {
  name = "patchies-data"
}

resource "docker_container" "patchies" {
  name    = "patchies"
  image   = docker_image.patchies.image_id
  restart = "unless-stopped"

  ports {
    internal = 8090
    external = 8090
  }

  volumes {
    container_path = "/app/pb_data"
    volume_name    = docker_volume.patchies_data.name
  }
}

output "patchies_url" {
  value = "http://localhost:8090"
}

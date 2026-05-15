FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

COPY *.sln .

COPY Domain/*.csproj Domain/
COPY Application/*.csproj Application/
COPY Infrastructure/*.csproj Infrastructure/
COPY Api/*.csproj Api/
COPY tests/Yalla.Api.IntegrationTests/*.csproj tests/Yalla.Api.IntegrationTests/
COPY tests/Yalla.Application.UnitTests/*.csproj tests/Yalla.Application.UnitTests/
RUN dotnet restore

COPY . .

WORKDIR /src/Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0

# curl: needed by the compose healthcheck (hits /api/health).
# libfontconfig1: pulled in by SkiaSharp / receipt-PDF rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Drop privileges: Microsoft's aspnet:9.0 base image already ships
# with a non-root `app` user (uid 1654) precisely for this purpose,
# so we just reuse it instead of minting our own. The intent is the
# same as the playbook calls for — if something pwns the API process
# inside the container, it can't write to /app, can't apt-install
# implants, and can't trivially break out via the docker socket
# (which we never mount anyway).

WORKDIR /app

# Copy the publish output owned by `app:app` from the get-go so the
# runner doesn't need a chown layer later.
COPY --from=build --chown=app:app /app/publish .

USER app

EXPOSE 8080

ENTRYPOINT ["dotnet", "Api.dll"]

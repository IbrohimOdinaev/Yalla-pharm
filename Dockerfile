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

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "Api.dll"]

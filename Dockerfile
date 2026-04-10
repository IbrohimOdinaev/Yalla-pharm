FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

COPY yalla-back/*.sln .

COPY yalla-back/Domain/*.csproj Domain/
COPY yalla-back/Application/*.csproj Application/
COPY yalla-back/Infrastructure/*.csproj Infrastructure/
COPY yalla-back/Api/*.csproj Api/
COPY yalla-back/tests/Yalla.Api.IntegrationTests/*.csproj tests/Yalla.Api.IntegrationTests/
COPY yalla-back/tests/Yalla.Application.UnitTests/*.csproj tests/Yalla.Application.UnitTests/
RUN dotnet restore

COPY yalla-back/ .

WORKDIR /src/Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "Api.dll"]

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files for caching restore layer
COPY ["Brantas.sln", "./"]
COPY ["src/Brantas.Domain/Brantas.Domain.csproj", "src/Brantas.Domain/"]
COPY ["src/Brantas.Application/Brantas.Application.csproj", "src/Brantas.Application/"]
COPY ["src/Brantas.Infrastructure/Brantas.Infrastructure.csproj", "src/Brantas.Infrastructure/"]
COPY ["src/Brantas.Analytics/Brantas.Analytics.csproj", "src/Brantas.Analytics/"]
COPY ["src/Brantas.Api/Brantas.Api.csproj", "src/Brantas.Api/"]

RUN dotnet restore "src/Brantas.Api/Brantas.Api.csproj"

# Copy source and publish
COPY src/ src/
WORKDIR "/src/src/Brantas.Api"
RUN dotnet publish "Brantas.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    libgdiplus \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5025
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5025

ENTRYPOINT ["dotnet", "Brantas.Api.dll"]

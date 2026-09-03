FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .

# The daily report shells out to the Claude Code CLI itself, riding the Pro
# subscription rather than a metered API key. Its login state lives under
# $HOME, so that has to be a real, persisted directory rather than whatever
# the base image defaults root's home to.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code
ENV HOME=/root

ENTRYPOINT ["dotnet", "backend.dll"]

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiar proyectos y restaurar dependencias
COPY ["backend/src/Store.Api/Store.Api.csproj", "backend/src/Store.Api/"]
COPY ["backend/src/Store.Application/Store.Application.csproj", "backend/src/Store.Application/"]
COPY ["backend/src/Store.Domain/Store.Domain.csproj", "backend/src/Store.Domain/"]
COPY ["backend/src/Store.Infrastructure/Store.Infrastructure.csproj", "backend/src/Store.Infrastructure/"]

RUN dotnet restore "backend/src/Store.Api/Store.Api.csproj"

# Copiar código fuente y compilar
COPY backend/src/ ./backend/src/
WORKDIR "/src/backend/src/Store.Api"
RUN dotnet publish "Store.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Imagen final ligera de ejecución
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Store.Api.dll"]

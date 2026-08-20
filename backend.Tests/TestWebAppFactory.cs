using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public class TestWebAppFactory : WebApplicationFactory<Program>
{
    private readonly Action<IServiceCollection>? _configure;
    private readonly Dictionary<string, string?> _settings;

    public TestWebAppFactory(
        Action<IServiceCollection>? configure = null,
        Dictionary<string, string?>? settings = null)
    {
        _configure = configure;
        _settings = settings ?? [];
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development, not "Testing": outside development the auth cookie is
        // marked Secure, and the test server speaks plain http, so the client
        // would never send it back and every authenticated call would 401.
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["Auth:AllowRegistration"] = "true",
            };
            foreach (var (key, value) in _settings) settings[key] = value;
            config.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            var toRemove = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                    d.ServiceType == typeof(AppDbContext) ||
                    d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>) ||
                    d.ServiceType.FullName?.Contains("DbContextOptionsConfiguration") == true)
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            var dbName = Guid.NewGuid().ToString();
            var dbRoot = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
            services.AddDbContext<AppDbContext>(opts =>
                opts.UseInMemoryDatabase(dbName, dbRoot).EnableServiceProviderCaching(false));

            _configure?.Invoke(services);
        });
    }
}

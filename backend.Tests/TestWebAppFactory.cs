using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public class TestWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:AllowRegistration"] = "true",
            });
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
        });
    }
}

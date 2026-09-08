using Brantas.Application.Assistant;
using Brantas.Infrastructure.Assistant;
using Brantas.Application.Data;
using Brantas.Infrastructure.Data;
using Brantas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Brantas.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("BrantasDatabase")
            ?? throw new InvalidOperationException("Connection string BrantasDatabase belum dikonfigurasi.");

        services.AddDbContext<BrantasDbContext>(options => options
            .UseNpgsql(connectionString)
            .ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));
        services.AddScoped<ISyntheticDataSeeder, SyntheticDataSeeder>();
        services.AddHttpClient<IBrantasAssistant, LlmGatewayAssistant>();
        return services;
    }
}
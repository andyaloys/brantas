using Brantas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Brantas.Infrastructure.Persistence;

public sealed class BrantasDbContext(DbContextOptions<BrantasDbContext> options) : DbContext(options)
{
    public DbSet<DatasetVersion> DatasetVersions => Set<DatasetVersion>();
    public DbSet<Region> Regions => Set<Region>();
    public DbSet<PovertyIndicator> PovertyIndicators => Set<PovertyIndicator>();
    public DbSet<FiscalAllocation> FiscalAllocations => Set<FiscalAllocation>();
    public DbSet<Anomaly> Anomalies => Set<Anomaly>();
    public DbSet<AnomalyReview> AnomalyReviews => Set<AnomalyReview>();
    public DbSet<SyntheticGroundTruth> SyntheticGroundTruths => Set<SyntheticGroundTruth>();
    public DbSet<BeneficiaryRecord> BeneficiaryRecords => Set<BeneficiaryRecord>();
    public DbSet<WelfareCoverage> WelfareCoverages => Set<WelfareCoverage>();
    public DbSet<SimulationScenario> SimulationScenarios => Set<SimulationScenario>();
    public DbSet<AllocationResult> AllocationResults => Set<AllocationResult>();
    public DbSet<PolicyImpactPanel> PolicyImpactPanels => Set<PolicyImpactPanel>();
    public DbSet<PolicyImpactGroundTruth> PolicyImpactGroundTruths => Set<PolicyImpactGroundTruth>();
    public DbSet<AssistantAuditLog> AssistantAuditLogs => Set<AssistantAuditLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Action).HasMaxLength(80);
            entity.Property(item => item.ActorRole).HasMaxLength(40);
            entity.Property(item => item.ActorRegion).HasMaxLength(160);
            entity.Property(item => item.DetailsJson).HasColumnType("jsonb");
            entity.HasIndex(item => item.OccurredAt);
        });
        modelBuilder.Entity<DatasetVersion>(entity =>
        {
            entity.ToTable("dataset_versions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.SourceSet).HasMaxLength(100);
            entity.Property(item => item.Period).HasMaxLength(20);
            entity.Property(item => item.Checksum).HasMaxLength(128);
        });
        modelBuilder.Entity<Region>(entity =>
        {
            entity.ToTable("regions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.BpsCode).HasMaxLength(16);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.Property(item => item.Latitude).HasPrecision(9, 6);
            entity.Property(item => item.Longitude).HasPrecision(9, 6);
            entity.HasIndex(item => new { item.BpsCode, item.Level }).IsUnique();
            entity.HasOne(item => item.Parent).WithMany(item => item.Children).HasForeignKey(item => item.ParentId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<PovertyIndicator>(entity =>
        {
            entity.ToTable("poverty_indicators");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Period).HasMaxLength(20);
            entity.Property(item => item.PovertyRate).HasPrecision(7, 4);
            entity.Property(item => item.PovertyDepthIndex).HasPrecision(7, 4);
            entity.Property(item => item.PovertySeverityIndex).HasPrecision(7, 4);
            entity.Property(item => item.HumanDevelopmentIndex).HasPrecision(7, 4);
            entity.Property(item => item.GdpPerCapita).HasPrecision(16, 2);
            entity.HasIndex(item => new { item.RegionId, item.DatasetVersionId, item.Period }).IsUnique();
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<FiscalAllocation>(entity =>
        {
            entity.ToTable("fiscal_allocations");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.TotalAllocation).HasPrecision(18, 2);
            entity.HasIndex(item => new { item.RegionId, item.DatasetVersionId }).IsUnique();
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<Anomaly>(entity =>
        {
            entity.ToTable("anomalies");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.ConfidenceScore).HasPrecision(5, 2);
            entity.Property(item => item.ZScore).HasPrecision(7, 4);
            entity.Property(item => item.ValueAtRisk).HasPrecision(18, 2);
            entity.Property(item => item.Explanation).HasMaxLength(600);
            entity.HasIndex(item => new { item.DatasetVersionId, item.Severity });
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<AnomalyReview>(entity =>
        {
            entity.ToTable("anomaly_reviews");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => item.AnomalyId).IsUnique();
            entity.HasOne(item => item.Anomaly).WithMany().HasForeignKey(item => item.AnomalyId);
        });
        modelBuilder.Entity<SyntheticGroundTruth>(entity =>
        {
            entity.ToTable("synthetic_ground_truth");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => new { item.RegionId, item.DatasetVersionId, item.ExpectedType }).IsUnique();
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<BeneficiaryRecord>(entity =>
        {
            entity.ToTable("beneficiary_records");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.NikHash).HasMaxLength(64);
            entity.Property(item => item.NkkHash).HasMaxLength(64);
            entity.Property(item => item.Program).HasMaxLength(40);
            entity.HasIndex(item => new { item.DatasetVersionId, item.NikHash });
            entity.HasIndex(item => new { item.DatasetVersionId, item.RegionId });
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<WelfareCoverage>(entity =>
        {
            entity.ToTable("welfare_coverages");
            entity.HasKey(item => item.Id);
            entity.HasIndex(item => new { item.RegionId, item.DatasetVersionId }).IsUnique();
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<SimulationScenario>(entity =>
        {
            entity.ToTable("simulation_scenarios");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Name).HasMaxLength(160);
            entity.Property(item => item.WeightsJson).HasColumnType("jsonb");
            entity.Property(item => item.ConstraintsJson).HasColumnType("jsonb");
            entity.Property(item => item.TotalBudget).HasPrecision(18, 2);
            entity.HasIndex(item => new { item.DatasetVersionId, item.CreatedAt });
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<AllocationResult>(entity =>
        {
            entity.ToTable("allocation_results");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.VulnerabilityIndex).HasPrecision(9, 6);
            entity.Property(item => item.BaselineAmount).HasPrecision(18, 2);
            entity.Property(item => item.RecommendedAmount).HasPrecision(18, 2);
            entity.HasIndex(item => new { item.ScenarioId, item.RegionId }).IsUnique();
            entity.HasOne(item => item.Scenario).WithMany(item => item.Results).HasForeignKey(item => item.ScenarioId);
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
        });
        modelBuilder.Entity<PolicyImpactPanel>(entity =>
        {
            entity.ToTable("policy_impact_panel");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.SocialProtectionAllocation).HasPrecision(18, 2);
            entity.Property(item => item.PovertyRate).HasPrecision(7, 4);
            entity.HasIndex(item => new { item.RegionId, item.DatasetVersionId, item.Year }).IsUnique();
            entity.HasOne(item => item.Region).WithMany().HasForeignKey(item => item.RegionId);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<PolicyImpactGroundTruth>(entity =>
        {
            entity.ToTable("policy_impact_ground_truth");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.PlantedEffectPercentagePoints).HasPrecision(7, 4);
            entity.HasIndex(item => item.DatasetVersionId).IsUnique();
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
        modelBuilder.Entity<AssistantAuditLog>(entity =>
        {
            entity.ToTable("assistant_audit_logs");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.RequestHash).HasMaxLength(64);
            entity.Property(item => item.Outcome).HasMaxLength(40);
            entity.HasIndex(item => item.OccurredAt);
            entity.HasOne(item => item.DatasetVersion).WithMany().HasForeignKey(item => item.DatasetVersionId);
        });
    }
}
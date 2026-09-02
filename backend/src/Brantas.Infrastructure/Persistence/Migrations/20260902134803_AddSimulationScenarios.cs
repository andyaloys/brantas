using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulationScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "simulation_scenarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    WeightsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ConstraintsJson = table.Column<string>(type: "jsonb", nullable: false),
                    TotalBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_simulation_scenarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_simulation_scenarios_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "allocation_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScenarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    VulnerabilityIndex = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: false),
                    BaselineAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RecommendedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_allocation_results", x => x.Id);
                    table.ForeignKey(
                        name: "FK_allocation_results_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_allocation_results_simulation_scenarios_ScenarioId",
                        column: x => x.ScenarioId,
                        principalTable: "simulation_scenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_allocation_results_RegionId",
                table: "allocation_results",
                column: "RegionId");

            migrationBuilder.CreateIndex(
                name: "IX_allocation_results_ScenarioId_RegionId",
                table: "allocation_results",
                columns: new[] { "ScenarioId", "RegionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_simulation_scenarios_DatasetVersionId_CreatedAt",
                table: "simulation_scenarios",
                columns: new[] { "DatasetVersionId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "allocation_results");

            migrationBuilder.DropTable(
                name: "simulation_scenarios");
        }
    }
}

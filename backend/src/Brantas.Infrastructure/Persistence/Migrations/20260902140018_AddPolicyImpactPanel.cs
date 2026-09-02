using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPolicyImpactPanel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "policy_impact_ground_truth",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlantedEffectPercentagePoints = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    TreatmentStartYear = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_impact_ground_truth", x => x.Id);
                    table.ForeignKey(
                        name: "FK_policy_impact_ground_truth_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "policy_impact_panel",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    IsTreated = table.Column<bool>(type: "boolean", nullable: false),
                    SocialProtectionAllocation = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PovertyRate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_impact_panel", x => x.Id);
                    table.ForeignKey(
                        name: "FK_policy_impact_panel_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_policy_impact_panel_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_policy_impact_ground_truth_DatasetVersionId",
                table: "policy_impact_ground_truth",
                column: "DatasetVersionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_policy_impact_panel_DatasetVersionId",
                table: "policy_impact_panel",
                column: "DatasetVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_policy_impact_panel_RegionId_DatasetVersionId_Year",
                table: "policy_impact_panel",
                columns: new[] { "RegionId", "DatasetVersionId", "Year" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "policy_impact_ground_truth");

            migrationBuilder.DropTable(
                name: "policy_impact_panel");
        }
    }
}

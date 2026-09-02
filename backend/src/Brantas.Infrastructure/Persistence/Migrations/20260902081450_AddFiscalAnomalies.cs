using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Brantas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFiscalAnomalies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "anomalies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    ConfidenceScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    ZScore = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    ValueAtRisk = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Explanation = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    DetectedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_anomalies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_anomalies_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_anomalies_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fiscal_allocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TotalAllocation = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fiscal_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fiscal_allocations_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_fiscal_allocations_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "synthetic_ground_truth",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RegionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatasetVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpectedType = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_synthetic_ground_truth", x => x.Id);
                    table.ForeignKey(
                        name: "FK_synthetic_ground_truth_dataset_versions_DatasetVersionId",
                        column: x => x.DatasetVersionId,
                        principalTable: "dataset_versions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_synthetic_ground_truth_regions_RegionId",
                        column: x => x.RegionId,
                        principalTable: "regions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_anomalies_DatasetVersionId_Severity",
                table: "anomalies",
                columns: new[] { "DatasetVersionId", "Severity" });

            migrationBuilder.CreateIndex(
                name: "IX_anomalies_RegionId",
                table: "anomalies",
                column: "RegionId");

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_allocations_DatasetVersionId",
                table: "fiscal_allocations",
                column: "DatasetVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_fiscal_allocations_RegionId_DatasetVersionId",
                table: "fiscal_allocations",
                columns: new[] { "RegionId", "DatasetVersionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_synthetic_ground_truth_DatasetVersionId",
                table: "synthetic_ground_truth",
                column: "DatasetVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_synthetic_ground_truth_RegionId_DatasetVersionId_ExpectedTy~",
                table: "synthetic_ground_truth",
                columns: new[] { "RegionId", "DatasetVersionId", "ExpectedType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "anomalies");

            migrationBuilder.DropTable(
                name: "fiscal_allocations");

            migrationBuilder.DropTable(
                name: "synthetic_ground_truth");
        }
    }
}
